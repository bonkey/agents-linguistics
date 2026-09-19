# caveman-lite / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-lite`  prompt: `review-pr-12116`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 16  wall: 163s  api: 91s
- cost: $0.9265  output tokens: 7231  words: 572

---

## Verdict: request changes

Do not merge this pull request as written. The problem it reports is real, but the fix belongs in Crowdin, not in `si-LK.json`. I fetched the PR ref and compared the PR's `si-LK.json` against `en.json` with a script. No tests were run, and I changed no files.

## Findings, most severe first

**1. The pull request edits a Crowdin-managed file, so its changes will be overwritten.**
- **Location:** `packages/excalidraw/locales/si-LK.json`, the whole diff.
- **Cause:** `packages/excalidraw/locales/README.md` says "Please do not contribute changes directly to these files, as we manage them with Crowdin." `crowdin.yml` maps `en.json` to `%locale%.json`. Every commit in the history of `si-LK.json` is a bot sync titled "Update translations from Crowdin". The next sync will overwrite these four lines.
- **Fix:** Make the corrections on Crowdin. Close this pull request, or have a maintainer apply the change upstream.

**2. The Sinhala strings translate the key names, not the English text.**
- **Location:** `si-LK.json:285`, `:511`, `:566`, `:572`.
- **Cause:** As far as I can read the Sinhala, `publishSuccessDialog.content` says "publish success content". `toast.canvas` says "canvas toast". `alerts.collabOfflineWarning` says "collaboration offline warning". With the placeholder added, a user would see "publish success content (Alice)", which is still meaningless. The author says they do not speak Sinhala.
- **Fix:** Set these values to `""`. In `i18n.ts`, `t()` falls back to the English string when a value is empty. Alternatively, have a Sinhala speaker retranslate them on Crowdin.

**3. `publishSuccessDialog.content` still has no `<link>` tags.**
- **Location:** `si-LK.json:511`.
- **Cause:** The English string wraps "here" in `<link>…</link>`. `LibraryMenuHeaderContent.tsx:117` passes a `link` prop to `Trans`. Without the tags in the translation, the link for tracking the submission never renders.
- **Fix:** Add `<link>…</link>` to the string, or set it to `""` as in finding 2.

**4. The fix is incomplete: three more placeholders are missing in `si-LK.json`.**
- **Location:** `si-LK.json:280` (`alerts.confirmAddLibrary`), `:293` (`errors.fileTooBig`), `:410` (`errorSplash.trackedToSentry`).
- **Cause:** These strings drop `{{numShapes}}`, `{{maxSize}}`, and `{{eventId}}`. Line 569 (`toast.fileSavedToFilename`) drops `{filename}`. The `.replace(...)` call at `actionExport.tsx:297` then does nothing. The pull request's claim of "the 4 missing placeholder tokens" undercounts.
- **Fix:** Correct all of them on Crowdin. Another 12 keys in the file are missing tags: `bold`, `button`, `link`, `br`, `discordLink`, and `issueLink`.

**5. No user can see these strings today.**
- **Location:** `packages/excalidraw/i18n.ts`, the `languages` array.
- **Cause:** `si-LK` is not in the array. `percentages.json:46` lists it at 65 percent, below `COMPLETION_THRESHOLD = 85`. Users cannot select the locale.
- **Fix:** No code change is needed. Treat this as low priority.

**6. The pull request description refers to a test suite that is not on `master`.**
- **Location:** The pull request body, which says "#12109's parity test suite currently exempts si-LK".
- **Cause:** #12109 is open and unmerged, so `master` has no parity test.
- **Fix:** Remove that sentence, or move the request to #12109. No regression test comes with this pull request either.

**7. The new placeholders sit in the wrong place, which the author acknowledges.**
- **Location:** All four changed lines.
- **Cause:** Each token is appended in parentheses at the end. In `copyToClipboardAsPng` the English string puts `{{exportSelection}}` inside the sentence and `{{exportColorScheme}}` on a second line in parentheses. In `pasteAsSingleElement` the second clause, "or paste into an existing text editor", is missing.
- **Fix:** Have a Sinhala speaker rewrite the strings on Crowdin.

The PR's `si-LK.json` parses as valid JSON, and the diff touches only those four lines.