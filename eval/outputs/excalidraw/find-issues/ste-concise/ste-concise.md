# ste-concise / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `ste-concise`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 27  wall: 441s  api: 384s
- cost: $3.6914  output tokens: 30201  words: 1032

---

The most severe defect is in `actionCut`. It deletes the selection before the clipboard write finishes, so a failed write loses the elements. All findings come from a static read of the code. No test ran and no file changed. Paths are relative to `packages/excalidraw/`.

## High

1. Cut deletes the selection when the clipboard write fails
   - Location: `actions/actionClipboard.tsx:117-120`
   - Cause: `actionCut.perform` calls `actionCopy.perform` without `await` and discards the result. `actionDeleteSelected` runs at once. The Ctrl+X shortcut passes a null event (`actions/manager.tsx:141`), so the copy uses the async `navigator.clipboard.writeText`. A rejected write shows no error. Only undo recovers the elements.
   - Fix: Make `perform` async and await the copy. When the copy fails, return the error result and skip the delete.

## Medium

2. A paste into the text editor inserts the full scene JSON
   - Location: `wysiwyg/textWysiwyg.tsx:571-574`, `clipboard.ts:615-636`
   - Cause: The text editor detects Excalidraw data only by the custom MIME type. `copyTextToSystemClipboard` writes that type only when it has a `ClipboardEvent`. Ctrl+X and the context menu have no event, so the clipboard holds `text/plain` only. The editor inserts the raw JSON, which includes the base64 data of each image.
   - Fix: In `onpaste`, read `text/plain` synchronously from `event.clipboardData`. Test it with `clipboardContainsElements` before `preventDefault()`.

3. A non-image file on the clipboard blocks the paste
   - Location: `components/App.tsx:4639-4657`
   - Cause: `insertClipboardContent` treats each clipboard file as an image. `initializeImage` throws `errors.unsupportedFileType`. The function then returns before it reads `data.elements` or `data.text`. The drop handler filters with `isSupportedImageFile` (`components/App.tsx:13239-13241`).
   - Fix: Apply the same filter in `insertClipboardContent`.

4. Pasted HTML starts remote fetches with no limit
   - Location: `clipboard.ts:221-225`, `components/App.tsx:4985-4999`, `data/blob.ts:422-437`
   - Cause: `parseHTMLTree` accepts each `<img src>` that starts with `http`. `addElementsFromMixedContentPaste` fetches all of them in parallel. The code sets no limit on the count, no size check before `response.blob()`, and no timeout. Each request discloses the IP address of the user. A same-origin URL carries the cookies.
   - Fix: Validate the protocol with `new URL()` and cap the count. Add an `AbortController` timeout and a size check. Set `credentials: "omit"` and `referrerPolicy: "no-referrer"`.

5. One image in pasted HTML discards all the text
   - Location: `clipboard.ts:341-354`, `components/App.tsx:4977-5017`
   - Cause: When the HTML has one `<img>`, `parseClipboard` returns `mixedContent` only. `addElementsFromMixedContentPaste` inserts the images and ignores the text nodes. A paragraph with one inline icon pastes as the icon only. The TODO at `components/App.tsx:4967` records this.
   - Fix: Insert the text nodes and the images in the same paste.

6. Errors after the first `await` of a paste are unhandled
   - Location: `actions/actionClipboard.tsx:91-102`, `components/App.tsx:4807`, `components/App.tsx:4662-4666`
   - Cause: `actionPaste` calls `app.pasteFromClipboard(...)` without `await`. The `try/catch` catches only the synchronous errors of `createPasteEvent`. `insertClipboardContent` has no `catch`. Clipboard JSON of type `excalidraw-api/clipboard` goes to `convertToExcalidrawElements`. That function throws on a frame with an unknown child id (`packages/element/src/transform.ts:834`).
   - Fix: Await the call in `actionPaste`. Wrap `insertClipboardContent` in `try/catch` and set `errorMessage`.

## Low

7. `copyText` cannot catch a failed write
   - Location: `actions/actionClipboard.tsx:264-268`
   - Cause: The action calls `copyTextToSystemClipboard` without `await`. The `try/catch` never sees the rejection. The rejection is unhandled and the user sees no message.
   - Fix: Make `perform` async and await the call.

8. An empty clipboard shows an error dialog
   - Location: `clipboard.ts:262-293`
   - Cause: The `DataError` branch runs only when `navigator.clipboard.read` does not exist. In that case the caught error comes from `readText`, which does not throw `DataError`. A `DataError` from `read()` reaches `throw error` and `actionPaste` shows `errors.asyncPasteFailedOnRead`. The two warnings also name the wrong API. When `navigator.clipboard` is undefined, `for...of` throws on `undefined`.
   - Fix: Test `error.name === "DataError"` in the outer `catch` and return `types`. Return early when `navigator.clipboard` is undefined.

9. Clipboard actions write stale `appState` after an `await`
   - Location: `actions/actionClipboard.tsx:38-44`, `82-88`, `220-234`
   - Cause: `actionCopy`, `actionPaste` and `actionCopyAsPng` spread the `appState` that they captured before the `await`. A permission prompt or a slow PNG export can last seconds. A scroll, zoom or selection change during that time is reverted. `actionCopyAsSvg` returns only `{ toast }`.
   - Fix: Return only the changed keys (`errorMessage`, `toast`).

10. `IS_PLAIN_PASTE` is a module global with a 100 ms timer
    - Location: `components/App.tsx:628-629`, `5635-5644`
    - Cause: All editor instances on a page share the flag. A Ctrl+Shift+V in one instance affects a paste in another. A paste event that arrives more than 100 ms after the keydown loses the plain mode.
    - Fix: Store the flag on the `App` instance. Clear it in `pasteFromClipboard` and remove the timer.

11. An empty `text/plain` item hides the HTML text
    - Location: `clipboard.ts:346`
    - Cause: `getData(MIME_TYPES.text) ?? …` keeps an empty string. The paste inserts no text, although the HTML holds text.
    - Fix: Use `||` and trim the value.

12. The frame branch in `serializeAsClipboardJSON` never runs
    - Location: `clipboard.ts:150`, `176-185`
    - Cause: `elementsMap` holds only the copied elements, so `getContainingFrame` finds a frame only when that frame is also copied. The JSON keeps a `frameId` that points to a frame outside the clipboard. The editor paste clears it in `bindElementsToFramesAfterDuplication`, but an `onPaste` host and other consumers receive it.
    - Fix: Set `frameId: null` when `element.frameId` is set and the frame is not in `framesToCopy`.

13. The end of `pasteFromClipboard` has two no-effect or wrong steps
    - Location: `components/App.tsx:4809-4813`
    - Cause: `event?.preventDefault()` runs after several `await` calls, so it has no effect. `setActiveTool` also runs when the clipboard is empty or holds an error, and resets the tool of the user.
    - Fix: Call `preventDefault()` before the first `await`. Call `setActiveTool` only after an insert.

14. The Linux paste guard can swallow one keyboard paste
    - Location: `components/App.pan.ts:161-198`
    - Cause: Only a window `pointerup` removes `preventNextPaste`. When the pan ends by window `blur`, the listener stays on `body`. It then stops the next paste event before the `document` listener of the editor. The guard also arms for the right-button pan, which causes no paste.
    - Fix: Remove the listener in `teardown`. Arm the guard only for `button === 1`.

15. `createPasteEvent` changes the `files` array of the caller
    - Location: `clipboard.ts:108-109`
    - Cause: `files.push(value)` mutates the argument when the caller passes both `types` and `files`.
    - Fix: Copy the array first (`files = [...(files ?? [])]`).