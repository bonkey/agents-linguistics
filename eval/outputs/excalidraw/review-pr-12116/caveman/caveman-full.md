# caveman-full / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-full`  prompt: `review-pr-12116`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 13  wall: 159s  api: 90s
- cost: $1.0169  output tokens: 7699  words: 391

---

**Verdict: reject.** The edit goes to the wrong place. Crowdin manages `si-LK.json`, the file is never loaded at runtime, and the next Crowdin sync reverts the change.

I could not use `gh` because it is not authenticated, so I fetched the diff over HTTP. The PR's base blob matches the local `si-LK.json`. The PR changes one file, with 4 insertions and 4 deletions. No files were modified. I ran no tests, because the change is JSON only.

Findings, most severe first:

1. **Direct edit to a Crowdin-managed file**
   - Location: `packages/excalidraw/locales/si-LK.json:285,511,566,572`.
   - Cause: `packages/excalidraw/locales/README.md:3` forbids direct edits to locale files. `origin/l10n_master` still holds the old strings (lines 289, 519, 574, 580 there). The next "Update translations from Crowdin" PR overwrites these edits.
   - Fix: close the PR and edit the strings on Crowdin.

2. **No runtime effect**
   - Location: `packages/excalidraw/i18n.ts` language list, and `packages/excalidraw/components/InitializeApp.tsx:26`.
   - Cause: `si-LK` is not registered in the language list. Its completion in `percentages.json:46` is 65, below `COMPLETION_THRESHOLD = 85` (`i18n.ts:9`). `languages.find(...) || defaultLang` falls back to English, so `si-LK.json` is never imported. The PR fixes nothing a user can see.
   - Fix: no in-repo fix. To ship si-LK, raise its Crowdin completion to 85% or more, then register the language.

3. **Placeholders appended in parentheses, not integrated into the sentence**
   - Location: `si-LK.json:285,511,566,572`.
   - Cause: the existing si-LK strings translate the key names, not the English values. For `publishSuccessDialog.content`, English is "Thank you {{authorName}}. Your library has been submitted for review…", while si-LK reads roughly "publish success content ({{authorName}})". For the PNG toast, `toast.canvas` and `toast.selection` (`:570-571`) read "canvas toast" and "selection toast", and `actionClipboard.tsx:224` inserts them into the message. The output is grammatically broken.
   - Fix: retranslate these strings from the English values on Crowdin, with the placeholders inside the sentence.

4. **Placeholder restore is incomplete**
   - Location: `si-LK.json:280,293,410,511,569`.
   - Cause: several placeholders and tags are still missing after the patch:
     - `alerts.confirmAddLibrary` lacks `{{numShapes}}`.
     - `errors.fileTooBig` lacks `{{maxSize}}`.
     - `errorSplash.trackedToSentry` lacks `{{eventId}}`.
     - `toast.fileSavedToFilename` lacks the single-brace `{filename}`, which `actionExport.tsx:297` fills with `.replace`.
     - `publishSuccessDialog.content` still lacks `<link>…</link>`, so the status link at `LibraryMenuHeaderContent.tsx:117` does not render.
     - Eleven more strings lack `<bold>`, `<link>`, `<button>` or `<br>` tags, under `errors.brave_measure_text_error.*`, `errorSplash.*`, `publishDialog.note*` and `overwriteConfirm.modal.*`.
   - Fix: restore all of them on Crowdin.

Tell the author the intent is good, and point them to https://crowdin.com/translate/excalidraw/10.