# caveman-ultra / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-ultra`  prompt: `find-issues`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 25  wall: 412s  api: 349s
- cost: $3.2685  output tokens: 27266  words: 1034

---

Static review only. Nothing executed, no files modified. Findings are ordered by severity.

**High**

1. `packages/excalidraw/actions/actionClipboard.tsx:117-120` (`actionCut`)
   - Cause:
     - `actionCopy.perform()` is not awaited and its result is dropped. `actionDeleteSelected` runs regardless, so a failed copy still deletes the elements and shows no error.
     - Ctrl+X matches `keyTest` and the action manager calls `preventDefault` on keydown. If browsers then suppress the `cut` event (browser behavior, not verified), copy runs with `event = null`.
     - Copy then depends on `navigator.clipboard.writeText`, which fails on HTTP, in an iframe without `clipboard-write`, or when the document is unfocused.
   - Fix: make `perform` async and await the copy. On failure return `errorMessage` and skip the delete. Drop `keyTest` so the `onCut` event path (with `clipboardData`) handles Ctrl+X.

2. `packages/excalidraw/components/App.tsx:4639`, `packages/excalidraw/clipboard.ts:436-442`
   - Cause:
     - The paste path maps every clipboard file to `imageFiles`. `getFiles()` filters only on `kind === "file"`, and its type guard wrongly claims image MIME types.
     - A non-image file (a PDF copied in Finder, for example) goes to `insertImages`, shows an error, and returns. The accompanying text is never pasted.
     - The drop path filters correctly at `App.tsx:13236`.
   - Fix: add `.filter(isSupportedImageFile)` in the paste path. Fall through to elements or text when no files remain.

**Medium**

3. `packages/excalidraw/clipboard.ts:262-295` (`readSystemClipboard`)
   - Cause:
     - The `DataError` check tests the inner `readText` error, and only when `clipboard.read` is missing. It cannot match the outer `read()` error.
     - An empty clipboard therefore rethrows and shows an "asyncPasteFailedOnRead" dialog.
     - When `navigator.clipboard` is undefined, `clipboardItems` is `undefined` and `for…of` throws `TypeError`.
     - The warn message names the wrong API.
   - Fix: check `error.name === "DataError"` on the outer error first. Guard a missing `navigator.clipboard`. Correct the message.

4. `packages/excalidraw/components/App.tsx:4760-4815`, `:4687`; `packages/excalidraw/actions/actionClipboard.tsx:91-102`
   - Cause:
     - `pasteFromClipboard` has no try/catch. `await import("@excalidraw/mermaid-to-excalidraw")` sits outside its `try`, so an offline or stale chunk gives an unhandled rejection and no text fallback.
     - `actionPaste` does not await `pasteFromClipboard`, so `asyncPasteFailedOnParse` is unreachable for async errors.
     - Clipboard JSON with `elements: [null]` throws at `packages/excalidraw/data/restore.ts:962` and `:971`, outside the per-element try.
   - Fix: move the import inside the try. Wrap `insertClipboardContent` in try/catch that sets `errorMessage`. Await the call in `actionPaste`. Filter non-object elements in `clipboardContainsElements`.

5. `packages/excalidraw/wysiwyg/textWysiwyg.tsx:571-608`
   - Cause:
     - Detection depends on the custom MIME type `excalidrawClipboard`. Context-menu copy (and keyboard cut per finding 1) use `writeText`, which writes only `text/plain`.
     - Pasting into the text editor then inserts the raw JSON.
     - The `catch` after `preventDefault()` falls through to code that inserts nothing, so the paste is lost.
   - Fix: parse `text/plain` with `parseClipboard` and branch on `parsed.elements`. In the catch, insert the plain text manually.

6. `packages/excalidraw/clipboard.ts:221-225`, `packages/excalidraw/components/App.tsx:4985`, `packages/excalidraw/data/blob.ts:428`
   - Cause:
     - Pasted HTML triggers an automatic `fetch` of every `<img src>`.
     - There is no count cap, timeout, or size limit.
     - The `startsWith("http")` check is loose. Untrusted HTML can leak the user's IP, probe the local network, or hang the paste.
   - Fix: validate with `new URL()` and allow only the `http:` and `https:` protocols. Cap the image count. Use `AbortController` with a timeout and a size check.

7. `packages/excalidraw/components/App.tsx:4489-4502` (`onCopy`)
   - Cause:
     - Copy is hijacked whenever focus is inside the editor container and the target is not writable.
     - Text selected in a dialog or error message cannot be copied.
     - An empty element selection overwrites the clipboard with `{"elements":[]}`.
   - Fix: bail out if `getSelection()` is non-collapsed or no elements are selected. Call `preventDefault` only after data is set.

**Low**

8. `packages/excalidraw/actions/actionClipboard.tsx:264-268` (`copyText`)
   - Cause: the promise is not awaited, so the `try/catch` is dead and a failure is an unhandled rejection. `getTextFromElements` (`packages/element/src/textElement.ts:580`) copies the wrapped `text`, which has hard line breaks.
   - Fix: make `perform` async and await the copy. Use `originalText`.

9. `packages/excalidraw/clipboard.ts:216-220`, `:346`
   - Cause: `parseHTMLTree` also emits text nodes from `<style>` and `<script>`. The `??` operator keeps an empty `text/plain` and discards the HTML text. That branch does not trim, unlike line 359.
   - Fix: skip STYLE, SCRIPT and comment nodes. Use `||` and trim.

10. `packages/excalidraw/components/App.tsx:4776-4786`
    - Cause:
      - The canvas gate uses `viewport.lastPosition`, which stays `(0,0)` until the first pointermove and goes stale on touch.
      - In an embedded editor away from the page origin, paste is silently ignored.
      - A context-menu paste lands at the menu item's position, not where the right-click happened.
    - Fix: gate on focus and target instead. Fall back to the viewport center, and store the context-menu coordinates.

11. `packages/excalidraw/components/App.tsx:628`, `:5635-5643`
    - Cause:
      - `IS_PLAIN_PASTE` is a module global shared by every editor instance, and unmounting one instance resets it for the others.
      - The 100 ms timer can expire before the paste event on a busy main thread.
      - `event.key === "v"` fails on non-Latin keyboard layouts.
    - Fix: make it an instance field. Also match `event.code === CODES.V`. Clear the flag when the paste is consumed.

12. `packages/excalidraw/components/App.tsx:4671`, `:5326-5358`
    - Cause:
      - `files` from clipboard JSON are not validated.
      - Entries are keyed by `fileData.id`, so `__proto__` works as a key, and a `null` entry throws.
      - A spoofed `mimeType` skips `normalizeSVG`. Arbitrary dataURLs are persisted.
    - Fix: validate each entry's id and dataURL shape and check it against the image MIME allowlist. Derive the mime type from the dataURL. Use a `Map` or a null-prototype object.

13. `packages/excalidraw/components/App.tsx:4813`
    - Cause: `event.preventDefault()` runs after awaits, so it does nothing.
    - Fix: call it synchronously once the gate passes.

14. `packages/excalidraw/clipboard.ts:640-680`
    - Cause: the execCommand fallback uses the global `document` instead of `ownerDocument`. Focus may move to the temporary textarea and not return; afterwards `isExcalidrawActive` would be false and paste ignored.
    - Fix: pass the owner document into the fallback. Restore the previous `activeElement`.

15. `packages/excalidraw/clipboard.ts:176-185`
    - Cause: `elementsMap` is built from the copied elements only. `getContainingFrame` returns a frame only if it was copied, so the `!framesToCopy.has` branch is dead. A dangling `frameId` reaches `onPaste` hosts, though internal paste nulls it in `duplicate`.
    - Fix: use the condition `element.frameId && !framesToCopy-ids.has(element.frameId)`.

16. `packages/excalidraw/clipboard.ts:295-318`, `:108-109`
    - Cause: `types` is keyed by MIME type, so multiple `ClipboardItem`s of the same type overwrite each other. `createPasteEvent` mutates the caller's `files` array.
    - Fix: collect the files into an array. Copy the `files` array before pushing.