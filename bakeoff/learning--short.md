# learning / short

- arm: `learning`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 5  wall: 40s  api: 38s
- cost: $0.4677  output tokens: 2660  words: 394

---

It is deliberate, and it is the plugin's stated reason for existing. The README opens with it: a PR whose only failing checks are non-required reads as mergeable, the way GitHub itself treats it. Here is the mechanism.

**GitHub already makes the call.** Branch protection only gates a merge on the checks it lists as required. When a non-required check fails, GitHub does not report the PR as BLOCKED. It reports `mergeStateStatus` as UNSTABLE, and the merge button stays enabled. The plugin follows that judgement rather than the raw check rollup.

**The classifier only counts required checks as failures.** The ❌ and 🟠 verdicts come from the `required_failing` flag, which is computed in `required_state` at daemon.py:282. That function walks every check run and status context, but skips any whose `isRequired` is not true at daemon.py:311. A failing non-required check therefore never sets the flag.

**UNSTABLE then falls through to its own rung.** In `blocker_for` at daemon.py:346, the order is:

1. Required failure, at daemon.py:385. Not hit, per the above.
2. Rollup PENDING or a required check still running. Not hit once everything has finished.
3. Review required, ejected from the queue, then BLOCKED. Not hit.
4. UNSTABLE, at daemon.py:397, returns the `unstable` glyph.

**Which glyph that is depends on config.** The default is 🆗, which is deliberately not the same as ✅. The `unstable` setting in config.toml resolves it in `icon_set` at daemon.py:170:

| Setting | Emoji | Nerd Font |
|---|---|---|
| `"ok"` (default) | 🆗 | oct-check |
| `"pass"` | ✅ | oct-check_circle_fill |
| `"warn"` | ⚠️ | oct-alert |

So if your row shows an actual ✅ rather than 🆗, the config has `unstable = "pass"`. The Nerd Font default keeps the distinction visible too: a hollow check for UNSTABLE versus a filled circle check for CLEAN.

`★ Insight ─────────────────────────────────────`
- The daemon does not reimplement branch protection. It asks GitHub `isRequired(pullRequestNumber:)` per check and lets `mergeStateStatus` carry the verdict, so any protection rule change on the base branch is honoured automatically.
- The `unstable` setting is resolved once into the icon table rather than checked at classification time. That keeps `blocker_for` a pure ordering of facts, and nothing downstream needs to know the state is configurable.
- 🆗 as a distinct default is the compromise: mergeable, but flagged so you can decide whether the optional failure matters.
`─────────────────────────────────────────────────`
