# proactive / find-issues

- project: `excalidraw` at `c0ad61c6743a`
- arm: `proactive`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 35  wall: 493s  api: 434s
- cost: $4.0071  output tokens: 34145  words: 1381

---

I found 14 issues in the clipboard and paste code, listed below from most to least severe. This is from reading the code only: `node_modules` isn't installed, so I ran nothing. No files were modified.

## High

**1. Cut deletes the selection even when the copy fails**
- **Location:** `packages/excalidraw/actions/actionClipboard.tsx:117-120`; the keyboard path is `actions/manager.tsx:141-147`.
- **Cause:** `actionCut` calls `actionCopy.perform(...)` without awaiting it and discards its result (including `errorMessage`), then deletes the selection immediately.
  - Ctrl+X goes through `keyTest`, so `perform` receives `null` instead of a `ClipboardEvent`. The keydown is `preventDefault`ed, so `onCut` presumably never runs.
  - The write therefore always takes the async `navigator.clipboard.writeText` path. That path can reject (unfocused document, denied permission, insecure context), and the user is never told.
  - This path writes only `text/plain`. `textWysiwyg.tsx:572` can't detect Excalidraw data without the custom MIME type, so pasting into a text editor inserts raw JSON.
- **Fix:** Make `perform` async, await the copy, and skip the delete (surfacing `errorMessage`) if it failed. Drop the `keyTest` so Ctrl+X reaches the native `cut` event, or have the text editor sniff `text/plain` for Excalidraw JSON.

## Medium

**2. Pasting HTML automatically fetches arbitrary remote URLs**
- **Location:** `clipboard.ts:221-225`, `App.tsx:4982-4999`, `data/blob.ts:422-445`.
- **Cause:** Every `<img src>` in pasted `text/html` is fetched without user confirmation.
  - The only filter is `url.startsWith("http")`, which also matches `httpfoo:`.
  - There is no limit on the number of images, no timeout, and no size limit before the body is downloaded (`maxFileSizeBytes` is checked later).
  - Pasted web content can therefore trigger tracking pixels or requests to intranet hosts from the user's browser.
- **Fix:** Parse with `new URL()` and allow only `http:`/`https:`. Cap the count, add an `AbortController` timeout, and check `Content-Length`. Consider `credentials: "omit"` plus `referrerPolicy: "no-referrer"`, and an opt-out prop.

**3. Mixed HTML paste drops all text, and failed fetches paste nothing**
- **Location:** `App.tsx:4977-5017`.
- **Cause:** If the HTML contains any `<img>`, only the images are inserted and every text node is discarded.
  - Because `parseClipboard` returns only `{ mixedContent }` (`clipboard.ts:532-536`), `text/plain` isn't available as a fallback.
  - When every fetch fails (likely common because of CORS), `insertImages([])` still runs. That clears the user's selection (`App.tsx:13175-13181`) and fires `actionFinalize`.
  - The user ends up with only an error message.
- **Fix:** Skip `insertImages` when `imageFiles` is empty, and fall back to the text nodes or `text/plain`. Longer term, carry `text` alongside `mixedContent` and paste both, as the existing TODO suggests.

**4. Unvalidated `files` from clipboard JSON can throw halfway through the paste**
- **Location:** `clipboard.ts:539-551`, `App.tsx:4897` and `4918-4920`, `App.tsx:5333-5341`.
- **Cause:** `systemClipboardData.files` is passed through as-is. `addMissingFiles` dereferences `fileData.id` on every value.
  - `files: {a: null}` throws after `scene.replaceAllElements` has already run.
  - The elements are added but there is no `scheduleCapture`, no selection, and an unhandled rejection.
  - Files that no element references are also kept in `this.files`, which bloats memory and persistence.
- **Fix:** Validate the shape in `parseClipboard` (object of `{id, dataURL, mimeType}` with an image MIME type). Keep only files whose ids match the pasted image elements. Call `addMissingFiles` before mutating the scene.

**5. Async paste errors are unhandled, and a failed Mermaid chunk load blocks text paste**
- **Location:** `actionClipboard.tsx:91-102`, `App.tsx:4687`.
- **Cause:**
  - `app.pasteFromClipboard(...)` is async but not awaited. The surrounding `try` only catches synchronous `createPasteEvent` errors, so `asyncPasteFailedOnParse` can never appear for real parse or insert failures.
  - `await import("@excalidraw/mermaid-to-excalidraw")` sits outside its `try`. When the chunk fails to load (offline, stale deploy), any text starting with `graph` or `flowchart` cannot be pasted.
- **Fix:** Await the paste call, and move the `import()` inside the `try` so it falls back to text.

**6. `copyText` silently swallows failures**
- **Location:** `actionClipboard.tsx:264-268`.
- **Cause:** `copyTextToSystemClipboard` returns a promise that isn't awaited. The `try/catch` never catches anything, so a rejection is unhandled and the user gets no feedback.
- **Fix:** Make `perform` async, await the call, and return `appState.errorMessage` on failure, as `actionCopy` does.

**7. Pasted non-image files cause an error and hide the rest of the clipboard**
- **Location:** `App.tsx:4639`, `4650-4657`.
- **Cause:** Every clipboard file is treated as an image. The drop path filters with `isSupportedImageFile` (`App.tsx:13239-13241`) but the paste path does not.
  - A file copied from a file manager produces "unsupported file type".
  - The early `return` means any text or elements on the clipboard are never pasted.
- **Fix:** Filter with `isSupportedImageFile` and fall through when nothing remains.

**8. URL paste ignores whether the embeddable tool is enabled, and can paste nothing**
- **Location:** `App.tsx:4725-4754`.
- **Cause:** The image path checks `isToolSupported("image")`, but this branch has no equivalent check. Hosts that disabled embeddables still get iframes.
  - There is no cap on how many iframes one paste creates.
  - If `insertEmbeddableElement` returns `undefined` for every URL, the branch returns without pasting the link text either.
- **Fix:** Gate on `isToolSupported("embeddable")`, cap the count, and `return` only when `embeddables.length > 0`.

## Low

**9. `readSystemClipboard` fallback logic is tangled**
- **Location:** `clipboard.ts:262-293`.
- **Cause:**
  - An empty clipboard (`DataError`, or an empty `readText()` result) rethrows and shows `asyncPasteFailedOnRead` instead of doing nothing.
  - The `DataError` branch is only reachable when `navigator.clipboard.read` is absent, which can't produce that error.
  - When `navigator.clipboard` is undefined, `clipboardItems` is `undefined` and the `for…of` throws a `TypeError`.
  - Two log messages are swapped.
  - When several `ClipboardItem`s share a type, only the last one is kept.
- **Fix:** Check API availability first. Handle `DataError` in the outer catch by returning `{}`, and do the same for empty `readText()`. Fall back to `readText` only for errors where it helps.

**10. `parseHTMLTree` is quadratic, and its result is usually thrown away**
- **Location:** `clipboard.ts:213-231`, `336-352`.
- **Cause:** `result = result.concat(...)` re-copies the accumulator for every sibling. It runs before the spreadsheet and text handling, so a large table copied from Excel or Sheets can freeze the tab.
  - The result is then discarded in favour of `text/plain` when there are no images.
  - Text inside `<script>` and `<style>` is collected as content.
  - `getData(text) ??` means an empty `text/plain` beats non-empty HTML text, and that branch isn't trimmed.
- **Fix:** Bail out early when `doc.querySelector("img")` is null. Push into a shared accumulator, skip script/style/template nodes, and use `||` with `.trim()`.

**11. Line-by-line text paste has no upper bound**
- **Location:** `App.tsx:5058-5108`.
- **Cause:** Each line becomes its own element, with `measureText` and `getTopLayerFrameAtSceneCoords` called per line. Pasting a long log creates that many elements and blocks the UI.
- **Fix:** Above a threshold (about 100 lines), paste as a single element.

**12. The plain-paste flag is fragile**
- **Location:** `App.tsx:628-630`, `5635-5644`.
- **Cause:**
  - It is a module-level global shared by every editor instance on the page.
  - It resets after 100ms, so a busy main thread turns Ctrl+Shift+V into a regular paste.
  - It matches on `event.key`, which is never `v` on non-Latin keyboard layouts.
- **Fix:** Store it per instance, also match `event.code === CODES.V`, and clear it when consumed in `pasteFromClipboard` rather than on a timer.

**13. `pasteFromClipboard` gating and cleanup**
- **Location:** `App.tsx:4776-4786`, `4809-4813`.
- **Cause:**
  - Paste silently does nothing unless the last pointer position is over a `<canvas>`. This affects keyboard-only users, a cursor resting on the toolbar, and paste from the command palette.
  - `event.preventDefault()` runs after several awaits, so it has no effect.
  - `setActiveTool` runs even when nothing was pasted, which resets the tool and finalizes an in-progress gesture.
  - The `event &&` guards imply a nullable event, but `parseDataTransferEvent(event)` would throw on `null`.
- **Fix:** Skip the cursor check for synthetic or programmatic pastes. Call `preventDefault` synchronously once the guards pass. Reset the tool only when something was inserted.

**14. Dead frame-detach branch in `serializeAsClipboardJSON`**
- **Location:** `clipboard.ts:150`, `176-185`.
- **Cause:** `elementsMap` only contains the copied elements. `getContainingFrame` is therefore non-null only when the frame is also being copied, which makes `!framesToCopy.has(...)` always false.
  - `frameId` is never cleared for children copied without their frame.
  - In-editor paste is unaffected because `bindElementsToFramesAfterDuplication` clears it.
  - External consumers, including `exportToClipboard({type: "json"})`, receive a `frameId` that points to nothing.
- **Fix:** Replace the condition with `element.frameId && !elementsMap.has(element.frameId)`.

Items 1–6 and 10–13 rest partly on how I remember the upstream code, so these patterns are probably long-standing rather than regressions from the last few commits.