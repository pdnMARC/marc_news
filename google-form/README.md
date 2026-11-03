# News form

A Google Form lets MARC members send news for the website without a GitHub account: a new article (with photos), a vacancy, or a correction to a published article. Every night at 00:00 Sri Lanka time a GitHub Action turns new responses into pull requests, and a maintainer reviews them before they go live.

```text
Google Form ──► response sheet (CSV) ──► nightly GitHub Action ──► pull request ──► maintainer merges ──► website rebuilds
                                          articles/<date>-<title>.md + cover_photos/<date>-<title>/
```

| File | What it does |
|---|---|
| `setup.gs` | Google Apps Script that builds the form and its response sheet (run once). |
| `questions.json` | The question titles. They are the response sheet's column headings, so the form and the sync script must agree. |
| `../scripts/form-sync.mjs` | Turns responses into pull requests (photos resized to at most 1600 px, location and camera data removed). |
| `../.github/workflows/form-sync.yml` | Runs the sync every night, or on demand. |

It works like the profile form in [marc_people](https://github.com/pdnMARC/marc_people/tree/main/google-form), with its own form, response sheet and secret.

## How a response is handled

- **New article:** a new file `articles/<date>-<first words of the title>.md`. The cover photo becomes `cover_photos/<same name>/01.jpg`; the other photos follow as `02.jpg`, `03.jpg`, … under a `## Photos` heading, each described by its line in *Descriptions of the other photos*.
- **Vacancy:** *Yes* (or a deadline or application link on a new article) adds `vacancy: true`, plus `deadline` and `apply`. An email address in the application answer becomes a `mailto:` link.
- **Change to a published article:** the article is found from its link on the website (`…/news/<file name>/`) or its file name. A filled-in answer replaces the current value and a blank keeps it. New article text replaces the text but keeps the `## Photos` section; new photos are added after the existing ones; a new cover replaces the old one. The file name, which is the article's address, never changes.
- **Unusable response** (an unknown article link, a missing title, date or summary for a new article, a title another article already uses, a photo that can't be read, nothing to change, …): an issue titled *News form response … needs attention* instead of a pull request.
- **Each response is handled once.** Its id is in the branch name (`news-form/<id>`). Closing a pull request or issue rejects that response for good; the person can send the form again.

The form can't delete an article or edit a social feed item; those are done on GitHub and in the website data Google Sheet.

## One-time setup

You need the MARC Google account that should own the form, and admin access to `pdnMARC/marc_news`.

### 1. Create the form

1. Signed in as the MARC account, open [script.google.com](https://script.google.com) and create a **New project** (a separate one from the profile form's).
2. Replace the editor's contents with [`setup.gs`](setup.gs) and save.
3. Choose `setupForm` in the function list and click **Run**. Allow the permissions it asks for (create a form and a spreadsheet).
4. Open **Execution log**. It prints the form's edit link, the link to share, the response sheet, and the **CSV link** you need in step 5.

### 2. Add the photo questions

Apps Script can't create file-upload questions, so add these two by hand in the form editor, after *Article text*:

| Title (exactly) | Type | Settings | Help text, for example |
|---|---|---|---|
| `Cover photo` | File upload | Image only, 1 file, 10 MB | *Landscape, at least 1200 pixels wide. Shown on the news card and at the top of the article.* |
| `More photos` | File upload | Image only, up to 10 files, 10 MB | *Shown under the article, in this order. Describe each one in the next question.* |

Then drag *Descriptions of the other photos* below *More photos*. File-upload questions make respondents sign in with a Google account, which also records who sent each response.

### 3. Check the form settings

- **Settings → Responses → Collect email addresses: Verified** (set by the script).
- If MARC uses Google Workspace, consider **Restrict to users in your organisation**.
- Leave **Limit to 1 response** off.

### 4. Share the responses with the Action

The Action reads the responses without a Google login, so these need **General access → Anyone with the link → Viewer** (in Google Drive, **Share**):

- the response sheet *MARC news form (responses)*;
- the folder of uploaded files, *MARC website: news (File responses)*, and the two folders inside it, created after the first upload (send a test response with photos first).

Anyone holding these links can see the responses. The links are stored only as a GitHub secret (step 5) and are never published.

### 5. Connect GitHub (marc_news)

1. **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `NEWS_FORM_CSV_LINK`
   - Value: the CSV link from step 1, in the form
     `https://docs.google.com/spreadsheets/d/<sheet id>/export?format=csv&gid=<tab id>`
     (the `gid` is the number after `#gid=` in the address bar when the *Form Responses 1* tab is open).
2. **Settings → Actions → General → Workflow permissions**: tick **Allow GitHub Actions to create and approve pull requests**. For an organisation repository this may first need allowing in the organisation's settings.

### 6. Test it

1. Send a test response with a cover photo.
2. **Actions → News Form Sync → Run workflow**.
3. A pull request appears. Close it if it was only a test.

### 7. Publish the form link

Put the form's share link in `forms.news` in `src/data/site.ts` of the website repository. The news guide then shows an **Open the news form** button.

## Reviewing submissions

Each pull request lists the file, what changed, who sent it and the validator result, with a checklist:

- **Sender and text:** the sender is at MARC, and the text is accurate and fit for the public website.
- **Photos:** MARC may publish them, and anyone recognisable agreed. Photos without a description get an empty `![](…)`: write what the photo shows inside the brackets.
- **Address (new articles):** the file name becomes the article's address. Rename it now if it reads badly (with its photo folder and the photo paths); not after publishing.
- **Duplicates:** if the same news arrives twice, merge one pull request and close the other.
- **Merge** to publish (the website rebuilds), or **close** to reject.

Checks don't start by themselves on pull requests opened by a workflow; the validator result in the description is from the sync run. To run the checks on GitHub too, close and reopen the pull request.

## Maintenance

- **Changing a question's wording:** change it in the form, in `questions.json` and in `setup.gs`. The response sheet's column heading changes with the question.
- **New front matter fields:** if `scripts/validate-news.mjs` gains a field, add it to `FIELDS` and `articleMarkdown` in `scripts/form-sync.mjs`. Until then, changes to articles that use it are turned into issues rather than dropping the field.
- **Scheduled runs stop** after 60 days without any activity in a public repository. GitHub sends a notice; re-enable the workflow from the Actions tab.

## Trying it locally

```bash
npm install
DRY_RUN=1 FORM_RESPONSES_CSV=path/to/responses.csv node scripts/form-sync.mjs
```

`DRY_RUN=1` applies every response to the working tree and prints a summary, without git or GitHub. Download the CSV from the response sheet (**File → Download → CSV**). Use a scratch copy of the repository, and `git checkout -- articles && git clean -fd articles` to undo.
