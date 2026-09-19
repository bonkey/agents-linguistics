# learning / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `learning`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 367s  api: 361s
- cost: $3.3436  output tokens: 28125  words: 1840

---

I reviewed the code, tests, README and plugin behaviour without modifying any file. All 171 tests pass in under a second, and `git status` is still clean. I ran them with `PYTHONDONTWRITEBYTECODE=1` so no `__pycache__` was written.

Findings marked **[ran]** were reproduced by calling the functions from stdin scripts, and those marked **[read]** come from reading the code. I deliberately did not execute the first finding below. Learning mode's hands-on `TODO(human)` step requires an edit, so I skipped it.

`★ Insight ─────────────────────────────────────`
- The file is split into a "pure decisions" section and a "the world" section, and that split is why 171 tests run in under a second. Everything above `daemon.py:849` takes and returns dicts, and subprocesses only appear below it. Most of the gaps below are in the second section.
- The design keeps no local state on purpose. The TTL of three intervals acts as a dead-man's switch, and 🪃 clears itself because "GitHub's timeline is the state file". The pid file is the one place where local state returns, and that is where the sharpest bug is.
`─────────────────────────────────────────────────`

## Fix first

1. **An unknown flag starts a daemon and kills the running one. [read]**
   - `main` takes any unrecognised `argv[0]` as "run the loop" (`daemon.py:1366-1393`).
   - So `python3 daemon.py --help`, or a typo like `--sorted`, redirects output to the log and SIGTERMs the live daemon. It then loops in a terminal that prints nothing.
   - Pressing Ctrl-C leaves no daemon at all, and every emoji expires with its TTL.
   - Proposal: use `argparse`, or reject unknown flags with a usage line and exit 2.

2. **The pid file can kill an unrelated process. [read]**
   - `take_over_pidfile` sends SIGTERM and then SIGKILL to whatever PID the file names (`daemon.py:1302-1311`).
   - The file lives in `~/.local/state`, so it survives reboots and hard kills. macOS reuses PIDs quickly, so a stale number can belong to your editor.
   - Two simultaneous starts also race: both read the old PID, kill it, write their own, and both keep running.
   - Proposal: take an `fcntl.flock` on the file. A held lock proves the PID is a live daemon, and the lock is released when the process dies.

3. **`refreshIntervalSeconds = 1_800` polls every 60 s. [ran]**
   - That value is valid TOML for 30 minutes. The regex stops at the underscore, reads `1`, and clamps to the floor.
   - `signoffCommand = '~/bin/hook'` (a TOML literal string), `icons = "emojis"` and `unstable = "Warn"` are dropped without a log line.
   - Proposal: `try: import tomllib`, with the regex as the fallback on Python 3.9 and 3.10, and log every rejected value.

## Behaviour

4. **`CHANGES_REQUESTED` reads 🛑. [ran]**
   - The decision ladder only ever reads `REVIEW_REQUIRED` (`daemon.py:391`).
   - README lines 98-101 define 🛑 as "blocked, and this plugin cannot say why". Here GitHub does say why.
   - It is an errand for the author, unlike 👀. herdr's sixteen-rule limit has one slot to spare, enough for one new state.

5. **Running optional checks pin the row to 🟡. [ran]**
   - A PENDING rollup with `CLEAN` or `UNSTABLE` yields 🟡 (`daemon.py:389`).
   - That PR never becomes a target of the second, `isRequired` query (`daemon.py:686-690`).
   - Optional failures read as mergeable, which is the plugin's headline promise, but optional running checks do not.
   - A stuck deploy-preview status keeps a mergeable PR on 🟡 indefinitely.
   - Recommendation: make PENDING PRs targets, and show 🟡 only when a required check is running or the repository has no required checks at all.

6. **More than 100 check contexts gives a wrong 🟡 indefinitely. [ran]**
   - `contexts(first: 100)` requests no `pageInfo` (`daemon.py:714`).
   - With a required check at position 101 and a readable protection rule, that check counts as "expected, unreported" and therefore running. A failed required check reads 🟡.
   - The 100-thread cap is documented and fails safe. This cap is not documented and does not fail safe.
   - Proposal: request `hasNextPage` and paginate, or fall back to 🛑 and log it.

7. **`BEHIND` reads ✅.**
   - The mapping is at `daemon.py:76`. **[ran]**
   - As I understand it, GitHub only reports `BEHIND` when up-to-date branches are required. In that case the merge button is replaced by "Update branch".
   - Please verify this against one of your repositories. I did not confirm it.

8. **Fork pull requests can land on your rows. [read]**
   - `pullRequests(headRefName:)` matches by name across forks.
   - A stranger's pull request from their fork's `main` shows up on your trunk row.
   - Proposal: fetch `isCrossRepository`, use `last: 3`, and take the newest same-repository pull request.
   - Related: only `origin` on `github.com` is read (`daemon.py:945-962`). Fork workflows, GitHub Enterprise and SSH host aliases (`git@github-work:…`) therefore give a silently blank row.

9. **The running daemon and `refresh` can disagree after a config edit. [read]**
   - The daemon reads the config once at startup, and `reload-config` does not restart startup hooks.
   - The refresh action (`--once`) is a fresh process and does re-read it.
   - After an `icons` change the two keep overwriting each other's glyphs.
   - Proposal: re-read the config each cycle.

10. **The default icon set needs a font the install steps never mention. [read]**
    - The README's first example and the manifest both show emoji, but the default is `nerd` (`daemon.py:134`).
    - A new user without a Nerd Font sees empty boxes.
    - Proposal: default to `emoji`, or add one line to the Install section.

11. **`UNKNOWN` waits a full interval. [read]**
    - The code comment says the query that reports `UNKNOWN` is what makes the next one exact.
    - One bounded re-poll after about 10 s, for those branches only, would correct the row far sooner than the 120 s interval.

12. **A running required check reaches the hook as `build=`. [ran]**
    - The result is empty, while the README promises `name=RESULT`.
    - Proposal: send `PENDING` instead.

`★ Insight ─────────────────────────────────────`
Findings 4 to 6 have the same cause. The decision ladder is carefully reasoned for the states it names, and its fallbacks are graded by how wrong they could be: 🛑 means "don't know", and 🟡 means "wait". The bugs are where an unnamed case falls into a fallback that claims too much. 🟡 promises that the state will change, so it is the wrong value to be stuck on.
`─────────────────────────────────────────────────`

## Code

- **Publishing starts one `herdr` process per workspace and per pane, every cycle.**
  - The publish loop is at `daemon.py:1031-1039`. **[read]**
  - That includes `--clear-token` calls for rows that never had a token.
  - herdr 0.9.1's API schema does list `workspace.report_metadata` and `pane.report_metadata`, and `socket_request` already exists. **[ran]**
  - Proposal: publish over the socket. Skip clears for targets that are already clear.
- **The log is truncated only at startup.**
  - A daemon that runs for weeks can grow past `LOG_LIMIT` (`daemon.py:1346`). **[read]**
  - Truncating to zero also discards the lines you would want for debugging.
  - Proposal: rotate to `.log.1` inside the loop, and log a recurring error only when it changes.
- **The exit code is 0 when `gh` is missing, even for hand-run `--query` and `--once`.**
  - See `daemon.py:1372`. **[read]**
  - Proposal: keep 0 for the startup hook and return non-zero otherwise.
  - An unauthenticated `gh` is never detected up front.
- **`parse_signoff` wants exactly three columns.**
  - See `daemon.py:564`. **[read]**
  - The hook's input is append-only, but its answer is not.
  - Proposal: accept `< 3` as malformed and ignore extra columns.
- **Smaller items. [read]**
  - `apply_marks` and `decide` mutate their input inside the "pure decisions" section.
  - `states.json.tmp` is a shared name that `--once` and the daemon can both write. Proposal: add the PID to the name.
  - The sort ranks 👀💬 as "somebody else's turn", although 💬 is an errand for you.

## Tests

- **The I/O layer is never tested. [ran — no test names these functions]**
  - `gh_graphql` is only ever mocked. The README stresses that `gh` exits 1 while still returning usable data, and no test covers that.
  - Also unnamed by any test: `take_over_pidfile`, `alive`, `kill`, `drop_pidfile`, `read_pairs`, `print_verdicts` and `redirect_to_log`.
  - `main` dispatch gets no test for an unknown flag and no direct test for `--query` or `--resolve`. `workspace_rows` has no test for its pane-cwd fallback.
  - Findings 1 and 2 are in exactly this untested code.
- **Nothing ties the docs to the code. [ran]**
  - I checked that the README's 15 colour rules match `NERD`, and they do today, but no test enforces it.
  - The manifest `id` and `SOURCE` are not checked against each other either.
  - Both examples' headers still list five input columns (`examples/pr-signoff-static:8`, `examples/pr-signoff-jira:7`).
  - A contract test would catch this drift: pipe `signoff_input` through `pr-signoff-static` into `parse_signoff`.
- **`move_requests` is a good fit for a property test. [ran — no test uses `random` or `itertools`]**
  - Apply the requests to random permutations with `apply_move` and assert the wanted order.
  - No such randomised test exists today.
- **Nits. [read]**
  - `test_daemon.py:1208` passes `"pass"` as the `icons` argument, a leftover from an older signature.
  - The suite prints log lines to stderr. Proposal: patch `daemon.log` and assert on the messages.
- **There is no CI. [ran]**
  - The README promises Python 3.9+ on macOS and Linux.
  - A matrix workflow would enforce that.

## README

- **A shell trap for hook authors. [ran]**
  - Tab counts as IFS whitespace, so an empty `reviewDecision` column collapses.
  - In my run, `review` came out as `BLOCKED`. Here `review` is the 4th-column variable of `examples/pr-signoff-static`'s `read` loop, which I reproduced inline.
  - "Read the first three columns" is safe, but the 4th column onward is not safe in `sh`.
  - Proposal: warn about this in the README and in the static example.
- **Stale or leftover text.**
  - Line 244 says "five columns" where there are now six. **[ran]**
  - Line 8 still shows `bonkey/ios-27-siri-ai-intents` and similar names. Commit a5cc614 generalised only the sort example. **[ran]**
  - Lines 178-194, about check semantics, sit under the 💬 heading. **[read]**
- **Structure. [read]**
  - About 70 lines of precedence rationale come before Configuration.
  - Proposal: move the rationale to a `DESIGN.md`, and add Troubleshooting and Limitations sections.
  - Troubleshooting: the log path, `gh auth status`, fonts, and how to apply a config change.
  - Limitations: forks, GitHub Enterprise, SSH aliases, and the 100-check cap.
  - Add a screenshot, because the Nerd glyphs "cannot be read on a page".
- **Release hygiene. [ran]**
  - The manifest says 0.7.0, with no git tags and no CHANGELOG.
- **The Jira example. [read]**
  - `examples/pr-signoff-jira:118` and `:123` format a list, so the error prints as `['...']`.

## Order of work

Do 1 to 3 first. They are small, they guard against real damage, and each comes with an obvious test.

Findings 4, 5 and 7 are product decisions about what a glyph promises, so they are yours to make. Finding 5 is the one I would push for, because it contradicts the README's first paragraph.

Finding 6 and the socket publishing item are the most valuable for users with many worktrees.