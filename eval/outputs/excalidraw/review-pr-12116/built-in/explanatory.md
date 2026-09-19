# explanatory / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `explanatory`  prompt: `review-pr-12116`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 30  wall: 341s  api: 262s
- cost: $2.0885  output tokens: 21438  words: 999

---

## Verdict: **Reject** (close, and redirect the fix to Crowdin)

I chose reject over request-changes because no revision of this diff would be mergeable. The file is a generated export from Crowdin, so the fix has to be made there, not in git. The author's diagnosis is correct and the PR description is honest about its limits, so the closing note should be friendly.

**What I checked**
- I reviewed head `650527f`, which matches the PR's current head SHA. It is one commit and changes 4 lines in `packages/excalidraw/locales/si-LK.json`.
- All five restored token names match what the call sites pass: `count`, `authorName`, `exportSelection`, `exportColorScheme`, `shortcut`.
- The JSON is valid, with a trailing newline and no CR or BOM.

**What I could not run**
- `yarn test:typecheck` and `yarn test:update` did not run, because `node_modules` is not installed in this checkout.
- Neither would exercise this change anyway. Only `en.json` is typed (`i18n.ts:17`), and `grep` finds no test on master that reads locale files.
- I made no file modifications.

## Findings, most severe first

**1. Direct edit to a Crowdin-managed file, so the change will not persist.**
- **Location:** the whole diff; policy at `packages/excalidraw/locales/README.md:3`; mapping in `crowdin.yml`.
- **Cause:**
  - The README says "Please do not contribute changes directly to these files, as we manage them with Crowdin."
  - Every commit in `si-LK.json`'s history is an `Excalidraw Bot` sync.
  - In about 3 years, the only human commit touching any translated locale file was the monorepo file move.
  - Crowdin regenerates the file from its own database, which still holds the strings without placeholders, so the next sync will revert the edit.
- **Fix:** Close the PR and correct the strings in the [Crowdin project](https://crowdin.com/translate/excalidraw/10).

**2. Tokens are appended to strings that translate the key names, not the English text.**
- **Location:** `si-LK.json:285`, `:511`, `:566`, `:572`, with contributing values at `:570–571`.
- **Cause:** The existing si-LK values are machine translations of the identifiers. After the PR:
  - `:511` reads "Publication success content (Alice)". The English is "Thank you Alice. Your library has been submitted…".
  - `:566` interpolates `toast.canvas` and `toast.selection`, whose si-LK values mean "canvas toast" and "selection toast". The result reads "Copied to clipboard as PNG (canvas toast, Dark mode)". The word "toast" appears only in the key path, never in the English value.
  - `:572` reads "Pasting as a single element (Ctrl+Shift+V)". That is a statement. The English is an instruction: "Use {{shortcut}} to paste…, or paste into an existing text editor".
  - The author says they don't speak Sinhala and asks for someone to fix the phrasing before merge.
- **Fix:** Retranslate from the English source in Crowdin. If no translator is available, set these values to `""`. `t()` treats an empty string as falsy (`i18n.ts:140–143`) and falls back to the correct English with every placeholder intact.

**3. `<link>` is still dropped in a string the PR edits.**
- **Location:** `si-LK.json:511`; consumer at `LibraryMenuHeaderContent.tsx:116–128`.
- **Cause:**
  - This key renders through `<Trans>` with a `link` render prop.
  - `Trans` calls that prop only when the string contains a `<link>…</link>` pair (`Trans.tsx:12`).
  - The PR restores `{{authorName}}` but not the tags.
  - The anchor to `publishLibSuccess.url` therefore never renders, and that anchor is the dialog's only route to the submission-tracking page.
  - The author's checker evidently matched only `{{…}}`.
- **Fix:** Wrap the translated "here" in `<link>…</link>`, or blank the string as in finding 2.

**4. The change has no runtime effect, because si-LK cannot be loaded.**
- **Location:** `i18n.ts:21–75`, `percentages.json:46`, `InitializeApp.tsx:26`.
- **Cause:**
  - `si-LK` is not in the `languages` array.
  - It sits at 65% completion against the 85% threshold.
  - `languages.find(...) || defaultLang` falls back to English even if a host app passes `langCode="si-LK"`.
  - `si-LK.json` is therefore never imported, and "interpolated values silently lost" affects no user today.
  - The PR also leaves completion at 403 of 614 non-empty strings.
- **Fix:** No code change is needed. There is no urgency that would justify bypassing Crowdin.

**5. Placeholder drops of the same kind are missed, including one on a neighbouring line.**
- **Location:** `si-LK.json:569`, which is `toast.fileSavedToFilename`; consumer at `actionExport.tsx:297–300`.
- **Cause:**
  - This key uses a single-brace `{filename}`, substituted by a manual `.replace("{filename}", …)`.
  - A scan for `{{…}}` only does not see it. The si-LK value reads "File saved to file name" with no token.
  - My full audit found 20 mismatched strings before the PR and 17 after.
  - Of the 17, 3 are tracked in #12097 (`{{numShapes}}`, `{{maxSize}}`, `{{eventId}}`).
  - The other 14 are tracked nowhere: `{filename}` plus 13 strings that lose tags. For example, `errorSplash.headingMain` loses its reload `<button>`, and `publishDialog.noteLicense` loses the MIT `<link>`.
- **Fix:** Widen the check to `/\{\{[\w-]+\}\}|\{[\w-]+\}|<\/?[\w-]+>/` and file the remaining 14 strings against Crowdin.

**6. The PR description misstates what is on master.**
- **Location:** PR body, "…#12109's parity test suite currently exempts si-LK…".
- **Cause:** #12109 is open and unmerged. No locale parity test exists on master.
- **Fix:** Correct the description. The durable improvement is to land a parity test, for example through #12109. It should cover all three token kinds and list si-LK's known failures explicitly, not exempt the locale wholesale.

`★ Insight ─────────────────────────────────────`
- **An empty string is safer than a wrong one in this i18n layer.** `t()` chains lookups with `||`, so `""` falls through to English with every placeholder intact. That is why the completion script counts only non-empty strings. Patching a bad translation hides the gap, while blanking it records the gap honestly.
- **Excalidraw has three placeholder forms, and only one looks like a placeholder.** `{{var}}` is substituted by `t()`. `<tag>` is handled by `<Trans>` render props. A legacy `{var}` is substituted by ad-hoc `.replace()` calls. A parity checker that looks for one form will miss the other two, which is what happened in #12115.
- **For generated files, fix the generator.** The git history showed this clearly: a file with only bot commits is an output, not a source.
`─────────────────────────────────────────────────`