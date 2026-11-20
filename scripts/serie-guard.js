import { guardPullRequest } from './lib/serie-guard.js';
import { setOutputs } from './lib/github-output.js';

// Decides whether a pull request of the nightly build session may be merged without the operator.
// Called by .github/workflows/serie-merge.yml from the default branch, never from the PR's code.
//   PR_HEAD_REPO, PR_BASE_REPO, PR_HEAD_REF, CI_CONCLUSION, PR_FILES (one path per line)
const files = (process.env.PR_FILES || '').split('\n').map(s => s.trim()).filter(Boolean);
const result = guardPullRequest({
  headRepo: process.env.PR_HEAD_REPO,
  baseRepo: process.env.PR_BASE_REPO,
  headRef: process.env.PR_HEAD_REF,
  ciConclusion: process.env.CI_CONCLUSION,
  files
});
console.log(result.merge ? `Merge: ${files.length} content files` : `No automatic merge: ${result.reasons.join('; ')}`);
setOutputs({ merge: String(result.merge), reasons: result.reasons.join('; ') });

// Test line for the merge guard: a pull request that touches this file must wait for the operator.
