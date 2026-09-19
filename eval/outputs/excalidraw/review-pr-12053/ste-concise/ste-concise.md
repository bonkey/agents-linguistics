# ste-concise / review-pr-12053

- project: `excalidraw` at `c0ad61c6743a`
- arm: `ste-concise`  prompt: `review-pr-12053`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 20  wall: 716s  api: 632s
- cost: $4.6014  output tokens: 12449  words: 695

---

**Verdict: merge.** The fix is correct and no finding blocks it. GitHub shows [#12053](https://github.com/excalidraw/excalidraw/pull/12053) merged on 7 September 2026 at 15:28 UTC as [2b1c2a9f](https://github.com/excalidraw/excalidraw/commit/2b1c2a9fbf62417168cdae041d00f38cc403f0a5). Your checkout contains that commit, so each finding below is a follow-up.

No test ran. `node_modules` is absent, and an install writes files. I checked each finding by reading the code.

The PR fixes a regression from [#11974](https://github.com/excalidraw/excalidraw/pull/11974). The effect in `useOutsideClick` returns with no listener when `ref.current` is null. Radix mounts the menu content only on open, and all effect deps were stable, so the listeners never attached. The PR keeps the node in state, so the effect runs again when the node mounts.

## Findings

1. **Medium, root cause stays in the hook.**
   - **Location:** `packages/excalidraw/hooks/useOutsideClick.ts:27`. The workaround is at `packages/excalidraw/components/dropdownMenu/DropdownMenuContent.tsx:41`.
   - **Cause:**
     - The effect reads `ref.current?.ownerDocument` one time. A ref that attaches later does not run the effect again.
     - The PR fixes one caller with a `useMemo` object whose identity changes with the node.
     - `EyeDropper.tsx:258` also has a ref that mounts late. It works only because its callbacks are inline, so the effect runs on each render.
     - If those callbacks become memoized, the same bug returns with no error.
   - **Fix:** Change `useOutsideClick` to accept the element and put the element in the effect deps. Remove the `useMemo` object and read `menuNode` in the callback.

2. **Low, the test uses the wrong canvas.**
   - **Location:** `packages/excalidraw/components/dropdownMenu/DropdownMenu.test.tsx:37`
   - **Cause:**
     - `container.querySelector("canvas")` returns the static canvas, which is first in the DOM (`App.tsx:2646`).
     - The static canvas has `pointer-events: none` (`styles.scss:125`), so a user can never hit it.
     - The test does not send the event through the interactive canvas and its handlers.
   - **Fix:** Use `GlobalTestState.interactiveCanvas`.

3. **Low, gaps in test coverage.**
   - **Location:** `DropdownMenu.test.tsx:29`
   - **Cause:**
     - No test renders into a second document. A revert to the global `document` at `DropdownMenuContent.tsx:80` still passes.
     - No test fires `pointerDown` on the trigger while the menu is open. The trigger guard at lines 50 to 54 has no coverage.
   - **Fix:** Add a dropdown case to `packages/excalidraw/tests/crossDocument.test.tsx`. Add a case that fires `pointerDown` on the trigger and expects the menu to stay open.

4. **Low, the callback reads a stale node after unmount.**
   - **Location:** `DropdownMenuContent.tsx:51`
   - **Cause:**
     - `menuRef.current` is a copy from render time. After the content unmounts, an attached listener holds the detached node.
     - `closest()` on a detached node returns null, so the trigger guard passes and `onClickOutside` fires a second time.
     - This needs React 17, which the peer range allows. There, effect cleanup waits and a `touchstart` can follow the `pointerdown`.
     - All five callers only set a closed state, so nothing breaks today.
   - **Fix:** Return early in the callback when `!menuRef.current?.isConnected`. The change in finding 1 also removes this.

5. **Low, extra render on open and on close.**
   - **Location:** `DropdownMenuContent.tsx:38`
   - **Cause:**
     - `setMenuNode` runs in the ref callback. The menu subtree renders two times on open and one more time on close.
     - Each pass creates a new `{ onSelect }` context value, so each context consumer renders again.
   - **Fix:** Bind the listeners from the callback ref inside the hook, without React state. Memoize the context value.

6. **Low, listeners stay on the old document after `adoptNode`.**
   - **Location:** `DropdownMenuContent.tsx:80` and `useOutsideClick.ts:27`
   - **Cause:**
     - `ownerDocument` is captured once for each node identity.
     - A host that moves the editor DOM to a second window while a menu is open keeps the listeners on the first document.
     - I found no caller that does this today.
   - **Fix:** Accept this limit and write it in the hook JSDoc. The alternative is to read `ownerDocument` again when the host signals a move.

7. **Nit, test lookups do not follow the file idiom.**
   - **Location:** `DropdownMenu.test.tsx:36` and `:45`
   - **Cause:**
     - The test writes `[data-testid=...]` selectors by hand. The same file uses `getByTestId` elsewhere.
     - The `!` on `querySelector(triggerSelector)` makes a renamed class fail with an unclear null error.
   - **Fix:** Use `getByTestId` and `queryByTestId(container, "dropdown-menu")`.

One fact would change the verdict: a caller of `onClickOutside` that toggles state. Finding 4 then becomes a user-visible bug.