# concise / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `concise`  prompt: `review-pr-12116`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 17  wall: 180s  api: 106s
- cost: $1.0244  output tokens: 8681  words: 485

---

**Verdict: reject.** Close the PR and move the fix to Crowdin. No change to this diff would make it mergeable.

I reviewed the diff from the fetched PR ref, since `gh` isn't authenticated here. The PR is 4 lines in `packages/excalidraw/locales/si-LK.json`. The JSON is valid and no checks have run on it. I ran no tests.

Findings, most severe first:

1. **The file is Crowdin-managed, so this edit will be overwritten.**
   - **Location:** `packages/excalidraw/locales/si-LK.json`, the whole diff.
   - **Cause:** `packages/excalidraw/locales/README.md` says not to edit these files directly. `crowdin.yml` regenerates `%locale%.json` from Crowdin, so the next "Update translations from Crowdin" sync reverts the change.
   - **Fix:** make the corrections in Crowdin and close this PR.

2. **The Sinhala strings translate the key names, not the English text, so appending tokens produces nonsense.**
   - **Location:** lines 285, 511, 566, 572.
   - **Cause:** as far as I can read the Sinhala, `publishSuccessDialog.content` currently says "publish success content". The toast interpolates `toast.selection` and `toast.canvas`, which read "selection toast" and "canvas toast". The PR output becomes "publish success content (Alice)" and "Copied to clipboard as PNG (selection toast, dark mode)". The author says they don't speak Sinhala. Placeholder parity passes while the strings stay wrong, which hides them from any future parity check.
   - **Fix:** retranslate from `en.json` in Crowdin, or empty the strings so `t()` falls back to English (`packages/excalidraw/i18n.ts:141-142`).

3. **`publishSuccessDialog.content` is still broken after the PR.**
   - **Location:** line 511.
   - **Cause:** the string still lacks `<link>…</link>`, so the `<Trans>` at `packages/excalidraw/components/LibraryMenuHeaderContent.tsx:116` has no text to wrap in the submission-status link. The title claims dropped placeholders are restored, but this key remains incomplete.
   - **Fix:** include the link tags in the proper translation.

4. **The bug the PR describes never reaches a user.**
   - **Location:** `packages/excalidraw/i18n.ts:9` and `i18n.ts:69-73`.
   - **Cause:** `si-LK` is not in the `languages` list, and it sits at 65% in `percentages.json` against `COMPLETION_THRESHOLD = 85`. The locale cannot be selected, so no interpolated value is lost at runtime.
   - **Fix:** none needed in the repo. There is no urgency that justifies bypassing Crowdin.

5. **The scope is partial and the description is inaccurate.**
   - **Location:** PR body, plus the remaining placeholder gaps in `si-LK.json`.
   - **Cause:** after the PR, three `{{…}}` gaps remain: `alerts.confirmAddLibrary` (`{{numShapes}}`), `errors.fileTooBig` (`{{maxSize}}`) and `errorSplash.trackedToSentry` (`{{eventId}}`). Another 13 strings are missing tags such as `<bold>`, `<link>` and `<button>`. The body says "4 tokens" but lists 5. It also describes #12109's parity test as current, but #12109 is an open PR and the test is not in master.
   - **Fix:** fix all the si-LK gaps together in Crowdin. The parity-test suggestion belongs in the review of #12109.

6. **Nit: the toast format diverges from the English source.**
   - **Location:** line 566.
   - **Cause:** English is `Copied {{exportSelection}} … PNG\n({{exportColorScheme}})`. The PR drops the line break and moves `{{exportSelection}}` into the parenthetical.
   - **Fix:** follow the source structure in the real translation.