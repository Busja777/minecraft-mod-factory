// Every place the CurseForge tool looks for something on authors.curseforge.com, in ONE file.
// When CurseForge changes its pages, only this file needs an update (`npm run cf -- inspect`).
//
// A target is a list of alternatives; the first one that shows up wins:
//   { role, name }      → page.getByRole(role, { name })      (name: string or RegExp)
//   { label }           → page.getByLabel(label)
//   { field, kind }     → the first input/textarea/select/combobox/editor AFTER the visible label
//                         text `field` (CurseForge's labels are often not linked to their input).
//                         kind: 'file' → the next file input instead.
//   { placeholder }     → page.getByPlaceholder(placeholder)
//   { text, exact }     → page.getByText(text, { exact })
//   { css }             → page.locator(css)
//   nth: n / last: true → take the n-th / the last match (default: first)
//   hidden: true        → element may be invisible (file inputs usually are)
// Upload steps set files on the file input directly; if there is none yet, they click the step's
// `trigger` and catch the file chooser (the macOS dialog never opens).
//
// STATUS: calibrated from the screenshots in Input/Anleitung_CF.docx (labels, buttons, tabs, the
// order of the Create Project wizard). Icon-only buttons (edit pencil) are still best guesses.

export const URLS = {
  home: 'https://authors.curseforge.com/',
  projects: 'https://authors.curseforge.com/#/projects',
  // Project dashboard by numeric id. Learned automatically after the first "Create" (cf.js stores
  // the observed URL with {id}); null = unknown yet → the tool asks you to open the page yourself.
  project: null,
  // cf.js uses this while `project` has not been learned: the projects list address plus the id.
  projectGuess: 'https://authors.curseforge.com/#/projects/{id}'
};

// The edit page after "Create" shows the numeric project id in its URL.
export const PROJECT_ID_IN_URL = /projects?\/(\d{4,})/i;

const field = (name, extra = {}) => ({ field: name, ...extra });
const tab = name => [{ role: 'tab', name, exact: true }, { role: 'link', name, exact: true }, { role: 'button', name, exact: true }, { text: name, exact: true }];

export const TARGETS = {
  // Projects page → "+ Create A Project" (orange, top right)
  startProject: [{ role: 'button', name: /create a project/i }, { role: 'link', name: /create a project/i }, { text: /create a project/i }],

  // Create Project wizard: Choose Game · General · Description · License
  game: name => [{ text: name, exact: true }, { role: 'link', name, exact: true }, { role: 'button', name, exact: true }],
  wizardTab: name => tab(name),
  projectName: [field('Project name'), { label: /^\s*project name/i }],
  uploadLogo: [{ role: 'button', name: /upload image/i }, { text: /upload image/i }],
  logoFile: [field('Logo', { kind: 'file', hidden: true }), { css: 'input[type=file][accept*=image]', hidden: true }, { css: 'input[type=file]', hidden: true }],
  summary: [field('Summary'), { label: /^\s*summary/i }],
  projectClass: [field('Class'), { label: /^\s*class/i }],
  mainCategory: [field('Main category'), { label: /^\s*main category/i }],
  additionalCategories: [field('Additional categories'), { label: /^\s*additional categories/i }],
  descriptionEditorType: [{ role: 'combobox', name: /wysiwyg|markdown|editor/i }, { text: 'WYSIWYG', exact: true }],
  description: [{ css: 'textarea:visible', last: true }, { css: '[contenteditable=true]:visible', last: true }],
  license: [field('Project License'), { label: /^\s*project license/i }],
  distribution: [field('Project distribution'), { label: /^\s*project distribution/i }],

  // Edit page tabs: Description · General · License · Files · Source · Media · …
  projectTab: name => tab(name),

  // Media
  addMedia: [{ role: 'button', name: /^\s*\+?\s*add media\s*$/i }, { text: /^\s*add media\s*$/i }],
  uploadImageChoice: [{ text: /upload or drag image/i }],
  mediaFile: [{ css: 'input[type=file][accept*=image]', hidden: true, last: true }, { css: 'input[type=file]', hidden: true, last: true }],
  editMedia: [{ role: 'button', name: /edit/i, last: true }, { css: '[aria-label*="edit" i]', last: true }, { css: '[title*="edit" i]', last: true }],
  // Only the title: a "Description" label would also match the project's Description tab.
  mediaTitle: [field('Title'), { label: /^\s*title/i }],

  // Files: "+ Add File" opens the form — and the form's submit button is ALSO called "Add File"
  // (runner.js blocks that one once something has been filled in).
  addFile: [{ role: 'button', name: /^\s*\+?\s*add file\s*$/i }, { text: /^\s*add file\s*$/i }],
  uploadFileZone: [{ text: /or drop file here|drop your files here/i }],
  projectFile: [field('Upload File', { kind: 'file', hidden: true }), { css: 'input[type=file]', hidden: true }],
  gameVersions: [field('Game'), { label: /^\s*game\b/i }],
  releaseType: [field('Release Type'), { label: /^\s*release type/i }],
  changelogEditorType: [{ role: 'combobox', name: /wysiwyg|markdown|editor/i }, { text: 'WYSIWYG', exact: true }],
  changelog: [{ css: 'textarea:visible', last: true }, { css: '[contenteditable=true]:visible', last: true }]
};

// The tool NEVER clicks anything whose visible name matches this: the final click is always yours.
// Whole-name match, so "Create A Project" (opens the wizard) is allowed but "Create" is not.
export const FORBIDDEN_CLICK = /^\s*(create( project)?|save( changes)?|submit|publish|confirm|apply|upload|send|finish|done|ok)\s*$|^\s*(delete|remove)\b/i;

// Opening buttons that share their name with a form's submit button. Allowed only while nothing has
// been filled in since the last page change.
export const FORBIDDEN_AFTER_EDIT = /^\s*\+?\s*(add file|add media)\s*$/i;
