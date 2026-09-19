# i-have-adhd / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `i-have-adhd`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 32  wall: 482s  api: 394s
- cost: $3.6938  output tokens: 30319  words: 1292

---

No single fix is urgent. Start with #1: a failed copy during cut still deletes the selection, which is the only finding that loses user content.

I found 15 issues by reading the code, ranked below by severity. I could not run any tests because `node_modules` is not installed, so everything here comes from static reading. No files were modified. Paths are relative to `packages/excalidraw/` unless the path starts with `packages/` (#11).

## High: data loss and untrusted input

1. **Cut deletes elements even when the copy fails**
   - Location: `actions/actionClipboard.tsx:117-120`
   - Cause:
     - `actionCopy.perform(...)` is not awaited and its result, including `errorMessage`, is discarded.
     - Ctrl+X always passes `event = null`. `actions/manager.tsx:141-145` sends `null` and calls `preventDefault` on the keydown; I believe that suppresses the native `cut` event, but I have not checked it in a browser.
     - The copy therefore always goes through `navigator.clipboard.writeText`. If that rejects (Firefox without HTTPS, unfocused document, denied permission), the elements are deleted, the clipboard is stale and no error is shown.
   - Fix: make `perform` async and await the copy. If the copy returns `appState.errorMessage`, return that result and skip `actionDeleteSelected`.

2. **`files` in pasted JSON skip all image validation**
   - Location: `clipboard.ts:542-546`, `components/App.tsx:4671`, `components/App.tsx:5326-5363`, `packages/element/src/image.ts:30`
   - Cause:
     - Any `text/plain` JSON with `type: "excalidraw/clipboard"` supplies `files`, and they are added as-is.
     - There is no `dataURL` scheme check, no MIME allowlist and no `maxFileSizeBytes` check.
     - A `dataURL` of `https://…` goes straight into `image.src`. That causes a remote request for the user, for collaborators and for anyone who later opens the scene. It also taints the canvas, so PNG export throws.
     - A `null` entry throws on `fileData.id` after `replaceAllElements` has already run.
   - Fix: validate each file before `addMissingFiles`. Require an object with a string `id`, a `dataURL` starting with `data:image/`, a MIME type in `IMAGE_MIME_TYPES`, and a size within `imageOptions.maxFileSizeBytes`. Drop anything else.

3. **Pasted HTML triggers automatic fetches of arbitrary URLs**
   - Location: `clipboard.ts:221-225`, `components/App.tsx:4985-4988`, `data/blob.ts:422-445`
   - Cause:
     - Every `<img src="http…">` in the clipboard HTML is fetched without asking the user.
     - There is no cap on the number of URLs and no timeout.
     - `response.blob()` reads the whole body before any size check.
     - `startsWith("http")` also matches schemes other than http and https.
   - Fix: parse with `new URL` and allow only `http:` and `https:`. Cap the URL count, add an `AbortController` timeout, and reject on `Content-Length` above `maxFileSizeBytes`.

4. **The paste pipeline has no error handling**
   - Location: `components/App.tsx:4760-4815`, `actions/actionClipboard.tsx:91-93`
   - Cause:
     - `pasteFromClipboard` is async and has no try/catch.
     - `actionPaste` calls it without `await`, so its `asyncPasteFailedOnParse` catch only sees synchronous `createPasteEvent` errors.
     - `elements: [null]` throws in `arrayToMap` at `data/restore.ts:962`. Malformed API skeletons passed to `convertToExcalidrawElements` are not validated and likely throw as well.
     - The result is an unhandled rejection with no message, and the tool is not reset.
   - Fix: wrap the body in try/catch and set `errorMessage`. `await` the call in `actionPaste`. Make `clipboardContainsElements` require every entry to be an object with a string `type`.

5. **Paste does not filter files down to supported images**
   - Location: `clipboard.ts:436-442`, `components/App.tsx:4639-4657`
   - Cause:
     - `getFiles()` only checks `kind === "file"`, but its type guard claims the result is an image file.
     - The drop path filters with `isSupportedImageFile` at `components/App.tsx:13239-13241`; the paste path does not.
     - Pasting a copied PDF or `.excalidraw` file inserts placeholder elements, shows an error, and leaves deleted elements plus a history entry.
     - The accompanying text is ignored, and the `dataTransferFiles.length === 0` mixed-content branch is skipped.
   - Fix: filter with `isSupportedImageFile` at the top of `insertClipboardContent`. Fall through to elements or text when no images remain.

## Medium

6. **`readSystemClipboard` fallback is wired to the wrong error**
   - Location: `clipboard.ts:262-293`
   - Cause:
     - The `DataError` (empty clipboard) check reads the shadowed `readText` error, and only when `navigator.clipboard.read` is missing, so it never runs for a real `read()` failure.
     - An empty clipboard therefore shows the `asyncPasteFailedOnRead` dialog.
     - A `NotAllowedError` from `read()` still calls `readText()`, which means a second `readText()` call and possibly a second permission prompt in Safari (not verified).
     - When `navigator.clipboard` is undefined, the `for…of` loop throws a `TypeError`.
     - The first warning text (line 268) is wrong: `read()` failed, not `readText()`.
   - Fix: inspect the outer error first. Return `{}` for `DataError`, rethrow `NotAllowedError` and `AbortError` without falling back, and guard for a missing `navigator.clipboard?.read`.

7. **`copyText` error handling never runs**
   - Location: `actions/actionClipboard.tsx:264-268`
   - Cause:
     - `copyTextToSystemClipboard` is async and is not awaited, so the try/catch never fires and failures become unhandled rejections.
     - `components/ShareableLinkDialog.tsx:37` has the same kind of problem: it sets `justCopied` even after a failure.
   - Fix: make `perform` async, `await` the call, and return `appState.errorMessage`. Move `setJustCopied(true)` inside the `try`.

8. **Clipboard code ignores the editor's owner document**
   - Location: `clipboard.ts:62-72, 263, 567, 626, 647-677`, `data/blob.ts:453`
   - Cause:
     - The code uses the global `navigator`, `window` and `document`, while `App` uses `ownerDocument` and `ownerWindow`. Commit `e1bb9ff8` added render-into-another-document and left `clipboard.ts` untouched.
     - In a popup host, clipboard reads and writes run against the unfocused opener document and likely reject with "document not focused" (not run in a popup host).
     - The `execCommand` fallback appends its textarea to the wrong document.
     - `instanceof DataTransferItem` fails across realms, so file handles are lost.
   - Fix: pass `ownerWindow` and `ownerDocument` into the clipboard helpers. Duck-type the item check with `"getAsFileSystemHandle" in item`.

9. **`preventDefault` runs after awaits**
   - Location: `components/App.tsx:4813`, and skipped entirely on the early return at `components/App.tsx:4800`
   - Cause: event dispatch has finished by the time the awaits resolve, so the call has no effect and the default action and host-page handlers still run.
   - Fix: call `event.preventDefault()` synchronously right after the guards, before line 4791.

10. **Copy and cut take over the clipboard outside the canvas**
    - Location: `components/App.tsx:4474-4502`
    - Cause:
      - The guard only checks that focus is inside the container and the target is not writable.
      - Ctrl+C on text selected in a dialog or error message writes element JSON instead of the text.
      - With nothing selected it overwrites the system clipboard with `{"type":"excalidraw/clipboard","elements":[]}`.
    - Fix: return early when `ownerWindow.getSelection()` is non-collapsed, or when no elements are selected.

## Low

11. **Copied text contains auto-wrap line breaks**
    - Location: `packages/element/src/textElement.ts:579-581`, used by `actions/actionClipboard.tsx:265` and `wysiwyg/textWysiwyg.tsx:584`
    - Cause: the code reads `element.text`, which is the wrapped version, instead of `originalText`.
    - Fix: push `element.originalText`.

12. **Same-type clipboard images overwrite each other**
    - Location: `clipboard.ts:258, 295-306, 105-110`
    - Cause:
      - `types` is keyed by MIME type, so a second `image/png` item replaces the first.
      - `files.push` also mutates the caller's array.
    - Fix: collect files into an array and copy it before pushing.

13. **Mixed-content paste drops content silently**
    - Location: `components/App.tsx:4977-5017`, `clipboard.ts:221-225`
    - Cause:
      - Text is discarded whenever any image is present.
      - `data:` image sources are skipped.
      - If the image tool is unsupported, nothing happens and there is no `imageToolNotSupported` error, unlike `components/App.tsx:4654`.
    - Fix: insert both text and images, accept `data:image/` sources, and show the error.

14. **Copy-as-SVG likely loses user activation in Safari (not verified)**
    - Location: `data/index.ts:155-161`
    - Cause: the code awaits `svgPromise` before calling `writeText`. The PNG path avoids this with a Promise-based `ClipboardItem` (`clipboard.ts:557-571`).
    - Fix: write a `ClipboardItem` whose `text/plain` value is a promise.

15. **`IS_PLAIN_PASTE` is a module global with mismatched timers**
    - Location: `components/App.tsx:628-630, 3335, 5637, 5641`
    - Cause:
      - The flag is shared by every editor instance.
      - The timer is set with `ownerWindow.setTimeout` but cleared with the global `clearTimeout`, which can cancel an unrelated timer in the main window.
    - Fix: make it an instance field and clear it with `this.ownerWindow.clearTimeout`.

Next: open `packages/excalidraw/actions/actionClipboard.tsx:117` and read `actionCut`; it is a four-line fix.