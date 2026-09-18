# caveman-lite / review

- arm: `caveman-lite`  prompt: `review`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 31  wall: 393s  api: 313s
- cost: $4.4776  output tokens: 30429  words: 1221

---

Review done. Nothing was modified. Test suite: 171 tests pass on Python 3.14 in 1.3 s. The project is unusually well reasoned, so most of what follows is about gaps at the edges, not the core decisions.

## Behaviour and correctness

Ranked by impact.

- **PID reuse can kill an unrelated process.** `take_over_pidfile` at `daemon.py:1294` reads a stale pid, sends SIGTERM, then SIGKILL. The pidfile survives reboots in `~/.local/state`, and macOS reuses low pids, so the victim can be any same-user process, including herdr itself. Fix: hold an `fcntl.flock` on a lock file (released automatically at exit, no reuse problem), or at least confirm the pid's command line contains `daemon.py` before signalling.

- **Fork pull requests are matched by branch name alone.** `pullRequests(headRefName:)` at `daemon.py:594` returns pull requests from any fork with that head name. On an upstream checkout, a worktree on `main` or `develop` shows the state of some contributor's fork PR, and the README's "door on the trunk" rule only hides 🚪, not 👀 or ❌. Conversely, a fork checkout whose PR targets upstream reads ❔ forever. Ask for `isCrossRepository` and `headRepositoryOwner { login }` (both confirmed in the schema) and skip mismatches. Fork-to-upstream support would need the `upstream` remote or `gh repo view --json parent`.

- **`CHANGES_REQUESTED` has no errand.** It is a `PullRequestReviewDecision` value alongside `APPROVED` and `REVIEW_REQUIRED`, and `blocker_for` at `daemon.py:342` never looks at it. Verified: it reads ✅ on a base branch with no required reviews and 🛑 otherwise. Both hide the clearest author errand the plugin could name. A state between 👀 and 🪃 would fit the existing ladder.

- **The merge-queue removal reasons are guesses.** `daemon.py:448` treats only `merged` and `manual` as non-ejections. The schema says `reason` is a free `String` with no enum, and the fixture is hand-built by the test file's own admission. If GitHub writes `MANUAL` or `MERGE`, every manual dequeue reads 🪃 until the next push. Compare case-insensitively, log every reason the first time it is seen, and record one real payload.

- **Rulesets degrade to 🛑.** The README documents that `branchProtectionRule` is null under rulesets. Rulesets are now GitHub's default, and the schema has what is needed: `Ref.rules`, rule type `REQUIRED_STATUS_CHECKS` with `requiredStatusChecks`, and `PULL_REQUEST` with `requiredReviewThreadResolution` plus a standalone `REQUIRED_REVIEW_THREAD_RESOLUTION` type. Reading both sources restores 🟡 for expected checks and 💬 for those repositories.

- **Silent truncation at 100 contexts.** `contexts(first: 100)` at `daemon.py:714` counts every re-run attempt as a context. Fixture p2 shows four attempts of one check, so a busy monorepo PR exceeds 100. Then the newest attempt may sit past the cut, and a required check that reported only there reads as `EXPECTED`, pinning 🟡. Ask `totalCount`, log when it exceeds the page, and paginate or use `last:`.

- **Running required checks arrive as `name=`.** `daemon.py:319` falls back from `conclusion` to `state`, which a `CheckRun` lacks, so the hook gets `build=;lint=`. Fall back to `status` so it reads `build=IN_PROGRESS`.

- **Config changes need a daemon restart** and only the Development section says reload does not run startup hooks. Re-reading the config each cycle costs one file read and removes the surprise. Failing that, say so under Configuration.

- **Unsolicited hook answers stick.** A hook that answers for a merged PR yields `🟣🏁`. `decide` at `daemon.py:770` could keep only the keys it asked about.

- **Width note for the emoji set.** `⚠` is East Asian width N where `❔` and `✅` are W, so `⚠️` renders one cell in many terminals and columns wobble. Worth a README line, since `unstable = "warn"` borrows it.

- **Smaller points.** GitHub Enterprise is unsupported because `slug_from_url` at `daemon.py:951` hardcodes github.com. Detached HEAD blanks the row with no log line. The startup log at `daemon.py:1398` prints the resolved glyph, which under the Nerd set is a private-use character. The log truncates only at startup, so a persistent error grows it unbounded between restarts. The sign-off hook inherits the server's environment, so the Jira example's variables must come from a wrapper script. That deserves a sentence in the README.

## Code

- **TOML by regex.** `read_config` and `read_signoff` at `daemon.py:225` and `:253` ignore sections and escapes, so a key inside `[anything]` still counts and a `\"` breaks the command. Use `tomllib` where available (3.11+) with the regex as the 3.9 fallback, or document the constraint.
- **Hook takes a bare path.** `run_signoff` at `daemon.py:870` passes `[command]`, so `python3 ~/bin/hook.py` cannot be configured. `shlex.split` keeps the no-shell guarantee and allows arguments.
- **Per-cycle subprocess count.** Two git calls per workspace plus one `report-metadata` per workspace and per pane. With 30 workspaces and 60 panes that is about 150 spawns every two minutes. Fine today, but worth noting if herdr ever offers batch publishing.
- **No CI, no lint config, no tags.** The `.github` directory is absent and `git tag` is empty, yet the README promises Python 3.9 while the pycache shows only 3.12 to 3.14. A workflow running `python3 -m unittest` across 3.9 to 3.14 plus `ruff` would back the promise. Syntax parses under `feature_version=(3,9)`, so this is likely to pass as is.
- `.claude/` is untracked and holds `settings.local.json`. Add it to `.gitignore`.

## Tests, README, examples

Tests are strong on the pure functions. The untested surface is the process layer:

- `take_over_pidfile`, `alive`, `drop_pidfile`: nothing covers them, and they hold the riskiest code.
- `publish` and `report-metadata`: the one `--once` test uses workspaces without checkouts, so the stub never sees a token, a `--clear-token`, or the TTL of three intervals. A stub that records those calls would pin the contract.
- `gh_graphql`: the "errors with usable data" path and the non-JSON path are asserted in prose but not in a test. Patch `run`.
- `--query` and `--resolve` output format: no end-to-end coverage. A `gh` stub on PATH answering the fixtures would do.
- Fork PRs, `CHANGES_REQUESTED`, the empty-result column, and context truncation have no tests because the code has no behaviour for them.
- Style nits: `GuardedCycle` at `test_daemon.py:1206` assigns `daemon.cycle` by hand where every other test uses `mock.patch.object`. Three places use `__import__("shutil")` inline instead of a top-level import. The single 1900-line file could split by class group.

README and examples:

- **Stale hook contract in both examples.** `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` still document five stdin columns. The README at line 213 and `config.example.toml` document six, and the Jira script itself reads the sixth. Update the comments. The static script's `read` also silently folds the sixth column into `merge`.
- **Missing sections.** A Troubleshooting entry would answer the two questions a new user hits: every row ❔ means `gh` is not authenticated, and a blank row means no branch, a non-GitHub remote, detached HEAD, or an expired TTL. A Limitations list should name forks, rulesets, GitHub Enterprise, and the 100-context page.
- **Formatting.** The sort table at `README.md:342` uses its first data row as the header, so "First / ✅ 🆗 ..." renders bold. Add a real header row. The state-mapping prose runs about 120 lines; a short summary table first and the reasoning after would help skimming.
- **Jira example nit.** `examples/pr-signoff-jira:118` formats `splitlines()[:1]`, so errors read `curl exited 22: ['HTTP 401']` with list brackets. Index `[0]` with a guard, or join.

Suggested order if you act on this: the pidfile lock, the fork filter, the stale example comments, then a CI workflow, then `CHANGES_REQUESTED` and rulesets as features.
