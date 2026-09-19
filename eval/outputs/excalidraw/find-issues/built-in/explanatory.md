# explanatory / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `explanatory`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 30  wall: 432s  api: 380s
- cost: $3.5052  output tokens: 29655  words: 1298

---

I found 13 issues in the clipboard and paste code. Two are high severity: cut can delete elements without a successful copy, and a malformed clipboard can half-apply a paste with no error shown. All findings come from reading the code; I did not run or reproduce anything, and no files were modified.

`★ Insight ─────────────────────────────────────`
- Clipboard APIs are tied to the synchronous event tick. `setData`, `getData` and `preventDefault` only work before the first `await`, and several findings come from async code crossing that boundary.
- Excalidraw writes the scene JSON to a custom MIME type and to `text/plain`, but the canvas paste path reads only `text/plain`/`text/html`. The custom type can only be written by `ClipboardEvent.setData` (the copy/cut event), so copy paths without a `ClipboardEvent` never set it (#4).
`─────────────────────────────────────────────────`

## High

**1. Cut deletes elements even when the copy failed**
- **Location:** `packages/excalidraw/actions/actionClipboard.tsx:117-120` and `actions/manager.tsx:141-147`
- **Cause:**
  - `actionCut` calls the async `actionCopy.perform(...)` without awaiting it and discards its result. It then deletes the selection synchronously.
  - On Ctrl+X the keydown path passes `value = null`, so there is no `ClipboardEvent`. The copy goes through async `navigator.clipboard.writeText`, then `execCommand`.
  - Both can fail (unfocused document, denied permission, Firefox on non-HTTPS). The `errorMessage` result is dropped, so the user loses the elements with no error.
- **Fix:**
  - Make `perform` async and await the copy.
  - If the copy returns an `errorMessage`, return that result and skip `actionDeleteSelected`.

**2. Paste has no error handling, and malformed clipboard JSON half-applies**
- **Location:** `App.tsx:4760-4815`, `actionClipboard.tsx:91-102`, `clipboard.ts:74-88`, `App.tsx:4897-4925`
- **Cause:**
  - `pasteFromClipboard` is async with no try/catch. `actionPaste` calls it without `await`, so its `asyncPasteFailedOnParse` handler only catches synchronous throws from `createPasteEvent`.
  - `clipboardContainsElements` only checks `Array.isArray(elements)`. A clipboard with `elements: [null]` throws in `arrayToMap` (`common/src/utils.ts:565`).
  - A clipboard with `files: {"a": null}` throws in `addMissingFiles` (`App.tsx:5336`). That throw happens after `scene.replaceAllElements` (4897) but before `store.scheduleCapture()` (4925).
  - The result is elements in the scene with no undo entry, no selection, no files, and an unhandled rejection.
- **Fix:**
  - Wrap the body of `pasteFromClipboard` in try/catch that sets `errorMessage`.
  - `await` it in `actionPaste`.
  - Validate element and file shapes in `clipboardContainsElements`.
  - Run `addMissingFiles` before mutating the scene.

## Medium

**3. Copy with nothing selected overwrites the user's clipboard**
- **Location:** `App.tsx:4489-4502`
- **Cause:**
  - `onCopy` runs `actionCopy` and calls `preventDefault()` whenever focus is inside the container and the target isn't writable.
  - With no selection it writes `{"type":"excalidraw/clipboard","elements":[]}` over whatever the user had.
  - It also takes over Ctrl+C on selectable UI text such as dialogs and error messages.
- **Fix:** Return early, without `preventDefault`, when no elements are selected or when `getSelection()` is not collapsed.

**4. Text-editor paste guard relies on a MIME type most copy paths never set**
- **Location:** `wysiwyg/textWysiwyg.tsx:571-574`, `clipboard.ts:615-636`
- **Cause:**
  - The guard checks for `application/vnd.excalidraw.clipboard+json`, which only `ClipboardEvent.setData` can write. That means Ctrl+C only.
  - Ctrl+X (keydown path) and context-menu Copy/Cut fall back to `writeText`, which sets `text/plain` only.
  - Pasting into a text element then inserts the raw scene JSON, including base64 image data.
- **Fix:**
  - In the handler, also check `getData("text/plain")` synchronously for the excalidraw clipboard prefix and parse it as a fallback.
  - Optionally write a `web `-prefixed custom format via `navigator.clipboard.write`.

**5. HTML paste fetches remote images unbounded and drops text**
- **Location:** `clipboard.ts:221-225`, `App.tsx:4977-5008`, `data/blob.ts:422-445`
- **Cause:**
  - Every `<img src="http…">` in pasted HTML is fetched in parallel. There is no cap on count, no timeout, and no size limit before `response.blob()`.
  - This leaks the user's IP to whoever hosts the image and can exhaust memory.
  - When any image is present, all text is discarded. If the fetches fail (CORS is the common case), the user gets an error dialog and nothing pasted, although `text/plain` was available.
  - `startsWith("http")` is a loose scheme check.
- **Fix:**
  - Check the protocol strictly with `new URL()`.
  - Cap count and size, and add an `AbortController` timeout.
  - Keep `text` alongside `mixedContent` and fall back to it when no image loads.

**6. `readSystemClipboard` fallback logic is inverted**
- **Location:** `clipboard.ts:262-295`
- **Cause:**
  - The "clipboard probably empty" `DataError` branch only runs when `navigator.clipboard.read` doesn't exist, and only for errors thrown by `readText`. It is effectively unreachable.
  - In practice, an empty clipboard makes `read()` throw `DataError`, `readText()` returns `""`, and the original error is rethrown. The user sees `asyncPasteFailedOnRead`.
  - A permission denial on `read()` triggers a second attempt through `readText()`.
  - If `navigator.clipboard` is undefined, `clipboardItems` is `undefined` and the `for…of` throws a TypeError.
  - The warning messages are swapped.
  - In Firefox, any read error shows the `firefox_clipboard_write` hint (`actionClipboard.tsx:72-79`).
- **Fix:**
  - Handle `DataError` first and return `{}`.
  - Rethrow `NotAllowedError` without falling back to `readText`.
  - Guard `if (!clipboardItems) return types`.

## Low

**7. `preventDefault()` after awaits does nothing**
- **Location:** `App.tsx:4813`
- **Cause:**
  - The paste event has finished dispatching by then.
  - The line is also skipped entirely when `onPaste` returns `false`.
- **Fix:** Call it synchronously after the guard checks, before line 4791.

**8. Dead frame-stripping branch when copying**
- **Location:** `clipboard.ts:150-188`
- **Cause:**
  - `elementsMap` holds only the copied elements. If `getContainingFrame` returns non-null, the frame is already in `framesToCopy`, so the condition can never be true.
  - The clipboard JSON keeps dangling `frameId`s.
  - Excalidraw's own paste is rescued by `bindElementsToFramesAfterDuplication` (`element/src/frame.ts:68`). `onPaste` hosts and other consumers see orphaned IDs.
- **Fix:** Test `element.frameId && !copiedFrameIds.has(element.frameId)`.

**9. Text fallback quirks in HTML parsing**
- **Location:** `clipboard.ts:213-231` and `343-351`
- **Cause:**
  - `??` lets an empty `text/plain` beat non-empty HTML text.
  - That branch is not trimmed, unlike line 359.
  - `parseHTMLTree` collects text from `<style>`/`<script>` inside `<body>`. With no `text/plain` on the clipboard, that CSS or script source is pasted as text.
- **Fix:**
  - Use `||` and `.trim()`.
  - Skip `STYLE`, `SCRIPT` and `TEMPLATE` nodes.

**10. Non-image files are treated as images on paste**
- **Location:** `clipboard.ts:436-442`, `App.tsx:4639`
- **Cause:**
  - `getFiles()` claims to return image types but filters only on `kind === "file"`.
  - The paste path passes every file to `insertImages`, while the drop path filters with `isSupportedImageFile` (`App.tsx:13241`).
  - A PDF copied from the file manager inserts a placeholder, shows an error, and returns before element or text handling.
- **Fix:**
  - Filter with `isSupportedImageFile` in the paste path.
  - Make the type predicate honest.

**11. try/catch around un-awaited clipboard writes**
- **Location:** `actionClipboard.tsx:264-268` (`copyText`), `App.tsx:3006`
- **Cause:** The promise is not awaited, so the `catch` can never fire. Failures become unhandled rejections and the user is told nothing.
- **Fix:** Make these async and await the write.

**12. Stale selection after `await` in text-editor paste**
- **Location:** `textWysiwyg.tsx:578-594` and `639-644`
- **Cause:**
  - `selectionStart`, `selectionEnd` and `value` are read after awaits.
  - In the default-paste branch the browser has already inserted the text, so `nextText` contains it twice and the width is overestimated (clamped by `maxWidth`).
- **Fix:** Capture the selection and value synchronously at the top of the handler.

**13. Module-level state and import-time environment access**
- **Location:** `App.tsx:628-630`, `clipboard.ts:62-72`
- **Cause:**
  - `IS_PLAIN_PASTE` and `PLAIN_PASTE_TOAST_SHOWN` are shared across editor instances on one page.
  - The feature probes touch `navigator` at import time. On server-side rendering (SSR) with Node < 21 this throws `ReferenceError`.
- **Fix:**
  - Move the flags to instance fields.
  - Add `typeof navigator !== "undefined"` guards.

`★ Insight ─────────────────────────────────────`
- #1, #2 and #11 share one root cause: an async function called without `await` inside a try/catch that then can't catch anything. A lint rule such as `@typescript-eslint/no-floating-promises` would flag all three.
- #2 and #5 share a trust-boundary problem. The clipboard is untrusted input, but only `restoreElements` sanitizes it (for example `normalizeLink` on links). The files map and HTML image URLs pass through unchecked.
`─────────────────────────────────────────────────`