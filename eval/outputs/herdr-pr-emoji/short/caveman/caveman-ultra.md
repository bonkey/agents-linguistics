# caveman-ultra / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-ultra`  prompt: `short`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 35s  api: 29s
- cost: $0.601  output tokens: 2304  words: 203

---

By design. GitHub allows that merge, and the plugin reports what GitHub reports. `README.md:5` states it as the plugin's purpose.

**How it works**
- When only non-required checks fail, GitHub sets `mergeStateStatus == UNSTABLE`. The merge button stays enabled, because branch protection gates only on required checks.
- In `blocker_for` (`daemon.py:385-398`), ❌ and 🟠 need `required_failing`. `required_state` sets that only from checks with `isRequired`, or contexts that branch protection names.
- A failing optional check sets neither, so the PR falls through past DIRTY, running, 👀, 🪃 and `BLOCKED` to the `UNSTABLE` branch, which returns `icons["unstable"]`.

**Why it looks like ✅**
- You have no `config.toml`, so defaults apply: `unstable = "ok"` and `icons = "nerd"`.
- With the nerd icon set, 🆗 draws as `oct-check` and ✅ as `oct-check_circle_fill`. Both are check marks and easy to confuse.
- `SORT_ORDER` also ranks `unstable` right after `mergeable`.

**To make it read differently**
- Set `unstable = "warn"` in `~/.config/herdr/plugins/config/bonkey.pr-emoji/config.toml`. The PR then shows ⚠️ (`oct-alert`).
- `unstable = "pass"` shows a full ✅ instead.
- `icons = "emoji"` makes 🆗 and ✅ visibly distinct.

One trap: `"warn"` reuses the conflict glyph, so an `UNSTABLE` PR and a `DIRTY` PR look identical on the row.