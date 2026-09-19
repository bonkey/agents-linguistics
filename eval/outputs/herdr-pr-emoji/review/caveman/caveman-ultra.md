# caveman-ultra / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-ultra`  prompt: `review`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 9  wall: 368s  api: 361s
- cost: $3.7445  output tokens: 29615  words: 1955

---

# Review: herdr-pr-emoji

Solid core: the decisions are pure functions, 171 tests pass in 0.9 s, and failure containment is careful. The problems sit at the edges: process handling, config, state gaps and doc drift. No file was modified. Tests ran with `PYTHONDONTWRITEBYTECODE=1` and wrote only to temp directories. Findings marked "probe" were confirmed by a read-only run.

## Behaviour

**B1. A stale pid file can kill an unrelated process** (`daemon.py:1302-1312`).
- The pid file survives a crash, SIGKILL or power loss in `~/.local/state`.
- Once that PID is reused, `take_over_pidfile` sends SIGTERM, then SIGKILL after 5 s, to whatever process now owns it.
- Fix: before the kill, confirm that `ps -p PID -o command=` contains `daemon.py`. An alternative is `fcntl.flock` on the pid file, which also closes the race when two daemons start together.

**B2. An unknown argument starts the daemon** (`daemon.py:1366-1393`).
- `python3 daemon.py --help`, or a typo such as `--sort-names`, falls through to the loop.
- It kills the running daemon, redirects output to the log and loops in the foreground.
- Fix: reject unknown argv, print usage and exit 2.

**B3. Config is read once, but `--once` reads it fresh** (`daemon.py:1363`).
- Edit `icons` and invoke `refresh`. The row flips to the new set, then the daemon flips it back at the next cycle.
- The README documents no way to restart the daemon. The Development section says `reload-config` does not run startup hooks.
- Fix: check the config mtime each cycle, re-read it and log the change.

**B4. `CHANGES_REQUESTED` is unhandled** (`daemon.py:391`).
- Probe: it reads `blocked` 🛑 "cannot say why", although GitHub says exactly why.
- This is an errand for the author. Add a state, which uses the spare sixteenth herdr rule, and rank it in the first sort group.

**B5. 🟣 is not suppressed on the default branch** (`daemon.py:371-377`).
- The reasoning is the same as for 🚪. A release pull request from `main` into `production` that merged months ago keeps 🟣 on the trunk row.
- The README's own "release sync" example is merged more often than closed.

**B6. `headRefName` matches pull requests from forks** (`daemon.py:594`).
- A fork's pull request from its `main` or `patch-1` lands on your row of the same name.
- Fix: ask for `isCrossRepository`, take `last: 5` and pick the newest pull request from the same repository.
- The reverse gap: a clone whose `origin` is a fork never finds its pull request in upstream. Document that, or query `parent`.

**B7. `BEHIND` reads ✅** (`daemon.py:76`).
- GitHub reports `BEHIND` only where branch protection demands an up-to-date branch. The merge button is disabled until "Update branch", so "press the button" is false there.
- I did not verify this against a live pull request. Check one, then give it its own state.

**B8. `contexts(first: 100)` asks for no `pageInfo`** (`daemon.py:714`).
- Re-runs stay in the rollup, and the project's own `p2` fixture shows four attempts of one check. A monorepo reaches 100 contexts fast.
- A required check that passed at position 101 or later counts as unreported. It becomes `EXPECTED` and the row stays on 🟡.
- Fix: ask for `hasNextPage`. When it is true, skip the expected-missing inference or paginate.

**B9. 👀💬 and 🟡💬 sort below a lone 💬.**
- Probe: they rank 8 and 9, while `conversation` ranks 6. A row that carries an errand for the author sorts into "somebody else's turn".
- `states.json` stores only the state name. Store the modifier too, and rank by the lower of the state's rank and the conversation rank.

**B10. `UNKNOWN` leaves the row empty for a full interval.**
- This is worst on the first cycle and on a manual `refresh`.
- The README itself says the query triggers GitHub's computation. Add one bounded retry after about 5-10 s, for the `UNKNOWN` rows only.

**B11. The sign-off glyph disappears at once, where three places say it lasts until the TTL.**
- `daemon.py:556-558`, `config.example.toml:31` and the `pr-signoff-jira` header all claim a silent hook "keeps the glyph until its TTL runs out".
- Probe: when the hook fails, the row is republished as `✅` and 🏁 is gone at once. README lines 236-238 ("costs the third glyph") are right.
- Fix the three texts. Better, cache the last answer per (slug, branch) and reuse it for up to 3 cycles, which stops the flicker when Jira is flaky.

**B12. Rulesets.**
- `branchProtectionRule` is null on a repository governed by rulesets, so it gets no 💬 and no 🟡 for an unreported check.
- Rulesets are where GitHub is heading. Query `repository.rulesets` as a fallback. This is a bigger item.

**B13. A repository with no required checks reads 🆗 when CI is red.**
- This is documented and deliberate. "Optional" means nothing where nothing is required.
- Consider an `unstable = "fail"` setting for that case.

**Smaller items**
- **Remote parsing** (`daemon.py:951`): probe shows `https://user@github.com/…`, `git://`, `ssh.github.com:443` and `GitHub.com` all give an empty slug. GitHub Enterprise is not supported either. Parse the URL with `urllib.parse` and lowercase the host.
- **Rebase and bisect**: `git branch --show-current` is empty during a rebase or bisect, so the token is cleared. Fall back to `rebase-merge/head-name`.
- **Hook arguments**: probe shows `signoffCommand = "~/bin/x --flag"` becomes one argv and fails with ENOENT. Use `shlex.split`, still with no shell.
- **Missing `gh`**: the message is logged before `redirect_to_log()`, so it never reaches `daemon.log`. The exit code is also 0 for `--query`. Redirect first, and exit non-zero in the command-line modes.

## Code

- **Shared temp name** (`daemon.py:1108`): the daemon and `--once` both write `states.json.tmp`. Their writes can interleave into corrupt JSON or an ENOENT. Use `tempfile.mkstemp(dir=STATE)`.
- **One cycle, not two**: better still, have `refresh` send SIGUSR1 to the daemon instead of running a second cycle. That leaves one writer, one config and no parallel GraphQL requests, and it also resolves B3.
- **Log growth** (`daemon.py:1349`): the size check runs only at start and truncates the log to 0. A long-lived daemon grows without bound. Rotate to `daemon.log.1` every cycle.
- **Repeated errors**: the same SAML error is logged every 120 s. Log only when the message changes.
- **Config regex**:
  - A single-quoted TOML string is silently ignored. Probe: `icons = 'emoji'` has no effect.
  - A typo such as `icons = "emojis"` is also silent.
  - Use `tomllib` where it imports, keep the regex as a fallback for the macOS system Python 3.9, and log unknown keys and rejected values.
- **Dead parameter**: `blocker_for(pr, icons)` has one caller, which passes `STATE_NAMES` (`daemon.py:466`). Return the state name directly and drop the `STATE_NAMES` trick.
- **Duplicate work**: `decide` mutates `prs` and calls `apply_marks` a second time, and `states_of` recomputes `verdict_for`. Return verdicts and states together.
- **Unvalidated slug**: `read_pairs` accepts a slug without `/`. Probe: `--resolve` then ends in a `ValueError` traceback.
- **Publishing**: there is one `herdr` subprocess per workspace and per pane every cycle, run one after another. Skip a value that has not changed until half its TTL is spent. Cache the `origin` slug per path.
- **No chunking**: the alias batches are not chunked, and `isRequired` is costly on GitHub's side. Chunk at about 25 aliases. Failure is already contained per alias.
- **Permissions**: the state directory and the log use the default umask and hold repository and branch names. Create them with `mode=0o700`.
- **Formatting**: 13 lines in `daemon.py` and 21 in the tests are over 88 characters, so no formatter is enforced.

**Examples**
- **`pr-signoff-static:16`**:
  - Tab counts as IFS whitespace, so an empty column collapses. Probe: an empty `reviewDecision` gives `review=[CLEAN]`.
  - It is harmless in this script and wrong as a template to copy. Use `awk -F'\t'`.
  - Shellcheck also reports 3 unused variables.
- **Example headers**: both list 5 input columns. There are 6 since `unsatisfied` was added.
- **`pr-signoff-jira`**:
  - `detail.splitlines()[:1] or ""` prints a list repr.
  - Worst case is 5 curl calls of 15 s each against a 20 s hook budget, so add `--max-time`.
  - Pages are cut silently at 3. Log when `nextPageToken` remains.
  - `statusCategory == done` also covers "Won't do", so say in the comment that it means finished, not approved.
  - Skip the `/myself` call when the search returns at least one issue.

## Tests

- **Main path**: it is untested end to end. `cycle()` is covered only with no checkout, and the `publish` argv is asserted nowhere. Add a stub `gh` that answers `fixtures/lookup.json` and a temp git repository. Assert the exact `report-metadata` argv in `CALLS`.
- **Untested functions**:
  - process and entry point: `take_over_pidfile`, `drop_pidfile`, the `main` argv handling and `redirect_to_log`;
  - `gh_graphql`, for exit 1 with data and for non-JSON output;
  - `run`, for returns 124 and 127 and for stdin;
  - parsing and socket: `read_pairs`, the pane-cwd fallback of `workspace_rows`, and the error reply of `socket_request`.
- **Timeout test** (`test_daemon.py:1170`): it mocks `run` whole. A real hook that runs `sleep 5` with a 0.2 s timeout would cover the real path.
- **No doc-sync tests**: the git log shows this drift happening, with glyph swaps and renames.
  - Parse the README state table, the `\uXXXX` values in the `rules` block, the manifest description and the keys of `config.example.toml`.
  - Compare them with `EMOJI`, `NERD`, `SORT_ORDER` and `read_config`.
  - `test_the_whole_order_is_what_the_readme_says` never reads the README.
- **Fixtures**: `lookup.json` predates `reviewDecision`, `isInMergeQueue` and `timelineItems`. Re-record it with the current query, and add a script that records and anonymises.
- **Log output**: 5 log lines leak into the test output, and the log text is never asserted. Patch `daemon.log` and assert the message.
- **Nits**:
  - `__import__("shutil")` is used inline, and `shutil` is imported at function level in three places.
  - `GuardedCycle` patches by hand and passes `"pass"` as icons.
- **No CI**: add a workflow that runs `python3 -m unittest` on Python 3.9 and the latest, on macOS and Linux, plus `ruff` and `shellcheck`.

## README

- **Install omits the Nerd Font**:
  - The default is `icons = "nerd"`, the README opens with emoji, and the plugin is named pr-emoji.
  - A new user gets tofu boxes.
  - State the requirement in Install, or default to `emoji`.
- **Line 8**: the branch names look real (`bonkey/ios-27-siri-ai-intents`, `bonkey/apple-ads-interface`). Commit a5cc614 generalised the other examples. Replace these too.
- **Line 244**: it says "five columns". There are now 6.
- **Lines 178-194**: they cover the newest attempt, the rollup and expected contexts, but sit under "The 💬 modifier". They belong in State mapping.
- **Length**: 461 lines, mostly rationale.
  - Keep install, legend, configuration, troubleshooting and limitations in the README.
  - Move the rest to `DESIGN.md`, for example why 🚂 is read early and 🪃 late.
- **Troubleshooting section**:
  - No glyph: `gh auth status`, the log path, a `--query` test and SAML.
  - Tofu boxes: the Nerd Font requirement.
  - The hook's environment.
- **Limitations section**: `origin` only, github.com only, forks, rulesets, the 100-item caps and detached HEAD.
- **Configuration**: say when a config change takes effect and how to restart the daemon. Say how `SIGNOFF_JIRA_*` reach the herdr server's environment, for example through a wrapper script.
- **Legend in five places**: it lives in two README tables, the manifest, the config example and the `SORT_ORDER` comments. The manifest description is the whole legend, so shorten it.
- **Housekeeping**: add a screenshot, a CHANGELOG and git tags. There are no tags, and the manifest says 0.7.0. `.claude/` is not in `.gitignore`.

## Order of work

1. B1, B2 and B3, which are safety fixes and small.
2. The B11 texts and the stale README columns.
3. B4, B5 and B9, which are small state gaps.
4. The end-to-end cycle test, the doc-sync test and CI.
5. B6, B8 and B12.