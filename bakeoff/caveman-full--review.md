# caveman-full / review

- arm: `caveman-full`  prompt: `review`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 15  wall: 356s  api: 348s
- cost: $3.9544  output tokens: 26068  words: 786

---

Tests: 171 pass on Python 3.14.7. In-process line coverage of `daemon.py` via stdlib `trace`: 68.9%. Decision logic solid and well-tested. Findings below, severity-tagged, verified unless marked.

## Code and behaviour

- **HIGH, stale pidfile kills unrelated process.** `daemon.py:1302` trusts `os.kill(pid, 0)`. After reboot, pid reuse means SIGTERM then SIGKILL land on whatever same-user process now owns that number. Fix: confirm `ps -o command= -p PID` names `daemon.py`, or replace pid number with `fcntl.flock` on pidfile.
- **MED, missing `gh` logged nowhere useful.** `daemon.py:1372` logs "gh is required" before `redirect_to_log()` at `:1392`. Loop mode: `daemon.log` stays empty, user sees blank sidebar with no clue. Move redirect ahead of check for loop mode.
- **MED, config read once.** `daemon.py:1363`. README `:429` says reload-config does not rerun startup hooks, so `unstable`, `icons`, `signoffCommand` changes need full herdr restart. Configuration section `:410` never says so. Re-read config each cycle, cost trivial.
- **MED, `headRefName` matches fork PRs.** `daemon.py:594` `pullRequests(headRefName:, last: 1)` returns newest PR with that head name from any fork. Contributor fork PR named `main`, `develop`, `patch-1` created after yours wins row. Fix: add `headRepository { nameWithOwner }`, ask `last: 3`, prefer node whose head repo equals slug. Also: fork workflow, origin = fork and PR on upstream, always reads ❔. Undocumented.
- **MED, sign-off glyph leaks onto unasked rows.** Verified: hook answering for merged, no-PR, closed branch yields `🟣🏁`, `❔📭`, `🚪🎫`. `decide` `:789` accepts any `(slug, branch)`; `emoji_for` `:489` appends for any non-draft. README `:232` promises otherwise. Fix: append only when `state == "OPEN"`, or keep only answers for rows `signoff_input` sent.
- **LOW, running check reaches hook as `build=`.** `daemon.py:319` reads conclusion or state; in-flight CheckRun has neither. README `:223` promises `name=RESULT`. Use `status` (`IN_PROGRESS`, `QUEUED`) when conclusion empty.
- **LOW, `signoffCommand` takes no arguments.** `daemon.py:880` runs `[command]`. Jira example pushes everything into env vars as consequence. `shlex.split` keeps no-shell and allows `"~/bin/hook --team abc"`. Related: no way to set hook env under herdr; daemon inherits herdr's env. README `:438` shows only by-hand case. Document wrapper script or add `[signoffEnvironment]` table.
- **LOW, TOML by regex.** `daemon.py:233-276`, five regexes, tables and escapes ignored. Python 3.9 and 3.10 both EOL by October 2026. Bump floor to 3.11, use `tomllib`.
- **LOW, rollup `EXPECTED` not running.** `daemon.py:389` checks `PENDING` only. Verified: CLEAN plus EXPECTED reads ✅. Add `EXPECTED`.
- **LOW, empty `--resolve` sends `query {  }`.** `daemon.py:1076`. Guard on empty pairs.
- **LOW, one `herdr` spawn per workspace plus per pane per cycle.** `daemon.py:1031-1039`. 20 workspaces with 3 panes = 80 spawns every 2 min, each 10 s timeout budget. Publish only when value changed or age over 2 intervals, TTL is 3.

## Tests

- **Never exercised anywhere:** `git_branch`, `github_slug`, `publish` with token value, `workspace_rows`, `panes_of`, `read_pairs`, `print_verdicts`, `--query`, `--resolve`, `take_over_pidfile`, `drop_pidfile`, three-strikes loop exit. Add one `--once` end-to-end: stub `gh` answers fixtures, stub `git`, real checkout dir, assert `report-metadata` argv incl. `--ttl-ms` and `--clear-token`. STUB and CALLS at `test_daemon.py:1478` already give the mechanism.
- **Pidfile:** test with pidfile naming a sleeping child, then one naming dead pid.
- **No test for sign-off leak or empty RESULT** above. Both one-liners.
- **`examples/pr-signoff-jira` untested.** Pure functions `tickets_by_pull`, `unsatisfied_checks`, `without_a_ticket` loadable via `importlib.machinery.SourceFileLoader` despite missing `.py`. `pr-signoff-static` never run; one `run_signoff` call covers it.
- **`test_daemon.py:1667`** `--once` test: publish path hits stub and fails silently. Assert CALLS content to lock `--clear-token` argv.
- **Nits:** `:1205` manual monkeypatch, use `mock.patch.object`. `__import__("shutil")` at `:920`, `:1452`; local `import shutil` at `:1542`, `:1563`. Import once at top.
- **No CI.** Add GitHub Actions matrix 3.9 through 3.14. Syntax parses for 3.9 per `ast` check, but never run on it. README `:14` claim unverified.

## README, examples, repo

- **Stale hook comments.** `examples/pr-signoff-static:8` and `pr-signoff-jira:7` list five stdin columns. Daemon sends six since commit 65f1e99. Jira code reads column six; comment does not say so.
- **`pr-signoff-static:16` IFS trap.** POSIX `read` with `IFS=tab` collapses empty columns. Verified: empty reviewDecision shifts `CLEAN` into `review`. Harmless there, trap for anyone copying it. Comment it, or parse with `awk -F'\t'`.
- **No restart note** in Configuration `:410-422`. See config finding.
- **No Troubleshooting section.** "Nothing shows" is first question. Pieces exist scattered at `:394-408`, `:420`, `:429-436`: `gh auth status`, log path, `--once` by hand, hook exit lines. Collect under one heading.
- **Structure.** 461 lines, rationale prose dominates `:80-143`, `:103-127`, `:161-194`. Install, config, glyph tables buried between essays. Optional: keep tables, install, config, troubleshooting up front; move "why" paragraphs to `DESIGN.md` or one "Design notes" heading at end.
- **`:4` `mergr`** named, never linked or explained.
- **Fork workflow** absent. See `headRefName` finding.
- **Versioning.** Manifest says 0.7.0, zero git tags, no CHANGELOG. Tag releases.
- **`.gitignore`.** `.claude/settings.local.json` untracked local state. Add `.claude/` or that file.

Nothing modified.
