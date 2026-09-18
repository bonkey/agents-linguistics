# ste-concise / review

- arm: `ste-concise`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 27  wall: 314s  api: 310s
- cost: $3.4001  output tokens: 22343  words: 1093

---

The project is in good shape. The decision logic is pure, well tested, and the suite passes on Python 3.12, 3.13 and 3.14 (171 tests). The findings below are ranked by risk. No file was changed. The coverage run wrote a `.coverage` file, which I removed.

## Code and behaviour

- **A stale pid file can kill an unrelated process.** `take_over_pidfile` at `daemon.py:1294` checks only that the pid exists, then sends SIGTERM and, after five seconds, SIGKILL at `daemon.py:1311`. The pid file lives under `~/.local/state`, so it survives a reboot, and the kernel reuses pids. Fix: confirm the process is this daemon before signalling it, for example by checking that `ps -o command= -p PID` names `daemon.py`, and drop the SIGKILL or gate it on that confirmation.
- **A merged pull request on a long-lived branch shows 🟣 forever.** Only the door is suppressed on the default branch, at `daemon.py:377`. A trunk that is merged into `production` by pull request, or a `develop` or `release/*` branch that ever had one, keeps 🟣 or 🚪 for good. Fix: ask `headRefOid` in the lookup and compare it with the local head from `git rev-parse HEAD`. A merged or closed pull request whose head is not the local head is history and should read as no pull request. This also replaces the special case for the default branch.
- **The required-check query reads only the first hundred contexts.** `daemon.py:714` asks `contexts(first: 100)` with no `pageInfo` and no `totalCount`. Re-run attempts stay in the rollup, which the code relies on, so a busy pull request can exceed a hundred. A required check past the cut is then absent: it reads 🟡 for good where branch protection names it, or 🛑 where it does not. Fix: request `pageInfo { hasNextPage }` and log when the answer is truncated, or paginate.
- **Running optional checks read 🟡, which contradicts the headline rule.** `daemon.py:389` puts `rollup == PENDING` ahead of `mergeStateStatus`. When the status is CLEAN or UNSTABLE, every pending check is optional by construction, because a pending required check makes the status BLOCKED. The README promises that optional failures do not demote a mergeable pull request, but optional runs do. The test at `test_daemon.py:237` codifies this. This is a decision for you: keep it and document it, or count PENDING only when the status is BLOCKED or UNKNOWN.
- **A status context in state EXPECTED does not count as running.** `daemon.py:322` treats a `StatusContext` as running only when its state is PENDING. GitHub's `StatusState` enum also has EXPECTED. If GitHub ever returns such a node, it lands in `unsatisfied` as EXPECTED but `running` stays false, so the row reads 🛑 instead of 🟡. This is a hypothesis: the fixtures carry only ERROR and SUCCESS status contexts. Adding EXPECTED beside PENDING is cheap.
- **The sign-off command is one executable path, with no arguments.** `daemon.py:880` runs `[command]`. A configured `"python3 /path/hook.py"` fails, and `$VAR` is not expanded. Either document this in `config.example.toml`, or split the string with `shlex.split`.
- **Fork workflows and GitHub Enterprise are blind spots.** `github_slug` at `daemon.py:945` reads only `origin`, and `slug_from_url` accepts only `github.com`. With `origin` pointing at a fork, the pull request lives upstream and the row reads ❔. A GitHub Enterprise host reads as blank. Document both, or add a `remote` setting and pass the host to `gh` with `--hostname`.
- **Rulesets leave the branch protection rule null.** The README acknowledges this. The effect is that a required check that has reported nothing reads 🛑 rather than 🟡, and 💬 never appears, on every repository that uses rulesets rather than branch protection. `baseRef { refUpdateRule { requiredStatusCheckContexts requiresConversationResolution } }` may cover rulesets. Untested; worth one recording.
- **A missing `gh` exits 0.** `daemon.py:1373` logs and returns 0. For `--once`, `--query` and `--resolve` the caller sees success. Return non-zero for the one-shot commands.
- **A stale docstring.** `parse_required` at `daemon.py:723` says it returns `(failing, running)` pairs. It returns four-tuples with `unsatisfied` and the conversation flag.

## Tests

- **Add a CI matrix.** No `.github/workflows` exists. The README claims Python 3.9 as the floor. No interpreter older than 3.12 is installed here, and a grep found no syntax newer than 3.9, but only a run proves it. One workflow with `python3 -m unittest` on 3.9 and 3.14 covers both ends.
- **In-process coverage is 65 percent.** Untested in-process: `gh_graphql` and its handling of `gh` output that carries both data and errors, `publish` and the argv it builds with `--token`, `--ttl-ms` and `--clear-token`, `workspace_rows` and its fallback to a pane's cwd, `read_pairs`, `print_verdicts`, `take_over_pidfile`, `drop_pidfile`, and the main loop's exit after three herdr failures. The end-to-end sort tests exercise `cycle` in a subprocess, so coverage does not see it.
- **`required_state` has gaps.** No test covers a failing `StatusContext` with state FAILURE or ERROR, a `TIMED_OUT` or `STARTUP_FAILURE` conclusion, a `WAITING` or `REQUESTED` status, or two attempts with the same timestamp.
- **The recorded lookup fixture predates the current query.** `fixtures/lookup.json` carries no `reviewDecision`, `isInMergeQueue` or `timelineItems`, and the header says so. Re-record it so the fixture has the shape the query asks for. `lookup_queue.json` is hand-built, and a recorded ejection would be better evidence.
- **Style consistency.** `GuardedCycle` at `test_daemon.py:1200` patches by assignment where the rest of the file uses `mock.patch.object`. `shutil` is imported through `__import__` inside lambdas at lines 920 and 1452, and inside functions at lines 1542 and 1563. Import it once at the top.

## README, examples and repository hygiene

- **The example headers list five stdin columns; the daemon sends six.** `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` omit `unsatisfied`. The README and `config.example.toml` are correct.
- **The README is 4,416 words and mixes reference with rationale.** Install, configuration, the state table and the commands are what a reader returns to. The essays on why 🚂 precedes 🪃, or why 💬 replaces 🛑, are design history. Consider a short reference README and a `DESIGN.md` for the rationale, or collapsible sections. This is a judgement call, and the prose itself is accurate.
- **`.claude/settings.json` is untracked and not ignored.** `git status` shows `?? .claude/`. The local settings file is covered by your global ignore. Decide whether to commit `settings.json` or add `.claude/` to `.gitignore`.
- **No changelog, and the README never states a version.** The manifest says 0.7.0. A short changelog helps a herdr user decide whether to update.

Validation: the suite was run on Python 3.12, 3.13 and 3.14, all green. Coverage was measured in-process only. The EXPECTED status, the `refUpdateRule` field and the Python 3.9 claim are unverified against GitHub or an old interpreter.
