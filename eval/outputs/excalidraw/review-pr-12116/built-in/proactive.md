# proactive / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `proactive`  prompt: `review-pr-12116`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 24  wall: 237s  api: 165s
- cost: $1.4245  output tokens: 13634  words: 777

---

# Review of PR #12116, "fix(i18n): restore dropped placeholders in si-LK strings"

## Verdict: reject — close the PR and move the fix to Crowdin

The bug is real and the author was open about not speaking Sinhala. The PR still can't be merged in any form, because any hand-edit to `si-LK.json` is overwritten by the next Crowdin sync. Request-changes would imply a revision could land, and none can.

I did not run `yarn test` or `yarn test:typecheck`. The change is 4 lines of JSON in a locale the app doesn't load.

## Findings, most severe first

### 1. The edit will be overwritten
- **Location:** `packages/excalidraw/locales/si-LK.json` (entire change).
- **Cause:**
  - `packages/excalidraw/locales/README.md:3` says "Please do not contribute changes directly to these files, as we manage them with Crowdin."
  - `crowdin.yml` maps `%locale%.json` as Crowdin output.
  - Every commit to this file since the 2023 yarn-workspaces restructure is an `Excalidraw Bot` "Update translations from Crowdin" sync.
  - The next sync re-exports Crowdin's copy, which lacks the tokens, and reverts this PR.
- **Fix:** Close the PR and correct the four strings in the Crowdin project.

### 2. The tokens are appended to strings that are already mistranslated
- **Location:** `si-LK.json:285`, `:511`, `:566`, `:572`.
- **Cause:** The existing Sinhala strings translate the key names, not the English text. Appending a token keeps the wrong sentence.
  - `:511` reads roughly "Publication success content (Alice)". The English is "Thank you Alice. Your library has been submitted for review…".
  - `:566` interpolates `toast.canvas`, whose si-LK value (`:570`) means "canvas toast". The toast becomes "Copied to clipboard as PNG (canvas toast, light mode)".
  - `:285` reads "Remove items from library (3)". The English is a confirmation question for a destructive action, and the question is lost.
  - This is my own reading of the Sinhala, not a native speaker's.
- **Fix:** Retranslate the strings from the English text in Crowdin, and have a Sinhala speaker review them.

### 3. One string the PR touches is still broken
- **Location:** `si-LK.json:511`, `publishSuccessDialog.content`.
- **Cause:** The English string also contains `<link>here</link>`, and the PR's version does not. In `LibraryMenuHeaderContent.tsx:116-128`, `Trans` renders the `link` prop only when that tag is in the string. The success dialog therefore has no link for tracking the submission.
- **Fix:** The translation must wrap the link text in `<link>…</link>`.

### 4. The PR says it restores the 4 missing placeholders, but 17 strings still mismatch
- **Location:** A parity check of the PR head against `en.json` found:
  - Three `{{…}}` placeholders: `alerts.confirmAddLibrary` (`{{numShapes}}`), `errors.fileTooBig` (`{{maxSize}}`) and `errorSplash.trackedToSentry` (`{{eventId}}`). These are probably the three already tracked in #12097, which I didn't open.
  - `toast.fileSavedToFilename` (`:569`), missing `{filename}`.
  - 13 strings missing tags: `<link>`, `<button>`, `<bold>`, `<br>`, `<issueLink>`, `<discordLink>`.
- **Cause:** The author's check apparently matched only `{{x}}`. The single-brace `{filename}` is consumed by `.replace("{filename}", …)` at `actionExport.tsx:297`, so the filename is dropped without any error. Missing tags remove links and buttons, including the reload button on the error splash.
- **Fix:** Correct these in Crowdin too. Any parity check should also cover `{x}` and `<tag>`.

### 5. No user can currently see this bug
- **Location:** `packages/excalidraw/i18n.ts:23-74` and `locales/percentages.json:46`.
- **Cause:** si-LK is not in the `languages` list. Its 65% completion is below `COMPLETION_THRESHOLD = 85`, and 219 of its 622 strings are empty.
- **Fix:** None needed. Nothing here justifies bypassing Crowdin.

### 6. The PR body cites a test that isn't merged
- **Location:** PR description, last paragraph.
- **Cause:** It says #12109's parity test "currently exempts si-LK". #12109 is still open, and `tests/localePlaceholders.test.ts` does not exist on master. No CI check guards this change.
- **Fix:** Raise the exemption concern on #12109 instead.

### 7. Nit: line breaks
- **Location:** `si-LK.json:566`, `:572`.
- **Cause:** The English strings carry `\n` line breaks (`en.json:574`, `:580`) that the si-LK strings don't reproduce.
- **Fix:** Address this when the strings are retranslated.

## What is correct
- The JSON is valid.
- All five token names match `en.json` exactly.
- The four call sites pass exactly those tokens: `LibraryMenuHeaderContent.tsx:64` and `:117`, `actionClipboard.tsx:224`, `App.tsx:5130`.
- The diff is limited to the four lines.
- Issue #12115 accurately describes the dropped values.

## Suggested closing note to the author
Thank them for the report. Point to the locales README and Crowdin. Note the `<link>` and `{filename}` gaps, since those improve the detection script.

## Local side effects
- No repo files were modified.
- `git fetch` created a local branch `pr-12116`. Remove it with `git branch -D pr-12116` when you're done.
- I wrote one scratch file to `/tmp` and deleted it.
- `gh` is not authenticated, so nothing was posted to GitHub.