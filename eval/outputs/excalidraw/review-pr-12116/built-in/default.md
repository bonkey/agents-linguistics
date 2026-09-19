# default / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `default`  prompt: `review-pr-12116`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 26  wall: 240s  api: 173s
- cost: $1.5052  output tokens: 14094  words: 934

---

# Review of PR #12116: fix(i18n): restore dropped placeholders in si-LK strings

## Verdict: reject (close and redirect the fix to Crowdin)

No revision of this diff could be merged, because the change is in the wrong place. It edits a Crowdin-generated file for a locale the app never loads, and it patches strings that are not real translations.

The edit itself is mechanically correct: the JSON is valid, all five tokens match `en.json` and the call sites, and nothing unrelated changed. The author was also upfront about not speaking Sinhala.

## Findings, most severe first

**1. Blocking: the file is managed by Crowdin, so the edit will be overwritten**
- **Location:** `packages/excalidraw/locales/si-LK.json` (whole diff). The policy is in `packages/excalidraw/locales/README.md` and the mapping is in `crowdin.yml`.
- **Cause:** The README says "Please do not contribute changes directly to these files, as we manage them with Crowdin."
  - `crowdin.yml` regenerates `%locale%.json` from Crowdin's own database.
  - Every commit to this file since 2023 is `Excalidraw Bot … Update translations from Crowdin`.
  - The next sync will silently revert these four lines.
- **Fix:** Correct the strings in the [Crowdin project](https://crowdin.com/translate/excalidraw/10). Close this PR and keep issue #12115 open as the tracker.

**2. Blocking: si-LK is never loaded at runtime, so the PR's stated benefit does not exist**
- **Location:** `packages/excalidraw/i18n.ts:9,69-73`, `packages/excalidraw/components/InitializeApp.tsx:26`, and `locales/percentages.json:46`.
- **Cause:** `si-LK` does not appear in the `languages` array at all.
  - Its completion is 65%, below `COMPLETION_THRESHOLD = 85`.
  - `InitializeApp` resolves unknown codes with `languages.find(...) || defaultLang`, so even a host passing `langCode="si-LK"` gets English.
  - No user can see these strings, so there are no "silently lost" interpolated values to fix.
- **Fix:** None is needed in code. This only matters if si-LK reaches 85% and gets registered, and that has to happen through Crowdin.

**3. High: the strings being patched are translations of the key names, not of the English text**
- **Location:** all four changed lines, most clearly `publishSuccessDialog.content` (line 511).
- **Cause:** The English source is two sentences: "Thank you {{authorName}}. Your library has been submitted for review…". The si-LK value is three words that, by my reading, mean "publication success content".
  - The same pattern runs through the file. `publishDialog.noteLicense` reads as "note license" and `errorSplash.headingMain` as "main error".
  - The length mismatch shows this without needing Sinhala, but a native speaker should confirm my reading.
  - Appending `({{authorName}})` would produce "Publication success content (Alice)", which is nonsense that also hides the defect from any future parity check.
- **Fix:** Retranslate from the English source in Crowdin, or clear the strings there. An empty string falls back to English through the `||` chain at `i18n.ts:141-142`. English is better than a wrong label with a token attached.

**4. Medium: `publishSuccessDialog.content` still drops the `<link>` tag**
- **Location:** `si-LK.json:511`, rendered by `LibraryMenuHeaderContent.tsx:116-128`.
- **Cause:** The English source has `<link>here</link>`, which `Trans` turns into the anchor to the submission URL. The PR restores `{{authorName}}` but not the tag, so the only way to track the submission is still missing. That loss is worse than the missing name.
- **Fix:** Include `<link>…</link>` when the string is retranslated.

**5. Medium: the fix is incomplete for the file**
- **Location:** `si-LK.json`, 15 other keys.
- **Cause:** My parity check of the PR's version of the file against `en.json` still finds mismatches.
  - Three dropped placeholders: `alerts.confirmAddLibrary` `{{numShapes}}`, `errors.fileTooBig` `{{maxSize}}`, and `errorSplash.trackedToSentry` `{{eventId}}`. These are the ones from #12097.
  - Twelve dropped tags across `errors.brave_measure_text_error.line1-4`, `errorSplash.*`, `publishDialog.note*` and `overwriteConfirm.modal.*.description`.
  - The title "restore dropped placeholders in si-LK strings" overstates what the PR does.
- **Fix:** Handle all of them in one Crowdin pass. Tag mismatches are the same class of bug as `{{}}` mismatches.

**6. Low: the restored placeholder in the PNG toast would interpolate junk values**
- **Location:** `si-LK.json:566`, fed by `actionClipboard.tsx:224-231`.
- **Cause:** `{{exportSelection}}` receives `t("toast.selection")` or `t("toast.canvas")`. In si-LK those read as "selection toast" and "canvas toast", which is more key-name translation. The toast would say "Copied to clipboard as PNG (canvas toast, …)".
- **Fix:** Retranslate `toast.canvas` and `toast.selection` in the same Crowdin pass.

**7. Low: the PR title scope should fail CI**
- **Location:** the PR title, checked by `.github/workflows/semantic-pr-title.yml:32-39`.
- **Cause:** The workflow sets `requireScope: true` and allows only `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker` and `repo`. `i18n` is not on that list.
  - I inferred this from the workflow config. The head commit reports zero check runs, probably because a fork PR is awaiting workflow approval, so I did not see a failure.
- **Fix:** Moot if the PR is closed. Otherwise use `fix(editor): …`.

**8. Info: the PR body cites a test suite that does not exist on master**
- **Location:** the last paragraph of the PR description.
- **Cause:** "#12109's parity test suite currently exempts si-LK" refers to `localePlaceholders.test.ts` in #12109, which is open and unmerged. `master` has no locale tests. The exemption is a design choice in someone else's pending PR, not current behaviour.
- **Fix:** Raise the exemption concern on #12109. It is a fair point there, because an exemption list for a Crowdin-lagging locale is exactly how findings 3-5 stay hidden.

## How I checked
- `gh` was not authenticated, so I used the public GitHub API and `git fetch origin pull/12116/head`.
- I did not run the test suite: the diff is JSON only, and nothing on `master` reads `si-LK.json`.
- I left two things behind: a local branch ref `pr-12116` and the scratch file `/tmp/si-LK.pr.json`, which is outside the repo.
  - No tracked file was changed.
  - To remove them, run `git branch -D pr-12116` and `rm /tmp/si-LK.pr.json`.