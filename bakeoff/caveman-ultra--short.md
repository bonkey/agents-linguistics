# caveman-ultra / short

- arm: `caveman-ultra`  prompt: `short`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 5  wall: 34s  api: 31s
- cost: $0.5346  output tokens: 2156  words: 169

---

By design. GitHub itself says so, daemon agrees.

- **GitHub verdict.** Only non-required checks failing gives `mergeStateStatus == UNSTABLE`. GitHub merges over it. Merge button green.
- **Rollup alone misleads.** `statusCheckRollup.state` reports FAILURE for one optional failure. So `required_targets` (`daemon.py:664`) sends PR to second query, `isRequired(pullRequestNumber:)` per check (`daemon.py:694`).
- **Optional checks dropped.** `required_state` (`daemon.py:311`) skips every context where `isRequired is not True`. Optional failure never reaches `FAILING_RESULTS`. `required_failing` stays False.
- **Blocker ladder.** `blocker_for` (`daemon.py:385`) skips ❌ since nothing required fails. Nothing running. Falls to `status == "UNSTABLE"` (`daemon.py:397`), returns `icons["unstable"]`.
- **Glyph.** Default `unstable = "ok"`: 🆗 emoji, `oct-check` (F42E) in nerd set. Mergeable is `oct-check_circle_fill` (F4A4). Plain check vs filled circle. Easy to read as same. `unstable = "pass"` makes them identical on purpose (`daemon.py:180`). `unstable = "warn"` gives ⚠️.
- **Sort.** `unstable` ranks right after `mergeable` (`daemon.py:152`). Both mean "press button", one after you decide optional failures do not matter.

Want distinct signal: set `unstable = "warn"` in config. README line 72 documents all three.
