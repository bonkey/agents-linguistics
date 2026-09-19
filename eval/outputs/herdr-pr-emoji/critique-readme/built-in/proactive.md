# proactive / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `proactive`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 12  wall: 261s  api: 253s
- cost: $2.481  output tokens: 20787  words: 1780

---

The README has six statements that contradict the code, eight things a first-time contributor needs that it never says, and seven places that are hard to follow. I checked each claim against `daemon.py`, `herdr-plugin.toml`, `config.example.toml`, both hooks in `examples/` and the tests. The test suite (171 tests) passes on Python 3.14.7 and on 3.9.6, so the "Python 3.9 or newer" line holds. I changed no files.

## Wrong or stale

1. **`README.md:31-34` – `refresh` is offered as an alternative to restarting herdr.**
   - The action runs `daemon.py --once`: one cycle, then it exits.
   - Published values expire after three intervals (`daemon.py:1029`). The glyphs appear, vanish about six minutes later, and nothing is polling.
   - Proposed text: *"…so restart herdr after installing. `herdr plugin action invoke bonkey.pr-emoji.refresh` runs one cycle without a restart, but what it publishes expires after three intervals unless the daemon is running."*

2. **`README.md:244` – "five columns of GitHub's own answer".**
   - There are six: `unsatisfied` was added (`daemon.py:522`).
   - The header comments of both `examples/pr-signoff-*` also list five. The Jira hook reads the sixth at line 235.
   - Edit: "six columns", and add `<TAB>unsatisfied` to both example headers.

3. **`README.md:236` – "Every kind of silence keeps the row where it is".**
   - The next sentence, which says silence costs the third glyph, is what the code does. An unanswered row is republished without the sign-off glyph on that same cycle (`decide` sets `signoff = ""`; `test_a_row_the_hook_left_out_grows_no_glyph`).
   - Replace it with: *"Every kind of silence costs the third glyph and nothing else: the row is republished with its pull request state alone."*
   - `config.example.toml:33` ("keeps the glyph it has") and `examples/pr-signoff-jira:35` ("…until its TTL runs out") are wrong in the same way.

4. **`README.md:289` – "The prose below and the table above name the emoji throughout".**
   - At this point nearly all of the prose is above. This looks like a leftover from a section move.
   - Replace it with "This README names the emoji throughout…", and move it to just before "State mapping", where a reader first meets the two-column table.

5. **`README.md:296-297` and `:330` – the colour rules are said to be "in the order of the table above" and "ordered the way `blocker_for` decides".**
   - They are not. The block starts at draft and ends with merged, closed and no pull request. The table and `blocker_for` start with those three.
   - This is harmless, because a value carries exactly one state glyph.
   - Proposed text: *"Order matters in one place only: the 💬 rule goes last, so the glyph on its left wins the colour."*

6. **`README.md:429-436` – "launch the loop by hand" is followed by five commands, none of which launches the loop.**
   - The loop is `python3 daemon.py` with no arguments.
   - It prints nothing, because it redirects its output to `daemon.log` (`daemon.py:1392`). It also stops the daemon whose pid is in the pid file.
   - Add these two lines:

         python3 daemon.py &     # the loop; silent, logs to daemon.log, replaces the running daemon
         tail -f ~/.local/state/herdr/plugins/bonkey.pr-emoji/daemon.log

## Missing

7. **Install never says that a Nerd Font is needed.**
   - The default is `icons = "nerd"` (`daemon.py:134`), while the README's example line shows emoji.
   - The only statement that a Nerd Font is required is in `config.example.toml:14`. A first install without one draws empty boxes.
   - Add to the requirements: *"macOS or Linux, and a Nerd Font in the terminal. Without one, set `icons = "emoji"` in the [plugin's config](#configuration) to get the emoji shown here."*

8. **The README does not say the plugin's config is read once, at startup, by a regex parser.**
   - `main()` reads the config at start and never again, and the README does not say how to apply a change.
   - `refresh` re-reads the config. So after an edit it shows the new glyphs, and the running daemon overwrites them on its next cycle.
   - The parser is a regular expression, not a TOML parser (`daemon.py:233-250`). It takes double-quoted strings only, and an unrecognised value silently falls back to the default.
   - Add: *"Read once when the daemon starts. After editing, restart herdr, or run `python3 daemon.py &` from the plugin directory, which replaces the running daemon. Values must be double-quoted; an unrecognised one silently falls back to its default."*

9. **`signoffCommand` must be a bare path, which the README does not make plain.**
   - "One argv with no shell" is accurate, but a newcomer will not read it as "no arguments". The code is `run([command])`.
   - `~` is expanded and `$VARS` are not.
   - Add: *"It is the path of one executable: no arguments, no shell, `~` expanded and nothing else. For arguments or environment, point it at a wrapper script."*

10. **The README does not say where the Jira hook's environment variables go.**
    - The hook inherits the environment of the daemon that herdr starts, so the `SIGNOFF_JIRA_*` variables have to be set in herdr's environment.
    - The README only shows `STATE=open python3 daemon.py --once`, which sets a variable for a hand-run cycle.
    - Add a wrapper example:

          #!/bin/sh
          export SIGNOFF_JIRA_URL=… SIGNOFF_JIRA_TOKEN_CMD='op read op://…'
          exec /path/to/examples/pr-signoff-jira

11. **The sign-off table (`:203-208`) omits the words the hook must answer.**
    - Which of `not_required|missing|open|done` draws which glyph is given only in `config.example.toml`.
    - Add an "Answer" column.

12. **Three limitations are not stated.** Add them as bullets under "Non-goals":
    - Only `github.com` remotes are recognised (`slug_from_url`). A GitHub Enterprise remote shows nothing.
    - Only `origin` is read, and the pull request is looked up in that repository. In a fork workflow (`origin` is the fork, the pull request is upstream) the row reads ❔ for good.
    - Only the first 100 check contexts are read (`contexts(first: 100)`). The README mentions the 100 cap for threads only.

13. **There is no troubleshooting section.** Add one covering "nothing shows up":
    - Check the font, `gh auth status`, `daemon.log`, and whether the pid in `daemon.pid` is alive.
    - "gh is required; not starting" is logged before output is redirected to the log file (`daemon.py:1372` comes before `:1392`). That message never reaches `daemon.log`, which is the first place a user will look.

14. **"Development" does not tell a contributor how to work in the repository.** It shows how to run and test, and leaves out the following:
    - **Layout.** Everything is in `daemon.py`, in three sections: pure decisions, the world, the sort. The tests are in `test_daemon.py`.
    - **Recording a fixture.** I checked that the query builder runs on its own and that fixtures are the raw `{"data": …}` response:

          gh api graphql -f query="$(python3 -c 'import daemon; print(daemon.lookup_query([("owner/name", "branch")]))')" > fixtures/lookup_new.json

    - **Where a glyph lives.** About ten places:
      - `EMOJI`, `NERD` and `SORT_ORDER` in `daemon.py`
      - the README's state table, icon table, colour rules and sort table
      - `config.example.toml`
      - `description` in `herdr-plugin.toml`
      - the headers of both examples
      
      No test ties any of these together. `test_the_whole_order_is_what_the_readme_says` only compares `SORT_ORDER` with itself. Commits 3c4cf89, 4981858 and a5cc614 were each a sweep of this kind.
    - **Code conventions.** Standard library only and 3.9-compatible, so no `tomllib`; `%`-formatting throughout; no CI, so run the tests under `/usr/bin/python3` as well.
    - **Versioning.** The manifest says `0.7.0` and there are no tags or changelog. The README should say whether a pull request bumps the version.

## Unclear

15. **Two different files are both called `config.toml`.**
    - `:17` and `:37` mean herdr's own file.
    - `:412` means the plugin's file.
    - `unstable = "pass"` at `:72` and `icons = "emoji"` at `:262` do not say which file they belong in.
    - Write "herdr's own `config.toml`" and "the plugin's `config.toml`", and link the second to #configuration.

16. **Terms are used long before they are defined.**
    - "The second request" appears at `:113`, `:165`, `:189` and `:230`, and is defined at `:382`.
    - "The TTL of three intervals" appears at `:84`, and is defined at `:391`.
    - Either move "How it polls" to follow Install, or put three sentences under the state table. They should define:
      - the lookup
      - the second request, and which pull requests it covers
      - the TTL

17. **`:178-194` sit in the wrong section.**
    - These paragraphs cover re-runs, `statusCheckRollup.state` and unreported required contexts. They are about ❌ and 🟡, but they close "The 💬 modifier".
    - Move them up to follow the 🟠 paragraph (`:103-106`).
    - Rewrite `:179-180`, where "either" refers to nothing: *"A missing review can also arrive as a required check run concluding `ACTION_REQUIRED`; that is a missing review, not a failed check, so it never reads ❌."*

18. **"Blocker" is used for the main state glyph even when the state is ✅ or 🟣** (`:201`, `:298`). Define the term once (it comes from `blocker_for`), or say "state glyph".

19. **💬 is absent from the state table, although a lone 💬 replaces 🛑.**
    - Add to the `BLOCKED` row: "🛑, or 💬 where open conversations are the reason — see below."
    - Add one line to "Sorting": a 💬 that joins another glyph does not change the rank, so 👀💬 sorts as 👀 (`states_of` uses `verdict_for(pr)[0]`).

20. **herdr's vocabulary is never defined or linked.**
    - The undefined terms are workspace, space, pane, agent row, worktree group, parent and token.
    - `mergr` has no link.
    - The example line at `:8` has no caption, and `bonkey/purchase-to-unlock` reads as `owner/repo` when it is a branch.
    - Add a one-line glossary and a caption.

21. **Four things about running the daemon by hand are left open.**
    - `:435` says `--sort` needs `HERDR_SOCKET_PATH`, but not where a shell gets it. The code only says "run this under herdr".
    - `HERDR_BIN_PATH` is honoured (`daemon.py:33`) and is not documented.
    - `--query` and `--resolve` print the configured icon set. By default that is private-use codepoints, which show as blanks. Say to set `icons = "emoji"` first.
    - The README does not say what `herdr plugin link` does when the same plugin id is already installed from GitHub. I could not tell from the repository either.

## Minor

- The sort table (`:342-346`) uses its first data row as the header, so the "First" row renders as the table's header rather than as data.
- The colour rules are shown for `[ui.sidebar.spaces]` only; `[ui.sidebar.agents]` needs its own copy.
- There is no screenshot, and the default Nerd Font look cannot be shown as text on a page.
- The `verdict_for` docstring in `daemon.py` says the token "is never wider than two", which the sign-off glyph made stale. That one is in the code, not the README.

If you want these applied, do the six "Wrong" items and item 7 first. They are one-line edits, and they are the ones that mislead someone on their first install.