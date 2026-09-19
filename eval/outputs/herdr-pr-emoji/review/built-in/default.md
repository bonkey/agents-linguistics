# default / review

- project: `herdr-pr-emoji` at `81e8933`
- arm: `default`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 16  wall: 376s  api: 366s
- cost: $3.8626  output tokens: 29510  words: 1299

---

I reviewed the project and changed nothing. The decision logic is careful and well tested, and the 171 tests pass on Python 3.14 and on 3.9.6. The weak spots are the parts that touch the outside world, and a few cases where the row shows a confident glyph that isn't true. Items marked **confirmed** I reproduced, using mocks and temp dirs so nothing was written to the repo. The rest come from reading the code.

## Behaviour

1. **Fork PRs are matched (confirmed live).** `pullRequests(headRefName:)` at `daemon.py:594` ignores the head repository. On `cli/cli`, the three newest PRs for `trunk` are all cross-repository. A workspace on `main` or `patch-1` can therefore show a stranger's PR. Ask for `isCrossRepository` with `last: 5` and take the newest PR from this repository.
2. **A branch switch keeps the old branch's glyph (confirmed).** If the new branch is `UNKNOWN` or GitHub did not answer, `plan_publications` returns `None`, so the previous branch's ✅ stays for up to three intervals. `plan_states` does the same for `states.json`. Record `(slug, branch)` per workspace and clear the token when it changes.
3. **A hook that fails once drops the sign-off glyph at once.** `✅📭` becomes a bare `✅`, the very misreading the sign-off glyph exists to prevent.
   - Three places say the row keeps its glyph: `daemon.py:556`, `config.example.toml:31` and `examples/pr-signoff-jira:35`.
   - `README.md:236` says both things in one sentence.
   - Fix it by caching the last answer for the TTL window, or by drawing a "sign-off unknown" glyph.
4. **Config is read once at startup, but `--once` re-reads it.** After you edit `icons`, the refresh action publishes emoji and the daemon overwrites them with Octicons two minutes later. The README also says reload-config does not re-run startup hooks, so there is no documented way to apply a change. Re-read the config each cycle.
5. **An unknown flag starts a daemon (confirmed).** `daemon.py --help` and a typo such as `--onec` both fall through to daemon mode and take over the pidfile, which stops the daemon that was running. Reject unknown arguments.
6. **`take_over_pidfile` kills whatever process holds the recorded PID.** It sends TERM and then KILL without checking what the process is (`daemon.py:1302`). After a crash, a reboot or a SIGHUP (which is unhandled at `:1394`), the PID in a stale file can belong to an unrelated process. Use `flock`, or check the command line first.
7. **Design question on pending optional checks.** An optional check that failed reads 🆗, but one still running reads 🟡 (`:389`) and sorts under "CI's turn", even though GitHub would merge the PR. Either include `PENDING` in `required_targets` so the required checks decide, or document the asymmetry.
8. **Remote detection is narrow (confirmed).** Seven common URL forms return an empty slug:
   - `https://user@github.com/o/r.git`
   - `https://x-access-token:abc@github.com/o/r`
   - `git://github.com/o/r.git`
   - `ssh://git@github.com:22/o/r.git`
   - `git@github.com-work:o/r.git` (host aliases)
   - `git@GitHub.com:o/r.git`
   - `ssh://git@ssh.github.com:443/o/r.git`

   Only `origin` is read, so a fork workflow where the PR lives upstream always reads ❔.
9. **Every error path exits 0** (`:1372-1390`). A refresh action with no `gh`, or with herdr unreachable, looks like a success.

## Code

- **Null nodes cost the whole cycle (confirmed in three places).** `parse_lookup` at `:646`, `required_state` and `conversation_block` all raise `AttributeError` on a null node. That contradicts "failures are contained per branch".
- **`""` means two different things.** In `blocker_for` it means both "clear the row" and "leave it alone", and `decide` works out which at `:791`. Return `None` when there is no verdict.
- **Vestigial `icons` parameter.** `blocker_for` has one caller, and it passes `STATE_NAMES`. Make it `state_for(pr)` and drop the identity table.
- **The "pure decisions" section mutates its input.** `apply_marks` runs twice and `verdict_for` runs twice per PR. One pass that yields `(state, conversation, signoff)` would produce both the glyphs and the states.
- **Config parsing ignores valid TOML without saying so (confirmed).**
   - Single-quoted strings, wrong case and unknown values are silently ignored.
   - Keys inside any `[table]` are matched.
   - The interval has no upper bound.
   - Only the floor on the interval is logged.
   - Use `tomllib` where available, log every rejected value, and carry one `Config` tuple instead of two tuples passed through five signatures.
- **Startup log line (confirmed).** It prints `unstable=\uf42e`, the glyph rather than the setting, and omits the icon set (`:1396`).
- **Temp file collision.** `save_states` uses a fixed `.tmp` name (`:1108`), so the daemon and the refresh action can write the same temp file at once.
- **Timeouts leave grandchildren running (confirmed).** Start the child with `start_new_session=True` and kill the whole process group.
- **Silent truncation of checks.** `contexts(first: 100)` truncates silently. The limit on threads is documented, the limit on checks is not.
- **Log rotation.** The log is truncated to zero, and only at startup.
- **Examples:**
   - Both headers and `README.md:244` say five columns, but there are six.
   - The static hook's `IFS=tab read` collapses an empty column (confirmed: `review` came back as `CLEAN`). That is worth a comment in a file people will copy.
   - The Jira `fail()` prints a list, as `['msg']`, at `:118` and `:123`.
   - Its header says one request a cycle, but `/myself` makes it at least two.
   - Its worst case is 75 s against the daemon's 20 s default timeout.
   - `--fail-with-body` needs curl ≥ 7.76.

## Tests

- **Gaps in coverage.** The code that talks to herdr, `gh` and the filesystem is mostly untested:
   - `cycle`, `publish` and `workspace_rows`
   - `gh_graphql`, `run`, `read_pairs` and `--query`
   - argument dispatch and the pidfile functions
- **One cheap test covers most of that gap.** `SortEndToEnd` already stubs herdr and records refused calls. Add a stub `gh` serving the fixtures and you have an end-to-end `--once` test.
- **Add a regression test for each confirmed bug above.**
- **A test that does not test the README.** `test_the_whole_order_is_what_the_readme_says` (`:1350`) compares `SORT_ORDER` with itself. I ran a real check against the README and the manifest: all three tables, the 15 colour rules and the manifest legend agree with the code today. Keep that as a test, because the glyph tables are maintained by hand in five places.
- **Test the examples.** Feed the static one `signoff_input` output, and load the Jira one with `importlib` to test its three pure functions.
- **Hygiene:**
   - The test output carries five log lines of noise.
   - `GuardedCycle` swaps `daemon.cycle` by hand and passes `"pass"` as the icons (`:1205`).
   - `__import__("shutil")` is inlined at `:920` and `:1452`.
   - `PAIR` at `:943` looks like a leftover internal name.
- **No CI and no tags, though the manifest says 0.7.0.** Run the tests on Python 3.9 and the latest release, on Ubuntu and macOS, and tag releases.

## README

- **Nerd Font.** Install never says the default glyphs need a Nerd Font. The first mention is at line 259, and the title, tagline and sample line all use emoji.
- **Misplaced paragraphs.** Lines 178–194, about re-runs, the rollup and expected contexts, sit under "The 💬 modifier" and belong in the state mapping.
- **Order.** About 140 lines of rationale come before Configuration. Put the reference first and move the rationale to a "Design notes" section. It also duplicates the docstrings nearly word for word.
- **Missing sections.**
   - Troubleshooting: the log path, `gh auth status`, the PATH of a herdr-launched process, the Nerd Font, `--once`.
   - How to apply a config change.
   - Limits: github.com only, `origin` only, 100 checks.
- **Sample line.** Line 8 still shows what look like real branch names (`ios-27-siri-ai-intents`, `apple-ads-interface`), although commit a5cc614 generalised the others.
- **Manifest.** Its `description` is a ~700-character legend. One sentence would do.

**Suggested order:** behaviour items 1–3 first, since those are wrong glyphs. Then 5 and 6, which are destructive. After that the null-node guards, the end-to-end `--once` test with CI, and the README install and troubleshooting sections.