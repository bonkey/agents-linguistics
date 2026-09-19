# default / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `default`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 31  wall: 520s  api: 468s
- cost: $3.9924  output tokens: 36690  words: 1490

---

I found 12 bugs or risks in the clipboard and paste handling, plus a few minor ones, listed below by severity. They come from reading the code only; I did not run tests or reproduce anything at runtime, and I did not modify any file.

Paths are relative to `packages/excalidraw/`.

## 1. Cut deletes elements even when the copy fails
- **Location:** `actions/actionClipboard.tsx:117-120`, reached from `actions/manager.tsx:141-147`.
- **Cause:**
  - `actionCopy.perform()` is async but is not awaited, and its `errorMessage` result is discarded. `actionDeleteSelected` runs straight away regardless.
  - Ctrl+X goes through `handleKeyDown` with `value = null`, so there is no `ClipboardEvent` to write to. The write then depends on `navigator.clipboard.writeText`, which fails on an insecure origin, an unfocused document, or denied permission.
  - In those cases the elements disappear, the clipboard is unchanged, and no error is shown. Undo recovers them.
- **Fix:** make `perform` async and await the copy. If the copy result carries `errorMessage`, return that result and skip the delete.

## 2. `files` from pasted clipboard JSON are never validated
- **Location:** `clipboard.ts:542-550`, then `components/App.tsx:4918-4920`, `addMissingFiles` at `App.tsx:5326-5363`, and `element/src/image.ts:29`.
- **Cause:** pasted elements go through `restoreElements`, but `files` go in untouched.
  - A crafted `dataURL` can be a remote `http(s)` URL. It is loaded with `image.src`, which makes a network request and taints the canvas, so PNG export and copy-as-PNG break.
  - SVG normalization runs only when the entry declares its own `mimeType` as SVG, so a crafted entry can skip it.
  - A non-object entry throws at `fileData.id`. That happens after `replaceAllElements` at line 4897, so the elements are inserted with no selection and no history capture.
- **Fix:** in `parseClipboard`, keep only entries that:
  - are objects,
  - have an `id` equal to their key,
  - have a `dataURL` starting with `data:`,
  - have a `mimeType` that is an allowed image type and matches the `dataURL` prefix.

## 3. Paste sends every clipboard file to image insertion
- **Location:** `App.tsx:4639-4657` and `clipboard.ts:436-442`.
- **Cause:**
  - `getFiles()` filters only on `kind === "file"`, although its type predicate claims the files are images.
  - Paste never applies `isSupportedImageFile`, unlike the drop handler at `App.tsx:13239-13241`.
  - A PDF or `.excalidraw` file copied from a file manager gives an "unsupported file type" error. Placeholder images are inserted and then deleted under `CaptureUpdateAction.IMMEDIATELY`.
  - The `return` at line 4656 also blocks the elements and text branches.
- **Fix:**
  - Filter with `isSupportedImageFile`, and fall through to the other branches when no image remains.
  - Route `.excalidraw` files the way drop does.
  - Make the `getFiles` predicate match what it actually returns.

## 4. The paste pipeline has no error handling
- **Location:** `App.tsx:4760-4815`, `App.tsx:4687`, `clipboard.ts:478-511`, `actionClipboard.tsx:92`.
- **Cause:** any of these aborts the paste as an unhandled promise rejection (the mermaid chunk case is more common than it sounds).
  - `pasteFromClipboard` has no try/catch.
  - `actionPaste` does not await it, so its try/catch covers only `createPasteEvent`.
  - `await import("@excalidraw/mermaid-to-excalidraw")` sits outside the `try`. If the chunk fails to load (offline, stale deploy), pasting any text that starts with `graph`, `pie`, `block`, `timeline` and similar does nothing instead of falling back to plain text.
  - One unreadable file rejects the whole `Promise.all` in `parseDataTransferEvent`, which also discards the text items.
  - `restoreElements` throws on `elements: [null]`.
- **Fix:**
  - Wrap the body of `pasteFromClipboard` and set `errorMessage` on failure.
  - Move the mermaid import inside its `try`.
  - Catch per item in `parseDataTransferEvent`.
  - Await the paste in `actionPaste`.

## 5. Copy with nothing selected overwrites the system clipboard
- **Location:** `App.tsx:4489-4502` and `4474-4487`, `actionClipboard.tsx:28-36`, `App.tsx:4825-4951`.
- **Cause:**
  - There is no guard for an empty selection, and `preventDefault` always runs. Cmd+C with nothing selected replaces the clipboard with `{"type":"excalidraw/clipboard","elements":[],…}`.
  - Only `isWritableElement` is checked, so copying text selected in non-writable UI inside the editor container (dialogs, error messages) is hijacked too.
  - Pasting that empty payload back clears the current selection, closes the sidebar, schedules a history capture, and inserts nothing. `getCommonBounds([])` returns ±Infinity along the way.
- **Fix:**
  - In `onCopy` and `onCut`, return before `preventDefault` when nothing is selected or the DOM selection is non-collapsed.
  - Return early from `addElementsFromPasteOrLibrary` when no elements remain.

## 6. Async clipboard actions return a stale `appState`
- **Location:** `actionClipboard.tsx:38-44`, `73-79`, `82-88`, `95-101`, `220-233`, `238-243`. The merge happens at `App.tsx:3212-3217`.
- **Cause:**
  - `{...appState, …}` is captured before the `await`. After a permission prompt or a multi-second PNG export, it is merged over the live state.
  - Collaborators, selection, scroll, zoom and open dialogs changed in the meantime are reverted.
  - `actionCopyAsSvg` already does this correctly.
- **Fix:** return only the changed keys, `toast` or `errorMessage`.

## 7. `copyText` does not await the clipboard write
- **Location:** `actionClipboard.tsx:264-268`.
- **Cause:** `copyTextToSystemClipboard` is async and not awaited, so the surrounding try/catch never fires. A failed copy is an unhandled rejection and the user sees no error.
- **Fix:** make `perform` async, await the write, and return `errorMessage` on failure.

## 8. Text-editor paste detects Excalidraw data only by a custom MIME type
- **Location:** `wysiwyg/textWysiwyg.tsx:571-606` and `clipboard.ts:599-636`.
- **Cause:**
  - The custom MIME type is set only when a `ClipboardEvent` is available.
  - These paths write only `text/plain`, so raw JSON gets pasted into the text element:
    - context-menu copy,
    - Ctrl+X,
    - `exportToClipboard({type: "json"})`,
    - cross-browser pastes.
  - `preventDefault()` runs before the parse result is known. If `parsed.elements` is undefined the paste is swallowed.
  - The catch path falls through with the default already prevented, so nothing is inserted.
- **Fix:**
  - Check `clipboardData.getData("text/plain")` synchronously for the `excalidraw/clipboard` prefix.
  - When the parse fails, insert the plain text manually.

## 9. Mixed HTML paste is all-or-nothing and fetches without limits
- **Location:** `App.tsx:4969-5018`, `data/blob.ts:422-445`, `clipboard.ts:221-225`.
- **Cause:**
  - Any `<img src="http…">` in the pasted HTML causes all text to be dropped.
  - When every image fetch fails, which is the usual outcome because of CORS, the user gets only an error and no text.
  - Fetches run in parallel with no count cap, timeout, or size check before download, and can target arbitrary hosts including the intranet.
  - Images with `data:` sources are ignored.
- **Fix:**
  - Fall back to the text nodes when no image succeeds.
  - Cap the number and concurrency of fetches.
  - Add an `AbortController` timeout and check `Content-Length`.
  - Match `^https?://` instead of `startsWith("http")`.

## 10. Plain paste (Ctrl+Shift+V) is detected by `event.key`
- **Location:** `App.tsx:5635-5644` and `628-630`.
- **Cause:**
  - `event.key.toLowerCase() === "v"` never matches on non-Latin layouts such as Cyrillic or Greek, so plain paste behaves as a normal paste.
  - `IS_PLAIN_PASTE` is a module-level global shared by every editor instance on the page.
- **Fix:** also match `event.code === CODES.V`, or use `matchKey`. Keep the flag per instance.

## 11. `pasteFromClipboard` prevents default too late and always switches tool
- **Location:** `App.tsx:4809-4813`.
- **Cause:**
  - `event.preventDefault()` runs after several awaits, when event dispatch has already finished, so it does nothing.
  - `setActiveTool(selection)` runs even when nothing was pasted (empty clipboard, chart dialog opened, error), which drops a locked tool.
- **Fix:** call `preventDefault` synchronously once the guards pass, and switch tool only after an insert.

## 12. `readSystemClipboard` fallback logic is tangled
- **Location:** `clipboard.ts:262-293`.
- **Cause:**
  - A rejected `read()`, including a user-dismissed `NotAllowedError`, immediately triggers `readText()`, which can prompt a second time.
  - An empty clipboard (`DataError` from `read()`, empty `readText()`) rethrows, so the user sees the `errors.asyncPasteFailedOnRead` error message. The `DataError` guard is only reachable when `read` does not exist.
  - An undefined `navigator.clipboard` (insecure origin) ends in `for…of undefined`.
  - The warning text at line 268 names `readText()`, but it was `read()` that failed.
  - When the clipboard holds several `ClipboardItem`s, later ones overwrite earlier ones.
- **Fix:**
  - Check that the API exists up front.
  - Do not fall back on `NotAllowedError` or `AbortError`.
  - Treat `DataError` as an empty clipboard.

## Minor
- `clipboard.ts:346`:
  - **Cause:** `??` returns an empty `text/plain` instead of falling back to the HTML text, and this branch is not trimmed, unlike line 359.
  - **Fix:** use `||` and trim.
- `clipboard.ts:176-185` is dead code:
  - **Cause:** `elementsMap` holds only the copied elements, so `getContainingFrame` can only find frames that are already in `framesToCopy`.
  - **Effect:** `frameId` is never cleared at copy time, so the clipboard JSON and `onPaste` consumers see dangling `frameId`s. Pasting inside the editor is rescued by `bindElementsToFramesAfterDuplication`.
  - **Fix:** clear any `frameId` that is not in `framesToCopy`.
- `clipboard.ts:108-109`: `createPasteEvent` mutates the caller's `files` array; copy it first.
- `App.tsx:4598-4604` and `5021-5027`: text and image paste use `viewport.lastPosition` even on touch devices, while element paste uses `"center"` (`4672-4673`); use `"center"` on touch devices for text and images too.
- `clipboard.ts:203-209` and `604-605`:
  - **Cause:** full image dataURLs are written to the clipboard twice, then read back for a string comparison, so every copy of an image-heavy selection moves several MB.
  - **Fix:** skip the read-back comparison for large payloads.