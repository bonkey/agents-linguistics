# default / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `default`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 26s  api: 22s
- cost: $0.5147  output tokens: 1807  words: 287

---

It reads as mergeable on purpose. `README.md:5` says the plugin was built so a PR whose only failing checks are non-required reads the way GitHub treats it, which is as mergeable. Two parts of the code do this.

**1. Only required checks can produce a failing mark.**
- `required_state` (`daemon.py:282`) skips any check context where `isRequired` is not `True` (`daemon.py:311`). A failing optional check therefore never sets `failing`.
- The ❌ and 🟠 marks in `blocker_for` depend only on `pr["required_failing"]` (`daemon.py:385`). They never look at the overall rollup state.
- The rollup cannot be used for this. GitHub reports `FAILURE` for the whole `statusCheckRollup` as soon as one check fails, optional or not (`daemon.py:667-669`).
- A `FAILURE` or `ERROR` rollup triggers a second GraphQL request (`required_targets`, `daemon.py:686`). That request asks for `isRequired(pullRequestNumber:)` on each check to find out which ones count.

**2. The row then falls through to GitHub's own merge state.**
- `blocker_for` checks, in order, for a required failure, running checks, a missing review, a merge-queue ejection and `BLOCKED`. If none apply, it reads `mergeStateStatus`.
- When only optional checks fail, GitHub reports `UNSTABLE`, meaning the PR can be merged although some checks are red.
- `daemon.py:397` maps `UNSTABLE` to `icons["unstable"]`.

**What that mark looks like is configurable.**
- The `unstable` setting controls it (`config.example.toml:8`, resolved in `icon_set` at `daemon.py:170`).
- `"ok"` is the default and shows 🆗. It means mergeable, with optional failures present.
- `"pass"` shows ✅, the same as a fully green PR.
- `"warn"` shows ⚠️, the same glyph as a merge conflict.

If you want these PRs to stand out, set `unstable = "warn"`. The default 🆗 already differs from ✅, and only `"pass"` makes the two look the same.