# concise / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `concise`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 29s  api: 27s
- cost: $0.5368  output tokens: 2221  words: 230

---

That is the plugin's founding premise: the README opens with it (`README.md:5`). GitHub lets you merge over a failing non-required check, so the row should not say otherwise.

- **Only required failures count as a failure:** `required_state` skips any check whose `isRequired` is not `True` (`daemon.py:311`). Only a required failure sets `required_failing`, which gives the failing glyph.
- **What is left is `UNSTABLE`:** with nothing required failing, the row falls through to `mergeStateStatus`. `UNSTABLE` is what GitHub reports for a PR whose only failures are non-required.
- **`UNSTABLE` gets a glyph of its own:** `blocker_for` returns `icons["unstable"]`, the 🆗 or `oct-check` glyph (`daemon.py:397-398`). That is a plain check rather than the ✅ of `CLEAN`, so you can still tell "mergeable" from "mergeable, and something optional is red". It also sorts right after ✅ (`daemon.py:151-152`).

You have no plugin config of your own, so you are on the default `unstable = "ok"` and get that separate glyph. The setting lives in the plugin's `config.toml` (the `unstable` line in `config.example.toml:8`). `unstable = "warn"` draws it as ⚠️ instead, and `unstable = "pass"` makes it identical to ✅ (`daemon.py:177-180`).

`BEHIND` is in `MERGEABLE_STATUS` and draws ✅. If GitHub reports `BEHIND` for a PR that also has an optional failure, the row shows a full ✅ with no hint of that failure. I inferred this from the code and have not seen it happen.