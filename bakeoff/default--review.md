# default / review

- arm: `default`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 22  wall: 328s  api: 323s
- cost: $3.6755  output tokens: 24871  words: 1103

---

Review complete. I changed nothing. The suite passes on both Python 3.14 and the system Python 3.9, so the README's version claim holds. The project is in good shape: the decision logic is pure and well tested, and the fixtures are real. The proposals below are ranked by how much they matter, most severe first.

## Code and behaviour

- **Stale pid file can kill an unrelated process.** `daemon.py:1302` sends TERM, then KILL, to whatever pid the file names, as long as it is alive. After a reboot or crash the pid is recycled, so the daemon can kill a random same-user process. Check the target's command line before signalling it, or hold an `fcntl.flock` on the pid file so a dead owner releases it on its own.
- **Fork pull requests leak into the trunk row.** GitHub matches `pullRequests(headRefName:)` by ref name alone, so on a public repository the newest PR from any fork's `main` becomes the trunk workspace's verdict. Ask for `isCrossRepository` in `daemon.py:594` and drop those nodes. A user working inside their own fork gets nothing from the fork lookup today anyway, so the filter loses nothing.
- **⚠️💬 and 🪃💬 are documented but unreachable.** `daemon.py:686` only sends failing or BLOCKED pull requests to the second query, so a conflicted PR with green checks, or an ejected CLEAN one, never has its threads read. I verified both return no targets. Adding DIRTY and ejected PRs costs more aliases in the same request, not another round trip. Otherwise remove the two combinations from the README table.
- **The sign-off command cannot take arguments.** `daemon.py:880` runs the configured string as a single argv entry. I verified `"/bin/echo hello"` exits 127 with "no such file". `shlex.split` keeps the no-shell guarantee while allowing arguments. The regex reader also ignores single-quoted TOML strings and mangles an escaped quote. Python 3.11+ ships `tomllib`. A try-import with the regex as fallback would fix all three.
- **Config is read once, at startup.** `daemon.py:1363` reads it and the loop never looks again. The README says reload-config and disable/enable do not rerun startup hooks, so a config edit silently does nothing until herdr restarts. Re-read both settings at the top of each cycle. It is two small file reads.
- **Publishing spawns one process per workspace and per pane, every cycle.** `daemon.py:1035` calls the herdr binary for each. The socket schema exposes `workspace.report_metadata` and `pane.report_metadata`, and `socket_request` already exists for sorting. Moving publishing onto the socket removes dozens of process spawns per cycle.
- **More than 100 check contexts silently corrupt the verdict.** Re-run attempts accumulate in the rollup, so a busy monorepo PR overflows `contexts(first: 100)` at `daemon.py:714` and the newest attempt may be beyond the page. Request `pageInfo { hasNextPage }` and log when it is true.
- **Unrecognised origin URLs fail silently.** `daemon.py:953` rejects `https://user@github.com/…`, `ssh://github.com/…`, `http://`, and a mixed-case host. I verified each returns empty. The row shows nothing and nothing is logged. Parse the host case-insensitively and log an unrecognised origin once.
- **Missing gh exits 0.** `daemon.py:1372` returns success with "not starting", so herdr's action log shows `--once` succeeding when it did nothing. Return non-zero.
- **Startup log prints a glyph instead of the setting.** `daemon.py:1396` logs the resolved icon, which for the Nerd set is a private-use codepoint. Verified. Returning the settings alongside the table fixes it and lets `read_config` and `read_signoff` share one file read.
- **Log truncation only runs at startup.** `daemon.py:1349` checks the size once. A daemon logging "no answer for N branches" every cycle for weeks grows without bound. Check per cycle.
- **Tie-breaking on equal timestamps depends on list order.** I verified two attempts with the same `completedAt` flip the ❌ verdict when reversed. Either document that or break ties deterministically.
- **Small things.** `daemon.py:1186` rebuilds `set(moved)` per element. Two git subprocesses per workspace per cycle at `daemon.py:1020` could cache the origin per `repo_key`, since worktrees share it.

## Tests

- **The publish path has no coverage.** `cycle`, `publish`, `workspace_rows` and `panes_of` at `daemon.py:975` onwards are untested, so the TTL value, the clear-token branch, pane fan-out and the skip-on-None rule have no assertions. The sort harness already records stub herdr calls to a file. A stub `gh` answering `fixtures/lookup.json` would let a `--once` test assert the exact argv.
- **Pid handling is untested.** `take_over_pidfile`, `drop_pidfile` and `alive` have no tests, which is how the reuse bug above hides.
- **`--query` and `--resolve` are untested.** `read_pairs` and `print_verdicts` at `daemon.py:1058` have no coverage.
- **The gh exit-1-with-data path is only tested indirectly.** `gh_graphql` at `daemon.py:852` is the reason the README says the exit code decides nothing, yet only `parse_lookup` sees the fixture.
- **The timeout branch is mocked away.** `test_daemon.py:1170` patches `run` instead of letting a sleeping hook time out. A one-second timeout against a sleep exercises the real code path.
- **No CI.** A GitHub Actions matrix on 3.9 and 3.14 would back the README claim I verified by hand.
- **Style.** `test_daemon.py:1205` patches by assignment where every other test uses `mock.patch.object`. `shutil` is imported inline in four places instead of once at the top.

## README, examples, repository

- **Both example hooks document the old five-column input.** `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` omit the `unsatisfied` column that `config.example.toml` and the Jira code itself use. README line 244 also says "five columns".
- **The Configuration section does not say when changes take effect.** See the startup-only read above. It also does not say the sign-off command runs in herdr's server environment, not the user's shell. The Jira example depends entirely on environment variables and never says how they reach a daemon herdr launches. Document a wrapper script or add a `signoffEnv` table.
- **The sign-off command's no-arguments rule is undocumented.** README line 417 and `config.example.toml` present it as a plain path.
- **Jira example error messages print a Python list.** `examples/pr-signoff-jira:107` formats a slice, so the log reads `curl exited 22: ['first line']`. Verified.
- **`config.example.toml:15` says "this README" inside a config file.**
- **No known-limitations section.** GitHub Enterprise hosts, fork workflows, `origin` only, and the 100-context page are all worth one line each.
- **Structure.** At 461 lines with rationale interleaved with reference, a reader looking up a glyph has to scroll past the reasoning. A table of contents, or reference tables first and the "why" after, would help. This is a style call.
- **Repository hygiene.** The untracked `.claude/` directory holds a `settings.local.json` that should never be committed. Add it to `.gitignore` and decide whether the shared `settings.json` belongs in the repo. Two remote branches, `signoff-glyph` and `fix/required-check-detection`, are already merged into main and can be deleted.
