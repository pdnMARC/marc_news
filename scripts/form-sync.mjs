// News form → pull requests. Run by .github/workflows/form-sync.yml every night at 00:00
// Sri Lanka time, or by hand ("Run workflow").
//
// Reads the Google Form's response sheet (CSV link in FORM_RESPONSES_CSV, from the NEWS_FORM_CSV_LINK
// secret). Every response that has not been handled yet becomes a pull request on branch
// news-form/<id> with the new or changed article and its photos; a response that can't be used
// becomes an issue instead. A response whose pull request or issue exists (open, merged or closed) is
// never proposed again, so closing a pull request rejects that submission for good.
// Setup: google-form/README.md.
//
// Try it locally without git or GitHub (changes are written to the working tree):
//   DRY_RUN=1 FORM_RESPONSES_CSV=path/to/responses.csv node scripts/form-sync.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const Q = JSON.parse(fs.readFileSync(new URL("../google-form/questions.json", import.meta.url), "utf8"));
const DRY = process.env.DRY_RUN === "1";
const ROOT = process.cwd();
const ARTICLES = path.join(ROOT, "articles");
const PHOTOS = path.join(ARTICLES, "cover_photos");
// The only front matter fields scripts/validate-news.mjs allows, in the order the form writes them.
const FIELDS = ["title", "date", "cover", "short", "vacancy", "deadline", "apply"];

/** A problem with the answers (or a photo): reported in an issue instead of a pull request. */
class SubmissionError extends Error {}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/* ── Responses ─────────────────────────────────────────────────────────────── */

async function readSource(source) {
  if (!/^https?:\/\//.test(source)) return fs.readFileSync(source, "utf8");
  const res = await fetch(source, { redirect: "follow", headers: { "Cache-Control": "no-cache" } });
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error(`Could not read the response sheet (${res.status}). Is it shared as "Anyone with the link"? (google-form/README.md)`);
  }
  return text;
}

/** RFC 4180 CSV → objects keyed by the (trimmed) header row. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header = [], ...data] = rows;
  return data
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** Answer by question title, ignoring upper/lower case (the sheet may write "Email Address"). */
const answer = (row, title) => {
  const key = Object.keys(row).find((k) => k.toLowerCase() === title.toLowerCase());
  return key ? row[key] : "";
};

/** Stable id of a response. */
export const responseId = (row) =>
  crypto
    .createHash("sha1")
    .update([answer(row, Q.timestamp), answer(row, Q.submitter), answer(row, Q.title), answer(row, Q.article)].join("|").toLowerCase())
    .digest("hex")
    .slice(0, 10);

/* ── Articles ──────────────────────────────────────────────────────────────── */

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
/** YYYY-MM-DD for a front matter date (YAML reads unquoted dates as Date objects). */
const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : clean(v));
const isDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const pad = (n) => String(n).padStart(2, "0");
const STOP_WORDS = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "the", "to", "with"]);

/** "MARC Researchers Win the Best Paper Award!" → "marc-researchers-win-best-paper-award" (at most six words). */
export function slugify(title) {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const kept = words.filter((w) => !STOP_WORDS.has(w));
  return (kept.length ? kept : words).slice(0, 6).join("-").slice(0, 60).replace(/-+$/, "") || "news";
}

/** Form text → Markdown: each line is a paragraph, and consecutive "- " / "1. " lines stay one list. */
export function toMarkdown(text) {
  const blocks = [];
  let list = null;
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      list = null;
      continue;
    }
    if (/^([-*•]|\d+[.)])\s+/.test(line)) {
      const item = line.replace(/^•\s*/, "- ");
      if (list) list.push(item);
      else blocks.push((list = [item]));
      continue;
    }
    list = null;
    blocks.push([line]);
  }
  return blocks.map((b) => b.join("\n")).join("\n\n");
}

function readArticles() {
  return fs
    .readdirSync(ARTICLES)
    .filter((f) => /\.md$/i.test(f) && f.toLowerCase() !== "readme.md")
    .map((file) => {
      const raw = fs.readFileSync(path.join(ARTICLES, file), "utf8");
      const parsed = matter(raw);
      return { file, raw, data: parsed.data, body: parsed.content.trim() };
    });
}

/** The article a website link (…/news/<file name>/) or a file name points to. */
function findArticle(articles, link) {
  const slug = (link.match(/\/news\/([^/?#\s]+)/) || [])[1] ?? link.replace(/\.md$/i, "").split("/").filter(Boolean).pop() ?? "";
  const wanted = decodeURIComponent(slug).toLowerCase();
  return articles.find((a) => a.file.replace(/\.md$/i, "").toLowerCase() === wanted);
}

/** [text, "## Photos" section]: the form replaces the text but keeps the photos. */
function splitBody(body) {
  const m = body.match(/^## Photos[ \t]*$/m);
  return m ? [body.slice(0, m.index).trim(), body.slice(m.index).trim()] : [body.trim(), ""];
}

/** Same layout as the hand-written articles. */
export function articleMarkdown(d, body) {
  const q = (s) => JSON.stringify(String(s)); // a JSON string is a valid double-quoted YAML string
  const out = ["---", `title: ${q(d.title)}`, `date: ${d.date}`];
  if (d.cover) out.push(`cover: ${d.cover}`);
  out.push(`short: ${q(d.short)}`);
  if (d.vacancy) {
    out.push("vacancy: true");
    if (d.deadline) out.push(`deadline: ${d.deadline}`);
    if (d.apply) out.push(`apply: ${q(d.apply)}`);
  }
  out.push("---");
  return out.join("\n") + "\n" + (body ? "\n" + body.trim() + "\n" : "");
}

async function photoJpeg(cell) {
  let bytes;
  if (cell.startsWith("file:")) {
    bytes = fs.readFileSync(new URL(cell)); // local tries only
  } else {
    const id = (cell.match(/[?&]id=([\w-]+)/) || cell.match(/\/d\/([\w-]+)/) || [])[1];
    if (!id) throw new SubmissionError("A photo link in the response could not be read.");
    const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, { redirect: "follow" });
    if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) {
      throw new SubmissionError(
        "A photo could not be downloaded. Check that the form's upload folders are shared as \"Anyone with the link\" (google-form/README.md, step 4).",
      );
    }
    bytes = Buffer.from(await res.arrayBuffer());
  }
  const { default: sharp } = await import("sharp");
  try {
    // Upright, at most 1600 × 1600, as JPEG. sharp drops EXIF data (camera, location) by default.
    return await sharp(bytes).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch {
    throw new SubmissionError("A photo is not an image we can use. Please upload JPG, PNG or WebP files.");
  }
}

/** Writes the response's article (and photos) into the working tree. Returns a summary for the pull request. */
export async function applyResponse(row) {
  const wantsChange = answer(row, Q.action) === Q.actionChange;
  const articles = readArticles();
  const link = clean(answer(row, Q.article));
  let existing;
  if (wantsChange) {
    if (!link) throw new SubmissionError("A change to a published article needs the link to that article.");
    existing = findArticle(articles, link);
    if (!existing) throw new SubmissionError(`No article has the address ${link}. Copy the link from the article's page on the website.`);
    const unknown = Object.keys(existing.data).filter((k) => !FIELDS.includes(k));
    if (unknown.length) throw new SubmissionError(`${existing.file} has fields the form can't edit (${unknown.join(", ")}). Change it on GitHub instead.`);
  }
  const isUpdate = Boolean(existing);
  const base = existing?.data ?? {};

  // An answer replaces the current value and a blank keeps it.
  const d = {
    title: clean(answer(row, Q.title)) || clean(base.title),
    date: clean(answer(row, Q.date)) || isoDay(base.date),
    short: clean(answer(row, Q.short)) || clean(base.short),
    cover: clean(base.cover),
  };
  if (!d.title) throw new SubmissionError("A new article needs a title.");
  if (!d.date) throw new SubmissionError("A new article needs a date.");
  if (!isDate(d.date)) throw new SubmissionError(`"${d.date}" is not a real date written as YYYY-MM-DD.`);
  if (!d.short) throw new SubmissionError("A new article needs a summary.");
  const clash = articles.find((a) => a !== existing && clean(a.data.title).toLowerCase() === d.title.toLowerCase());
  if (clash) {
    const hint = isUpdate ? "" : ` If this corrects that article, send the form again and choose "${Q.actionChange}".`;
    throw new SubmissionError(`The title "${d.title}" is already used by ${clash.file}.${hint}`);
  }

  const notes = [];
  const vacancy = answer(row, Q.vacancy);
  const deadline = clean(answer(row, Q.deadline));
  const apply = clean(answer(row, Q.apply)).replace(/^(?!mailto:)([^\s@:/]+@[^\s@]+\.[^\s@]+)$/, "mailto:$1");
  d.vacancy = vacancy === Q.vacancyYes ? true : vacancy === Q.vacancyNo ? false : base.vacancy === true || (!isUpdate && Boolean(deadline || apply));
  if (d.vacancy) {
    d.deadline = deadline || isoDay(base.deadline);
    d.apply = apply || clean(base.apply);
    if (d.deadline && !isDate(d.deadline)) throw new SubmissionError(`The deadline "${d.deadline}" is not a real date written as YYYY-MM-DD.`);
    if (d.apply && !/^(https?:\/\/|mailto:)\S+$/.test(d.apply)) throw new SubmissionError(`"${d.apply}" is not a link (https://…) or an email address.`);
  } else if (deadline || apply) {
    notes.push("The deadline and application link were left out because the article is not marked as a vacancy.");
  }

  let file = existing?.file;
  if (!file) {
    const stem = `${d.date}-${slugify(d.title)}`;
    file = `${stem}.md`;
    const taken = (f) => articles.some((a) => a.file.toLowerCase() === f.toLowerCase()) || fs.existsSync(path.join(PHOTOS, f.replace(/\.md$/, "")));
    for (let n = 2; taken(file); n++) file = `${stem}-${n}.md`;
  }
  const slug = file.replace(/\.md$/i, "");

  // Photos go in cover_photos/<article>/01.jpg, 02.jpg, … after any already there.
  const folder = path.join(PHOTOS, slug);
  let next = 1 + Math.max(0, ...(fs.existsSync(folder) ? fs.readdirSync(folder).map((f) => parseInt(f, 10)).filter(Number.isFinite) : []));
  const savePhoto = async (cell) => {
    const jpeg = await photoJpeg(cell);
    fs.mkdirSync(folder, { recursive: true });
    const name = `${pad(next++)}.jpg`;
    fs.writeFileSync(path.join(folder, name), jpeg);
    return `./cover_photos/${slug}/${name}`;
  };

  const changes = [];
  const oldCover = d.cover;
  const coverCell = answer(row, Q.cover).split(/,\s*/)[0];
  if (coverCell) {
    d.cover = await savePhoto(coverCell);
    changes.push("cover photo");
  }
  const descriptions = String(answer(row, Q.photoDescriptions)).split(/\r?\n/).map(clean).filter(Boolean);
  const added = [];
  for (const [i, cell] of answer(row, Q.photos).split(/,\s*/).filter(Boolean).entries()) {
    added.push({ src: await savePhoto(cell), alt: (descriptions[i] || "").replace(/[[\]]/g, "") });
  }
  if (added.length) changes.push(`${added.length} more photo${added.length > 1 ? "s" : ""}`);

  const [oldText, oldPhotos] = splitBody(existing?.body ?? "");
  const newText = toMarkdown(answer(row, Q.body));
  const gallery = added.map((p) => `![${p.alt}](${p.src})`);
  const photosSection = [oldPhotos || (gallery.length ? "## Photos" : ""), ...gallery].filter(Boolean).join("\n\n");
  const body = [newText || oldText, photosSection].filter(Boolean).join("\n\n");
  if (!newText && !oldText) notes.push("There is no article text, so the article page shows only the summary.");

  // A replaced cover is deleted unless another article, or this one's text, still shows it.
  if (coverCell && oldCover) {
    const oldFile = path.resolve(ARTICLES, oldCover);
    const used = body.includes(oldCover) || articles.some((a) => a !== existing && a.raw.includes(oldCover));
    if (!used && oldFile.startsWith(PHOTOS + path.sep) && fs.existsSync(oldFile)) {
      fs.rmSync(oldFile);
      notes.push(`The previous cover photo (${oldCover}) was deleted.`);
    }
  }

  if (isUpdate) {
    if (clean(base.title) !== d.title) changes.push("title");
    if (isoDay(base.date) !== d.date) changes.push("date");
    if (clean(base.short) !== d.short) changes.push("summary");
    if (newText && newText !== oldText) changes.push("article text");
    if ((base.vacancy === true) !== d.vacancy || (d.vacancy && (isoDay(base.deadline) !== d.deadline || clean(base.apply) !== d.apply))) {
      changes.push("vacancy details");
    }
    if (!changes.length) throw new SubmissionError("The answers don't change anything in the article.");
  } else {
    changes.unshift("new article");
  }

  fs.writeFileSync(path.join(ARTICLES, file), articleMarkdown(d, body));
  return {
    file: `articles/${file}`,
    slug,
    title: d.title,
    isUpdate,
    changes,
    notes,
    submitter: clean(answer(row, Q.submitter)).toLowerCase(),
    photos: Boolean(coverCell) || added.length > 0,
    undescribed: added.filter((p) => !p.alt).length,
    vacancy: d.vacancy,
  };
}

/* ── Git and GitHub ────────────────────────────────────────────────────────── */

function handledIds() {
  const ids = new Set();
  const add = (s) => {
    const m = String(s).match(/news-form\/([0-9a-f]{10})\b|response ([0-9a-f]{10})\b/);
    if (m) ids.add(m[1] || m[2]);
  };
  JSON.parse(run("gh", ["pr", "list", "--state", "all", "--limit", "1000", "--json", "headRefName"])).forEach((p) => add(p.headRefName));
  JSON.parse(run("gh", ["issue", "list", "--state", "all", "--limit", "1000", "--search", "News form response in:title", "--json", "title"])).forEach((i) => add(i.title));
  run("git", ["ls-remote", "--heads", "origin", "news-form/*"]).split("\n").forEach(add);
  return ids;
}

function validate() {
  try {
    return { ok: true, output: run("node", ["scripts/validate-news.mjs"]) };
  } catch (err) {
    return { ok: false, output: `${err.stdout || ""}${err.stderr || ""}`.trim() };
  }
}

function prBody(id, s, check) {
  return [
    `Submitted through the MARC news form (response \`${id}\`).`,
    "",
    `- **File:** \`${s.file}\`${s.isUpdate ? "" : " (new)"}`,
    `- **Changes:** ${s.changes.join(", ")}`,
    `- **Submitted from:** ${s.submitter || "(no email collected)"}`,
    ...s.notes.map((n) => `- **Note:** ${n}`),
    `- **Validator:** ${check.ok ? "✅ passed" : "❌ failed"}`,
    check.ok ? null : "\n```\n" + check.output + "\n```",
    "",
    "Before merging:",
    "- [ ] The sender is at MARC, and the text is accurate and suitable for the public website.",
    s.photos ? "- [ ] MARC may publish the photos, and anyone recognisable in them agreed." : null,
    s.undescribed
      ? `- [ ] ${s.undescribed} photo(s) have no description: write what each one shows inside the square brackets of its \`![](…)\` line.`
      : null,
    s.isUpdate
      ? null
      : `- [ ] The address will be \`/news/${s.slug}/\`. To change it, rename the file, its photo folder and the photo paths now: it shouldn't change once published.`,
    s.vacancy ? "- [ ] The deadline and the application link are right." : null,
    "",
    "Merge to publish, or close to reject (this response won't be proposed again).",
    "Checks don't start by themselves on pull requests opened by a workflow; the validator result above is from this run.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function withBodyFile(text, fn) {
  const file = path.join(os.tmpdir(), `form-sync-${process.pid}.md`);
  fs.writeFileSync(file, text);
  try {
    return fn(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/* ── Main ──────────────────────────────────────────────────────────────────── */

async function main() {
  const source = process.env.FORM_RESPONSES_CSV;
  if (!source) {
    console.log("FORM_RESPONSES_CSV is not set: nothing to do (google-form/README.md, step 5).");
    return;
  }
  const rows = parseCsv(await readSource(source));
  const handled = DRY ? new Set() : handledIds();
  const todo = rows.filter((row) => !handled.has(responseId(row)));
  console.log(`${rows.length} response(s), ${todo.length} new.`);

  for (const row of todo) {
    const id = responseId(row);
    const branch = `news-form/${id}`;
    if (!DRY) {
      // Start every response from main, dropping whatever an earlier unusable response left behind.
      run("git", ["reset", "--hard"]);
      run("git", ["clean", "-fd", "articles"]);
      run("git", ["checkout", "-B", branch, "origin/main"]);
    }
    try {
      const summary = await applyResponse(row);
      const check = validate();
      console.log(`${id}: ${summary.isUpdate ? "update" : "new"} ${summary.file} (${summary.changes.join(", ")}), validator ${check.ok ? "passed" : "failed"}`);
      if (DRY) continue;
      run("git", ["add", "-A", "articles"]);
      run("git", ["commit", "-m", `${summary.isUpdate ? "Update" : "Add"} news: ${summary.title} (news form ${id})`]);
      run("git", ["push", "-u", "origin", branch]);
      withBodyFile(prBody(id, summary, check), (bodyFile) =>
        run("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", `${summary.isUpdate ? "Update" : "Add"} news: ${summary.title}`, "--body-file", bodyFile, ...(check.ok ? [] : ["--draft"])]),
      );
    } catch (err) {
      if (!(err instanceof SubmissionError)) throw err;
      console.log(`${id}: not usable: ${err.message}`);
      if (DRY) continue;
      const who = clean(answer(row, Q.submitter)) || "(unknown)";
      withBodyFile(
        [
          `A news form response could not be turned into a pull request.`,
          "",
          `- **Problem:** ${err.message}`,
          `- **Submitted:** ${answer(row, Q.timestamp)} from ${who}`,
          clean(answer(row, Q.title)) ? `- **Title:** ${clean(answer(row, Q.title))}` : null,
          "",
          "Contact the person if needed, then close this issue. The response won't be processed again; they can send the form again.",
        ]
          .filter((l) => l !== null)
          .join("\n"),
        (bodyFile) => run("gh", ["issue", "create", "--title", `News form response ${id} needs attention`, "--body-file", bodyFile]),
      );
    }
  }
  if (!DRY) {
    run("git", ["reset", "--hard"]);
    run("git", ["checkout", "-f", "main"]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
