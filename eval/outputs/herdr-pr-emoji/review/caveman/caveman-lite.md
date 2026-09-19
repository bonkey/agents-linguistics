# caveman-lite / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-lite`  prompt: `review`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 12  wall: 283s  api: 275s
- cost: $3.3009  output tokens: 21671  words: 1585

---

I found no correctness bug in the verdict logic. The serious problems are in how the daemon starts, takes over its pid file and treats sign-off hook failures. All 171 tests pass (Python 3.14, 0.9 s). I changed no file. I ran the tests and a few read-only probes with bytecode writing off; items marked "probed" were confirmed that way.

## Fix these first
1. **An unknown argument starts the daemon.** `python3 daemon.py --help`, or a typo like `--onse`, falls through every branch at `daemon.py:1366-1393`. It then redirects output to the log, SIGTERMs the running daemon and loops silently. Reject unknown arguments with a usage line and exit 2.
2. **The pid file takeover can kill an unrelated process.** `take_over_pidfile` (`daemon.py:1294`) sends TERM and then KILL to whatever process id the file names. After a reboot or process id reuse, that can be any process you own. Hold an `fcntl.flock` on a lock file for the daemon's lifetime, or check the process command line before signalling. Two daemons starting at once also race on the write.
3. **`CHANGES_REQUESTED` reads 🛑.** Probed. 🛑 means "blocked, and this plugin cannot say why", but `reviewDecision` says exactly why. This is the most common author errand and it has no state. The spare sixteenth colour rule fits it. Rank it near `conversation` in `SORT_ORDER`.
4. **The lookup ignores which repository the pull request comes from.**
   - `pullRequests(headRefName:)` (`daemon.py:594`) matches pull requests from any fork. A stranger's later `patch-1` or `main` pull request takes over your row.
   - With `origin` set to your fork, a pull request against upstream is never found and reads ❔.
   - Ask for `headRepository { nameWithOwner }`, take the last few and pick the one that matches. Fall back to an `upstream` remote.
   - The 🚪 suppression on the trunk partly patches this same cause.
5. **A failing sign-off hook does not do what the docs say.**
   - `daemon.py:556-558`, `config.example.toml:31` and `examples/pr-signoff-jira:34-35` say the row "keeps the glyph it has until its TTL runs out". In fact `decide` republishes the row without the glyph on the next cycle.
   - A flaky hook turns ✅🎫 into a bare ✅, which is the false positive the feature exists to prevent.
   - Either cache the last sign-off state in `states.json` with an age limit, or draw a separate "unknown" glyph. Correct the three texts whichever you choose.

## Behaviour
- **Optional checks still running read 🟡.**
  - `daemon.py:389` shows 🟡 when only optional checks run, even with a `CLEAN` merge state (probed). That contradicts the plugin's headline rule that optional failures do not block.
  - Add `PENDING` rollups to `required_targets` and trust `required_running` wherever required checks exist. Keep the rollup as the fallback for repositories with no required checks. An option in the style of `unstable` would also work.
- **`BEHIND` reads ✅.** As far as I know GitHub reports `BEHIND` only when the base branch requires an up-to-date branch. The button there is then "Update branch", not "Merge". Give it its own state or a setting.
- **Rulesets get no 🟡 for an unreported check and no 💬.** GitHub now sets up rulesets by default. `Ref.rules` exposes `RequiredStatusChecksParameters` and `requiredReviewThreadResolution`; check that against the schema before relying on it.
- **`contexts(first: 100)` is cut off silently** (`daemon.py:714`). Past 100 contexts, a required check reads "unreported" and the row stays 🟡 forever. Without a readable rule, a failure is missed. Read `pageInfo.hasNextPage`, then at least log it or page through. The README mentions the cap only for review threads.
- **Remote parsing is narrow** (probed). `https://user@github.com/…`, `git://`, `ssh.github.com:443`, SSH host aliases and GitHub Enterprise all give an empty slug and a silently blank row. Match `github.com[:/]owner/name` more loosely and log an unrecognised remote once. Document that only `origin` is read.
- **The hook can mark rows it was never asked about** (probed: `🟣🏁`, `❔📭`). Filter its answers to the keys `signoff_input` sent (`daemon.py:789`).
- **Config is read once at start**, and `reload-config` does not restart the daemon. Re-read the file each cycle when its modification time changes, or document the restart. The regex parser also has gaps (probed):
  - It reads keys inside any `[table]`.
  - It ignores TOML single-quoted strings.
  - It drops invalid values without a log line.
  - Use `tomllib` on Python 3.11 and newer, keep the regex as the fallback, and log ignored values.
- **Exit codes hide failures.** `--once` returns 0 when herdr is unreachable (`daemon.py:1387`), and a missing `gh` returns 0 for `--query` and `--resolve`. Return non-zero so the action reports the failure.
- **Three slow herdr answers end the daemon for good.** `herdr_json` returns `None` for a 10 s timeout or a JSON parse error, so three busy cycles end the daemon (`daemon.py:1406-1411`). Every glyph then expires. Back off instead of exiting, or exit only when the socket or binary is gone.
- **Refresh and branch changes lag.**
  - `refresh` runs a second full cycle alongside the daemon. A SIGUSR1 to the daemon would avoid the double poll.
  - A branch switch shows the old pull request for up to one interval. A cheap local branch check between polls would fix that.
  - During a rebase the row goes blank. Read `rebase-merge/head-name` there.
- **Sorting ignores the sign-off.** ✅📭 sorts as "press the button". Rank `missing` and `open` lower inside `mergeable`.

## Code
- **Logging:**
  - `daemon.py:1398` logs `icons["unstable"]`, which is the glyph (a private-use codepoint), not the setting. Log the names of the setting and the icon set.
  - `guarded_cycle` logs only `repr(exc)` (`daemon.py:1054`). Add `traceback.format_exc()`.
  - The log is truncated only at start, and the truncation destroys everything. Rotate to `.1` instead. Deduplicate errors that repeat every cycle, such as a SAML-protected repository writing one line every 2 minutes.
- **`save_states`** uses one `.tmp` name (`daemon.py:1108`). `--once` and the daemon can collide on it. Add the process id to the name.
- **Subprocess load.**
  - Each cycle spawns two `git` calls per workspace and one `herdr` call per workspace and per pane, all sequential.
  - Cache the slug per path, and skip a clear for a target that is already cleared.
  - `time.sleep(interval)` makes the period drift by the cycle duration. Sleep for `interval - elapsed`.
- **`sort_workspaces`** logs "workspace list is empty" when herdr is actually unreachable (`daemon.py:1273-1277`).
- **`signoffCommand` takes no arguments** (probed: the path became `…/x --flag`). `shlex.split` would allow arguments and still use no shell.
- **`examples/pr-signoff-jira`:**
  - Line 118 formats a list into the message, which prints `['…']`.
  - The header promises "one request a cycle", but the code makes a `/myself` call plus up to 3 search pages. Cache the identity check.
- **Style.** Line length is mixed, with some lines wrapped at 88 and others over 100. `class SocketStub(object)` is Python 2 style. `shutil` is imported lazily in three places in the tests. Add a `ruff` config.
- **No CI.** The "Python 3.9 or newer" claim is untested. Add an Actions matrix for 3.9–3.14 on macOS and Linux. Version 0.7.0 has no tag and no changelog.

## Tests
- **Riskiest code is untested:** `take_over_pidfile`, `drop_pidfile`, argument handling in `main`, `gh_graphql` (exit 1 with data, non-JSON output, timeout), `publish` arguments, the `workspace_rows` fallback to a pane's working directory, `read_pairs`, the error replies of `socket_request` and `redirect_to_log`.
- **No full-cycle test.** No end-to-end cycle reaches a pull request. The herdr stub already exists, so add a fake `gh` that serves the fixtures and a temporary git repository.
- **Examples are untested.**
  - Run `pr-signoff-static` on real `signoff_input` output to prove the contract.
  - Load `pr-signoff-jira` with `SourceFileLoader` and test `tickets_by_pull`, `unsatisfied_checks` and `without_a_ticket`.
- **Docs are not checked against the code.**
  - `test_the_whole_order_is_what_the_readme_says` never reads the README.
  - Parse the README state table, the `\uXXXX` colour rules and the manifest description, and compare them with `EMOJI`, `NERD` and `SORT_ORDER`. A codepoint typo goes unnoticed today.
- **Other test gaps:**
  - Add a seeded random permutation test for `move_requests`.
  - Tests print daemon log lines to stderr. Patch `daemon.log`.
  - `GuardedCycle` patches by hand and passes `"pass"` as the icons argument. Use `mock.patch.object`.
  - Add tests for the items above: `CHANGES_REQUESTED`, the fork match, hook answers for rows it was not asked about and config keys inside a table.

## README
- **Install never mentions the font.** The default is `icons = "nerd"`, but the intro says "one emoji" and the font first appears at line 259. A new user sees boxes.
- **`README.md:178-194`** covers required checks but sits under the 💬 heading. Move it to State mapping or give it its own section.
- **Stale text:**
  - `README.md:244` says "five columns" and there are six.
  - The headers of both example hooks omit `unsatisfied` (`pr-signoff-jira:7`, `pr-signoff-static:8`).
  - `README.md:330` says the colour rules follow the `blocker_for` order, but merged, closed and no-PR come last in the list.
- **`README.md:8`** keeps branch names that look real (`ios-27-siri-ai-intents`, `apple-ads-interface`), although commit a5cc614 generalised the other examples. `test_daemon.py:943` uses "PAIR" without explaining it.
- **Missing sections:**
  - Troubleshooting: the log path, `gh auth status`, a SAML-protected organisation and a blank row.
  - How a config change is applied.
  - The limits on forks, `origin` and GitHub Enterprise.
  - How the hook gets its `SIGNOFF_JIRA_*` variables. A daemon that the herdr server starts inherits the server's environment, so document a wrapper script.
- **Reference is hard to find.** The rationale prose outweighs the reference. Put the tables and the config first and move the reasoning to a "Design notes" section, so a lookup does not mean reading 120 lines.