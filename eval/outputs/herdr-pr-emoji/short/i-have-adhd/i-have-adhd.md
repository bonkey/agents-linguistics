# i-have-adhd / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `i-have-adhd`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 26s  api: 21s
- cost: $0.4832  output tokens: 1777  words: 175

---

It is on purpose: GitHub only blocks a merge on *required* checks, and the plugin copies that. This is the behaviour the README calls out at `README.md:5`.

1. **Only required checks can produce ❌.** `required_state` skips every check where `isRequired` is not true (`daemon.py:311`). A failing optional check therefore never sets `required_failing`, and the ❌/🟠 branch at `daemon.py:385` does not fire.
2. **GitHub reports such a PR as `UNSTABLE`, not `BLOCKED`.** `UNSTABLE` is GitHub's status for a PR that can be merged while some check is failing. `blocker_for` maps it to `icons["unstable"]` at `daemon.py:397`.
3. **By default that glyph is 🆗 (`oct-check`), not the full ✅.** This default is set at `daemon.py:64`. The 🆗 means the PR can be merged but an optional check is red.

Running CI (🟡), a missing review (👀) and `BLOCKED` (🛑) are all checked before `UNSTABLE`. A PR with optional failures only reaches 🆗 when nothing else is holding it.

Next: to change what it shows, set `unstable` in `config.toml`. `"warn"` gives ⚠️, `"pass"` gives ✅, and `"ok"` keeps 🆗.