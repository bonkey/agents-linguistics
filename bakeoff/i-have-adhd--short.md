# i-have-adhd / short

- arm: `i-have-adhd`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 12  wall: 143s  api: 118s
- cost: $1.1912  output tokens: 8549  words: 259

---

It's the plugin's stated purpose. The README opens with it: a PR whose only failing checks are non-required reads as mergeable, the way GitHub itself treats it. GitHub lets you press Merge in that state, and this plugin was built to replace `mergr` precisely because `mergr` painted those red.

**How the code gets there**, in the order `blocker_for` checks things:

1. `required_state` skips every check whose `isRequired` is not true at `daemon.py:311`. An optional failure never sets `required_failing`, so ❌ and 🟠 never fire.
2. The rollup is read only for PENDING at `daemon.py:389`. GitHub flips the whole rollup to FAILURE as soon as any check fails, optional included, so reading FAILURE there would put ❌ on every optional failure.
3. GitHub reports `mergeStateStatus == UNSTABLE` for exactly this case, and that lands on the `unstable` glyph at `daemon.py:397`.

**Which glyph that is** depends on the `unstable` setting in config.toml:

| setting | emoji | nerd |
|---|---|---|
| `"ok"` (default) | 🆗 | oct-check, plain tick |
| `"pass"` | ✅ | oct-check_circle_fill, same as CLEAN |
| `"warn"` | ⚠️ | oct-alert |

**Why yours looks identical to a clean PR.** The copy herdr runs is from Sep 7, commit 73f7978, before the Python rewrite. Its last startup line in the daemon log says `unstable=pass`. The 🆗 default only arrived on Sep 8. The plugin's config directory is empty, so nothing overrides it either way.

Next: reinstall with `herdr plugin install bonkey/herdr-pr-emoji` so the running copy draws UNSTABLE as a plain tick rather than the filled circle.
