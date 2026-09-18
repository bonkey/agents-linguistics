# caveman-full / short

- arm: `caveman-full`  prompt: `short`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 5  wall: 36s  api: 33s
- cost: $0.6015  output tokens: 2376  words: 207

---

By design. README first line states plugin goal: "a PR whose only failing checks are non-required reads as mergeable, the way GitHub itself treats it." Replaces mergr, which read any red check as failing.

Mechanism, three layers:

1. **GitHub side.** Non-required failures do not block merge button. GitHub reports `mergeStateStatus == UNSTABLE`, not `BLOCKED`. Rollup still says `FAILURE`, so rollup alone misleads.

2. **Required-check query.** `required_targets` (`daemon.py:664`) sends PRs with rollup `FAILURE` for closer look. `required_state` (`daemon.py:311`) skips every context where `isRequired` is not `True`. Non-required failure never sets `required_failing`, so ❌/🟠 rungs never fire.

3. **`blocker_for` ladder** (`daemon.py:385-398`). Order: conflict, required failing, running, review, ejected, `BLOCKED`, then `UNSTABLE`. `UNSTABLE` maps to `icons["unstable"]`. Default `unstable = "ok"`: 🆗 emoji, `oct-check` in Nerd set. Config `unstable = "pass"` makes it ✅ / `oct-check_circle_fill`; `"warn"` makes it ⚠️ / `oct-alert` (`daemon.py:170-181`).

Note glyph pitfall: Nerd default draws 🆗 as `oct-check` and ✅ as `oct-check_circle_fill`. Both look like green ticks. If row shows filled circle tick, config has `unstable = "pass"`. Sort also ranks `unstable` right after `mergeable` (`daemon.py:152`).

Want red check to block? Set `unstable = "warn"` in plugin `config.toml`, then `herdr plugin action invoke bonkey.pr-emoji.refresh`. Or make check required in branch protection, then `isRequired` flips and ❌ fires.
