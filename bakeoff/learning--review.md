# learning / review

- arm: `learning`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 2316s  api: 497s
- cost: $4.1793  output tokens: 31894  words: 1418

---

Review complete. The project is in good shape: the decision logic is pure and well tested, the two GraphQL queries are balanced, the code parses as Python 3.9, and all 19 Nerd Font codepoints match upstream nerd-fonts 3.5.1. What follows is ranked, most consequential first, with nothing modified.

## Code and behaviour

- **Config is read once, but the refresh action re-reads it.** The loop passes the `icons` and `signoff` values bound at startup forever at `daemon.py:1404`, while `--once` reads the file fresh. Change `icons = "emoji"`, invoke refresh, and the rows flip to emoji, then flip back to Octicons on the daemon's next cycle. Reading the config at the top of each cycle is one small file read and removes the flip-flop.
- **An unknown argument starts a second daemon and kills the live one.** `main` handles five flags and everything else falls through to the takeover path at `daemon.py:1392`. So `python3 daemon.py --help` or a typo sends SIGTERM to the running daemon and starts a loop. An explicit usage error for any unrecognised argument fixes it.
- **A stale pid file can kill an unrelated process.** After a crash or reboot the pid in the file may be reused by another process of yours. `take_over_pidfile` at `daemon.py:1302` trusts it and escalates to SIGKILL. An `fcntl.flock` on the pid file is released by the kernel on exit, leaves no stale state, and needs no polling. A cheaper guard is checking that the process command line contains the script name.
- **The rollup is read with `contexts(first: 100)` and re-runs accumulate.** The fixtures show one check with four attempts. On a busy monorepo pull request the newest attempt of a required check can fall past page one, so a failure is missed or the name never appears and the row pins to 🟡 as EXPECTED. The query at `daemon.py:714` asks for no `pageInfo`, so this is invisible. Ask for `hasNextPage` and log it, or paginate. The README documents the thread cap but not this one.
- **Optional-only running checks read 🟡, against the headline principle.** `blocker_for` treats a PENDING rollup as running at `daemon.py:389`, but `required_targets` never sends PENDING rollups to the second query. A pull request with every required check green and one optional job running reads 🟡 rather than ✅. That is the running analogue of the failure case the plugin exists to fix. My recommendation is to add PENDING rollups to the second query and let `required_running` decide, keeping the rollup only as a fallback when that query fails. The cost is more targets per cycle. If 🟡 for unprotected repositories is the intended reading, document the choice.
- **The startup log prints a glyph, not the setting.** After the "carry the resolved table" refactor, `daemon.py:1398` logs `icons["unstable"]`, which is now a private-use codepoint or 🆗. The old log in your state directory still shows `unstable=pass` from before that change.
- **Remote detection is narrow.** `slug_from_url` recognises three prefixes at `daemon.py:953`. It misses `ssh://github.com/`, URLs with a user before the host, `git://`, `http://`, mixed-case hosts, and every GitHub Enterprise host. Only `origin` is consulted, so a fork workflow with `upstream` as the base reads ❔ on every row. A regex over the URL plus an optional remote setting would cover both.
- **A `StatusContext` in state EXPECTED is neither running nor failing.** `required_state` counts only PENDING as running at `daemon.py:322`. GitHub's enum includes EXPECTED, and if a rollup ever carries one, the row reads 🛑 instead of 🟡. One more name in the condition.
- **Every cycle spawns one process per workspace and per pane.** herdr 0.9.1's socket exposes `workspace.list`, `pane.list`, `workspace.report_metadata` and `pane.report_metadata`, and `socket_request` already exists for the sort. Moving publishing onto the socket removes the whole per-cycle spawn storm. The socket also emits `workspace.created` and `pane.created`, which could trigger a refresh so a new row gets its glyph immediately rather than after up to two minutes.
- **Smaller points.** A hook that volunteers an answer for a merged or closed branch grows a sign-off glyph, because `decide` at `daemon.py:789` looks up every pull request rather than only those `signoff_input` sent. When herdr is unreachable, the sort logs "workspace list is empty", which is misleading. Missing `gh` exits 0 even for `--once` and `--query`. The log is only truncated at startup and drops all history when it is. TOML by regex ignores table sections and single-quoted strings, and a `signoffCommand` cannot carry arguments, so an interpreter needs a wrapper script. A `tomllib` import with the regex fallback keeps 3.9 support and an array form would remove the wrapper.

## Tests

The pure functions, the recorded fixtures, the query balance check and the end-to-end sorts against a stub herdr and stub socket are all good. The gaps are on the "world" side of the divider.

- **`cycle()` is never run against a checkout.** The one `--once` test uses a workspace without a checkout, so `git_branch`, `github_slug`, `resolve` through a stub `gh`, `publish` with its token value and TTL arithmetic, and the pane fan-out are untested. The stub herdr already records unknown calls to a file. Add a `git init` temp repo with an origin URL and a stub `gh` that prints the lookup fixture.
- **`gh_graphql` is untested.** The README's claim that the exit code decides nothing is only pinned at `parse_lookup`. A stub `gh` that prints `lookup_partial.json` and exits 1 would pin the actual contract.
- **Pid file takeover is untested.** A sleeping subprocess, a pid file holding its pid, and an assertion that it is gone afterwards would cover both takeover and `drop_pidfile`.
- **Untested helpers.** The pane-cwd fallback in `workspace_rows`, `panes_of`, and `read_pairs`.
- **`required_state` edge cases.** No test uses a failing `StatusContext`, two attempts with equal timestamps, or a completed check with a null conclusion, which currently lands in the unsatisfied column as a bare `name=`.
- **The suite logs to stderr while passing.** Five lines appear in a green run. Patching `daemon.log` in those tests keeps the run clean and lets them assert the message.
- **`GuardedCycle` assigns over `daemon.cycle`** where every other test uses `mock.patch.object`.
- **No CI.** A GitHub Actions matrix of 3.9 and 3.13 running `python3 -m unittest` is a short file and backs the version claim on every push.

## README, config and examples

- **Both example headers are stale.** `examples/pr-signoff-static:7` and `examples/pr-signoff-jira:7` document five stdin columns; the daemon has sent six since the commit that added the unsatisfied checks. The static hook's `read` folds the sixth into `merge`, which is harmless but wrong.
- **The Jira example can outrun the daemon's default timeout.** Its curl budget is 15 seconds per request across one identity call and up to three pages, while `signoffTimeoutSeconds` defaults to 20. On a slow Jira the daemon kills the hook every cycle and the glyph never appears, and the kill does not reach the curl grandchild. Document a higher timeout for this example, or size `--max-time` from the budget.
- **Jira error lines format a list.** `examples/pr-signoff-jira:117` and `:122` interpolate `splitlines()[:1]`, so the daemon log reads `['message']`.
- **Missing operational notes.** The README does not say config changes need a daemon restart, nor how to restart it by hand. It does not mention the 100-context cap, the origin-only rule, or the fork case.
- **Structure.** At 27 KB the file is thorough but hard to scan. The State mapping table already carries both glyph columns, so the Two icon sets table adds only four sign-off rows. One table, with the long rationale paragraphs moved under a Design notes heading, would make Install, Config and the table findable.
- **Small slips.** `config.example.toml:12` says "this README" inside the config file. The manifest says 0.7.0 but there are no git tags and no changelog. The installed copy on this machine is pinned at 73f7978, 24 commits behind HEAD, which is the situation a tag helps with. `.gitignore` lacks `.claude/` and it shows as untracked.

`★ Insight ─────────────────────────────────────`
- The "carry the resolved glyph table instead of the setting" refactor is a good example of pushing a decision to one place, and the log regression shows its cost: anything that still wanted the setting's name lost it. When collapsing a setting into derived data, grep for the last readers of the original.
- A pid file records a fact about the past. A file lock is a fact about the present, held by the kernel on your behalf, which is why `flock` needs no liveness polling and cannot point at a reused pid.
`─────────────────────────────────────────────────`
