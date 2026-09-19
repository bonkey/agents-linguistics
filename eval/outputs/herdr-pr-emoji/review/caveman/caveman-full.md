# caveman-full / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-full`  prompt: `review`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 16  wall: 263s  api: 244s
- cost: $2.9196  output tokens: 20172  words: 970

---

Review done. No file changed. Tests: 171 pass on Python 3.14 and 3.9.6. Findings ranked inside each area; items marked **[verified]** reproduced by running code.

## Behaviour

1. **Pidfile takeover can kill unrelated process.** `daemon.py:1294` sends SIGTERM, then SIGKILL, to whatever PID file names. After crash or reboot PID gets reused. Fix: `fcntl.flock` on pidfile held for process life, or check `ps -o command=` contains `daemon.py` before kill.
2. **Unknown argument starts daemon.** `daemon.py:1366-1393`: `--help` or typo `--onse` falls through, kills server-started daemon, loops in terminal. Reject unknown arguments with usage, exit 2.
3. **Config read once** (`daemon.py:1363`). `refresh` runs `--once` with fresh config; daemon overwrites with old icons next cycle. Re-read each cycle (mtime check) or on SIGHUP. README never says restart needed.
4. **Install trap.** README:31-34 offers `refresh` instead of restart. `--once` starts no loop, so emoji vanish after TTL (6 min). Make `refresh` signal running daemon (SIGUSR1), spawn one when none alive; or document.
5. **`CHANGES_REQUESTED` reads 🛑** [verified]. Common blocker, author's errand, plugin knows reason. Add state + glyph. README:98-101 list of 🛑 causes omits it.
6. **`BEHIND` reads ✅** [verified] (`daemon.py:76`). GitHub reports `BEHIND` where up-to-date branch is required, so merge button is disabled. Errand is "update branch". Add `behind` state; sixteenth colour rule is free.
7. **Optional checks running read 🟡** [verified]: `rollup == PENDING` with `UNSTABLE`/`CLEAN` (`daemon.py:389`). Contradicts headline rule: optional failure = mergeable, optional running = not. Gate 🟡 on required checks, or add setting.
8. **Fork PR collision.** `pullRequests(headRefName:)` (`daemon.py:594`) matches heads from any fork. Fork PR from `main` or `patch-1` paints your row. Ask `isCrossRepository`/`headRepositoryOwner`, `last: 5`, filter.
9. **Reused branch name.** Long-lived `develop` shows 🟣 after each release merge; trunk merged into release branch shows 🟣 forever (only 🚪 suppressed). Compare `headRefOid` with local `HEAD`; stale means ❔.
10. **Rulesets.** Null `branchProtectionRule` loses 💬 and expected-context 🟡. `baseRef.rules` (`RequiredStatusChecksParameters`, `PullRequestParameters.requiredReviewThreadResolution`) likely covers it. Verify live, record fixture.
11. **`contexts(first: 100)` cap silent** (`daemon.py:714`). Monorepo PR past 100 misses required failure. Ask `pageInfo.hasNextPage`, log or paginate. README documents thread cap only.
12. **Hook answer for unasked row is drawn** [verified]: `🟣🏁`, `❔🏁` (`daemon.py:489,789`). Filter answers to keys sent.
13. **Running CheckRun gives `build=`** [verified] (`daemon.py:319`). Empty RESULT undocumented. Send `status` (`IN_PROGRESS`, `QUEUED`).
14. **Transient hook failure drops third glyph at once**; three documents say otherwise (README item 2). Cache last answer per PR for one TTL.
15. `gh` missing: exit 0, message before `redirect_to_log()` (`daemon.py:1372`). Nothing in log, no emoji. Log to file, exit non-zero.
16. `signoffCommand = "~/bin/x --flag"` gives ENOENT [verified] (`daemon.py:880`). `shlex.split` keeps no-shell guarantee, allows arguments.
17. `slug_from_url` [verified] rejects `https://user:tok@github.com/`, `ssh://git@github.com:22/`, `git://`, `http://`, SSH host alias (`github-work:o/r`). Only `origin` read, so fork clone shows ❔ for upstream PR. Try `upstream`, or `gh repo view`.
18. `gh api` follows `GH_HOST`. Pass `--hostname github.com`.

## Code

1. Regex TOML (`daemon.py:225-276`) [verified]: `unstable = 'pass'` ignored; `1_000` parsed as 1, raised to 60; `icons = "Emoji"` silent. Use `tomllib` on 3.11+, regex fallback. Log every rejected value. Merge `read_config` and `read_signoff`: one file read.
2. `--resolve` with slug lacking `/` raises `ValueError` traceback [verified] (`daemon.py:590`). Validate in `read_pairs`.
3. `save_states` fixed `.tmp` name (`daemon.py:1108`). Daemon plus `--once` interleave. Use `tempfile.mkstemp` in same directory.
4. Log truncates to 0, only at startup (`daemon.py:1349`). Rotate to `.1`; check per cycle.
5. Cycle spawns 2 `git` per workspace and 1 `herdr` per workspace and pane, serial. Cache by path; publish over API socket if method exists.
6. `required_state` keys by name only (`daemon.py:309`). Two workflows with job `build`: newest hides failing one [verified]. Add app or workflow to key.
7. Stale docstrings: `verdict_for` "never wider than two" (`daemon.py:457`); `resolve` and log at `daemon.py:926` omit 🟠 and 💬.
8. `HAS_HOOKS` unreachable: Enterprise remotes rejected.
9. `examples/pr-signoff-jira:118` formats list: prints `['...']`. Worst case 4 × 15 s curl exceeds 20 s hook timeout. Header says "One request a cycle"; makes two or more.

## Tests

1. No test: pidfile takeover, `main` argument handling, `publish` argv, `workspace_rows` cwd fallback, `panes_of`, `read_pairs`, `print_verdicts`, `gh_graphql` (exit 1 with partial data, non-JSON), `run`, `redirect_to_log`, `socket_request` error reply, mid-sort stop.
2. No full `cycle` test. Stub herdr refuses `report-metadata`. Add stub `gh` replaying fixtures, stub `git`; assert published tokens and TTL.
3. Timeout test mocks `run` (`test_daemon.py:1170`). Real `sleep` hook works [verified, 1.0 s]; make that the test.
4. Example hooks untested. `tickets_by_pull`, `unsatisfied_checks`, `without_a_ticket` pure: load with `SourceFileLoader`.
5. `test_the_whole_order_is_what_the_readme_says` never reads README. Add doc-sync test: README glyph tables, colour rules, sort table against `EMOJI`, `NERD`, `SORT_ORDER`. They agree today, by hand.
6. `GuardedCycle` passes `"pass"` as icons (`test_daemon.py:1207`), stale signature, hand monkeypatch. Use `mock.patch.object`.
7. Hook tests leak 3 log lines to stderr. Patch `daemon.log`, assert message.
8. No CI. Add GitHub Actions: 3.9–3.14, macOS and Linux, `python -m unittest`, `ruff`.
9. `lookup_queue.json` hand-built. Record real ejection when one appears.

## README

1. Six columns, not five: README:244, both example headers (`examples/pr-signoff-static:7`, `examples/pr-signoff-jira:7`).
2. Silence wording contradicts itself and code: README:236-241 "keeps the row where it is" against "costs the third glyph"; `config.example.toml:32`, jira header:35, `parse_signoff` docstring claim glyph kept until TTL. Code removes it.
3. README:178-194 (re-runs, rollup, expected contexts) sits under "The 💬 modifier". Move under own heading "Required checks".
4. Missing: troubleshooting (log path, `gh auth status`, PATH under launchd, SAML, Nerd Font), config change needs restart, `gh` scopes, upgrade and uninstall, changelog, caps (100 contexts), fork and ruleset limits.
5. State table and "Two icon sets" table duplicate Nerd column. Keep one.
6. 461 lines, mostly rationale. Split: README for use, `DESIGN.md` for why. Sample row at top shows emoji while default is `nerd`; say so.

## Order of work

Behaviour 1, 2 first: safety. Then 3, 4: every new user hits them. Then 5, 6, 7: verdict accuracy, plugin's purpose. Then README 1, 2 and doc-sync test. Rest as time allows.