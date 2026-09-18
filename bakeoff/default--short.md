# default / short

- arm: `default`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 34s  api: 32s
- cost: $0.4983  output tokens: 2083  words: 317

---

It is deliberate, and it is the plugin's founding feature rather than a bug. The README's first paragraph states it as the one behaviour the plugin was built for, matching how GitHub itself treats such a PR.

**Where GitHub decides it.** When every required check has passed and only optional checks are red, GitHub reports the PR's merge state as UNSTABLE, not BLOCKED. The merge button stays enabled. UNSTABLE is GitHub's own word for "mergeable, with a warning".

**Where the plugin decides it.** The verdict comes from the first-match ladder in `blocker_for` at `daemon.py:381`. Two rungs matter here:

- **The failure rung only fires for required checks.** `required_state` at `daemon.py:284` skips every context whose `isRequired` is false, so a red optional check never sets the failing flag that produces ❌ or 🟠. The rollup's overall FAILURE state is ignored for the same reason: GitHub flips it as soon as any context fails, required or not.
- **UNSTABLE lands on its own rung**, below BLOCKED and above the CLEAN set, and reads the `unstable` icon.

**What that glyph shows is configurable.** The `unstable` key in the plugin's config picks among three renderings, documented at `config.example.toml:6`:

| Setting | Glyph |
|---|---|
| `ok` (default) | 🆗 |
| `pass` | ✅ |
| `warn` | ⚠️ |

So by default the row is 🆗, which is distinct from the plain ✅ that CLEAN, BEHIND and HAS_HOOKS get. If you are seeing ✅ for such a PR, the config has `unstable = "pass"`. If you want the optional failures to stand out, set it to `warn`.

The one caveat the docs note: the plugin only asks per-check `isRequired` for PRs whose rollup is FAILURE or ERROR, or whose merge state is BLOCKED. A PR the required-check query did not answer for keeps default marks, which is why the UNSTABLE rung sits after the required-failure rungs rather than before them.
