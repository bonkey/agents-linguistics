# proactive / review-pr-12053

- project: `excalidraw` at `c0ad61c6743a`
- arm: `proactive`  prompt: `review-pr-12053`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 34  wall: 451s  api: 330s
- cost: $2.7307  output tokens: 26858  words: 777

---

# PR #12053 review: "fix(editor): dismiss dropdown menus on outside clicks"

**Verdict: merge.** The fix is correct and complete for the regression, with no blocking findings. The four findings below are non-blocking; finding 1 is worth a small follow-up PR.

The PR was already squash-merged on 2026-09-07 as `2b1c2a9f`. The touched files at your HEAD are byte-identical to the PR head, so this review applies to the code you have.

## Checks I ran

`gh` isn't authenticated and dependencies aren't installed in this checkout. I ran every check in a throwaway clone under `$TMPDIR`, which I have since deleted, so none of your files were modified.

| Check | Result |
|---|---|
| PR's test file at PR head | 3 of 3 pass |
| Same tests with only the component fix reverted | The 2 new tests fail and the Escape test passes, as the PR claims |
| My own probes on both menus: inside click, trigger pointerdown, trigger click, Escape, outside pointerdown | All behave correctly |
| Listener counts over 3 open/close cycles | 1 of each listener while open, 0 after every close, so no leak |
| Editor rendered inside an iframe document | Outside pointerdown and Escape both dismiss, and nothing binds to the top document |
| `tsc`, ESLint `--max-warnings=0`, Prettier on the touched files | Clean |

The PR's diagnosis is right:
- `MenuContent` is always mounted, but Radix mounts `Content` one render later.
- `useOutsideClick` therefore ran once with a null ref and returned early, and its stable dependencies meant it never ran again.
- The fix tracks the node in state, so the effect re-subscribes when the menu mounts and cleans up when it unmounts.
- The fix lives in the shared component, so all five dropdown call sites are covered.

## Findings, most severe first

**1. The root cause stays in the hook; only one call site is patched (medium, follow-up).**
- **Location:** `packages/excalidraw/hooks/useOutsideClick.ts:27-31`, worked around at `DropdownMenuContent.tsx:38-41`.
- **Cause:** Since #11974 the hook reads `ref.current?.ownerDocument` once and returns early if it is null. Its dependencies are `[ref, callback, isInside]`, and a `useRef` object never changes identity. Any target that mounts late, combined with a memoized callback, silently gets no listeners.
  - I reproduced this in isolation: a late-mounting target with a memoized callback never fires, while an un-memoized callback works.
  - `EyeDropper.tsx:256-272` works today only because its inline callbacks re-run the effect on every render.
  - Memoizing those callbacks, as the hook's own JSDoc advises, would break it the same way.
- **Fix:**
  - Let the hook accept a state-tracked node (`T | null`) alongside a `RefObject`.
  - Alternatively, take the document from `useApp().ownerDocument`, so the ref no longer gates listener registration.
  - Then drop the dropdown's workaround and add a hook-level test for a late-mounting target.

**2. The fake ref object is a fragile idiom (low).**
- **Location:** `DropdownMenuContent.tsx:41`, `useMemo(() => ({ current: menuNode }), [menuNode])`.
- **Cause:** The code fabricates a ref whose identity changes only to retrigger the hook's effect. React also does not guarantee that `useMemo` keeps its value; a discarded value would only cause a harmless re-subscribe. The comment explains why the code exists but not that ref identity is the actual mechanism. A later cleanup back to `useRef` would reintroduce the bug without any type error.
- **Fix:** Finding 1's fix removes this. Until then, extend the comment to say that the identity change is what re-runs `useOutsideClick`.

**3. The new tests miss the cross-document case the code is written for (low).**
- **Location:** `DropdownMenu.test.tsx:29-58`.
- **Cause:** The change of the Escape listener to `menuNode.ownerDocument` has no test, and Escape is tested only for the main menu. Nothing asserts that inside clicks or trigger pointerdown leave the menu open. That matters because finding 1's follow-up will rewrite this same logic. My probes confirm all of this works today.
- **Fix:**
  - Add a dropdown case to `tests/crossDocument.test.tsx` that opens the menu in the iframe, then dismisses it with pointerdown and with Escape dispatched in `ownerDocument`.
  - Extend the `it.each` with assertions that an inside click and a trigger pointerdown leave the menu open.

**4. The Escape listener now registers after Radix's (informational, no action).**
- **Location:** `DropdownMenuContent.tsx:62-85`.
- **Cause:** Gating on `menuNode` delays registration by one commit. Radix's capture-phase keydown handler now runs before this one, so `stopImmediatePropagation` no longer suppresses it. This is harmless today because the root is controlled without `onOpenChange`, so Radix's dismiss does nothing. It would matter only if someone later wires `onOpenChange`.
- **Fix:** None needed now. If `onOpenChange` is ever added, handle Escape through `Content`'s `onEscapeKeyDown` instead of a document listener.