# i-have-adhd / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `i-have-adhd`  prompt: `review-pr-12116`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 16  wall: 368s  api: 282s
- cost: $2.3619  output tokens: 8695  words: 688

---

**Verdict: reject.** Close #12116 and fix the four strings in [Crowdin](https://crowdin.com/translate/excalidraw/10). The edit would be overwritten by the next Crowdin sync, and si-LK is never loaded at runtime. No files were modified.

I got the diff from the local `pr-12116` branch (1 commit, `si-LK.json`, +4/−4) and the PR and issue text from the public API. I checked every finding below against source.

## Blocking

1. **Manual edit to a Crowdin-generated file**
   - Location: `packages/excalidraw/locales/si-LK.json` (whole diff), `packages/excalidraw/locales/README.md:3`, `crowdin.yml`
   - Cause: The README says not to edit these files directly because Crowdin manages them. `origin/l10n_master` (4051fc9f, 2026-09-14) still holds the four old strings, so the next "Update translations from Crowdin" PR reverts this change. The strings first appeared in Crowdin sync #7429 (d1f39823).
   - Fix: Close the PR and correct the strings in Crowdin.

2. **No user-visible effect**
   - Location: `packages/excalidraw/i18n.ts:20-74`, `packages/excalidraw/locales/percentages.json:46`
   - Cause: `si-LK` is not in the `languages` array. Its completion is 65, below `COMPLETION_THRESHOLD = 85`. `langCode="si-LK"` resolves to English and `si-LK.json` is never imported.
   - Fix: Nothing to ship. Audit the placeholders when the locale reaches 85% and is registered.

## Defects in the four edited strings

3. **`publishSuccessDialog.content` still lacks `<link>…</link>`**
   - Location: `si-LK.json:511`
   - Cause: Only `{{…}}` tokens were checked. en.json:519 has `<link>here</link>`. `Trans` (`LibraryMenuHeaderContent.tsx:117`) calls the `link` prop only when the tag is in the string, so the link to the submission never renders.
   - Fix: Add the tag pair around a translated "here", or set the value to `""`.

4. **Tokens appended to key-name pseudo-translations**
   - Location: `si-LK.json:285`, `511`, `566`, `572`
   - Cause: The existing values translate the key names, not the English source. Line 511 renders as "Publish success content (Alice)". Line 572 reads "Pasting as a single element (Ctrl+Shift+V)", but `App.tsx:5130` shows this toast after the paste was split into several elements, and it drops the "or paste into an existing text editor" half. The author states they do not speak Sinhala.
   - Fix: Set all four to `""`. `t()` then falls back to en.json through the `||` chain at `i18n.ts:141-143`. Otherwise get a real translation through Crowdin.

5. **`{{exportSelection}}` is filled from nonsense values**
   - Location: `si-LK.json:566`, fed by `si-LK.json:570-571`
   - Cause: `actionClipboard.tsx:224` interpolates `toast.canvas` and `toast.selection`. Their si-LK values mean "canvas toast" and "selection toast". The PNG toast becomes "Copied to clipboard as PNG (selection toast, dark mode)".
   - Fix: Correct or blank lines 570-571 in the same change.

## Incomplete: 17 placeholder or tag mismatches remain after this PR

A parity script run against the PR branch still finds these; they predate the PR, and the issue says three more are already tracked in #12097.

6. **Missing value placeholders**
   - Location:
     - `si-LK.json:280` `alerts.confirmAddLibrary` lacks `{{numShapes}}`
     - `:293` `errors.fileTooBig` lacks `{{maxSize}}`
     - `:410` `errorSplash.trackedToSentry` lacks `{{eventId}}`
     - `:569` `toast.fileSavedToFilename` lacks the single-brace `{filename}`
   - Cause: Same key-name translations as above. Line 569 was missed because only `{{…}}` was audited; `actionExport.tsx:297` uses `.replace("{filename}", …)`, so the filename never shows.
   - Fix: Same as finding 4.

7. **Missing render tags**
   - Location:
     - `si-LK.json:407`, `408`, `411`: `errorSplash.headingMain`, `clearCanvasMessage` and `openIssueMessage` lack `<button>`
     - `:502-504`: `publishDialog.noteDescription`, `noteGuidelines` and `noteLicense` lack `<link>`
     - `:303-306`: `errors.brave_measure_text_error.line1-4` lack `<bold>`, `<link>`, `<issueLink>` and `<discordLink>`
     - `:643`, `648`: the `overwriteConfirm.modal` descriptions for `loadFromFile` and `shareableLink` lack `<bold>` and `<br>`
   - Cause: `Trans` never calls render props whose tags are absent from the string. The crash screen (`TopErrorBoundary.tsx`) would have no reload, clear-canvas or bug-report buttons. The overwrite modal also loses its data-loss warning.
   - Fix: Same as finding 4.

## Process gap

8. **No check compares locale placeholders against en.json**
   - Location: no parity test exists on master. The one proposed in open PR #12109 exempts si-LK, as this PR's description notes.
   - Cause: Placeholder and tag drift cannot fail CI.
   - Fix: In #12109, cover `<tag>` and `{single}` tokens as well as `{{…}}`. Remove the si-LK exemption once the strings are blanked or fixed.

Next: post the close comment on #12116 pointing the author to Crowdin, and suggest blanking the 21 mismatched strings to `""` there (the four in this PR plus the 17 in findings 6 and 7) — about two minutes.