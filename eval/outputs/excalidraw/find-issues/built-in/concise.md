# concise / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `concise`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 27  wall: 396s  api: 345s
- cost: $3.3251  output tokens: 27748  words: 1185

---

I found 17 bugs and risks in the clipboard and paste code, listed below by severity. They all come from reading the code: I ran no tests and changed no files. I believe most also exist upstream rather than being local regressions, but I did not diff against upstream to confirm.

**High**

1. **`actions/actionClipboard.tsx:117-120` (`actionCut`), with `actions/manager.tsx:141`**
   - Cause: cut calls `actionCopy.perform()` without awaiting it, throws away its result, and then deletes the selection. Keyboard Ctrl+X reaches the action through the keydown handler with `value = null`, so it always takes the async `navigator.clipboard.writeText` route. If that write fails (permission denied, unfocused document, an iframe without `clipboard-write`), the elements are deleted, nothing lands on the clipboard, and the error is dropped. Only undo recovers the elements.
   - Fix: make `perform` async, await the copy, and skip the delete (returning the error state) when the copy fails.

**Medium**

2. **`clipboard.ts:221-225`, `App.tsx:4982-4999`, `data/blob.ts:422-445` (pasted HTML images)**
   - Cause: every `<img src="http…">` in pasted HTML is fetched automatically. There is no limit on the count, no timeout, and no size check before `response.blob()`. Same-origin URLs are fetched with cookies, so pasted content can trigger credentialed GETs against the host app, reveal the user's IP to third parties, or exhaust memory.
   - Fix:
     - Cap the number of image URLs.
     - Require `^https?://`.
     - Pass `credentials: "omit"` and `referrerPolicy: "no-referrer"` to `fetch`.
     - Add an `AbortController` timeout.
     - Reject on `Content-Length` or blob size before building the `File`.

3. **`App.tsx:4760-4815` and `actionClipboard.tsx:91-102` (async paste errors)**
   - Cause: `pasteFromClipboard` has no try/catch around `insertClipboardContent`. A throw from `restoreElements`, `convertToExcalidrawElements` on malformed API clipboard data, or `addMissingFiles` becomes an unhandled rejection with no message to the user. `actionPaste` calls `app.pasteFromClipboard(...)` without awaiting it, so its catch block and the `asyncPasteFailedOnParse` error can never fire for async failures.
   - Fix: await the call in `actionPaste`, and wrap the insertion in try/catch that sets `errorMessage`.

4. **`App.tsx:4918-4920` and `5326-5358` (`files` from clipboard JSON)**
   - Cause: the `files` object from the clipboard JSON goes into `addMissingFiles` without any shape validation. A `null` or malformed entry throws after `scene.replaceAllElements` has already run. The paste is then half-applied, with no history capture and no selection update. These files also bypass `imageOptions.maxFileSizeBytes` and the image MIME allow-list.
   - Fix: validate each entry (`id`, `dataURL` starting with `data:image/`, an allowed `mimeType`, a size cap) and do it before the scene is mutated.

5. **`App.tsx:4639` (non-image files on paste)**
   - Cause: paste sends every file on the clipboard to `insertImages`. The drop handler filters with `isSupportedImageFile` (`13239-13241`), but paste does not. Pasting a PDF or a `.excalidraw` file copied from a file manager inserts placeholders, then deletes them, shows an error, and leaves a no-op undo entry. Any text or elements in the same clipboard are ignored.
   - Fix: filter with `isSupportedImageFile`. If no images remain, fall through to the elements and text branches.

6. **`App.tsx:4977-5017` (mixed content)**
   - Cause: if the pasted HTML contains even one `<img>`, only the images are inserted and all the text is discarded. Text is only handled in the `else` branch. `parseClipboard` also returns `mixedContent` without `text/plain`, so there is nothing to fall back on.
   - Fix: insert both the text nodes and the images, or keep `text` alongside `mixedContent`.

7. **`App.tsx:4474-4502` (`onCopy` / `onCut`)**
   - Cause: there is no check for an empty selection or for selected DOM text. Ctrl+C with nothing selected overwrites the clipboard with empty-elements JSON and calls `preventDefault`, which also blocks copying text the user selected inside dialogs. Pasting that JSON back runs `addElementsFromPasteOrLibrary` with `[]`, which clears the selection, schedules a history capture, and may close the sidebar.
   - Fix:
     - Return early when no elements are selected or when `getSelection()` is non-collapsed.
     - Return early in the elements branch of `insertClipboardContent` when `data.elements` is empty.

**Low**

8. **`clipboard.ts:262-293` and `:295` (`readSystemClipboard`)**
   - Cause:
     - The `DataError` "clipboard is probably empty" return sits in the inner catch and only runs when `read` does not exist, so it is unreachable. An empty clipboard rethrows and the user sees an error dialog.
     - When `navigator.clipboard` is undefined, `for…of undefined` throws a TypeError.
     - The warning messages name the wrong API.
     - A denied `read()` is followed by a `readText()` call, which can prompt the user a second time.
   - Fix:
     - Check `error.name === "DataError"` on the outer error.
     - Skip the `readText` fallback on `NotAllowedError`.
     - Guard against an undefined `clipboardItems`.

9. **`App.tsx:628-630` and `5635-5644` (plain-paste flag)**
   - Cause:
     - `IS_PLAIN_PASTE` is a module-level global, so every editor instance on the page shares it.
     - It resets on a 100ms timer, so a paste event that arrives late is treated as a normal paste.
     - It is set by matching `event.key`, so Ctrl+Shift+V never sets it on non-Latin keyboard layouts.
   - Fix: also match `event.code === CODES.V`, and store the flag per instance.

10. **`App.tsx:5058-5108` (`addTextFromPaste`)**
    - Cause: a non-plain paste creates one text element per line, synchronously and with no upper bound. Each line also runs a frame hit-test and a text measurement, so pasting a large log freezes the UI.
    - Fix: above a line threshold, fall back to a single wrapped element.

11. **`clipboard.ts:345-350` (HTML text fallback)**
    - Cause: the HTML-text fallback uses `??`, so an empty `text/plain` value wins over the text extracted from the HTML and nothing is pasted. This branch also does not trim, unlike the one below it.
    - Fix: use `||` and trim the result.

12. **`App.tsx:4813` (`preventDefault` in paste)**
    - Cause: `event?.preventDefault()` runs after several awaits, by which point it has no effect.
    - Fix: call it synchronously as soon as the guards pass.

13. **`actionClipboard.tsx:264-268` (`copyText`)**
    - Cause: the async copy is not awaited, so the catch block is dead and failures go unreported.
    - Fix: make `perform` async and await the copy.

14. **`clipboard.ts:176-185` (`serializeAsClipboardJSON`)**
    - Cause:
      - `elementsMap` holds only the copied elements, so `getContainingFrame` returns a frame only when that frame is also in `framesToCopy`. The branch that clears `frameId` is therefore dead code.
      - The exported JSON keeps a dangling `frameId`.
      - In-app paste is unaffected, because `restoreElements` repairs the dangling id.
    - Fix: replace the condition with `element.frameId && !elementsMap.has(element.frameId)`.

15. **`clipboard.ts:640-680` (`execCommand` fallback)**
    - Cause: the fallback uses the global `document` and `window` rather than the editor's owner document, so it breaks when the editor runs in a pop-out window.
    - Fix: pass the owner document in.

16. **`charts/charts.parse.ts:6-13` (`tryParseNumber`)**
    - Cause:
      - `[\d.,]+` accepts `.`, `,` and `1.2.3`.
      - These produce `NaN`, which is not `null`, so the text is treated as a chart with NaN values.
      - Commas are stripped, so a European `1,5` becomes 15.
      - This check runs before every other text branch (`App.tsx:4624`).
    - Fix: tighten the regex and reject `NaN`.

17. **`wysiwyg/textWysiwyg.tsx:608-645` (container text editor)**
    - Cause: the container width is computed after an `await`, when the browser's default paste may already have updated `editable.value`. The pasted text is then counted twice.
    - Fix: read the value and selection synchronously, before the await.

Links and embeddable URLs on pasted elements are sanitized correctly (`restore.ts:493` and `embeddableURLValidator`).