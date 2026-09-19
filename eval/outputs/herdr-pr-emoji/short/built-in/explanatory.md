# explanatory / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `explanatory`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 9  wall: 35s  api: 31s
- cost: $0.7367  output tokens: 2424  words: 386

---

It is deliberate. The plugin is built to agree with GitHub, which still lets you merge a PR when only optional checks fail. `README.md:5` calls this the one behaviour the plugin was written for, as a replacement for `mergr`.

The decision is made in `blocker_for` (`daemon.py:342`), where the first matching condition wins:

1. **Only required checks can produce a failure glyph.** `required_state` (`daemon.py:282`) skips every check where `isRequired` is not true (`daemon.py:311`). A failing optional check therefore never sets `required_failing`, and the ❌/🟠 branch at `daemon.py:385` is not taken.

2. **The overall check rollup is not used as the verdict.** GitHub marks the whole rollup `FAILURE` as soon as any single check fails, required or not (`daemon.py:667-669`). The plugin uses a failed rollup only as a trigger for a second GraphQL query (`daemon.py:694`). That query asks each check whether it is required for this PR.

3. **GitHub's own merge state decides the rest.** With no required failure, nothing running, no missing review and no block, the code reaches `status == "UNSTABLE"` (`daemon.py:397`). `UNSTABLE` is GitHub's `mergeStateStatus` for a PR that can be merged while some non-required check is failing.

By default the row does not show the full ✅. It shows 🆗 (`oct-check` in the Nerd Font set), which sorts just below ✅ (`daemon.py:152`). You can change that with the `unstable` setting (`config.example.toml:8`):

| `unstable` | Glyph | Meaning |
|---|---|---|
| `"ok"` (default) | 🆗 | mergeable, but optional checks are failing |
| `"pass"` | ✅ | same as a clean PR |
| `"warn"` | ⚠️ | same as a merge conflict |

`icon_set` (`daemon.py:170`) applies this setting once, when the glyph table is built, so `blocker_for` does not need to know the glyph is configurable.

A PR that is `UNSTABLE` but still waiting for a required review shows 👀, because the review check at `daemon.py:391` comes before the `UNSTABLE` check.

`★ Insight ─────────────────────────────────────`
- The plugin checks required failures itself and only then falls back to `mergeStateStatus`. A PR with one failed required check and others still running would otherwise show only as `BLOCKED`.
- `isRequired(pullRequestNumber:)` takes the PR number because whether a check is required depends on the base branch's protection rules. That is why this data comes from a second query limited to PRs that look broken (`required_targets`, `daemon.py:664`).
`─────────────────────────────────────────────────`