# ste-concise / review-pr-12116

- project: `excalidraw` at `c0ad61c6743a`
- arm: `ste-concise`  prompt: `review-pr-12116`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 18  wall: 206s  api: 133s
- cost: $1.3746  output tokens: 11930  words: 673

---

**Verdict: reject.** Close [#12116](https://github.com/excalidraw/excalidraw/pull/12116) and send the correction to Crowdin. The repository is the wrong place for this fix, and the edited strings stay wrong after the change.

The PR is one commit, 650527f6, made on 17 September at 10:07 +0530. It changes 4 lines in `packages/excalidraw/locales/si-LK.json`.

## Findings, most severe first

1. Wrong channel for the fix.
   - Location: `packages/excalidraw/locales/si-LK.json`, the whole diff.
   - Cause: Crowdin owns the locale files (`crowdin.yml`, `dev-docs/docs/introduction/contributing.mdx:70`). Every commit to this file since 12 December 2023 is from Excalidraw Bot. The next Crowdin sync will probably overwrite a manual edit.
   - Fix: correct the 4 strings in the Crowdin project, then close the PR.

2. The change has no effect at runtime.
   - Location: `packages/excalidraw/i18n.ts:21-75`, `packages/excalidraw/locales/percentages.json:46`, `packages/excalidraw/components/InitializeApp.tsx:26`.
   - Cause: the `languages` list does not contain `si-LK`. Its completion is 65, below `COMPLETION_THRESHOLD = 85`. `langCode="si-LK"` falls back to English, so no build loads this file, and the bug in the PR body cannot occur.
   - Fix: none in code. The work belongs in Crowdin, with no urgency.

3. `publishSuccessDialog.content` still drops `<link>…</link>`.
   - Location: `si-LK.json:511`, use site `packages/excalidraw/components/LibraryMenuHeaderContent.tsx:116-128`.
   - Cause: the string has no `<link>` tag, so `Trans` never calls the `link` prop. The URL of the submitted library does not render. The base text reads "publication success content", a gloss of the key name. The result is "publication success content (name)".
   - Fix: translate the full English sentence in Crowdin, with `{{authorName}}` and `<link>…</link>`.

4. `toast.copyToClipboardAsPng` interpolates wrong strings.
   - Location: `si-LK.json:566`, with `:570-571`, use site `packages/excalidraw/actions/actionClipboard.tsx:224-231`.
   - Cause: `{{exportSelection}}` resolves to `toast.canvas` or `toast.selection`. In si-LK these read "canvas toast" and "selection toast". The toast then reads "Copied to clipboard as PNG (canvas toast, …)".
   - Fix: correct `toast.canvas` and `toast.selection` first. Then put `{{exportSelection}}` in the sentence as the object, and keep the `\n({{exportColorScheme}})` layout.

5. `toast.pasteAsSingleElement` loses the instruction.
   - Location: `si-LK.json:572`, use site `packages/excalidraw/components/App.tsx:5130`.
   - Cause: the base text reads "paste as a single element", a gloss of the key name. It drops "Use … to" and the second clause. The appended `({{shortcut}})` gives a label, not an instruction.
   - Fix: translate the full English sentence in Crowdin.

6. The scope does not match the title.
   - Location: `si-LK.json:280`, `:293`, `:410`, `:569`.
   - Cause: `{{numShapes}}`, `{{maxSize}}` and `{{eventId}}` stay dropped. [#12097](https://github.com/excalidraw/excalidraw/issues/12097) tracks them. `toast.fileSavedToFilename` drops `{filename}`, which `packages/excalidraw/actions/actionExport.tsx:297` replaces. No issue lists this one. 13 more strings drop tags such as `<link>`, `<bold>` and `<button>`.
   - Fix: add `{filename}` and the tag drops to [#12115](https://github.com/excalidraw/excalidraw/issues/12115), and correct them in Crowdin.

7. `alerts.removeItemsFromsLibrary` has the wrong tone for a confirm dialog.
   - Location: `si-LK.json:285`.
   - Cause: the text reads "Remove items from library (3)". The English source is a question.
   - Fix: a Sinhala speaker writes the question form with `{{count}}` inside the sentence.

8. The PR body has two errors and the PR has no test.
   - Location: the PR description.
   - Cause: the body says "4 missing placeholder tokens" and lists 5. It cites the parity suite of [#12109](https://github.com/excalidraw/excalidraw/pull/12109) as current. #12109 is open, and `packages/excalidraw/tests/localePlaceholders.test.ts` does not exist at c0ad61c6.
   - Fix: correct the body. The parity check belongs in #12109.

## Validation

I ran a parity script that compares `en.json` with the PR version of `si-LK.json`. The JSON parses, and the 5 tokens now match. I ran no test suite, because the change is JSON only. GitHub shows 0 check runs for 650527f6.

The Sinhala glosses in findings 3, 4, 5 and 7 are my own reading. The author states they do not speak Sinhala. The same pattern of glossed key names appears across the file, for example `errorSplash.headingMain` reads "main error". A Sinhala speaker must confirm the final strings.

The option that stays open is "request changes", which applies only if the maintainers accept direct locale edits outside Crowdin. In that case, require a Sinhala speaker to supply the full strings for findings 3 to 5 and 7.

I changed no tracked file. I created a local branch `pr-12116` and the scratch file `/tmp/si-LK-pr.json` to read the diff.