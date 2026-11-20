// Which pull requests the series may merge without the operator.
// The nightly build session only adds content: projects, their stock and the plan. Anything that
// changes how things are built, checked, merged or uploaded waits for the operator.

export const AUTO_BRANCH = /^serie\/auto-[a-z0-9][a-z0-9-]*$/;

// Content paths. Everything else (scripts/, .github/, tests/, tools/*/lib.js, config.json,
// CLAUDE.md, package.json, data/cf-projects.json …) is tooling or state the upload run owns.
const CONTENT = [
  /^tools\/(wow|java|stardew|bedrock)\/projects\/[a-z0-9-]+\/.+/,
  /^data\/projects\/[a-z0-9-]+\/(project\.json|files\/[^/]+)$/,
  /^data\/serie\/[a-z0-9]+\.json$/,
  /^data\/radar\/[^/]+\.json$/
];

// Inside a project folder these would run during the build or the tests of other projects.
const NEVER = [/(^|\/)\.github\//, /(^|\/)package(-lock)?\.json$/, /(^|\/)node_modules\//, /\.(sh|command)$/];

export const isContent = file => CONTENT.some(re => re.test(file)) && !NEVER.some(re => re.test(file));

// pr: { headRepo, baseRepo, headRef, baseRef, defaultBranch, files: [paths], ciConclusion }
// → { merge: boolean, reasons: [text] }
// Only into the default branch: a pull request into another branch (for example one that waits
// for the operator) is never merged by the series.
export function guardPullRequest({ headRepo, baseRepo, headRef, baseRef, defaultBranch, files = [], ciConclusion }) {
  const reasons = [];
  if (!headRepo || headRepo !== baseRepo) reasons.push('the branch is not in this repository');
  if (!defaultBranch || baseRef !== defaultBranch) reasons.push(`it targets "${baseRef}", not the default branch`);
  if (!AUTO_BRANCH.test(headRef || '')) reasons.push(`the branch "${headRef}" is not serie/auto-…`);
  if (ciConclusion !== 'success') reasons.push(`the tests are ${ciConclusion || 'missing'}, not green`);
  if (!files.length) reasons.push('the pull request changes no files');
  const other = files.filter(f => !isContent(f));
  if (other.length) reasons.push(`it changes more than content: ${other.slice(0, 5).join(', ')}${other.length > 5 ? ` and ${other.length - 5} more` : ''}`);
  return { merge: reasons.length === 0, reasons };
}
