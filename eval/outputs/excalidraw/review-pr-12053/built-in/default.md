# default / review-pr-12053

- project: `excalidraw` at `c0ad61c6743a`
- arm: `default`  prompt: `review-pr-12053`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 36  wall: 452s  api: 325s
- cost: $2.8567  output tokens: 27871  words: 853

---

## Verdict: merge (approve, with non-blocking follow-ups)

The fix is correct, but `useOutsideClick` itself still has the underlying bug. PR #12053 was already merged upstream on 2026-09-07 as `2b1c2a9f`, so this is a post-merge review. Nothing here justifies a revert, and none of the findings below is blocking.

I couldn't run anything in the repo because it has no `node_modules` and you asked me not to modify files. I exported the PR head to a temp directory, installed dependencies and ran the tests there. The temp copy and the local PR ref I created are deleted, and the repo working tree is clean.

**What I verified**
- **Root cause:** confirmed. `MenuContent` is always mounted, but Radix only mounts the content node when the menu opens. After #11974, the `useOutsideClick` effect returned early on the null ref. Its dependencies never changed, so the listeners were never attached.
- **Tests at PR head:** all 3 dropdown tests pass.
- **Tests before the fix:** with the old `DropdownMenuContent.tsx`, the 2 new tests fail and the Escape test passes, as the author said.
- **Gaps the PR's tests leave:** I wrote 10 probe tests for these, and all 10 pass.
  - A pointerdown on `canvas.interactive` closes both menus.
  - Clicking the trigger toggles the menu closed.
  - A pointerdown inside the menu does not dismiss it.
  - Document listeners return to zero after 5 open/close cycles, so there is no leak.
  - When rendered into an iframe, both an outside pointerdown and Escape close the menu. The same probe fails on the pre-fix component.
- **CI:** lint and coverage are green. The first `semantic` failure was re-run green.
- **Call sites:** I read all five `DropdownMenu.Content` call sites. Every `onClickOutside` handler is idempotent.

## Findings, by severity

**1. Medium (design): the fix is in the caller, not in the hook that broke**
- **Location:** `hooks/useOutsideClick.ts:27-30,92`, worked around at `dropdownMenu/DropdownMenuContent.tsx:38-41`.
- **Cause:** `useOutsideClick` silently does nothing when `ref.current` is null on first run and the callback is memoized. The PR works around this for one caller by building a fake ref with `useMemo(() => ({ current: menuNode }))`. `EyeDropper.tsx:258-276` has the same shape, because it returns `null` until its portal container exists. It only works because its callbacks are inline, so the effect re-runs on every render. Wrapping those callbacks in `useCallback` would reintroduce this regression with no warning.
- **Fix:** repair the hook itself.
  - Either have it take the node (`T | null`) as a dependency, or take the owner document from editor context so listeners attach at mount as they did before #11974. The handler's existing `if (!ref.current) return` already covers the closed state.
  - Then remove the `useMemo` shim. The context option also removes the extra render the state adds on each open and close.

**2. Low–medium (test coverage): the cross-document behaviour is untested**
- **Location:** `DropdownMenuContent.tsx:63,80-83` and `dropdownMenu/DropdownMenu.test.tsx`.
- **Cause:** The regression came from cross-document support, and the PR also moves the Escape listener to `menuNode.ownerDocument`. No test renders into another document, so neither change is covered. The behaviour does work, as my probe showed.
- **Fix:** add a case to `tests/crossDocument.test.tsx`, which already has the iframe setup. Open the main menu, fire `pointerDown` on the iframe's `canvas.interactive`, then fire Escape on the iframe document, and assert the menu closes both times.

**3. Low (test fidelity): the test clicks a canvas users cannot click**
- **Location:** `DropdownMenu.test.tsx:37`.
- **Cause:** `container.querySelector("canvas")` returns `excalidraw__canvas static`, which has `pointer-events: none` in `css/styles.scss:127-130`. Real clicks land on `canvas.interactive` and go through App's pointer-down handler. The test therefore skips the real path, although I verified that path works too.
- **Fix:** query `canvas.interactive`.

**4. Low (latent): the fake ref is not cleared on unmount**
- **Location:** `DropdownMenuContent.tsx:41,45-60`.
- **Cause:** React sets a real ref to null when the node unmounts. This `useMemo` object instead keeps pointing at the detached node until the effect cleanup runs. A pointerdown in that window calls `onClickOutside` again for a menu that is already closed. This is harmless today because every handler is idempotent. `useMemo` is also only a caching hint, so it is a weak basis for a ref's identity.
- **Fix:** the hook fix in finding 1 covers this. Until then, add a comment saying `onClickOutside` must be idempotent.

**5. Out of scope, worth a follow-up issue**
- **Location:** `Sidebar/Sidebar.tsx:102,137`, plus an inherent limit of #11974.
- **Cause:** Sidebar still binds Escape and the `.Dialog` lookup to the global `document`. That is the same cross-document bug this PR fixed for dropdowns. Separately, a pointerdown in the top-level document does not dismiss a menu open in an iframe or popout; my probe confirmed this. The PR did not introduce either problem.
- **Fix:** use `islandRef.current?.ownerDocument` in Sidebar. Decide separately whether clicks in the host document should dismiss menus.

**6. Process: merged with no review**
- **Location:** PR #12053 on GitHub.
- **Cause:** The PR was self-merged 7 minutes after opening with zero reviews, and it fixes a regression from a PR the same author co-wrote.
- **Fix:** get a reviewer on the follow-up for finding 1, since that changes a shared hook.