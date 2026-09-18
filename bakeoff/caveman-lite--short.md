# caveman-lite / short

- arm: `caveman-lite`  prompt: `short`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 6  wall: 34s  api: 31s
- cost: $0.5459  output tokens: 2075  words: 227

---

Answer is in the code and docs. Writing it up now.

Because that is what GitHub says, and the daemon deliberately does not second-guess it. Branch protection only counts required checks, so a PR whose only failures are optional gets `mergeStateStatus == UNSTABLE`, which GitHub itself treats as "the merge button works".

The daemon follows that in two steps:

- **The failing verdict ignores optional checks.** `required_state` in `daemon.py:311` skips every context whose `isRequired` is not true. With no required check failing, `required_failing` stays false, so ❌ and 🟠 never trigger. The rollup-level `FAILURE` is not used for the verdict because one optional failure is enough to turn the whole rollup red (comment at `daemon.py:667`).
- **UNSTABLE then falls through to its own glyph.** In `blocker_for` at `daemon.py:397`, `UNSTABLE` returns `icons["unstable"]`, not `icons["mergeable"]`. By default that is 🆗 with emoji or `oct-check` with Nerd Font, which is a plain check rather than the filled circle of ✅. The `unstable` setting in config chooses the reading: `"ok"` is the default, `"pass"` maps it onto the ✅ glyph, `"warn"` maps it onto ⚠️ (`icon_set`, `daemon.py:176`).

So if you see a true ✅ on such a PR, either `unstable = "pass"` is set in your config, or the two Nerd Font check glyphs look alike in your font. Set `unstable = "warn"` if you want optional failures to stand out.
