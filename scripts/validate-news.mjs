import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const repoRoot = process.cwd();
const nonEmptyString = z.string().trim().min(1);
const frontmatterSchema = z
  .object({
    title: nonEmptyString,
    date: z.coerce.date(),
    cover: nonEmptyString.optional(),
    short: nonEmptyString,
  })
  .strict();

const markdownFiles = fs
  .readdirSync(repoRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".md") &&
      entry.name.toLowerCase() !== "readme.md",
  )
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const failures = [];
const seenTitles = new Map();
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

for (const fileName of markdownFiles) {
  const filePath = path.join(repoRoot, fileName);
  const raw = fs.readFileSync(filePath, "utf8");

  let parsed;
  try {
    parsed = matter(raw);
  } catch (error) {
    failures.push(`${fileName}: could not parse front matter (${error.message})`);
    continue;
  }

  const result = frontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const issuePath = issue.path.length > 0 ? issue.path.join(".") : "frontmatter";
      failures.push(`${fileName}: ${issuePath} ${issue.message}`);
    }
    continue;
  }

  const data = result.data;
  const normalizedTitle = data.title.toLowerCase();

  if (seenTitles.has(normalizedTitle)) {
    failures.push(
      `${fileName}: duplicate title "${data.title}" also used in ${seenTitles.get(normalizedTitle)}`,
    );
  } else {
    seenTitles.set(normalizedTitle, fileName);
  }

  const dateLine = parsed.matter
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith("date:"));
  const rawDateValue = dateLine
    ?.replace(/^\s*date:\s*/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  if (!rawDateValue || !isoDatePattern.test(rawDateValue)) {
    failures.push(`${fileName}: date must use the exact YYYY-MM-DD format`);
  }

  if (data.cover) {
    if (!data.cover.startsWith("./cover_photos/")) {
      failures.push(
        `${fileName}: cover must use a repo-relative path starting with "./cover_photos/"`,
      );
    }

    const coverPath = path.resolve(path.dirname(filePath), data.cover);
    if (!fs.existsSync(coverPath)) {
      failures.push(`${fileName}: cover image not found at ${data.cover}`);
    }
  }
}

if (markdownFiles.length === 0) {
  failures.push("No news markdown files were found.");
}

if (failures.length > 0) {
  console.error("marc_news validation failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Validated ${markdownFiles.length} news file(s) successfully.`);