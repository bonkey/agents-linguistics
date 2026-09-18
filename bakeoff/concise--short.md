# concise / short

- arm: `concise`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 6  wall: 31s  api: 27s
- cost: $0.4134  output tokens: 1767  words: 243

---

Because that is what GitHub itself says, and the daemon deliberately follows GitHub's verdict rather than the raw check rollup.

**What GitHub reports.** A PR whose only failures are non-required checks gets `mergeStateStatus == UNSTABLE`. Branch protection ignores those checks, so the merge button is live. `UNSTABLE` means "mergeable, but with a caveat", not "blocked".

**What the daemon does with it.** In `blocker_for` (`daemon.py:365`), the ❌ and 🟠 rungs fire only on `required_failing`, which `required_state` (`daemon.py:282`) computes by skipping every context whose `isRequired` is not true. A failing optional check never sets it. The overall rollup state is read only to decide whether to run the closer required-check query, not to render a verdict. So an UNSTABLE PR falls past ❌, 🟡, 👀 and 🛑 and lands on the `unstable` rung at `daemon.py:401`.

**The glyph is configurable, and the default is not quite ✅.** The `unstable` setting picks what that rung shows:

| `unstable` | emoji | nerd |
|---|---|---|
| `"ok"` (default) | 🆗 | `oct-check` (plain check) |
| `"pass"` | ✅ | `oct-check_circle_fill` (same as mergeable) |
| `"warn"` | ⚠️ | `oct-alert` (same as conflict) |

With Nerd Font icons, the default `oct-check` and the mergeable `oct-check_circle_fill` are visually close, so an UNSTABLE PR can read as plain mergeable at a glance. If you want optional failures to stand out, set `unstable = "warn"` in `config.toml`. If you never want the distinction, `"pass"` collapses it into ✅ on purpose.
