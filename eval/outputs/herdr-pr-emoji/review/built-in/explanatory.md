# explanatory / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `explanatory`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 17  wall: 367s  api: 359s
- cost: $3.8383  output tokens: 28314  words: 1548

---

I made no changes and `git status` is clean. All 171 tests pass on Python 3.14 and on 3.9.6, so the README's "3.9 or newer" claim holds. The decision logic is solid. The problems are in process management, the GitHub query limits, and the first-run path in the README.

## Bugs I reproduced

Process-level checks ran in a temporary state directory and the rest as direct calls to the functions in `daemon.py`.

| # | Finding | Where | What I saw |
|---|---|---|---|
| 1 | A stale pid file makes the daemon kill an unrelated process. `take_over_pidfile` checks only that a PID is alive, not that it is a daemon. | `daemon.py:1294` | I wrote the PID of a plain `sleep 300` into `daemon.pid`. The daemon logged "stopping previous daemon" and sent it SIGTERM, with SIGKILL to follow after 5 seconds. |
| 2 | An unknown argument starts the daemon. `main` has no branch for unrecognised flags. | `daemon.py:1366-1392` | `daemon.py --help` printed nothing, redirected output to the log, took over the pid file and looped. Run against a live install, that kills herdr's real daemon and leaves the mistyped command looping in its place. |
| 3 | More than 100 check contexts pins a row to 🟡. The query asks for `contexts(first: 100)` with no `pageInfo`, and any expected context missing from the page counts as running. | `daemon.py:714`, `:328-330` | With 100 contexts and a passed required check not among them, the verdict was 🟡 on an `UNSTABLE` pull request that should read 🆗. |
| 4 | `CHANGES_REQUESTED` reads 🛑, which the README defines as "blocked, and this plugin cannot say why". Here the plugin can say why. | `daemon.py:391` | `verdict_for` returned `('blocked', False)`. |

Suggested fixes:
- **1:** hold an `fcntl.flock` on the pid file for the life of the process. Signal the recorded PID only when the lock is already held, because then a real daemon owns it. This also closes the race between two daemons starting at once.
- **2:** use `argparse`, or reject unknown flags with a usage line and exit code 2.
- **3:** ask for `pageInfo { hasNextPage }`. When the page is truncated, skip the "unreported means running" inference. The README documents the 100-thread cap but not this one.
- **4:** add a rung for `CHANGES_REQUESTED`. The colour rules allow sixteen and use fifteen, so there is room for one more state.

## Code

- **Config changes do not stick.**
  - Config is read once at `daemon.py:1363`, while the `refresh` action (`--once`) reads it fresh each time.
  - Change `icons`, press refresh, and the new glyphs appear. The running daemon repaints the old ones at its next cycle.
  - Re-reading the file every cycle fixes this. The alternative is to make `refresh` signal the daemon instead of running a second full cycle beside it.
- **Invalid config values fail silently** (`daemon.py:244-249`).
  - `icons = "emojis"` and single-quoted TOML strings fall back to defaults with no log line. Only the interval floor is logged.
  - The file is also opened twice. `tomllib` with the regex as a fallback would keep 3.9 support.
- **`guarded_cycle` logs `%r` of the exception with no traceback** (`daemon.py:1054`). This handler is what stands between a parser surprise and a dead daemon, and its log line gives too little to debug with.
- **The startup log prints the glyph instead of the setting.** I saw `unstable=\uf42e` in the log, from `daemon.py:1398`. It is a leftover from when `icons` was the `unstable` string.
- **Failures exit 0.** `--once` returns 0 when herdr is unreachable, and a missing `gh` also returns 0 (`daemon.py:1372-1390`). The `gh` message is written before `redirect_to_log()`, so it never reaches `daemon.log`.
- **Logging.**
  - The log is truncated only at startup (`daemon.py:1349`), so a long-lived daemon never rotates it.
  - A persistent condition such as a SAML-protected repository writes the same lines every cycle. Rotate to `daemon.log.1` and suppress repeated messages.
- **`signoffCommand` cannot take arguments.** It runs as `[command]` (`daemon.py:880`), so `"~/bin/hook --flag"` fails with ENOENT. `shlex.split` would allow arguments and still avoid a shell.
- **`read_pairs` accepts a slug with no slash.** `lookup_query` then raises `ValueError`, so `--resolve` ends in a traceback.
- **The daemon and `--once` share the same `states.json.tmp` path** (`daemon.py:1108`). Use a PID-suffixed name.
- **Smaller points.**
  - `decide` and `apply_marks` mutate their inputs although they sit under "pure decisions".
  - `blocker_for` runs three times per pull request. `decide` could return the state and the glyph together.
- **Examples.**
  - Both example headers list five stdin columns, but there are six. The Jira example reads the sixth, so its header contradicts its own code.
  - `pr-signoff-jira:118` and `:123` format a list, so an error reads `curl exited 22: ['{"errorMessages"...']`.
  - `pr-signoff-static:16` splits on a tab with `read`, and a tab counts as IFS whitespace, so empty fields collapse. With an empty `reviewDecision`, `review` received `CLEAN`. The static hook ignores that column, but anyone copying the loop gets shifted fields.

## Behaviour

I reasoned these from the code and the GitHub API and have not run them against live data, except where noted.

- **Fork pull requests match by branch name.**
  - `pullRequests(headRefName:)` (`daemon.py:594`) matches a head branch in any repository, so a stranger's fork PR from `patch-1` or `main` can claim your row.
  - The default-branch 🚪 suppression works around one symptom. Asking for `isCrossRepository` with `last: 3` and filtering treats the cause.
  - Separately, a fork-as-`origin` workflow always reads ❔, because the PR lives in the parent repository.
- **`UNKNOWN` waits a full interval.** The README says the query that reports `UNKNOWN` makes the next one exact, but the next one is 120 seconds later. Re-asking only the `UNKNOWN` branches after about 10 seconds follows from the plugin's own argument.
- **Rulesets.** A null `branchProtectionRule` loses 💬 and the expected-check 🟡. Rulesets are increasingly the default, and GraphQL exposes `RequiredStatusChecksParameters` and `requiredReviewThreadResolution`. This is a larger feature.
- **Sort order outlives what the sidebar shows.** Tokens expire after three intervals, but `states.json` never does. Once the daemon dies, a sort orders by state the sidebar no longer shows. Writing a timestamp into the file would fix this.
- **Same-named checks.** Two checks with the same name resolve to the newest one only. A passing `build` from one workflow masks a failing `build` from another; I confirmed `required_state` returns `(False, False, [])` for that case.
- **⚠️💬 depends on an unrelated check.** A `DIRTY` pull request only gets the second query, and therefore 💬, when some check also fails.
- **Remote URL forms.** `https://user@github.com/…`, `ssh.github.com:443`, SSH host aliases such as `git@github-work:` and `GitHub.com` all returned an empty slug, so those rows stay blank.

## Tests

The fixtures recorded from real responses, the end-to-end sort against a stub socket, and test names that read like a specification are all worth keeping. The gaps are these:

- **The layer that talks to gh, herdr and the filesystem is untested.** That covers `gh_graphql`, including the "exit 1 but usable data" case the README stresses. It also covers `publish`, `workspace_rows`, `panes_of`, the pid file functions, argument handling in `main`, `read_pairs`, and the real timeout path in `run`. The timeout test at `test_daemon.py:1170` mocks `run`, so `TimeoutExpired` is never raised.
- **The examples have no tests.** The Jira example's pure functions can be imported and tested. A contract test that feeds `signoff_input` output to `pr-signoff-static` would keep the examples in step with the protocol.
- **Docs and code can drift.** My ad-hoc script found the README glyph tables, the colour rules and the `NERD` table in sync today. That script should become a test.
- **Housekeeping.**
  - `test_the_whole_order_is_what_the_readme_says` compares `SORT_ORDER` with itself.
  - `GuardedCycle` passes `"pass"` as `icons` and patches by hand instead of using `mock.patch.object`.
  - Five log lines leak to stderr during the run and could be assertions on `daemon.log`.
  - `__import__("shutil")` should be a top-level import.
- **There is no CI.** A workflow running the suite on Python 3.9 and the newest release would keep the README's version claim checked.

## README

- **The Nerd Font requirement is missing from Install** (`README.md:14`).
  - The default icon set needs one, and the sample row at line 8 shows emoji, which is not the default. A new user sees empty boxes.
  - Either state the requirement up front or make `emoji` the default.
- **Stale counts.** "Five columns" appears at `README.md:244`, and "never wider than two" at `daemon.py:458` and `test_daemon.py:438`. The token is now up to three glyphs wide.
- **Misplaced paragraphs.** `README.md:178-194`, on re-runs, the rollup and expected contexts, sit under the 💬 heading. They belong in a "Required checks" subsection.
- **Missing sections.**
  - How to apply a config change (see the config item under Code).
  - A short troubleshooting list: check the log, `gh auth status`, the font, and `--query`.
  - How `SIGNOFF_JIRA_*` reach a daemon that herdr starts. A wrapper script is the practical answer.
  - That `signoffCommand` takes no arguments.
- **Structure.** Reference material and design rationale are interleaved across 460 lines. Moving the rationale to a `DESIGN.md` would make the README quicker to read for setup and reference.

I would fix the bugs in the order 1, 2, 3, then the config re-read. Each is a change of roughly ten lines.