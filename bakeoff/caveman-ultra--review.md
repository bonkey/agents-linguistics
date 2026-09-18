# caveman-ultra / review

- arm: `caveman-ultra`  prompt: `review`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 34  wall: 511s  api: 507s
- cost: $5.1128  output tokens: 38824  words: 900

---

Review done. Nothing modified. Verified: 171 tests green on Python 3.9.6, 3.12, 3.13, 3.14, also with deprecation warnings as errors. All 19 Nerd Font codepoints match upstream glyphnames.json. Enum claims checked against the GitHub GraphQL schema, herdr claims against herdr 0.9.1 docs.

## Bugs, ranked

1. **Running-check enum gaps** `daemon.py:75`. GitHub `CheckStatusState` has `PENDING`; `RUNNING_STATUS` lacks it. `StatusState` has `EXPECTED`; only absent contexts count as expected, a reported `EXPECTED` does not. Both cases read 🛑 instead of 🟡, and `unsatisfied` carries `name=` with empty result. `CheckConclusionState.STALE` sits in neither `FAILING_RESULTS` nor `SATISFIED_RESULTS`; pick a side. Add tests for all three.
2. **Trunk with no PR reads ❔** `daemon.py:369`. The no-PR check runs before the default-branch check at `daemon.py:377`. Trunk with closed PR reads blank, trunk with none reads ❔. Return blank for both.
3. **Example headers stale** `examples/pr-signoff-static:8`, `examples/pr-signoff-jira:7`. Both list five stdin columns. Daemon sends six since commit 65f1e99. Jira example itself reads `parts[5]`.
4. **PID reuse hazard** `daemon.py:1294`. Stale pidfile after crash or reboot plus PID reuse: daemon sends SIGTERM then SIGKILL to an unrelated process. Check `ps -o command= -p PID` for `daemon.py` before kill.
5. **100-context cap** `daemon.py:714`. Re-run attempts stay in rollup. Busy PR passes 100 contexts. Required check past cut-off reads unreported: 🟡 forever if listed in `requiredStatusCheckContexts`, invisible otherwise. Ask `totalCount`, log when over, or paginate.
6. **Fork PRs match by branch name** `daemon.py:594`. `pullRequests(headRefName:)` returns PRs from forks with same head branch. Fork PR from `main` shows as your trunk's state. Add `headRepository { nameWithOwner }`, drop nodes from other repos.
7. **Test dir leak** `test_daemon.py:1551`. Lambda captures loop variable `directory`. If first candidate path too long, its temp dir cleanup removes second dir twice, first leaks. Ruff B023.

## Behaviour and design

- **Startup hook contract.** herdr plugins.mdx: startup hooks are "one-shot initialization commands rather than supervised daemons... should ... exit". Loop works today but sits outside documented contract. State this in README. Add `[[events]] on = "worktree.created"` running `--once`, so a new worktree gets a glyph now, not up to 120 s later.
- **Publish over socket** `daemon.py:975`. `workspace.report_metadata` and `pane.report_metadata` take a `tokens` map plus `ttl_ms`; `null` clears. Startup hooks receive `HERDR_SOCKET_PATH`. `socket_request` at `daemon.py:1241` already exists. Cycle drops from 2+N+M process spawns to one connection. Also pass `seq` (cycle start ms): a slow `--once` can publish an older cycle after the loop published a newer one.
- **Config read once** `daemon.py:1363`. reload-config never reruns startup hooks, so any config change needs herdr restart. Re-read `config.toml` each cycle.
- **Optional checks pending read 🟡** `daemon.py:389`. `CLEAN` plus rollup `PENDING` means only optional checks run. Contradicts headline "only non-required failing reads mergeable". Gate on `mergeStateStatus not in MERGEABLE_STATUS`, or add `PENDING` rollups to `required_targets` at `daemon.py:664`.
- **`CHANGES_REQUESTED` has no glyph.** Reads 🛑 under protection, ✅ without. Author's own errand, same argument README makes for 👀. One colour rule spare (15 of 16). Free Octicons: `oct-stop` F46E, `oct-history` F464.
- **Full-interval sleep after herdr failure** `daemon.py:1412`. Three retries at 120 s each. Use 5 to 15 s backoff for retries. Also `daemon.py:1276` logs "workspace list is empty" for unreachable herdr.
- **Detached HEAD blanks the row** `daemon.py:940`. Every rebase or bisect clears the glyph for one cycle. Return `None` (keep) when path is a repo without a branch, or read `rebase-merge/head-name`.
- **Remote parsing** `daemon.py:951`. Misses `ssh://git@github.com:22/`, `https://user@github.com/`, `git://`. Only `origin`: fork workflow with PR in `upstream` reads ❔. Document or prefer `upstream`.
- **CLI modes exit 0 without gh** `daemon.py:1373`. `--query`, `--resolve`, `--once` print nothing, return 0. Return non-zero there.
- **Log rotates only at start** `daemon.py:1346`. Long-lived daemon grows past `LOG_LIMIT`.
- **TOML by regex** `daemon.py:225`, `daemon.py:253`. Reads keys inside other tables, ignores single-quoted strings, reads file twice. Use `tomllib` on 3.11+, regex fallback below.
- **Lint.** ruff: 36 E501, 4 SIM105, 1 SIM115 (log handle, intentional). Clean otherwise.

## Tests and docs

- **Missing tests:** `PENDING` / `EXPECTED` / `STALE` (bug 1); end-to-end cycle with stub `gh` fixtures checking `publish` argv (`--ttl-ms`, `--clear-token`, per-pane calls); `workspace_rows` pane-cwd fallback; `read_pairs`; pidfile take-over and drop; `gh_graphql` non-JSON and non-dict bodies; branch names with `"` or `\` in `lookup_query`.
- **Drift test:** extract `\uXXXX` from README rules block and `oct-` names from tables, assert against `NERD`. Glyphs swapped three times in recent commits. Same for `SORT_ORDER` groups vs README sort table.
- **Noise:** five log lines print during the run. Patch `daemon.log` in those tests. `shutil` imported via `__import__` in lambdas and inside three functions; import once. `GuardedCycle` assigns `daemon.cycle` instead of `mock.patch.object`.
- **No CI, no CHANGELOG** at `version = "0.7.0"`. Add GitHub Actions: 3.9, 3.12, 3.14 on ubuntu and macos, `python -m unittest` plus `ruff check`.
- **README misplaced paragraphs** `README.md:178` to `README.md:195`. Re-run attempts, rollup limits, unreported contexts: belong under "State mapping", sit under "The 💬 modifier".
- **README undocumented:** long-lived hook vs herdr contract; detached HEAD blank; `origin` only, forks; github.com only, no `GH_HOST`; 100-context cap; token scopes (`repo`, `read:org` for SAML) and push access for `branchProtectionRule`; empty result in `unsatisfied` for a running check.
- **README imprecise** at "Only the first hundred threads": open thread within first 100 still reads 💬. Consider `last: 100`, newest threads likelier open.
- **README length:** 460 lines, rationale-heavy. Short at-a-glance table plus TOC at top, rationale under one "Why" heading.
- **Small:** `config.example.toml` says "this README" inside a toml file. `.gitignore` lacks `.claude/settings.local.json`. `herdr-plugin.toml` description is one 600-char line.
