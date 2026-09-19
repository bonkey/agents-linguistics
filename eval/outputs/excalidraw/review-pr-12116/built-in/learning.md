# learning / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `learning`  prompt: `review-pr-12116`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 24  wall: 225s  api: 156s
- cost: $1.427  output tokens: 12761  words: 1079

---

# Review of PR #12116, "fix(i18n): restore dropped placeholders in si-LK strings"

## Verdict: **Reject** (close the PR and move the fix to Crowdin)

The PR changes 4 lines in one JSON file, and it is syntactically valid. It should still not be merged, for three reasons:
- It edits a file the repo says not to edit by hand.
- The edit cannot reach any user.
- The strings it patches are not real translations.

I chose reject over request changes because no revision of this diff would be mergeable. The fix has to go through Crowdin. The author's bug-finding is good, and I'd say so when closing.

The PR has no CI check runs; only the Vercel preview deployed. I did not run `yarn test:update`, because a JSON-only change in an unregistered locale is not exercised by any test.

---

## Findings, most severe first

### 1. The file is managed by Crowdin, so a direct edit will be overwritten
- **Location:** `packages/excalidraw/locales/si-LK.json` (the whole diff). The policy is in `packages/excalidraw/locales/README.md:3` and `crowdin.yml`.
- **Cause:**
  - The README says: "Please do not contribute changes directly to these files, as we manage them with Crowdin."
  - Every previous commit to this file is an Excalidraw Bot Crowdin sync.
  - `origin/l10n_master` still has all four strings without placeholders, so the next sync PR reverts this change.
- **Fix:** Close the PR and correct the four strings in Crowdin's si-LK project. Crowdin's placeholder QA check can enforce this at the source.

### 2. The change has no runtime effect because si-LK cannot be loaded
- **Location:** `packages/excalidraw/i18n.ts:69-73` and `packages/excalidraw/components/InitializeApp.tsx:26`
- **Cause:**
  - `si-LK` appears zero times in `i18n.ts`, so it is not in the `languages` array. It is one of 12 locale files with no registration.
  - It is 65% complete, below `COMPLETION_THRESHOLD = 85`.
  - `InitializeApp` resolves `languages.find(code) || defaultLang`, so a host app passing `langCode="si-LK"` gets English.
  - The PR description says values are being "silently lost", but no user sees them.
- **Fix:** Nothing is needed in code. This is why the issue is not urgent and can go through Crowdin.

### 3. The patched strings are translations of the key names, not of the English text
- **Location:** `si-LK.json:285, 511, 566, 572` at the PR head
- **Cause:**
  - `publishSuccessDialog.content` now reads "Publish success content ({{authorName}})". The base string is the key name rendered in Sinhala.
  - The same pattern runs through the file. `errorSplash.headingMain` reads "Main error", and `publishDialog.noteDescription` reads "Note description".
  - Adding a token to such a string makes a placeholder parity check pass while the text is still wrong.
  - The author says they don't speak Sinhala and appended the tokens in parentheses.
- **Fix:** Have these strings retranslated from the English values in Crowdin, or blanked. An empty string falls back to English at `i18n.ts:141-142`, which is better than the current text.

### 4. A line the PR touches is still broken: the `<link>` tag is missing
- **Location:** `si-LK.json:511`, used at `packages/excalidraw/components/LibraryMenuHeaderContent.tsx:116-128`
- **Cause:**
  - The English string is `…track the status <link>here</link>`.
  - `Trans` only calls the `link` render prop when the tag is present in the string.
  - Without the tag, the dialog never shows the URL of the submitted library, and that link is the purpose of the dialog. This is a worse omission than the missing author name.
- **Fix:** Restore `<link>…</link>` around the relevant words in the Crowdin translation.

### 5. The fix is incomplete relative to its title
- **Location:** `si-LK.json:569` (`toast.fileSavedToFilename`), plus 12 other keys
- **Cause:**
  - My parity audit found 17 mismatched keys at the PR head, not 4.
  - `fileSavedToFilename` uses the single-brace `{filename}` form, which a `{{…}}`-only regex does not match.
  - That key is substituted with a raw `.replace("{filename}", …)` at `actions/actionExport.tsx:297`, so the missing token drops the filename.
  - Still missing: `{{numShapes}}`, `{{maxSize}}`, `{{eventId}}`, and 11 strings with tags (`<bold>`, `<link>`, `<button>`, `<issueLink>`, `<discordLink>`, `<br>`).
- **Fix:** Apply the same Crowdin pass as in finding 3. Any future parity test should match `{{x}}`, `{x}` and `<tag>`.

### 6. The restored placeholders would interpolate bad values
- **Location:** `si-LK.json:566`, with values from `si-LK.json:570-571`, called at `actions/actionClipboard.tsx:224-231`
- **Cause:**
  - `{{exportSelection}}` is filled from `toast.canvas` or `toast.selection`.
  - In si-LK those read "Canvas toast" and "Selection toast", which are also key-name translations.
  - The resulting toast would read "Copied to clipboard as PNG (Canvas toast, Dark mode)".
- **Fix:** Fix `toast.canvas` and `toast.selection` in the same Crowdin pass.

### 7. Minor: the PR description is inaccurate
- **Location:** PR body and issue #12115
- **Cause:**
  - The "parity test that exempts si-LK" is in #12109, which is still open. No such test exists in this tree; I searched for one.
  - The issue title says "5 more drops" but lists 4 keys.
- **Fix:** Reword these when the issue is refiled. The test-coverage suggestion belongs as a review comment on #12109.

---

`★ Insight ─────────────────────────────────────`
- **Two interpolation paths behave differently.** `t()` uses `String.replace`, which does nothing if the token is absent. `Trans` splits on a regex, and a tag's render prop is only called when the tag is present. A missing `{{var}}` drops one value, while a missing `<link>` removes an interactive element. That is why finding 4 ranks above the placeholder the PR did restore.
- **An empty string is better than a wrong one.** The `||` chain at `i18n.ts:141` treats `""` as missing and falls back to English. The 211 empty si-LK strings are therefore harmless, and a key-name translation is the worst case because it blocks that fallback.
- **The gate is two layers.** A locale needs a `languages` entry and at least 85% in `percentages.json`. Checking reachability first (finding 2) would have shown that this whole class of bug is cosmetic for now.
`─────────────────────────────────────────────────`

## Suggested closing note
- Thank the author; the parity-diff approach in #12115 is useful.
- Point to `locales/README.md` and Crowdin as the place for the fix.
- Keep #12115 open and relabel it as a Crowdin data-quality issue covering all 17 keys and the key-name translations.
- Move the test-coverage suggestion to #12109.

**Housekeeping:** I did not modify any tracked files, and the worktree is clean. I created a local ref, `pr-12116`, to read the diff. It will help if you want to check these findings; otherwise remove it with `git branch -D pr-12116`. `gh` was not authenticated, so the PR metadata came from the public GitHub REST API.