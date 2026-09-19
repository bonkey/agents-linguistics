# ste-concise / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `ste-concise`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 15  wall: 416s  api: 407s
- cost: $3.5169  output tokens: 33565  words: 1906

---

The decision logic is careful and well tested. The defects are in process control, config parsing, remote URL parsing and pagination. Correct defects 1 to 3 first: each fix is small, and each defect can break an install that works.

**Validation:** `python3 -m unittest` passes, 171 tests, on Python 3.14.7. Three probes ran against functions of `daemon.py`: remote URLs, config values and the timeout path. No request went to GitHub or herdr. Defects 4 and 6 and the rulesets proposal therefore rest on the code and on my knowledge of the GitHub API. The test suite created `__pycache__/`. I removed it, and the tree is as I found it.

## Defects

1. `daemon.py:1366`: an unknown argument starts the loop.
   - `python3 daemon.py --help`, or a typo such as `--onse`, reaches `take_over_pidfile()`. It stops the daemon that herdr started and sends its own output to the log file.
   - Reject an unknown argument with a usage line and exit 2.
2. `daemon.py:1302`: `take_over_pidfile` sends SIGTERM, then SIGKILL, to any live process with the stored pid.
   - The pid file survives a reboot and a SIGKILL of the daemon, so a reused pid belongs to an unrelated process.
   - Hold `fcntl.flock` on the pid file. The alternative is to compare `ps -p <pid> -o command=` with `daemon.py` before the signal.
3. `daemon.py:1363`: the loop reads `config.toml` once, and `--once` reads it each time.
   - After an edit of `icons`, `refresh` publishes the new set, and the loop overwrites it with the old set on its next cycle.
   - The README does not say how a config edit takes effect.
   - Read the config at the top of each cycle.
4. `daemon.py:714`: `contexts(first: 100)` asks for no `pageInfo`.
   - Re-runs keep every attempt, so a large pull request exceeds 100 contexts.
   - A required context on page two then counts as `EXPECTED`. The row shows 🟡 or 🟠 for good, and the hook receives a false `EXPECTED`.
   - Ask `pageInfo { hasNextPage }`. Then follow the cursor, or drop the `expected` rule for that pull request.
5. `daemon.py:951`: `slug_from_url` rejects valid GitHub remotes.
   - The probe returned an empty slug for each of these:
     - `https://user@github.com/o/r.git`
     - `ssh://git@github.com:22/o/r.git`
     - `git://github.com/o/r.git`
     - `http://github.com/o/r`
     - `https://GitHub.com/o/r`
     - `git@github-work:o/r.git`
   - The row stays blank and the log file has no line about it.
   - Use `urllib.parse` plus one pattern for the scp form, drop the user and the port, and fold the case of the host.
   - Write one log line for each rejected remote.
   - A host alias needs a config key or `ssh -G`.
6. `daemon.py:594`: `pullRequests(headRefName:)` also matches a head branch in a fork.
   - A pull request from the `main` of a fork becomes the newest match for `main`, and the trunk row shows its state.
   - Ask `isCrossRepository` with `last: 5`, and take the newest pull request of the same repository.
   - The reverse case has no support: with `origin` on a fork, the pull request lives in the parent and the row shows ❔.
7. `daemon.py:207`: a timeout stops the direct child only.
   - The probe `run(["sh", "-c", "sleep 4; echo late"], 1)` returned after 1 s and left `sleep` alive.
   - A shell hook that starts `curl` leaves one `curl` behind per cycle.
   - Set `start_new_session=True` and use `os.killpg` on timeout.
8. `daemon.py:1372` and `daemon.py:1387`: every mode exits 0 without `gh`, and `--once` exits 0 when herdr is unreachable.
   - The `refresh` action therefore reports success for no work.
   - The `gh is required` line is written before `redirect_to_log()`, so it never reaches `daemon.log`.
   - Exit 1 in the manual modes, and write the startup line to the log file.
9. `daemon.py:244`: the config parser ignores a single-quoted TOML string.
   - It drops `unstable = "Warn"` and `icons = "emojis"` with no log line.
   - It accepts `signoffCommand = "~/bin/hook --flag"`, which then exits 127 on every cycle.
   - Use `tomllib` on Python 3.11 and later, with the patterns as the fallback.
   - Write a log line for each rejected value, and accept an array for the command.
10. `daemon.py:1108`: the loop and `--once` write the same `states.json.tmp`. Two writers at one time can rename a partial file. Use `tempfile.mkstemp(dir=STATE)`.
11. `daemon.py:1398`: the startup line prints `icons["unstable"]`, which is the glyph. With the default set, the line shows a private-use codepoint after `unstable=`. Print the name of the setting.

## Behaviour

Two of these proposals alter what a user sees: `BEHIND` and the `PENDING` rule. A config key for each makes the release reversible.

- **`BEHIND`:** `BEHIND` shows ✅.
  - GitHub reports `BEHIND` only where the base branch requires an up-to-date head. The merge button is disabled, and the errand is "update the branch".
  - Give it a state of its own, ranked after `mergeable`. The README says one of the sixteen rule slots is free.
  - The alternative is one sentence in the README.
- **`PENDING`:** at `daemon.py:389`, `rollup == "PENDING"` overrides the exact result of the second request.
  - Take a `BLOCKED` pull request with every required check green, one slow optional check and no review. It shows 🟡 for the whole optional check, where 👀 is the errand.
  - That conflicts with the first paragraph of the README, where optional checks decide nothing.
  - Where the marks exist and the protection rule was readable, let `required_running` decide alone.
  - Keep the rollup as the fallback elsewhere. Under rulesets it is the only sign of an unreported required check.
- **Rulesets:** `branchProtectionRule` is null under a ruleset, so an unreported required check shows 🛑 and 💬 never appears.
  - The README documents that fallback.
  - GitHub's GraphQL schema has repository rulesets with `RequiredStatusChecksParameters` and `requiredReviewThreadResolution`. Read both sources.
  - Examine the schema first, because I did not query it.
- **Detached HEAD:** in a rebase or a bisect, `git branch --show-current` prints nothing.
  - The row clears, and `states.json` stores an empty state, which puts the worktree last in the next sort.
  - Publish nothing for a checkout with no current branch, so the last glyph stays until its TTL.
- **Repeated errors:** an expired `gh` token writes the same two lines on every cycle. The rows go blank after three intervals with no other sign. Write a repeated error once, until its text differs.
- **Log file:** `redirect_to_log` truncates the file to zero, and only at launch.
  - A daemon that lives for weeks never rotates it.
  - The next launch deletes the evidence of why the previous daemon stopped.
  - Rename the file to `daemon.log.1` at the limit, and read its size on each cycle.
- **Request size:** one request carries every branch, with no chunk limit.
  - I have no evidence of a failure, but a refused request blanks every row after the TTL.
  - Split at a fixed count of aliases if a user reports `RESOURCE_LIMITS_EXCEEDED`.
- **Subprocess count:** each cycle starts two `git` commands per workspace and one `herdr` command per workspace and per pane. Worktrees of one repository share `origin`, so cache the slug per `repo_key`.

## Code

- **`blocker_for`:** `blocker_for(pr, icons)` has one caller, and that caller gives it `STATE_NAMES`. Return the state name, and delete the parameter and the table. `emoji_for` already maps the name to the glyph.
- **`apply_marks`:** with a hook configured, it executes twice, in `resolve` and again in `decide`. Keep the one in `resolve`, and let the `decide` wrapper in the tests apply the marks.
- **Config readers:** `read_config` and `read_signoff` open and parse the same file. One function that returns one tuple removes the second read and gives defect 9 one place for its fix.
- **Stale text:** the docstring of `parse_required` promises `(failing, running)`, and the function returns four values. The log line at `daemon.py:926` and the docstring of `resolve` omit 🟠 and 💬.

## Tests

- **Coverage:** no test exercises these functions:
  - `publish`
  - `workspace_rows`
  - `panes_of`
  - `read_pairs`
  - `print_verdicts`
  - `take_over_pidfile`
  - `drop_pidfile`
  - `redirect_to_log`
  - `read_reply`
  - `main`
- **One cycle, end to end:** one test of a whole cycle covers most of them.
  - `SortEndToEnd` already has a stub `herdr` that stores its arguments.
  - Add a stub `gh` that prints `fixtures/lookup.json`, and a temporary git checkout with a GitHub `origin`.
  - Assert on the stored `report-metadata` arguments: the token, `--ttl-ms`, `--clear-token`, the panes and the skipped rows.
- **README order:** `test_the_whole_order_is_what_the_readme_says` compares `SORT_ORDER` with itself and never opens the README. Parse the README tables, or rename the test.
- **Octicons:** the README repeats the Octicon names and codepoints by hand. One test can compare its rules block with `NERD`.
- **Timeout path:** `test_a_command_that_times_out_answers_nothing` replaces `run` with a mock, so no test exercises the timeout path. A hook that sleeps, with a timeout of 1 s, covers it and guards the fix for defect 7.
- **Examples:** `examples/` has no test.
  - Send the output of `signoff_input` through `run_signoff` to `pr-signoff-static`. That pins the contract of six columns.
  - Load `pr-signoff-jira` with `importlib`, and test `tickets_by_pull`, `without_a_ticket` and `unsatisfied_checks`. All three are pure functions.
- **Log lines:** a passing suite prints five log lines. Patch `daemon.log` in those tests and assert on the message.
- **CI:** the repository has none. Add a workflow for `python3 -m unittest` on Python 3.9 and on the newest release. The README promises 3.9, and this review used 3.14 only.

## README and examples

- **Nerd Font:** "Install" does not name the Nerd Font, `nerd` is the default, and the first example shows emoji. A user without a Nerd Font sees empty boxes on the first launch. Add the font to the "Requires" line.
- **Shell hooks:** document the trap.
  - Tab is IFS white space, so `read` merges adjacent tabs, and an empty `reviewDecision` moves `mergeStateStatus` one column left.
  - `examples/pr-signoff-static:16` has that shape. The script ignores those columns, so it is harmless there.
  - Rewrite the example with `awk -F'\t'`, because readers copy it.
- **Column count:** both example headers and README line 244 ("five columns") describe the input before the `unsatisfied` column. The daemon sends six columns.
- **Placement:** README lines 178 to 194 cover the newest attempt, the rollup and unreported contexts. They sit under "The 💬 modifier" and belong to "State mapping".
- **Rule order:** README line 330 says the colour rules follow the order of `blocker_for`.
  - The block puts merged, closed and no pull request near the end, and `blocker_for` decides them first.
  - Only the last place of 💬 matters. Say that instead.
- **New sections:** add three.
  - "Troubleshooting" for blank rows: `gh auth status`, the log path, a token absent from `rows`, and the font.
  - A limits section: github.com only, `origin` only, forks, 100 contexts, and rulesets.
  - A section on how a config edit takes effect.
- **Versions:** the manifest says `0.7.0`, and the repository has no tag and no changelog. Add both, so a user can see what an upgrade brings.
- **`mergr`:** it appears twice with no link and no description.
- **Length:** rationale fills most of the 461 lines. Move it to `DESIGN.md`, and keep install, the state table, configuration and "Troubleshooting" in the README.
- **`pr-signoff-jira`:** it allows 15 s for each `curl` and starts `curl` up to four times, against a default `signoffTimeoutSeconds` of 20.
  - Add `--max-time` to `curl`, and name the timeout in the header.
  - `fail()` at line 118 formats a list, so the log file shows `['text']`.