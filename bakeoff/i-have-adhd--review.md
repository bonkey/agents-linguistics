# i-have-adhd / review

- arm: `i-have-adhd`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 46  wall: 542s  api: 536s
- cost: $4.9344  output tokens: 39048  words: 784

---

**Top fix: `daemon.py:1409` exits the loop after three failed `herdr` calls, and herdr never restarts a startup hook. That is why no emoji have shown on this machine since Sep 15.**

Evidence from the live system: the plugin log has one startup event since the GUI started on Sep 15 13:10. The daemon log ends Sep 15 17:15 with "herdr is gone, exiting". The GUI is still running, no daemon process exists, and there is no pidfile.

**Behaviour**

1. Replace the three-strikes exit with backoff. Decide "gone" from a real signal: the parent pid becoming 1, or the socket path vanishing. About 30 minutes with a test.
2. The installed copy is the pre-Python bash version. `herdr plugin list` pins commit 73f7978, 28 commits behind HEAD. Reinstall or link the repo. Two minutes.
3. Config is read once, at `daemon.py:1363`. Changing config.toml needs a daemon restart, and the README does not say so. Re-read it every cycle. Ten minutes.
4. A failed first cycle after a herdr start costs a full interval before any emoji appears. Retry after a few seconds on the first failures instead.
5. When offline, every cycle logs one line per unanswered branch. The log is only truncated at daemon start, so a long offline stretch grows it without bound. Truncate inside `log` or collapse repeats.

**Code**

1. `RUNNING_STATUS` at `daemon.py:75` lacks `PENDING`. GitHub's CheckStatusState enum has it, verified by introspection today. A pending check run reads 🛑 instead of 🟡. Also `STALE` is in neither result set, and a rollup state of `EXPECTED` at line 389 is not treated like `PENDING`. Five minutes.
2. `daemon.py:371` returns 🟣 without the default-branch check 🚪 gets. A trunk worktree shows merged forever after a main-to-release pull request merges.
3. `daemon.py:389` shows 🟡 for CLEAN plus a pending rollup. CLEAN means only optional checks are still running, so this contradicts the plugin's own UNSTABLE principle. Adding pending rollups to `required_targets` fixes it at the cost of a larger second query.
4. Publishing forks one `herdr` process per workspace and per pane per cycle, at lines 975 and 1037. The socket the sort already uses offers `workspace.report_metadata` and `pane.report_metadata` with a tokens map, null to clear, and ttl_ms. One connection replaces dozens of subprocesses. Keep the CLI as fallback when the socket env var is absent. One to two hours.
5. TOML is parsed by regex at lines 225 and 253. Single-quoted strings, escaped quotes, and a command with arguments all fail, since line 880 runs the string as one argv. Use tomllib where available with the regex as fallback, and `shlex.split` the command.

**Tests**

1. No CI. Add a workflow running unittest on 3.9 and 3.14 plus ruff. I ran the suite under Python 3.9 via uv today and it passes, but nothing guards that claim. Twenty minutes.
2. Untested paths: the three-strikes loop, `cycle` with panes and TTL, the pane-cwd fallback in `workspace_rows`, `gh_graphql` parsing exit 1 with data, and pidfile takeover. The loop gap is how the behaviour bug shipped.
3. Only FAILURE is tested as a failing required conclusion. Add CANCELLED, TIMED_OUT, STARTUP_FAILURE, and a required StatusContext in ERROR.
4. `test_daemon.py:1206` monkeypatches by assignment; use `mock.patch.object` like the rest. Lines 920, 1452, 1542 and 1563 import shutil inside lambdas and functions. Import it once at the top.
5. Daemon log lines print to stderr during the run. Silence `log` in a base test class so failures stand out.

**README and docs**

1. The example hooks describe five stdin columns at `pr-signoff-static:8` and `pr-signoff-jira:7`. The protocol now has six. The static hook's `read` folds the sixth into `merge`, harmless but the comment is wrong.
2. The README is 461 lines, mostly rationale. Move the "why 🚂 is early, why 🪃 is late" essays and the 💬 essay to a Design section or DESIGN.md. Keep install, state table, config, sort and sign-off near the top. One hour.
3. Add a Troubleshooting block: where the pidfile and log are, the `herdr plugin log list` command, and that config changes need a restart.
4. The manifest says 0.7.0 but git has no tags and no CHANGELOG. Tag releases so plugin pins mean something.
5. `.gitignore` lacks `.claude/settings.local.json`, which is untracked in status now, and `.ruff_cache/`. A ruff cache exists but no pyproject pins its target version to py39.

Separately, lower priority: `WorkspaceInfo.tokens` exists in the herdr schema, so publishing a second `pr_state` token and reading it back from `workspace list` could replace states.json entirely. Also, a fork workflow gets ❔ because only `origin` is read at `daemon.py:953`.

Next: open `daemon.py:1409` and decide whether "gone" should mean parent-pid 1 or a missing socket path. Tell me which items to implement and I will start there.
