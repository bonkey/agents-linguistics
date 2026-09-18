# ste-concise / short

- arm: `ste-concise`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 42s  api: 39s
- cost: $0.6362  output tokens: 2759  words: 213

---

It is by design. The plugin exists to match GitHub, and GitHub lets you merge that pull request: it reports `mergeStateStatus == UNSTABLE`, and the merge button is enabled. The README states this as the one behaviour the plugin was built for, in place of `mergr`.

The code reaches that verdict in two steps in `daemon.py`:

1. `required_state` at `daemon.py:282` skips every context whose `isRequired` is not true. A failing optional check therefore never sets `required_failing`, so the ❌ and 🟠 rungs of `blocker_for` do not fire.
2. `blocker_for` at `daemon.py:397` then matches `UNSTABLE` and returns the `unstable` glyph.

Which glyph you see depends on the `unstable` setting in the plugin's config.toml:

| `unstable` | Emoji set | Nerd set |
|---|---|---|
| `"ok"` (default) | 🆗 | `oct-check` |
| `"pass"` | ✅ | `oct-check_circle_fill`, the same as CLEAN |
| `"warn"` | ⚠️ | `oct-alert`, the same as a conflict |

Your plugin config directory has no config.toml, so the daemon runs with the default. In the default Nerd set the row draws `oct-check`, a plain tick, and a fully mergeable pull request draws `oct-check_circle_fill`, a filled circle. The two are meant to look alike but not identical. If you want the optional failure to stand out, set `unstable = "warn"`.
