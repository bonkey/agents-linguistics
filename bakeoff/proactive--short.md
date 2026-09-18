# proactive / short

- arm: `proactive`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 5  wall: 30s  api: 27s
- cost: $0.4694  output tokens: 1700  words: 301

---

It's by design, and it mirrors GitHub. The README's opening paragraph names it as the plugin's one distinguishing behaviour: a PR whose only failing checks are non-required reads as mergeable, the way GitHub itself treats it. GitHub will let you press the merge button in that state, so the row says so.

The mechanism lives in `blocker_for` in `daemon.py:340`, where the first matching rule wins:

- **Failing checks only count if they are required.** The rollup state alone can't tell a required failure from an optional one, so any PR whose rollup reports FAILURE or ERROR gets a second query. That query asks GitHub's `isRequired(pullRequestNumber:)` on every check, and `required_state` at `daemon.py:282` skips every context where that answer is not true. If no required check failed, the failing flag stays false and the ❌ and 🟠 rules at `daemon.py:385` never fire.
- **GitHub then reports the merge state as UNSTABLE.** That is GitHub's own word for "mergeable, but a non-required check failed". The rule at `daemon.py:397` maps it to the unstable glyph, which sits just above CLEAN, BEHIND and HAS_HOOKS in the ladder.
- **The glyph you see for it is configurable.** The default is 🆗, deliberately distinct from ✅ so you can tell the two apart. With `unstable = "pass"` in the config it becomes ✅, and with `unstable = "warn"` it becomes ⚠️. The resolution happens once in `icon_set` at `daemon.py:170`.

So if a row shows ✅ for such a PR, either the config sets unstable to pass, or the required-check query could not answer and the daemon fell back to the merge state alone. That fallback is logged as "no required checks for ..." and only affects ❌ and 🟡, not this case. If instead you want those PRs to stand out, set `unstable = "warn"` in `config.toml`.
