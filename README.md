# marc_news

:wave: This repository stores the news articles that are pulled into the MARC website during deployment.

If your pull request is merged here, the website workflow will clone this repository into the website build, and your news article can appear on the live site.

## :sparkles: Two ways to add news

There are two different ways to add news to the MARC website:
- Markdown news articles in this repository
- Social feed items through the Google Sheet used by the website sync script

Use Markdown articles when you want a full news page with a title, summary, optional cover photo, and full article body.

Use the Google Sheet when you want a shorter social/news update that links to an external post such as Facebook, LinkedIn, a website article, or Twitter.

## :newspaper: Option 1: Markdown news articles in this repository

You will usually add:
- one Markdown file for your news article
- optionally one cover image inside `cover_photos/`

A typical news file looks like this:

```md
---
title: "Example News Title"
date: 2026-03-10
cover: ./cover_photos/example_news.jpg
short: >
  A short summary of the news item that will appear on the news card
  and near the top of the article page.
---
Write the full news article here in Markdown.
```

The text below the front matter becomes the full article page on the website.

## :bookmark_tabs: Fields used by the website for Markdown news

The website currently validates each Markdown news entry with these fields:
- `title`: string
- `date`: date
- `cover`: optional image path
- `short`: short summary string

Required fields:
- `title`
- `date`
- `short`

Optional field:
- `cover`

## :brain: Before you start

You should have:
- a GitHub account
- basic familiarity with editing files and committing changes
- the article title, date, summary, and full article text ready
- optionally a cover image ready

## :triangular_ruler: YAML front matter basics

The block between the top `---` line and the next `---` line is YAML front matter.

This is where the website reads your news metadata.

A few YAML gotchas to watch for:
- every field name must be followed by a colon, like `title:`
- do not use tabs for indentation
- if a value contains special characters, a colon, or you just want to be safe, wrap it in quotes
- do not forget the closing `---` line before your normal Markdown article starts
- the `cover` path must match the actual file name exactly
- avoid extra spaces inside file paths
- the `date` should use the exact format `YYYY-MM-DD`

Good example:

```yaml
title: "Example News Title"
date: 2026-03-10
cover: ./cover_photos/example_news.jpg
short: >
  This is a short summary for the article card.
```

Safe quoted example:

```yaml
title: "MARC Wins National Award"
```

The `short` field often reads well as a folded YAML block using `>` when the summary is more than one short line.

## :calendar: Date format

Use the date format exactly like this:

```text
2026-03-10
```

This is `YYYY-MM-DD`.

Examples:
- `2026-01-05`
- `2026-03-10`

Avoid formats like these:
- `10-03-2026`
- `03/10/2026`
- `March 10, 2026`

## :memo: What you can write in the content section

Everything below the closing `---` line is normal Markdown content.

For news articles, this is the full article body. You can include:
- plain paragraphs
- section headings
- bullet lists
- links
- emphasis such as bold or italic text
- images using Markdown syntax

Example:

```md
---
title: "Example News Title"
date: 2026-03-10
cover: ./cover_photos/example_news.jpg
short: >
  A short summary of the article.
---
This article announces a new MARC milestone.

## Highlights

- Strong collaboration
- New research impact
- Recognition at national level

Read more here: [Example link](https://example.com).

Here is an inline image:
![Example photo](./cover_photos/example_news.jpg)
```

If you include an image in the content section, use a relative path to a file inside the repository.

Keep it reasonably simple and readable. Plain paragraphs are completely fine.

## :framed_picture: Cover image

If you want a cover image:

1. Put the image file inside the `cover_photos/` folder.
2. Reference it in the `cover` field.

Example:

```md
cover: ./cover_photos/example_news.jpg
```

Notes:
- Common formats such as `.jpg`, `.jpeg`, and `.png` are appropriate.
- The cover image is optional in the current website schema.
- If you do not add a `cover`, the article can still appear on the site.

## :satellite: Option 2: Social feed items through the Google Sheet

The website also has a separate `social_news` collection. Unlike the Markdown articles above, this is not edited directly in this repository.

Instead, it is generated from this Google Sheet:
- `https://docs.google.com/spreadsheets/d/1vhvcqlhc_bTdGScX3iYQ4T9HTD2uLbKD22rsrI_qA8U/edit?usp=sharing`

The website's Python sync script reads the sheet, converts the news tab to JSON, and writes it into the website as `social_news.json` during the build/update process.

These social feed items appear in the `Latest Activity` section of the News page and link out to the original external post or page.

### When to use the Google Sheet

Use the Google Sheet when:
- you want to link to a Facebook, LinkedIn, Twitter, or web post
- you do not need a full Markdown article page on the website
- the update is better represented as a short social/news feed item

### Fields expected in the Google Sheet

The sync script and website expect these fields for social news items:
- `Title`
- `Date`
- `Source`
- `URL`
- `Thumbnail` optional
- `Embed` optional

From the website validation:
- `Source` should be exactly one of `Facebook`, `LinkedIn`, `Web`, or `Twitter`
- `URL` should be a valid full URL
- `Date` should use the `YYYY-MM-DD` format

From the current sync script:
- rows missing `Title`, `Date`, or `URL` are dropped
- empty optional fields are allowed
- the sheet columns are converted to lowercase JSON keys during sync

### How to add a social feed item

1. Open the Google Sheet.
2. Go to the news/social tab used for website updates.
3. Add a new row.
4. Fill in the row with the relevant details.

Recommended column usage:
- `Title`: the text that should appear on the site
- `Date`: use `YYYY-MM-DD`
- `Source`: use exactly `Facebook`, `LinkedIn`, `Web`, or `Twitter`
- `URL`: the link to the original external post/page
- `Thumbnail`: optional image link or path if your workflow uses it
- `Embed`: optional embed code if needed later

Example row values:
- `Title`: `MARC team wins national competition`
- `Date`: `2026-03-10`
- `Source`: `LinkedIn`
- `URL`: `https://www.linkedin.com/posts/example`
- `Thumbnail`: leave blank if not needed
- `Embed`: leave blank if not needed

### Important notes for social feed items

- `Source` capitalization matters. Use the values exactly as listed above.
- `Date` format matters. Use `YYYY-MM-DD`.
- `URL` should be a full link, including `https://`.
- If you want a full article page on the website, the Google Sheet is not enough. Use a Markdown article in this repository instead.

## :globe_with_meridians: Option A: Edit Markdown articles using the GitHub website

This is the easiest option if you do not want to use Git locally.

### 1. Fork the repository

1. Open `pdnMARC/marc_news` on GitHub.
2. Click `Fork`.
3. Create the fork under your own GitHub account.

### 2. Create your news file in the browser

1. Open your fork on GitHub.
2. In the repository root, click `Add file`.
3. Choose `Create new file`.
4. Name the file something clear, for example:

```text
2026-03-example-news.md
```

5. Paste your article content.

Example:

```md
---
title: "Example News Title"
date: 2026-03-10
cover: ./cover_photos/example_news.jpg
short: >
  A short summary of the article.
---
Write the full article here.
```

### 3. Add your cover image in the browser

If you want a cover image:

1. Open the `cover_photos/` folder in your fork.
2. Click `Add file`.
3. Choose `Upload files`.
4. Upload your image.
5. Make sure the `cover` field matches the uploaded file name exactly.

Example:

```md
cover: ./cover_photos/example_news.jpg
```

### 4. Edit an existing article on GitHub

If you already have an article and just want to update it:

1. Open the existing `.md` file in your fork.
2. Click the pencil icon to edit it.
3. Update the front matter or article content.
4. If needed, upload a new image to `cover_photos/`.
5. Scroll down and commit the change to a new branch.
6. Open a pull request.

You can manage both new articles and later updates entirely from the GitHub website this way.

### 5. Commit your changes on GitHub

When editing in the browser:

1. Scroll to the commit section below the editor.
2. Enter a short commit message such as `Add news article for example event`.
3. Choose `Create a new branch for this commit and start a pull request` if GitHub offers it.
4. Click `Propose changes` or `Commit changes`.

### 6. Open a pull request

1. GitHub will usually guide you to a pull request page.
2. Open a pull request from your fork to `pdnMARC/marc_news:main`.
3. Briefly say that you are adding or updating a news article.

## :computer: Option B: Edit Markdown articles locally with Git

Use this option if you prefer working on your own machine.

### 1. Fork the repository

1. Open the `pdnMARC/marc_news` repository on GitHub.
2. Click `Fork`.
3. Create the fork under your own GitHub account.

### 2. Clone your fork

```bash
git clone https://github.com/<your-github-username>/marc_news.git
cd marc_news
```

### 3. Create a branch

```bash
git checkout -b add-news-article
```

Use any clear branch name such as `add-example-news`.

### 4. Add your news file

Create a new Markdown file in the repository root.

Example:

```text
2026-03-example-news.md
```

Add front matter at the top of the file.

Example:

```md
---
title: "Example News Title"
date: 2026-03-10
cover: ./cover_photos/example_news.jpg
short: >
  A short summary of the article.
---
Write the full article here.
```

### 5. Add your article content

After the front matter, write the full article in Markdown.

Plain paragraphs are enough.

### 6. Add your cover image

If you want a cover image:

1. Put the image file inside the `cover_photos/` folder.
2. Reference it in the `cover` field.

Example:

```md
cover: ./cover_photos/example_news.jpg
```

### 7. Commit and push

```bash
git add .
git commit -m "Add news article for example event"
git push origin add-news-article
```

### 8. Open a pull request

1. Go to your fork on GitHub.
2. Open a pull request from your branch to `pdnMARC/marc_news:main`.
3. In the pull request description, briefly state that you are adding or updating a news article.

## :arrows_counterclockwise: How the website uses this repository

The MARC website GitHub Actions workflow clones `pdnMARC/marc_news` into the website build as the news collection.

That is why news changes belong in this repository rather than directly in the website repository.

In practice, the flow is:
1. You update `marc_news`.
2. Your pull request is merged.
3. The website workflow pulls this repository during deployment.
4. Your Markdown article becomes part of the website build.

Social feed items follow a different path:
1. You update the Google Sheet.
2. The website sync script reads that sheet.
3. The script updates `social_news.json` in the website build/update flow.
4. The item appears in the News page social feed.

## :white_check_mark: Checklist before opening the pull request for Markdown news

- Your Markdown file is in the repository root.
- Your front matter includes `title`, `date`, and `short`.
- Your `date` uses the exact `YYYY-MM-DD` format.
- Your `cover` path is correct if you added an image.
- Your cover image file is inside `cover_photos/` if you used one.
- Your article content is below the closing `---` line.