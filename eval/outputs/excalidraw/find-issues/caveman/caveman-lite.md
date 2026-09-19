# caveman-lite / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-lite`  prompt: `find-issues`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 30  wall: 456s  api: 391s
- cost: $3.4812  output tokens: 29950  words: 1334

---

I found 16 bugs and risks in the clipboard and paste handling, listed below by severity. I found them by reading the code only and ran no tests. I modified no files.

## High

**1. Pasted `files` are trusted without validation**
- Location: `packages/excalidraw/clipboard.ts:539-551`, `components/App.tsx:5326-5358` (`addMissingFiles`), `packages/element/src/image.ts:30`.
- Cause:
  - Any `text/plain` JSON with `type: "excalidraw/clipboard"` supplies `files`.
  - `dataURL` is never checked for a `data:` prefix before `image.src = dataURL`.
  - A remote URL is fetched on paste, which leaks the user's IP address.
  - The remote image taints the canvas, so PNG export and copy-as-PNG throw `SecurityError`.
  - `mimeType` is attacker-controlled, so a wrong value skips `normalizeSVG`.
  - A `null` entry throws after `replaceAllElements`. Elements are inserted with no history capture and no selection update.
- Fix:
  - Validate each entry before `addMissingFiles`.
  - Require an object, a string `id` that matches the key, and a `dataURL` starting with `data:`.
  - Require `mimeType` to be in `IMAGE_MIME_TYPES` and equal to the MIME type inside the data URL.
  - Drop invalid entries.

**2. Cut deletes elements even when the copy fails**
- Location: `actions/actionClipboard.tsx:117-120`.
- Cause:
  - `actionCopy.perform()` is async and is not awaited.
  - Its `errorMessage` result is discarded, and `actionDeleteSelected` runs unconditionally.
  - When the clipboard write is denied, the elements are deleted silently and only undo recovers them.
- Fix: Make `actionCut.perform` async and await the copy. When the copy returns an `errorMessage`, return that result and skip the delete.

## Medium

**3. The paste pipeline has no error handling**
- Location: `components/App.tsx:4760-4815`, `App.tsx:4687`, `actions/actionClipboard.tsx:91-102`, `clipboard.ts:478-511`.
- Cause:
  - `actionPaste` calls `app.pasteFromClipboard(...)` without `await`, so its `catch` only sees synchronous `createPasteEvent` errors.
  - `errors.asyncPasteFailedOnParse` is therefore never shown for parse failures.
  - `pasteFromClipboard` has no try/catch.
  - A rejection from `restoreElements`, `convertToExcalidrawElements`, or `normalizeFile` in `Promise.all` is unhandled, and the user gets no feedback.
  - `await import("@excalidraw/mermaid-to-excalidraw")` sits outside the `try`, so a chunk load failure aborts the paste instead of falling back to text.
- Fix:
  - Await the paste call in `actionPaste`.
  - Wrap the `pasteFromClipboard` body in try/catch and set `errorMessage` there.
  - Move the mermaid import inside the `try`.
  - Use `Promise.allSettled`, or a per-item catch, in `parseDataTransferEvent`.

**4. The paste path does not filter out non-image files**
- Location: `components/App.tsx:4639-4657`.
- Cause:
  - `dataTransferFiles.map((data) => data.file)` takes every file item.
  - The drop path filters with `isSupportedImageFile` (`App.tsx:13237-13239`), but the paste path does not.
  - A PDF, ZIP, or `.excalidraw` file copied from a file manager creates a placeholder.
  - `initializeImage` then throws `unsupportedFileType`.
  - The early `return` also blocks the element and text branches.
- Fix: Filter with `isSupportedImageFile`. When nothing is left, fall through to the element and text branches.

**5. Keyboard cut and context-menu copy write only `text/plain`**
- Location: `actions/manager.tsx:140-146`, `actions/actionClipboard.tsx:121`, `clipboard.ts:615-631`, `wysiwyg/textWysiwyg.tsx:571-574`.
- Cause:
  - `actionCut.keyTest` matches Ctrl+X on keydown, and `handleKeyDown` calls `preventDefault()`.
  - I believe that suppresses the native `cut` event, which is standard browser behaviour.
  - `perform` then gets `null` instead of a `ClipboardEvent`, so only `writeText` runs.
  - Context-menu Copy and Cut have the same result.
  - The custom MIME type `application/vnd.excalidraw.clipboard+json` is never set.
  - The text editor paste relies on that MIME type, so it inserts the raw JSON instead of the element text.
- Fix:
  - In the text editor, also detect Excalidraw JSON in `text/plain`.
  - Alternatively, remove the `actionCut.keyTest` and rely on `onCut`, as `actionCopy` already does.

**6. Copy clobbers the clipboard and hijacks DOM text copy**
- Location: `components/App.tsx:4489-4502`, `actions/actionClipboard.tsx:28-36`.
- Cause:
  - There is no guard for an empty selection.
  - Ctrl+C with nothing selected overwrites the system clipboard with `{"elements":[]}`.
  - `preventDefault()` also blocks copying selected non-writable DOM text inside the container, such as sidebar content.
- Fix: Return before `preventDefault()` when no elements are selected, or when `getSelection()` is non-collapsed outside the canvas.

**7. Mixed HTML paste fetches remote URLs and drops text**
- Location: `components/App.tsx:4969-5018`, `clipboard.ts:221-225`, `data/blob.ts:422-445`.
- Cause:
  - Every `<img src>` in the pasted HTML is fetched without user consent.
  - There is no limit on the number of URLs, no timeout, and no `referrerPolicy`.
  - The check `startsWith("http")` also matches schemes such as `httpx:`.
  - One image in the HTML discards all text nodes, including when every fetch fails.
  - `insertImages([])` still runs in that case. It clears the selection, captures history, and fires `actionFinalize`.
- Fix:
  - Parse each URL with `new URL()` and allow only `http:` and `https:`.
  - Cap the number of URLs.
  - Pass an `AbortController` timeout and `referrerPolicy: "no-referrer"` to `fetch`.
  - Return early when there are no image files.
  - Insert the text when no image succeeds.

**8. The `readSystemClipboard` fallback logic is wrong**
- Location: `clipboard.ts:262-295`.
- Cause:
  - When `navigator.clipboard` is undefined, `clipboardItems` is `undefined` and the `for...of` throws `TypeError`.
  - The `DataError` check for an empty clipboard sits in the inner catch.
  - That catch is only reachable when `readText` throws and `read` is absent.
  - An empty clipboard therefore rethrows and shows `asyncPasteFailedOnRead`.
  - The first warning message names the two APIs the wrong way round.
- Fix:
  - Guard the missing API up front.
  - Check the outer `error.name === "DataError"` before trying `readText`.
  - Return `types` when `readText` yields an empty string.

## Low

**9. Plain-paste detection is fragile**
- Location: `components/App.tsx:628-630`, `App.tsx:5635-5644`, `App.tsx:3335-3337`.
- Cause:
  - `event.key.toLowerCase() === KEYS.V` fails on non-Latin keyboard layouts, so Ctrl+Shift+V acts as a normal paste.
  - The 100 ms reset timer can fire before a slow `paste` event, for example with a large clipboard.
  - The flags are module globals shared by all editor instances, and unmounting one instance resets them for the others.
- Fix: Use `matchKey(event, KEYS.V)`. Clear the flag inside `pasteFromClipboard` instead of on a timer. Store the flag per instance.

**10. `copyText` has a dead `catch`**
- Location: `actions/actionClipboard.tsx:264-268`.
- Cause: `copyTextToSystemClipboard` is async and is not awaited, so a failure becomes an unhandled rejection with no error UI.
- Fix: Make `perform` async, await the call, and return `errorMessage` on failure.

**11. The `execCommand` fallback steals focus**
- Location: `clipboard.ts:640-680`.
- Cause:
  - `textarea.select()` moves focus out of the editor and nothing restores it.
  - After that, `isExcalidrawActive` is false, so the next copy or paste shortcut is ignored until the user clicks the canvas.
  - `clipboard.ts:634` also returns silently when there is no `text/plain` entry.
- Fix: Save `document.activeElement` and refocus it after the copy. Throw when nothing was written.

**12. An empty `text/plain` wins over HTML text**
- Location: `clipboard.ts:345-350`.
- Cause:
  - `??` keeps an empty string, so an empty `text/plain` with text-only HTML pastes nothing.
  - This branch is also untrimmed, while the other branch trims.
- Fix: Use `||` and trim.

**13. Dead frame branch in `serializeAsClipboardJSON`**
- Location: `clipboard.ts:150`, `clipboard.ts:176-185`.
- Cause:
  - `elementsMap` holds only the copied elements.
  - `getContainingFrame` finds a frame only when that frame is also being copied, so the condition is never true.
  - A stale `frameId` stays in the clipboard JSON and is visible to `onPaste` hosts.
  - Internal paste nulls it later in `bindElementsToFramesAfterDuplication`.
- Fix: Test `element.frameId && !elementsMap.has(element.frameId)`.

**14. `event.preventDefault()` runs after awaits**
- Location: `components/App.tsx:4813`.
- Cause: Event dispatch has already finished, so the call does nothing.
- Fix: Call it synchronously once the target checks pass.

**15. Pasted content has no size caps**
- Location: `components/App.tsx:5058-5108`, `clipboard.ts:213-231`.
- Cause:
  - One text element plus one `measureText` call is created per pasted line.
  - `parseHTMLTree` is recursive and uses a quadratic `concat`.
  - It also collects the contents of `<style>` and `<script>` as text.
  - A huge paste freezes the UI.
- Fix: Cap the line count and fall back to a single element. Skip `STYLE` and `SCRIPT` nodes. Use `push` instead of `concat`.

**16. Module-level browser API access**
- Location: `clipboard.ts:62-72`.
- Cause: `navigator`, `window`, and `HTMLCanvasElement` are read at import time, so the module throws under server-side rendering.
- Fix: Add `typeof navigator !== "undefined"` guards, or evaluate the values lazily.