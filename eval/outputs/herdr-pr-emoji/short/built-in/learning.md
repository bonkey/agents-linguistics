# learning / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `learning`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 10  wall: 32s  api: 27s
- cost: $0.5585  output tokens: 2357  words: 376

---

A pull request whose only failing checks are non-required shows as mergeable because the plugin never treats a failing non-required check as a failure. This is the behaviour the plugin was written for. `README.md:5` says such a pull request "reads as mergeable, the way GitHub itself treats it", meaning branch protection only blocks on required checks.

Three places in `daemon.py` produce this:

1. **Failures are counted per check, and only for required checks.** `required_state` (`daemon.py:282`) skips every check where `isRequired` is not true (`daemon.py:311`). A failing non-required check therefore never sets `required_failing`, and the ❌/🟠 branch at `daemon.py:385` is never taken.

2. **The overall rollup state is not used to detect failure.** GitHub sets `statusCheckRollup.state` to `FAILURE` as soon as any one check fails, and one failing non-required check is enough (`README.md:182-185`). `blocker_for` reads the rollup only to detect `PENDING` (`daemon.py:389`).

3. **GitHub's own merge state already says the pull request can merge.** For this case GitHub reports `mergeStateStatus == UNSTABLE`, which means mergeable with non-passing, non-required statuses. `blocker_for` checks `DIRTY`, a required-check failure, running checks, a missing review, a merge-queue ejection and `BLOCKED` first. `UNSTABLE` comes after all of those (`daemon.py:397`), just above `CLEAN`/`BEHIND`/`HAS_HOOKS` → ✅.

By default it shows 🆗 rather than ✅, so you can tell "mergeable, but some optional checks are red" apart from "everything green". The `unstable` setting in `config.toml` changes that (`config.example.toml:6-8`, resolved in `icon_set` at `daemon.py:170`):

| `unstable =` | glyph | reads as |
|---|---|---|
| `"ok"` (default) | 🆗 | mergeable, with optional failures |
| `"pass"` | ✅ | the same as a clean pull request |
| `"warn"` | ⚠️ | shares the merge-conflict glyph, so the row looks like a conflict |

If the optional failures should stand out on your rows, set `unstable = "warn"`. No code change is needed.

`★ Insight ─────────────────────────────────────`
- `icon_set` resolves the `unstable` setting into the glyph table once, at load time. `blocker_for` just returns `icons["unstable"]` and does not know the state is configurable.
- Because of that, a glyph on a row cannot be mapped back to a state: under `"warn"`, ⚠️ can mean either a conflict or optional failures. The sort actions therefore recompute the state per workspace instead of reading the glyph back (`README.md:364`).
`─────────────────────────────────────────────────`