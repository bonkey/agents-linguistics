# proactive / review

- arm: `proactive`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 20  wall: 360s  api: 352s
- cost: $3.5971  output tokens: 26496  words: 1209

---

The project is in good shape. All 171 tests pass on Python 3.14 in under two seconds, the decision logic is pure and well covered by recorded fixtures, and the README explains every choice. Nothing was modified. The findings below are ranked within each section, most valuable first.

## Behaviour

- **The pid-file takeover can kill an unrelated process.** `take_over_pidfile` at `daemon.py:1294` trusts any live pid it finds, and `alive` at `daemon.py:1317` only checks that some process with that number exists. After a reboot the stale pid is reused by whatever the user happens to be running, and the daemon sends it TERM and then KILL. Hold a `fcntl.flock` on a lock file for the daemon's lifetime instead, and only signal a pid when the lock is actually held. That keeps the hand-launched takeover and removes the hazard. `fcntl` is standard on both platforms the manifest lists.
- **A changes-requested review has no glyph.** `reviewDecision` already arrives in the branch lookup, but only `REVIEW_REQUIRED` is read. A PR with `CHANGES_REQUESTED` reads 🛑 under branch protection and ✅ without it, and neither tells the author a reviewer is waiting on them. A distinct glyph placed just before 👀 in `blocker_for`, and in the first sort group, costs no request.
- **A pending optional check pins the row to 🟡.** `blocker_for` at `daemon.py:389` treats a `PENDING` rollup as running, but `required_targets` at `daemon.py:664` never sends a `PENDING` rollup to the second query. A slow or stuck non-required check therefore shows 🟡 indefinitely on a PR GitHub calls mergeable, which contradicts the plugin's founding rule that optional checks do not count. Add `PENDING` to the targets and let `required_running` decide, keeping the rollup as the fallback only when the second query went unanswered.
- **Config changes need a daemon restart, and nothing documents that.** The loop at `daemon.py:1412` reads the config once at startup. Since reload-config and disable/enable do not rerun startup hooks, a user who edits the interval or adds a sign-off command has no obvious way to apply it. Re-reading the two config functions each cycle is cheap and would make edits take effect within one interval.
- **An `EXPECTED` status context reads 🛑, but a missing one reads 🟡.** `required_state` at `daemon.py:322` counts only `PENDING` as running, so a status context GitHub itself labels "Expected, waiting for status" falls to blocked while the synthesised `EXPECTED` for an unreported name counts as running. Treating both the same closes the gap.
- **A running check reaches the sign-off hook as `name=` with an empty result.** At `daemon.py:319` an in-flight check run has no conclusion, so the column reads `build=`. Filling in the run's `status` would give the hook `build=IN_PROGRESS` and match the shape the README promises.
- **Rulesets leave 💬 and the expected-context check dark.** More organisations now use rulesets than classic protection, and the README documents the 🛑 fallback. `Ref.rules` on the base ref exposes the same data through `RequiredStatusChecksParameters` and `PullRequestParameters`, and could ride in the same second request. Worth verifying against the schema before building.
- **Fork workflows read ❔ everywhere.** The lookup asks the origin repository, but a PR from a fork lives on the upstream. Conversely `headRefName` also matches other people's fork branches of the same name, so a branch called `patch-1` can pick up a stranger's PR. At minimum the README should say so; reading an `upstream` remote would fix the first half.
- **The Jira example can exceed the daemon's default timeout.** Its per-request timeout is 15 seconds at `examples/pr-signoff-jira:53`, and one cycle makes up to five sequential calls including the token command. The daemon gives it 20 seconds by default, so a slow Jira silently costs the glyph every cycle. Either lower the per-call budget or tell readers to raise `signoffTimeoutSeconds`.
- **Log handling.** `redirect_to_log` at `daemon.py:1346` truncates the whole log to zero at startup, losing exactly the history a restart investigation wants, and never checks size again while the daemon runs for weeks. Rename to `.1` instead, and check once per cycle.
- **Missing `gh` exits 0.** At `daemon.py:1373` every mode returns success, so a `--query` or `--resolve` in a script produces no output and no failure signal.
- **Remote URL parsing misses common shapes.** `slug_from_url` at `daemon.py:951` rejects `ssh://github.com/`, `https://user@github.com/` and `git://`, and turns a trailing slash after `.git` into a repository named `r.git`. One anchored regex covers all of them.

## Code and tests

- `read_config` and `read_signoff` open and regex-scan the same file separately, and the regexes silently ignore single-quoted TOML strings. Merging them into one reader that returns a small settings dict removes the duplication; if the Python floor ever rises to 3.11, `tomllib` replaces the regexes outright.
- `apply_marks` runs twice on the sign-off path, once in `resolve` and again in `decide`. Making `resolve` the only caller and dropping it from `decide` removes the docstring's apology.
- The `STATE_NAMES` table at `daemon.py:144` exists so `blocker_for` can be tricked into returning names. Having `blocker_for` return names always and letting `emoji_for` do the glyph lookup is simpler and removes the table.
- Two git subprocesses per workspace per cycle. The origin URL almost never changes, so caching it by checkout path removes half of them.
- **Test gaps.** The publishing half of `cycle` is untested: nothing asserts the report-metadata argv, the TTL of three intervals, or that an empty verdict uses `--clear-token`. The stub herdr in the sort tests already records unknown calls, so a stub `gh` answering the fixtures would cover the whole cycle end to end. Also untested: `gh_graphql` on exit 1 with usable data, which is the docstring's central claim; `take_over_pidfile` and `drop_pidfile`; `read_pairs`; the pane-cwd fallback in `workspace_rows`; and `--query` and `--resolve` output.
- Cosmetic: `GuardedCycle` at `test_daemon.py:1208` still passes the string `"pass"` where an icon table is expected and monkeypatches by assignment rather than `mock.patch.object`. Several `__import__("shutil")` lambdas would be one import at the top.
- **No CI.** The README claims Python 3.9 or newer, and the syntax does parse under 3.9, but nothing runs the suite there. A workflow on ubuntu and macos across 3.9 and the current release would make the claim true continuously. Add `.claude/` to `.gitignore` while at it.

## README and examples

- **Both example hooks describe a five-column stdin that no longer exists.** `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` omit the `unsatisfied` column the daemon has sent since the last two commits, even though the Jira script reads it. `config.example.toml` and the README are correct.
- Three paragraphs under "The 💬 modifier", starting at `README.md:178`, are about re-run attempts and the rollup and belong under "State mapping".
- The default icon set needs a Nerd Font, but the Install section never says so. A reader without one sees empty boxes and has no hint that `icons = "emoji"` exists until the icon-set section much later.
- `README.md:330` names the internal function `blocker_for` in user-facing prose.
- The README is 461 lines and most of it is rationale. Moving the design essays into a separate design-notes file, leaving Install, the tables and Configuration, would make the plugin scannable without losing anything.
- Missing topics: what to do after editing the config, where a manual `refresh` action's output goes since it does not write to the daemon log, the fork limitation, and `CHANGES_REQUESTED`.
