# proactive / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `proactive`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 394s  api: 388s
- cost: $3.7223  output tokens: 30782  words: 1736

---

# Review of herdr-pr-emoji: proposed improvements

I changed no files. All 171 tests pass on Python 3.14; nothing was run on Python 3.9, the README's stated minimum.

I tested the suspected bugs in a scratch directory outside the repo. One suspicion did not reproduce: `run()` returns on time even when a child of the hook keeps the pipe open.

## Bugs I confirmed

1. **An unknown flag starts the daemon.** In `main()` (`daemon.py:1366`), anything that is not a known flag falls through to the loop. `python3 daemon.py --help` or a typo like `--onec` kills the server-started daemon through the pid file and replaces it with a foreground copy. When you press Ctrl-C there is no daemon left, and every emoji expires with its TTL. Fix: reject unknown arguments with a usage line and exit 2.

2. **The pid file can kill an unrelated process.** `take_over_pidfile()` (`daemon.py:1294`) sends SIGTERM and then SIGKILL to whatever PID the file names. After a crash or reboot the stale PID may belong to another of your processes. Fix: hold `fcntl.flock` on a lock file. If the lock can be acquired, the old daemon is dead; if it cannot, the holder really is the daemon and is safe to signal.

3. **A required check beyond the first 100 contexts reads 🟡 indefinitely.** `contexts(first: 100)` truncates large check lists. Any expected context past the cut counts as "never reported", so it counts as running. With 100 optional checks plus one required check the row showed 🟡 where 👀 was correct. Fix: ask for `pageInfo { hasNextPage }` and skip the "expected but missing means running" rule when the list is truncated. Paginating also works.

4. **A failed hook erases the sign-off glyph, contrary to the docs.** The README says "every kind of silence keeps the row where it is". `config.example.toml` and the `parse_signoff` docstring say a row the hook leaves out keeps the glyph it has. In fact ✅🎫 becomes ✅ on the first cycle after a hook timeout, because the shorter token is published over it. ✅ alone then looks like a clean pull request. Fix: cache the last answer per `(slug, branch, number)` and reuse it for up to three intervals, or correct the three texts.

5. **`examples/pr-signoff-static` parses its input wrongly.** `IFS=<TAB> read` collapses consecutive tabs, so an empty `reviewDecision` column shifts the remaining fields. I got `review=[CLEAN] merge=[build=FAILURE]`. The static hook itself only uses the first two fields, but it is the example people will copy.

6. **Both example headers are out of date.** They document five input columns and omit `unsatisfied`. README line 244 also says "five columns".

7. **`--resolve` crashes on a slug without a slash.** `slug.split("/", 1)` in `lookup_query` raises `ValueError` with a traceback. `--query a/b/c` passes validation as well. Fix: validate slugs in `read_pairs`.

8. **The startup log prints a glyph instead of the setting.** `daemon.py:1398` logs `icons["unstable"]`. With the nerd icon set that is a private-use character, so the line reads `unstable=` followed by nothing. It never names the icon set.

9. **Invalid config values are ignored without a log line.** `unstable = 'warn'` (TOML single quotes), `icons = "nerdfont"` and `refreshIntervalSeconds = "300"` all fall back to defaults silently. Fix: use `tomllib` when it is available (Python 3.11 and newer), keep the regexes as the fallback, and log every rejected value.

10. **Several common GitHub remote forms are not recognised.** `slug_from_url` rejects `https://user@github.com/…`, token-in-URL remotes, `git://`, `ssh://git@ssh.github.com:443/…` and SSH host aliases such as `git@github-work:o/r`. Those rows show nothing. A trailing slash after `.git` yields the slug `o/r.git`.

11. **`--once` and the daemon can corrupt `states.json`.** Both write through the same `states.json.tmp`. Fix: use `tempfile.mkstemp` in the state directory. `report-metadata` also has a `--seq` option that could order the two publishers.

12. **Failures exit with status 0.** `--once` with herdr unreachable, and any mode with `gh` missing, return 0, so the `refresh` action reports success when nothing happened.

## Behaviour

- **Missing state: `CHANGES_REQUESTED` reads 🛑.**
  - 🛑 means "blocked, and this plugin cannot say why", but the first request already carries the reason.
  - It is an errand for the author and deserves its own state.
  - A new state would use the last of herdr's sixteen colour rules.
- **`BEHIND` reads ✅.** With a strict base branch the button says "Update branch", not "Merge". In a plugin whose point is an honest ✅, this is the one case that is not.
- **Optional checks still running read 🟡.**
  - The rule `rollup == PENDING` does not separate required checks from optional ones.
  - The plugin already makes that distinction for failures.
  - A slow optional job holds the row on 🟡 while GitHub offers the merge.
  - `PENDING` without `BLOCKED` could fall through to 🆗 or ✅.
- **🟣 stays on the default branch forever.**
  - Only `CLOSED` is suppressed there.
  - The README's own example, a release sync, is usually merged rather than closed.
  - A general fix: request `headRefOid`, and when a merged or closed pull request's head is not the local `HEAD`, show ❔.
  - That fix also covers `develop` and release branches.
- **Pull requests from forks collide by branch name.**
  - `headRefName` matches any head repository.
  - A contributor's pull request from their fork's `main` appears on your `main` row.
  - Ask for `isCrossRepository` and take the newest same-repository pull request from `last: 5`.
  - The reverse case, where origin is a fork and the pull request lives upstream, always reads ❔.
- **Rulesets leave gaps the README already admits.**
  - Repositories governed by rulesets lose 💬 and the "expected check not yet reported" 🟡.
  - I believe GraphQL exposes the same data under `rulesets`, but I did not check the schema.
- **Refresh can lag by up to two minutes.**
  - A `git switch` or a newly opened pane waits for the next poll.
  - The local git checks cost nothing, so they could run every ~10 s and call GitHub only when the set of branches changes.
  - An `UNKNOWN` answer could be re-asked after ~10 s.
  - The README says the very query that reports `UNKNOWN` is what makes the next one exact.
- **`refresh` could signal the daemon instead of running a second cycle.**
  - Sending SIGUSR1 to the running daemon, with an interruptible sleep, would replace the parallel `--once` cycle.
  - That removes the `states.json` race.
  - It also fixes config drift: today `--once` reads a fresh config while the daemon keeps its startup copy, so changing `icons` makes the glyphs alternate until herdr restarts.
  - Re-reading the config each cycle would fix that drift on its own.
- **The default icon set needs a special font.** A plugin named "pr-emoji", whose README is written in emoji, defaults to `nerd`, which shows empty boxes without a Nerd Font. Either default to `emoji` or say so in the Install section.
- **Smaller points:**
  - `signoffCommand` cannot take arguments; `shlex.split` would allow them without a shell.
  - There is no backoff when `gh` keeps failing.
  - The log is only truncated at startup, which discards the evidence of why the previous daemon died.

## Code

- `blocker_for(pr, STATE_NAMES)` returns a state name or a glyph depending on which table it is given. It could always return the name and let `emoji_for` map it to a glyph, which removes `STATE_NAMES` and one parameter.
- `decide()` mutates its inputs, and `apply_marks` runs twice on the sign-off path. Apply the marks once in `resolve`.
- The config file is opened and regex-parsed twice, by `read_config` and `read_signoff`.
- Passing branches as GraphQL variables would remove the reliance on JSON string escaping matching GraphQL escaping.
- The single-file layout, the timeout handling and the containment of partial GraphQL answers are solid and worth keeping.

## Tests

- **Decisions and queries are well covered, but none of the I/O layer is tested:**
  - `cycle`, the `publish` argv (clear-token versus token with TTL), and `workspace_rows` with its pane-cwd fallback
  - `gh_graphql` on "exit 1 with usable data", which the README stresses but is only tested at the parser level
  - `run()`'s real timeout path, which is only mocked
  - `take_over_pidfile`, `drop_pidfile`, `read_pairs`, `main` dispatch, error replies in `socket_request`, and the three-failure exit
- **Every bug in the first section needs a regression test.** None has one today.
- **The examples have no tests.** `tickets_by_pull`, `unsatisfied_checks` and `without_a_ticket` in `pr-signoff-jira` are pure functions and easy to test.
- **Nothing guards against drift between the README and the code.** The fifteen colour rules in the README currently match `NERD`, which I checked, but no test would catch a change. A short test that parses the README would.
- **There is no CI.** A workflow running `python3 -m unittest` on Python 3.9 and the latest version, on Ubuntu and macOS, would back the README's "3.9 or newer" claim.
- **Log lines leak into the test output.** Capture them and assert on the messages.
- **`GuardedCycle` is inconsistent with the other tests.** It patches by hand instead of using `mock.patch.object`, and passes `"pass"` where an icon table is expected.

## README

- **Structure.**
  - About 300 lines of design rationale sit between Install and Configuration.
  - Put a short legend table first and move the rationale to a `DESIGN.md`.
  - Add a Troubleshooting section covering the log path, `herdr plugin log`, `gh auth status`, the Nerd Font, and SAML.
  - The SAML note is currently buried in "How it polls".
- **Three misplaced paragraphs.**
  - They cover re-run checks, the rollup `FAILURE`, and expected contexts.
  - They sit at the end of "The 💬 modifier" and belong under "State mapping".
- **Out-of-date statements.**
  - "Five columns" should be six.
  - The "keeps the glyph it has" claim is the one from bug 4.
  - The Jira example header says "one request a cycle", but the hook makes a `myself` call plus up to three pages.
- **Missing pieces.**
  - `mergr` is never explained.
  - There is no screenshot or changelog.
  - There are no git tags at version 0.7.0.
  - There is no note that a config change needs a daemon restart.
- **Manifest.** The `description` is 566 characters; keep one sentence and leave the legend to the README.

The highest-value fixes are the two that can kill processes, the two that leave a wrong glyph on screen, and the `CHANGES_REQUESTED` state. If you want, I can turn them into commits with regression tests.