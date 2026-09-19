# i-have-adhd / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `i-have-adhd`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 16  wall: 299s  api: 291s
- cost: $3.0992  output tokens: 22721  words: 895

---

**Fix first (about 10 minutes):** any flag `main` does not recognise starts the daemon loop, at `daemon.py:1366`. So `python3 daemon.py --help`, or a typo, takes over the pid file, SIGTERMs the live daemon and loops in the foreground. Reject unknown arguments with a usage line and exit 2.

I modified no files. All 171 tests pass in 0.9 s. Every finding below comes from reading the code or from a read-only probe of the pure functions.

## Behaviour (what the row says)

1. **`CHANGES_REQUESTED` reads 🛑.** 🛑 means "blocked, cannot say why", yet `reviewDecision` is already in the first request. Add a state ranked above 👀 at `daemon.py:391`. About 30 minutes with tests.
2. **`BEHIND` reads ✅** (`daemon.py:76`). GitHub describes it as "the head ref is out of date"; if, as I believe, it is only reported when the base branch requires up-to-date branches, the merge button cannot be pressed. It needs its own "update branch" state. herdr allows 16 colour rules and 15 are used, so items 1 and 2 together exceed the cap.
3. **Over 100 checks pins the row to 🟡.** `contexts(first: 100)` at `daemon.py:714` has no `pageInfo`. A required check on page 2 counts as never reported: the probe returned `(False, True, [('build', 'EXPECTED')])`. A failing one there is missed. Paginate, or skip `expected` when the page is truncated.
4. **Repositories governed by rulesets never get 💬 or "expected" checks.** I checked GitHub's schema: `Ref.rules` and `PullRequestParameters.requiredReviewThreadResolution` exist. Read them next to `branchProtectionRule`.
5. **The wrong pull request, or none, can land on a row.**
   - `pullRequests(headRefName:)` at `daemon.py:594` does not filter on the head repository, so a fork's pull request from a same-named branch (say `patch-1`) can land on your row. Filter on `isCrossRepository`.
   - `slug_from_url` at `daemon.py:951` returned `''` for `git@github.com-work:…`, `https://user@github.com/…`, `https://GitHub.com/…`, `git://…` and `ssh.github.com:443`.

## Code (robustness)

1. **Pid file takeover can kill an unrelated process** (`daemon.py:1294`). After a crash or reboot the recorded PID may belong to something else, and it gets SIGTERM then SIGKILL. Hold an `fcntl.flock` on the pid file instead, which also closes the race between two daemons starting together. About 45 minutes.
2. **The sign-off glyph attaches to any non-draft state** (`daemon.py:487`). A hook that answers a row it was not asked about produced `🟣📭` and `❔🎫` in the probe. Gate it with the same condition `signoff_input` uses.
3. **The regex config parser drops values silently** (`daemon.py:225`). `icons = 'emoji'` in single quotes and `unstable = "Warn"` both fall back to defaults with no log line. Use `tomllib` on Python 3.11+, keep the regex as fallback, and log rejected values.
4. **Diagnostics point the wrong way.**
   - The start-up line logs the glyph `'\uf42e'` rather than the setting `ok` (`daemon.py:1398`).
   - "gh is required" is logged at `daemon.py:1373`, before `redirect_to_log`, so it never reaches `daemon.log`.
   - The log is only truncated at start-up, and truncation discards its history.
5. **`save_states` uses one fixed `.tmp` name** (`daemon.py:1108`). The `refresh` action and the loop can collide on it. Use `tempfile.mkstemp` in the same folder.

## Tests

1. **The process-level functions have no tests.** These names never appear in `test_daemon.py`: `main`, `take_over_pidfile`, `drop_pidfile`, `redirect_to_log`, `publish`, `workspace_rows`, `panes_of`, `read_pairs`, `socket_request`. One `cycle()` test reusing the stub herdr, plus a stub `gh` that prints a fixture, would cover the publishing path. About 1 hour.
2. **`test_the_whole_order_is_what_the_readme_says` compares `SORT_ORDER` with itself** (`test_daemon.py:1350`). No test reads the README. Add a test that parses the README tables, the manifest description and `config.example.toml`, and checks them against `EMOJI`, `NERD`, `SORT_ORDER` and the defaults.
3. **The timeout test mocks `run`** (`test_daemon.py:1170`), so the `TimeoutExpired` → 124 branch never runs. Use a real `sleep` hook with a 0.2 s timeout.
4. **The examples are untested.** `pr-signoff-jira` has three pure functions that can be loaded with `importlib`. It also formats a list into its error text, so the log shows `['…']` (`examples/pr-signoff-jira:118`, `:123`).
5. **There is no CI.** Add a GitHub Actions matrix for Python 3.9 and latest on macOS and Linux. Also capture the three sign-off log lines the tests now print to stderr, and assert on them.

## README

1. **The Install section never says the default `icons = "nerd"` needs a Nerd Font.** The intro shows emoji, so a new user without one gets empty boxes. Default to emoji, or say it at `README.md:14`.
2. **The column count has drifted.** `README.md:244` says "five columns", and both example headers list five (`examples/pr-signoff-static:8`, `examples/pr-signoff-jira:7`). There are six, since `unsatisfied` was added.
3. **`README.md:178-194` is misplaced.** The paragraphs on re-runs, the rollup and expected contexts sit under "The 💬 modifier" but belong in "State mapping".
4. **There is no troubleshooting section.** An empty row should point to `daemon.log`, `gh auth status`, the PATH of hooks herdr starts, the requirement that the remote is `origin` on github.com, and the fact that config is read once so changes need a daemon restart (`daemon.py:1363`).
5. **It is 461 lines of reference mixed with rationale.** Keep install, the state table, config and troubleshooting in the README, and move the reasoning to `DESIGN.md`. Add a CHANGELOG and tags: the manifest says 0.7.0 and the repository has no tags.

I hold 11 smaller items, such as a quick re-poll after `UNKNOWN`, fewer `herdr` subprocesses per cycle, the stale docstring at `daemon.py:723`, the `marks` 4-tuple and query chunking. Ask if you want them.

Next: open `daemon.py:1366` and add the unknown-argument check.