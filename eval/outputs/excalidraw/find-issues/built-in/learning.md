# learning / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `learning`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 32  wall: 546s  api: 489s
- cost: $4.1411  output tokens: 38634  words: 1421

---

I found 12 bugs and risks in the clipboard and paste handling, listed below by severity. All of them come from reading the code: `node_modules` isn't installed, so I couldn't run the test suites, and installing would have modified the tree. No files were changed.

`★ Insight ─────────────────────────────────────`
- Clipboard data is only readable in the same tick as the event. The code reads every item correctly within that tick.
- Several of the bugs below come from the opposite mistake: an `async` function's promise is dropped. `withBatchedUpdates` and `actionCut` both do this, so failures never reach the user.
`─────────────────────────────────────────────────`

## High

**1. Cut deletes the selection without knowing whether the copy succeeded**
- **Location:** `packages/excalidraw/actions/actionClipboard.tsx:117-121`, `packages/excalidraw/actions/manager.tsx:145-147`, `packages/excalidraw/components/App.tsx:4474`
- **Cause:**
  - `actionCut` calls `actionCopy.perform(...)` without awaiting it, then runs `actionDeleteSelected` in the same tick. The copy failure result (`{appState: {errorMessage}}`) is thrown away.
  - `actionCut` also has a `keyTest` for Ctrl/Cmd+X. `handleKeyDown` calls `preventDefault()` on the keydown, which in the major browsers stops the native `cut` event from firing, and performs the action with `value = null`.
  - So keyboard cuts never reach `onCut` or the reliable `setData` path. They go through async `navigator.clipboard.writeText`, which fails in cross-origin iframes without `clipboard-write`, in insecure contexts, and in unfocused documents.
  - The elements disappear and the clipboard holds nothing. Undo is the only recovery.
- **Fix:** Make `perform` async, await the copy, and return the error without deleting if the copy failed. Remove `keyTest` from `actionCut`, as `actionCopy` already does, so keyboard cuts go through `onCut` with the real `ClipboardEvent`.

**2. HTML paste with any `<img>` drops all the text, and often pastes nothing**
- **Location:** `packages/excalidraw/clipboard.ts:341-354` and `:532-536`, `App.tsx:4613-4620`, `App.tsx:4977-5008`
- **Cause:**
  - One `<img src="http…">` in the pasted HTML makes `parseClipboard` return only `{mixedContent}` and discard `text/plain`.
  - `addElementsFromMixedContentPaste` then inserts only the images. `ImageURLToFile` uses a CORS `fetch`, which most third-party hosts reject.
  - Pasting a paragraph with one inline icon therefore shows an error dialog and inserts nothing.
  - `insertImages([])` still runs, which adds an empty undo entry and triggers `actionFinalize`.
- **Fix:**
  - Keep `text` next to `mixedContent` in `ClipboardData`.
  - Fall back to `addTextFromPaste` when no image resolves.
  - Skip `insertImages` when the list is empty; ideally insert both text and images.

**3. Errors in the paste pipeline can't be observed**
- **Location:** `App.tsx:4760`, `packages/excalidraw/reactUtils.ts:10-17`, `actionClipboard.tsx:91-102`, `App.tsx:4687`
- **Cause:**
  - `pasteFromClipboard` is an async function wrapped in `withBatchedUpdates`, which returns `void`. The `try/catch` in `actionPaste` only catches synchronous throws from `createPasteEvent`.
  - `errors.asyncPasteFailedOnParse` is therefore unreachable for real parse or insert failures. The public API type also says it returns a Promise when it actually returns `undefined`.
  - Known ways to reject silently:
    - The mermaid import sits outside its `try`, so an offline chunk failure ends the paste instead of falling back to text.
    - `convertToExcalidrawElements` throws on malformed `excalidraw-api/clipboard` JSON, for example `elements: [null]`.
    - `addMissingFiles` throws on `files: {a: null}`. This happens after `replaceAllElements` and before `scheduleCapture`/`setState`, which leaves a half-applied paste.
- **Fix:** Return the promise instead of wrapping the whole async function. Add a top-level `try/catch` that sets `errorMessage`. Move the import inside its `try`.

## Medium

**4. The `files` map from clipboard JSON is trusted as-is**
- **Location:** `clipboard.ts:543-546`, `App.tsx:4669-4671`, `App.tsx:5326-5363`, `packages/element/src/image.ts:30`
- **Cause:**
  - Elements go through `restoreElements`, but `files` is not validated. Any `text/plain` JSON with `type: "excalidraw"` qualifies, wherever it came from.
  - `dataURL` can be an `https://` URL. Because the image is loaded with `image.src = dataURL`, that becomes a tracking beacon stored in the scene's `files`, and anyone the host app shares those files with loads the same URL.
  - `mimeType` is trusted as claimed, and SVG normalization depends on that claim.
  - `imageOptions.maxFileSizeBytes` and the resize limits are bypassed.
- **Fix:**
  - Require a `data:` URL whose MIME type is in `IMAGE_MIME_TYPES` and matches the claimed type.
  - Enforce the size limit.
  - Import only the fileIds that the pasted image elements reference.

**5. Paste treats every clipboard file as an image**
- **Location:** `clipboard.ts:436-442`, `App.tsx:4639-4657`. The drop handler at `App.tsx:13239-13241` filters correctly.
- **Cause:**
  - `getFiles()` filters on `kind === "file"` only, but its type predicate claims an image MIME type, so TypeScript doesn't flag the problem.
  - Pasting a copied PDF or `.excalidraw` file inserts a placeholder, which then fails with "unsupported file type".
  - The early `return` means valid `data.elements` or `data.text` in the same clipboard are never looked at.
- **Fix:**
  - Filter with `isSupportedImageFile` and correct the type predicate.
  - Fall through to the elements and text handling when no image files remain.
  - Send `.excalidraw` files to `loadFileToCanvas`, as the drop handler does.

**6. The custom MIME type is only written on the event path, so the text editor can paste raw JSON**
- **Location:** `clipboard.ts:599-636`, `packages/excalidraw/wysiwyg/textWysiwyg.tsx:571-574`
- **Cause:**
  - The `writeText` and `execCommand` fallbacks write only `text/plain`.
  - Context-menu Copy and Cut, keyboard Cut (finding 1) and `exportToClipboard` never set `application/vnd.excalidraw.clipboard+json`.
  - The text editor relies on that type alone to detect Excalidraw content. Pasting into a text element after one of those copies inserts the whole JSON blob.
- **Fix:** Also check `text/plain` synchronously with `event.clipboardData.getData`, using a cheap marker check before `JSON.parse`.

**7. Remote image fetching on paste has no limits**
- **Location:** `App.tsx:4982-4999`, `packages/excalidraw/data/blob.ts:422-445`, `clipboard.ts:223`
- **Cause:**
  - Every `<img>` URL is fetched in parallel, with no cap on the count.
  - There is no timeout, and no size check before `response.blob()`.
  - `startsWith("http")` is a loose scheme check.
  - Hundreds of images mean hundreds of requests and placeholders. One slow host hangs the whole paste, because nothing is inserted until every fetch has settled. The user's IP is also sent to third parties without them choosing to.
- **Fix:**
  - Cap the number of images.
  - Add `AbortSignal.timeout`.
  - Enforce a byte limit.
  - Parse with `new URL()` and check the protocol.

## Low

**8. The fallback logic in `readSystemClipboard` is tangled**
- **Location:** `clipboard.ts:262-293`, `:306`
- **Cause:**
  - In insecure contexts `navigator.clipboard?.read()` returns `undefined`, so the `for…of` loop throws a TypeError.
  - The `DataError` "clipboard is empty" check looks at the `readText` error, in a branch reached only when `read` doesn't exist. `DataError` actually comes from `read()`, so an empty clipboard shows the generic failure dialog.
  - The two warning messages are swapped.
  - `types[type] = file` keeps only one image per MIME type.
- **Fix:** Check that the API exists first, and handle `DataError` in the outer catch.

**9. Clipboard writes that report success without checking**
- **Location:** `actionClipboard.tsx:264-268`, `App.tsx:3006-3009`
- **Cause:** `copyTextToSystemClipboard` is async but isn't awaited inside the `try`, so the `catch` never runs. At `App.tsx:3006-3009` the "copied to clipboard" toast shows even when the write failed.
- **Fix:** Await the call.

**10. The frame-stripping branch in `serializeAsClipboardJSON` can never run**
- **Location:** `clipboard.ts:150`, `:176-185`
- **Cause:**
  - `elementsMap` holds only the copied elements. `getContainingFrame` therefore returns a frame only when that frame is being copied, which is exactly when `framesToCopy.has()` is true. The condition can't be satisfied.
  - Elements copied without their frame keep a stale `frameId` in the clipboard JSON.
  - The editor's own paste is saved by `restoreElements` (`restore.ts:874-886`), but `onPaste` hosts and consumers of the exported JSON receive the dangling ids.
- **Fix:** Test the raw id instead: `element.frameId && !framesToCopyIds.has(element.frameId)`.

**11. Plain-paste detection depends on keyboard layout and a module-level flag**
- **Location:** `App.tsx:628-630`, `:5635-5644`
- **Cause:**
  - `event.key.toLowerCase() === KEYS.V` fails on non-Latin layouts. On a Russian layout the key is "м", so Ctrl+Shift+V silently pastes rich content.
  - The flag and its 100 ms timer are module globals shared by every editor instance on the page.
- **Fix:** Also match `event.code === CODES.V`, and move the flag to an instance field.

**12. Ctrl/Cmd+C with nothing selected overwrites the system clipboard**
- **Location:** `App.tsx:4489-4502`
- **Cause:**
  - `onCopy` always calls `preventDefault()` and writes JSON, even when `elements` is empty.
  - It also takes over copying of text selected in non-editable UI inside the container.
- **Fix:** Return early, without `preventDefault()`, when nothing is selected or when `getSelection()` is non-collapsed.

Finding 1 depends on keydown `preventDefault()` suppressing the `cut` event, which is how Chrome, Firefox and Safari behave. If a browser did not suppress it, `actionCut` would run twice and the second run would overwrite the clipboard with an empty selection, which is also a bug.

Findings 1 and 6 share a root cause: `actionCut` has a `keyTest` and `actionCopy` deliberately does not. Removing it fixes finding 1 and the keyboard-cut part of finding 6.