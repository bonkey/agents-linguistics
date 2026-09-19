# caveman-ultra / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-ultra`  prompt: `review-pr-12116`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 17  wall: 163s  api: 92s
- cost: $1.0626  output tokens: 7952  words: 360

---

Investigation done. Verdict below.

## Verdict: reject (close, redirect to Crowdin)

Diff: 1 file, 4 lines, `packages/excalidraw/locales/si-LK.json`. JSON valid. Prettier not run (no `node_modules`).

## Findings, by severity

1. **Wrong channel. Crowdin overwrites edit.**
   - Location: `packages/excalidraw/locales/si-LK.json` (whole diff); policy in `packages/excalidraw/locales/README.md`, `crowdin.yml`.
   - Cause: README says "Please do not contribute changes directly to these files". All si-LK history = "Update translations from Crowdin". Next sync reverts PR.
   - Fix: close PR. Fix strings on Crowdin.

2. **Author does not speak Sinhala. Appended tokens produce nonsense.**
   - Location: `si-LK.json:511` (`publishSuccessDialog.content`), `:566`, `:572`, `:285`.
   - Cause: source strings are translations of key names, not of English text. `:511` reads "Publish success content (Alice)". `:566` renders "... (selection toast, dark)" because `toast.selection` = "තේරීම ටෝස්ට්". Placeholder parity passes, meaning stays wrong.
   - Fix: native speaker retranslates full strings on Crowdin. Alternative: empty the strings so `t()` falls back to English (`i18n.ts:133`).

3. **`<link>` tags still missing.**
   - Location: `si-LK.json:511`; consumer `LibraryMenuHeaderContent.tsx:116`.
   - Cause: en has `<link>here</link>`. PR adds only `{{authorName}}`. Status-tracking link never renders.
   - Fix: include `<link>…</link>` in retranslation.

4. **Incomplete. Same bug class remains in same file.**
   - Location: `alerts.confirmAddLibrary` (`{{numShapes}}`), `errors.fileTooBig` (`{{maxSize}}`), `errorSplash.trackedToSentry` (`{{eventId}}`), `toast.fileSavedToFilename` (`{filename}`, single brace, used by `.replace` at `actionExport.tsx:297`). 12 more strings lack `<bold>`/`<link>`/`<button>`/`<br>` tags.
   - Cause: PR scoped to #12115 list. Title claims "restore dropped placeholders". `{filename}` missed by both issue and PR (double-brace regex only).
   - Fix: narrow title, or cover all via Crowdin.

5. **Zero runtime impact. Locale unreachable.**
   - Location: `packages/excalidraw/i18n.ts:21-75`, `percentages.json:46`, `App.tsx:14124`.
   - Cause: `si-LK` absent from `languages` array. Completion 65 < `COMPLETION_THRESHOLD` 85. `langCode="si-LK"` falls back to `defaultLang`. File never loads. "Silently lost values" claim not reproducible.
   - Fix: none in code. Lowers urgency; supports closing.

6. **No regression guard.**
   - Location: PR adds no test. Referenced #12109 still open, exempts si-LK.
   - Cause: nothing stops recurrence after next Crowdin sync.
   - Fix: land parity test (#12109) first. Extend regex to single-brace `{x}` and `<tag>` pairs.

7. **Minor: en line break dropped.**
   - Location: `si-LK.json:566`.
   - Cause: en has `\n` before `({{exportColorScheme}})`. PR joins both tokens in one parenthetical.
   - Fix: mirror en structure in retranslation.

No file modified.