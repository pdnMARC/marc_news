/**
 * MARC website: builds the news Google Form and its response sheet.
 *
 * Paste into a new Apps Script project (script.google.com) owned by the MARC Google account and
 * run setupForm() once. Use a separate project from the profile form's. The nightly GitHub Action
 * in marc_news reads the response sheet and opens pull requests (scripts/form-sync.mjs). This
 * script never writes to GitHub. See README.md in this folder.
 */

// Same text as questions.json in this folder: the response sheet uses these as column headings.
const Q = {
  action: "What would you like to do?",
  actionNew: "Post a new article",
  actionChange: "Change a published article",
  article: "Link to the article (changes only)",
  title: "Title",
  date: "Date of the news (YYYY-MM-DD)",
  short: "Summary",
  body: "Article text",
  photoDescriptions: "Descriptions of the other photos",
  vacancy: "Is this a vacancy or a call for applications?",
  vacancyYes: "Yes: also list it on the Vacancies page",
  vacancyNo: "No",
  deadline: "Application deadline (YYYY-MM-DD)",
  apply: "Application link or email address",
};
const ISO_DATE = "\\d{4}-\\d{2}-\\d{2}";

function setupForm() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("FORM_ID")) {
    throw new Error("A form already exists (script property FORM_ID). Delete that property to create another.");
  }

  const form = FormApp.create("MARC website: news");
  form.setDescription(
    [
      "Send news for the MARC website: an award, an event, a new paper, a partnership or a vacancy.",
      "Every night your answers become a change request that a MARC maintainer reviews before it goes live.",
      "Answers and photos are published in MARC's public GitHub repository. Only send photos MARC may publish, with the agreement of anyone recognisable in them.",
      "Changing a published article? Give its link and fill in only what should change: blank answers keep what is already there.",
    ].join("\n\n"),
  );
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
  } catch (e) {
    form.setCollectEmail(true); // older Forms API
  }
  const dateRule = (text) => FormApp.createTextValidation().setHelpText(text).requireTextMatchesPattern(ISO_DATE).build();

  form.addMultipleChoiceItem().setTitle(Q.action).setChoiceValues([Q.actionNew, Q.actionChange]).setRequired(true);
  form
    .addTextItem()
    .setTitle(Q.article)
    .setHelpText("Open the article on the website and copy its address, e.g. https://pdnmarc.github.io/news/2026-07-29-slema-gold-award/");
  form.addTextItem().setTitle(Q.title).setHelpText("Required for a new article. The headline, e.g. MARC Researchers Win Best Paper Award");
  form
    .addTextItem()
    .setTitle(Q.date)
    .setHelpText("Required for a new article. The day it happened or was announced, e.g. 2026-03-10. Articles are listed newest first.")
    .setValidation(dateRule("Write the date as YYYY-MM-DD, e.g. 2026-03-10"));
  form
    .addParagraphTextItem()
    .setTitle(Q.short)
    .setHelpText("Required for a new article. One or two sentences for the news card and the top of the article.");
  form
    .addParagraphTextItem()
    .setTitle(Q.body)
    .setHelpText(
      "The full article. Each line becomes a paragraph; lines starting with - become a list. Links: [text](https://…). " +
        "Changing an article? Paste the whole corrected text: it replaces the current text (photos are kept).",
    );
  form
    .addParagraphTextItem()
    .setTitle(Q.photoDescriptions)
    .setHelpText(
      'One line per photo in "More photos", in the same order, e.g. Students at the AI workshop in Kegalle. ' +
        "Read out to people who can't see the photos.",
    );
  form
    .addMultipleChoiceItem()
    .setTitle(Q.vacancy)
    .setHelpText("Vacancies, internships and volunteer calls are listed on the Vacancies page until their deadline. Leave blank to keep the current setting.")
    .setChoiceValues([Q.vacancyYes, Q.vacancyNo]);
  form
    .addTextItem()
    .setTitle(Q.deadline)
    .setHelpText("Vacancies only. The last day to apply, e.g. 2026-11-30. The vacancy leaves the Vacancies page after this day.")
    .setValidation(dateRule("Write the date as YYYY-MM-DD, e.g. 2026-11-30"));
  form.addTextItem().setTitle(Q.apply).setHelpText("Vacancies only. Adds an Apply button, e.g. https://forms.gle/… or an email address.");

  const sheet = SpreadsheetApp.create("MARC news form (responses)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  SpreadsheetApp.flush();
  const tab = SpreadsheetApp.openById(sheet.getId())
    .getSheets()
    .find((s) => /^Form Responses/i.test(s.getName()));

  props.setProperty("FORM_ID", form.getId());
  console.log(
    [
      "Form created.",
      "Edit the form:   " + form.getEditUrl(),
      "Share this link: " + form.getPublishedUrl(),
      "Response sheet:  " + sheet.getUrl(),
      tab
        ? "CSV link for GitHub (README step 5): https://docs.google.com/spreadsheets/d/" + sheet.getId() + "/export?format=csv&gid=" + tab.getSheetId()
        : "Open the response sheet to find the gid of the 'Form Responses 1' tab (README step 5).",
      "Next: add the two photo questions (README step 2).",
    ].join("\n"),
  );
}
