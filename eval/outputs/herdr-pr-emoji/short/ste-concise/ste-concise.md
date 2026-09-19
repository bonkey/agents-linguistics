# ste-concise / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `ste-concise`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 28s  api: 24s
- cost: $0.6352  output tokens: 1997  words: 236

---

The search is complete. The answer follows.

The plugin shows that PR as mergeable by design, because GitHub lets you merge it. Branch protection blocks a merge only on required checks. GitHub reports this case as `mergeStateStatus == UNSTABLE`, and the merge button stays active.

**How the code reaches that verdict:**

- `required_state` at `daemon.py:311` skips every context where `isRequired` is not `True`. A failing optional check never sets `required_failing`, so the ❌ rung at `daemon.py:385` does not fire.
- `blocker_for` then falls through to `daemon.py:397`. `UNSTABLE` returns `icons["unstable"]`.
- `icon_set` at `daemon.py:170` resolves that glyph from the `unstable` setting: `"ok"` gives 🆗 (`oct-check`, the default), `"pass"` gives ✅, `"warn"` gives ⚠️.
- `SORT_ORDER` at `daemon.py:152` ranks `unstable` second, directly after `mergeable`.

The README names this as the reason the plugin exists (`README.md:4`): "a PR whose only failing checks are non-required reads as mergeable, the way GitHub itself treats it." Commit 26635cc (8 September, 19:34) changed the default from ✅ to 🆗. The PR still counts as a pass, and the separate glyph tells you that an optional check is red.

Two limits apply. A missing review, a running required check, or a conflict ranks above `UNSTABLE` in `blocker_for`, so such a PR does not read 🆗. If you want the optional failure to look like a problem, set `unstable = "warn"` in `config.toml`.

I read the code and the commit message. I ran no tests.