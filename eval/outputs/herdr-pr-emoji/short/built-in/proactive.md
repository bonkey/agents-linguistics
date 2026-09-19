# proactive / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `proactive`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 11  wall: 39s  api: 35s
- cost: $0.8178  output tokens: 3048  words: 383

---

It's intentional. The README calls it the behaviour this plugin was built for: "a PR whose only failing checks are non-required reads as mergeable, the way GitHub itself treats it" (`README.md:5`). Two pieces of code produce it.

**1. Only required checks can mark a PR as failing.**

- One failed check of any kind is enough for GitHub to set `statusCheckRollup.state` to `FAILURE`, so the rollup can't tell a required failure from an optional one.
- A PR with a `FAILURE` rollup therefore gets a second query that asks `isRequired(pullRequestNumber:)` for every check (`required_targets`, `daemon.py:664`).
- `required_state` then drops anything that isn't required before it looks at results (`daemon.py:311`):

  ```python
  if context.get("isRequired") is not True:
      continue
  ```

- An optional failure therefore never sets `required_failing`, which is the only thing that produces ❌ or 🟠 (`daemon.py:385`).

**2. With no required failure, GitHub's own merge state decides.**

- GitHub reports `mergeStateStatus == UNSTABLE` for a PR that is mergeable but has a failing commit status. Branch protection only blocks on required checks, so the merge button still works.
- `blocker_for` reaches that branch after every real blocker has been ruled out (conflict, required failure, running CI, missing review, queue ejection, `BLOCKED`) (`daemon.py:397`):

  ```python
  if status == "UNSTABLE":
      return icons["unstable"]
  ```

I ran `decide` on a PR with a required `build` that passed and an optional `lint` that failed. `required_state` returned `(False, False, [])`, meaning nothing failing, nothing running and nothing unsatisfied. The row showed 🆗.

By default the row shows 🆗 (`oct-check`), which is a different glyph from the ✅ of a fully green PR. The `unstable` setting in `config.toml` (`config.example.toml:8`) controls this:

| `unstable =` | Shows | Meaning |
|---|---|---|
| `"ok"` (default) | 🆗 | mergeable, but an optional check is failing |
| `"pass"` | ✅ | same glyph as a fully green PR |
| `"warn"` | ⚠️ | flagged with the merge-conflict glyph |

Set `unstable = "warn"` if you want optional failures to stand out. If you are seeing ✅ rather than 🆗, check whether your config sets `unstable = "pass"`.

If a check you consider required shows up here, GitHub doesn't mark it as required for that PR's base branch. `isRequired` comes from branch protection or rulesets, so the fix is there, not in the plugin.