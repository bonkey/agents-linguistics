# explanatory / review-pr-12053

- project: `excalidraw` at `c0ad61c6743a`
- arm: `explanatory`  prompt: `review-pr-12053`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 26  wall: 326s  api: 264s
- cost: $2.0306  output tokens: 20818  words: 851

---

## Verdict: **Merge** (approve, with non-blocking follow-ups)

The PR is already merged as `2b1c2a9f`. Reviewed after the fact, I would approve it. It correctly diagnoses and fixes the regression, the change is small, and I found no correctness bug in it.

**What I checked**
- **Root cause is as the PR describes.** `MenuContent` stays mounted, but Radix `Presence` mounts `Content` only while the menu is open. After #11974, `useOutsideClick` bails out when `ref.current?.ownerDocument` is missing on its first effect pass. Its deps `[ref, callback, isInside]` were all stable here, so the effect never re-ran and the listeners never attached, not on first open and not on reopen.
- **The fix re-binds correctly.** Storing the node in state changes `menuRef`'s identity on every mount and unmount, which re-runs the hook's effect. `setMenuNode` is a stable callback, so Radix's `useComposedRefs` does not loop.
- **No collateral from reviving the listeners.**
  - Sub-menus are not portalled, so they sit inside `menuNode` and are not treated as outside clicks.
  - All five `onClickOutside` callers are idempotent setters, so the `pointerdown` + `touchstart` double-fire is harmless.
  - `App` does not close `openMenu` on canvas pointerdown, so the canvas part of the new test does exercise the fix.
- **CI is green on head `fca7cfd1`** (`lint`, `coverage`, CodeQL). The one `semantic` failure was superseded by a passing re-run.
- **I did not run the tests locally.** There is no `node_modules` or `yarn` here, and installing would have written into the repo.

## Findings (most severe first)

**1. Medium (design): the fix works around the hook's bug instead of fixing the hook**
- **Location:** `packages/excalidraw/hooks/useOutsideClick.ts:27-30`. The workaround is at `packages/excalidraw/components/dropdownMenu/DropdownMenuContent.tsx:38-41`.
- **Cause:** The hook still reads `ref.current?.ownerDocument` once, in an effect whose deps include the ref object but not the node. Any caller that mounts its node late and memoizes its callback gets no listeners, with no error. `EyeDropper.tsx:256-273` mounts late, behind a portal container. It works only because its callbacks are un-memoized, so the effect re-runs every render. Wrapping them in `useCallback` would break it the same way.
- **Fix:** Resolve the document inside the hook from `useApp().ownerDocument` (`App.tsx:654`). That getter is always available and honors `props.ownerDocument`; `EyeDropper` already uses `app.ownerWindow`. Then return `DropdownMenuContent` to a plain `useRef`. Alternatively, let the hook accept the node itself (`T | null`) as a dependency.

**2. Low: the synthetic ref is a snapshot, which weakens the hook's unmount guard**
- **Location:** `DropdownMenuContent.tsx:41`, `useMemo(() => ({ current: menuNode }), [menuNode])`.
- **Cause:** A real ref becomes `null` when the node unmounts, which the hook's `if (!ref.current) return` guard depends on. The snapshot keeps the detached node until the effect cleanup runs. In that window `closest(...)` returns `null` and `onClickOutside` fires again. This is harmless today only because every caller is idempotent. Also, `useMemo` does not guarantee a stable identity; it just happens to be stable here.
- **Fix:** Fixing finding 1 removes this. Otherwise, use `menuNode` directly in the callback and add a `menuNode.isConnected` check.

**3. Low: test gaps on behavior this PR changes or revives**
- **Location:** `DropdownMenu.test.tsx:29-58`.
- **Cause:**
  - The Escape-on-`ownerDocument` change has no test. In jsdom, `menuNode.ownerDocument === document`, so the old code would pass the existing Escape test too.
  - The trigger exemption at `DropdownMenuContent.tsx:49-53` had been unreachable since #11974 and is reachable again, but nothing tests it. If it broke, `pointerdown` would close the menu and `click` would reopen it.
- **Fix:**
  - Add a test that fires `pointerDown` then `click` on the trigger while the menu is open, and asserts the menu closes.
  - Add an Escape test with the editor rendered into a second document, such as an iframe.

**4. Nit: the code comment understates the mechanism**
- **Location:** `DropdownMenuContent.tsx:39-40`.
- **Cause:** "Radix mounts the content lazily" suggests a one-time delay. In fact the node is unmounted and remounted on every open, which is why the reopening case matters.
- **Fix:** Reword to something like "Radix (Presence) mounts/unmounts the content node on each open/close while this component stays mounted".

**5. Out of scope (follow-up): same leftover pattern from #11974 elsewhere**
- **Location:** `Sidebar/Sidebar.tsx:137`, `Popover.tsx:145`, `ColorPicker/Picker.tsx:134`.
- **Cause:** These still bind to the global `document`, so they will not fire when the editor is rendered into another document. This is the same problem this PR fixed for the dropdown's Escape listener.
- **Fix:** Switch them to `app.ownerDocument` in a follow-up PR.

`★ Insight ─────────────────────────────────────`
- Passing a ref to a hook that lists `[ref]` in its effect deps looks reactive but is not. The ref object's identity never changes, so the effect never sees the node change. Radix's own `DismissableLayer` avoids this by keeping the node in `useState`. This PR copies that pattern in the component rather than in the hook.
- Memoizing a callback can expose a bug that was hidden before. `EyeDropper` works because re-running its effect every render hides the hook's timing assumption. `DropdownMenuContent` memoized correctly and was the caller that broke. When a fix lands in a single caller, check why the other callers were not affected. Here that check is what shows the fix belongs in the hook.
`─────────────────────────────────────────────────`