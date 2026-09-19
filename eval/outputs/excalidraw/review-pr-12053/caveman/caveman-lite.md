# caveman-lite / review-pr-12053

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-lite`  prompt: `review-pr-12053`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 18  wall: 249s  api: 176s
- cost: $1.6256  output tokens: 14266  words: 573

---

**Verdict: merge.** The fix is correct and minimal, and it comes with regression tests. No finding blocks it.

The PR was already merged on 2026-09-07 as `2b1c2a9f`. It is in local `HEAD`, and the touched files have not changed since.

I did not run the tests, because `node_modules` is absent and installing it would modify files. The verdict rests on reading the code and on CI for `fca7cfd1`: lint, coverage and CodeQL are green. The one failed `semantic` run passed on rerun.

The diagnosis in the PR description is accurate. `useOutsideClick` returns early when `ref.current` is null. `MenuContent` mounts before Radix mounts the menu content. The ref and the memoized callback never change, so the effect never reran and the listeners never attached. The callback-ref state now produces a new `menuRef` when the node appears, which reruns the effect. `setMenuNode` is stable, so Radix's ref composition does not churn. Listeners are removed when the menu content unmounts.

## Findings, by severity

1. **Medium: the root cause stays in the hook.**
   - Location: `packages/excalidraw/hooks/useOutsideClick.ts:27`, and the workaround at `packages/excalidraw/components/dropdownMenu/DropdownMenuContent.tsx:41`.
   - Cause: the hook silently does nothing for any node that mounts after the first effect run when the caller memoizes the callback. The PR patches one consumer with a fake ref object built by `useMemo`. `EyeDropper.tsx:258` has the same late-mount pattern and works only because its callbacks are not memoized, so its effect reruns every render. Memoizing them would bring the bug back there. `Sidebar.tsx:111` is safe because its ref mounts in the same commit.
   - Fix: make `useOutsideClick` take the node (`T | null`) and list it in the effect dependencies, then drop the `useMemo` ref. Alternatively, use Radix `Content` props `onPointerDownOutside` and `onEscapeKeyDown`, which already resolve the owner document. Do this as a follow-up.

2. **Low: the owner-document path has no test.**
   - Location: `packages/excalidraw/components/dropdownMenu/DropdownMenu.test.tsx:29-58`, covering the code at `DropdownMenuContent.tsx:80-81`.
   - Cause: every test renders into the global `document`. There, `menuNode.ownerDocument` equals `document`, so the Escape rebinding behaves the same as the old code. Nothing covers the #11974 case that motivated it.
   - Fix: add a test that renders `<Excalidraw>` into an iframe document and asserts that Escape and outside pointerdown on that document close the menu.

3. **Low: a test failure does not say which case broke.**
   - Location: `DropdownMenu.test.tsx:40-41`.
   - Cause: the target and event loops are nested inside one `it.each` case, so a failure does not name the target and event combination.
   - Fix: move the target and the event into the `it.each` table.

4. **Nit: the test clicks the wrong canvas.**
   - Location: `DropdownMenu.test.tsx:37`.
   - Cause: `container.querySelector("canvas")` picks the first canvas, which should be the static one (not checked). Real pointer events land on the interactive canvas, and `App.handleCanvasPointerDown` does not run for the static one.
   - Fix: select `canvas.interactive`.

5. **Nit: extra render on open and close.**
   - Location: `DropdownMenuContent.tsx:38`.
   - Cause: the state update inside the ref callback makes `MenuContent` and its children render a second time on mount, and once more on unmount. The cost is negligible for the main menu.
   - Fix: none required. The second render on open is inherent to the callback-ref approach and would remain after the change in finding 1.

Gating the Escape listener on `menuNode` (`DropdownMenuContent.tsx:63`) is not a problem. The state update in the ref callback flushes synchronously during commit, so there is no window where Escape is unhandled. Trigger clicks are still excluded by the `closest(wrapper).contains(target)` guard.