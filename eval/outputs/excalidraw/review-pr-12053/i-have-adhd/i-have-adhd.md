# i-have-adhd / review-pr-12053

- project: `excalidraw` at `c0ad61c6743a`
- arm: `i-have-adhd`  prompt: `review-pr-12053`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 1140s  api: 996s
- cost: $6.8872  output tokens: 18118  words: 680

---

**Verdict: merge.** The fix is correct and minimal, it restores outside-click dismissal that #11974 broke, and none of the five findings below blocks it.

PR #12053 is already in local history as `2b1c2a9f`. `gh` is not authenticated, so I reviewed that commit, which matches the PR diffs saved in `/private/tmp`. I did not run the tests, because the repo has no `node_modules` and installing would write files. A sub-review reported that the 3 tests passed in a temporary checkout; I could not confirm that.

## Findings, most severe first

**1. Medium: root cause left in the shared hook**
- **Location:** `packages/excalidraw/hooks/useOutsideClick.ts:27-31`, worked around at `DropdownMenuContent.tsx:41`.
- **Cause:**
  - Since #11974 the hook returns early when `ref.current` is null on the first effect run, and with stable dependencies it never runs again.
  - The PR fixes one caller by building a fake ref with `useMemo(() => ({ current: menuNode }))`.
  - `EyeDropper.tsx:258` has the same null-on-first-render ref. It works only because its callbacks are un-memoized; memoizing them, as the hook's own JSDoc advises, would reproduce this bug.
- **Fix:** resolve the document inside the hook instead of from the ref.
  - Use `useApp().ownerDocument` (`App.tsx:654`), or accept the node (`T | null`) and key the effect on it.
  - Then return `DropdownMenuContent` to a plain `useRef`.
  - About 30 minutes, and it also removes findings 2 and 3.

**2. Low: `menuRef` is a snapshot, not a live ref**
- **Location:** `DropdownMenuContent.tsx:41`, `:51`.
- **Cause:**
  - After close, `menuRef.current` points at the detached node until the null-state re-render and effect cleanup have run.
  - On React 17 that cleanup is asynchronous (peer range is `^17 || ^18 || ^19`). A touch tap fires `pointerdown` then `touchstart`, so the second event can pass the `!ref.current` guard and call `onClickOutside()` a second time.
  - All five callers are idempotent closers, so nothing visible happens today.
- **Fix:** take fix 1, or guard with `menuRef.current?.isConnected`.

**3. Low: ref churn through Radix**
- **Location:** `DropdownMenuContent.tsx:94`.
- **Cause:**
  - Radix's popper content builds its ref as `useComposedRefs(forwardedRef, (node) => setContent(node))`, which gets a new identity on every render. I confirmed this in `@radix-ui/react-popper` 1.2.8, `index.mjs:76`.
  - React therefore calls `setMenuNode(null)` then `setMenuNode(node)` on each commit.
  - The two updates reduce to the same node, so there is no loop and no listener rebind.
  - The cost is one extra `MenuContent` call per popper render while the menu is open.
- **Fix:** take fix 1, which removes the need for state.

**4. Low: two dismissal paths with different gates, and Escape order flipped**
- **Location:** `DropdownMenuContent.tsx:63`, `:81`.
- **Cause:**
  - Keydown is gated on `open && menuNode`; outside-click is gated on `menuNode` only.
  - `open` is now redundant, because Radix mounts Content only while open.
  - Waiting for `menuNode` binds the Escape listener one commit later than Radix's own capture listener on the same document. I confirmed this in `react-dismissable-layer` 1.1.11 and `react-presence` 1.1.5.
  - Radix's handler now runs first. It does nothing only because the Root has no `onOpenChange`; adding one later would handle Escape twice.
- **Fix:**
  - Gate both paths on the node and drop the `open` prop plumbing.
  - Or replace the custom effect with Radix's `onEscapeKeyDown` and `onInteractOutside` props.

**5. Low: test gaps**
- **Location:** `DropdownMenu.test.tsx:29`, `:37`, `:41`.
- **Cause:**
  - No `pointerdown` is dispatched on the trigger while the menu is open. That is the guard whose dependencies this PR changed, and a regression there would make the menu impossible to close from its button.
  - `querySelector("canvas")` picks the static canvas (`pointer-events: none`, `styles.scss:125`), not `canvas.interactive`.
  - There is no cross-document coverage, so reverting `ownerDocument.addEventListener` back to `document.addEventListener` keeps every test passing.
- **Fix:**
  - Add a case that fires `pointerDown` on the trigger and asserts the menu stays open.
  - Target `canvas.interactive`.
  - Open and dismiss a menu inside the iframe harness in `tests/crossDocument.test.tsx`.
  - About 20 minutes each.

I modified no repo files. The three `pr12053*.diff` files in `/private/tmp` were created today, probably by the review sub-agent.

Next: open `packages/excalidraw/hooks/useOutsideClick.ts:27` and decide whether to file finding 1 as a follow-up PR.