# caveman-lite / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-lite`  prompt: `short`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 6  wall: 26s  api: 22s
- cost: $0.5295  output tokens: 1832  words: 249

---

A PR like that shows as mergeable by design. The plugin copies GitHub, where only required checks can block a merge, and the README names this as the plugin's reason for existing (`README.md:5`).

1. **Optional checks are ignored when looking for failures.** `required_state` skips every check where `isRequired` is not `True` (`daemon.py:311`). A failing optional check therefore never sets `required_failing`, and the ❌/🟠 rule at `daemon.py:385` does not fire.
2. **GitHub reports the PR as `UNSTABLE`.** GitHub reports `mergeStateStatus == UNSTABLE` when a PR has a failing check but can still be merged, and its merge button stays enabled.
3. **The plugin maps `UNSTABLE` to a glyph.** If the earlier rules don't match (conflict, required failure, running checks, missing review, queue ejection, `BLOCKED`), `blocker_for` reaches `status == "UNSTABLE"` at `daemon.py:397`. It returns `icons["unstable"]`.

The default glyph is 🆗 (`oct-check`), not ✅, so the row still tells you an optional check failed.

You can change that with `unstable` in `config.toml`, which `icon_set` resolves at `daemon.py:170`:

| `unstable` | Glyph | Effect |
|---|---|---|
| `"ok"` (default) | 🆗 | mergeable, optional failures visible |
| `"pass"` | ✅ | same as a clean PR |
| `"warn"` | ⚠️ | same glyph as a merge conflict |

To make optional failures show as a warning, set `unstable = "warn"`.

Two other rules take priority over the `UNSTABLE` glyph. While any check is still running (`rollup == PENDING`), the row shows 🟡 (`daemon.py:389`). While `reviewDecision == REVIEW_REQUIRED`, it shows 👀 (`daemon.py:391`).