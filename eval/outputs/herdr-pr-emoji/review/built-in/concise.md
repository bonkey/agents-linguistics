# concise / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `concise`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 16  wall: 267s  api: 252s
- cost: $2.6838  output tokens: 19263  words: 1141

---

No files were changed. The project is in good shape: 171 tests pass in about a second, failures are contained well, and the README is precise. The strongest proposals are one safety bug, one wrong-PR lookup and a handful of behaviour gaps. I reproduced the first two findings; the rest come from reading the code or from how GitHub behaves.

## Code

1. **A stale pidfile can kill an unrelated process** (`daemon.py:1294`).
   - `take_over_pidfile` sends SIGTERM, then SIGKILL, to whatever PID the file names.
   - After a crash or reboot that PID may belong to another of your processes. I pointed the file at a bystander `sleep` and the plugin killed it.
   - Fix: check the process's command line (`ps -o command=`) before signalling, or hold an `fcntl.flock` on the file and only signal a live lock holder.
2. **The branch lookup matches pull requests from forks** (`daemon.py:594`).
   - `headRefName` ignores which repository the head branch lives in.
   - For `cli/cli`, the last three pull requests from a branch named `trunk` all come from strangers' forks.
   - Today this only shows up as the 🚪 that the README blames on "a release sync". An open fork PR from `main` or `patch-1` would put a stranger's state on your row.
   - Fix: also ask for `isCrossRepository`, fetch `last: 5`, and skip any PR whose head is a fork. Prefer an OPEN PR over a newer closed one.
3. **More than 100 check contexts breaks the required-check logic** (`daemon.py:714`).
   - A required check beyond the first page counts as "never reported", so the row stays 🟡 for good. A failing check out there is missed entirely.
   - Fix: read `pageInfo.hasNextPage`, then either page through or skip the `expected` inference for that PR.
4. **Configuration is read once, at start** (`daemon.py:1363`).
   - Change `icons`, invoke `refresh`, and the row changes. Within one interval the running daemon repaints it with the old setting.
   - Fix: re-read the file every cycle, which is cheap, and log values it rejects. Today `unstable = "OK"` is ignored silently.
   - `tomllib`, where Python has it, would also accept `'single-quoted'` strings.
5. **`states.json.tmp` is a shared temp path** (`daemon.py:1108`). The daemon and a `--once` run can write it at the same time. Put the PID in the temp file's name.
6. **A hook's stderr is logged only when it exits non-zero** (`daemon.py:881`). Its warnings, such as "page cap reached", are lost. Log the last stderr line on success too.
7. **`signoffCommand` cannot take arguments** (`daemon.py:880`), because the whole string is one argv. `shlex.split` would allow them and still use no shell.
8. **`slug_from_url` rejects several valid GitHub remotes** (`daemon.py:951`).
   - `https://user@github.com/…`, `ssh://git@ssh.github.com:443/…`, `git://` and `www.` all return an empty slug.
   - GitHub Enterprise hosts and clones of a fork, where the PR lives upstream, are not supported at all.
9. **Smaller points**
   - Each cycle spawns two `git` processes per workspace and one `herdr` process per pane. The origin slug could be cached per path, and the publishes batched over the API socket.
   - A big sidebar goes to GitHub as one unbounded request.
   - The `icons` parameter of `blocker_for`, and its default, only ever receive `STATE_NAMES`. The function could simply return the state name.
   - `states_of` relies on `decide` having mutated the pull requests first.
   - The log is only truncated at start.

## Behaviour

- **`CHANGES_REQUESTED` reads 🛑**, which means "cannot say why", although the reason is known. It deserves a state of its own, ranked next to ❌.
- **`BEHIND` reads ✅.** GitHub reports `BEHIND` only when the base branch requires up-to-date branches, so the merge button is actually disabled. A separate "update branch" state would be more honest. These two new states together need 17 colour rules, and herdr allows 16.
- **Sorting ignores 💬 and the sign-off.** 👀💬 sorts under "somebody else's turn" although you have threads to answer. `states.json` would need to store the conversation flag (`daemon.py:805`).
- **A failed hook drops the sign-off glyph at once.** A Jira timeout turns ✅🏁 into a bare ✅, which looks the same as "no sign-off needed". Either keep the last answer for one TTL or draw an "unknown" glyph.
- **Repositories on rulesets get no 💬 and no 🟡 for an unreported required check.** The README admits this. Rulesets are now GitHub's default, so querying them is worth the work.
- **Where the base branch has no protection, red CI reads 🆗**, because every check counts as optional. A setting that treats all checks as required in that case would help.
- **A workspace without a worktree uses its first pane's working directory for every pane.**
- **Jira example**
  - A ticket rejected as "Won't do" falls in Jira's `done` category and reads 🏁.
  - Hitting the page cap is silent.
  - Lines 118 and 123 print a Python list (`['…']`) in the error message.

## Tests

- Nothing covers `take_over_pidfile`, `drop_pidfile`, `gh_graphql`, `read_pairs`, `workspace_rows`, `publish`, the `main` dispatch, or either example hook. The Jira hook's three pure functions would be easy to test.
- There is no CI, although the README promises Python 3.9 and the tests have only run on 3.14. Add a GitHub Actions matrix over 3.9–3.14 on macOS and Linux. There are also no git tags for version 0.7.0.
- Nothing guards the README against drift. One test could check the README's codepoints and colour rules, and the defaults in `config.example.toml`, against `NERD` and `DEFAULT_*`.
- The test run prints log lines between the dots, and `GuardedCycle` swaps `daemon.cycle` by hand. `mock.patch` and `assertLogs`-style capture would fix both.
- Add fixtures for a fork PR, more than 100 contexts, and `CHANGES_REQUESTED`.

## README

- **Stale text**
  - Line 244 says "five columns"; there are six.
  - The header comments of both examples leave out `unsatisfied`.
  - The `parse_required` docstring says 2-tuple; it returns a 4-tuple.
  - The `verdict_for` docstring says "never wider than two"; with a sign-off it is three.
  - The `resolve` docstring and its log message leave out 🟠 and 💬.
- **Contradiction:** `config.example.toml`, the Jira example and the `parse_signoff` docstring all say a row the hook leaves out "keeps the glyph it has". It loses it.
- **Misplaced section:** lines 178–194, on re-runs and unreported checks, sit under "The 💬 modifier" but belong with the state mapping.
- **Missing**
  - How to apply a config change, since the daemon must be restarted.
  - How the hook's environment variables reach a daemon that herdr starts.
  - The `gh` token scopes the queries need.
  - A short troubleshooting section.
- The rationale outweighs the usage instructions. Moving it to a `DESIGN.md` would leave a README that installs and configures the plugin in one screen.

I would do Code items 1 and 2 first. Item 1 can kill an unrelated process, and item 2 puts a stranger's pull request on your row.