# i-have-adhd / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `i-have-adhd`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 12  wall: 200s  api: 195s
- cost: $2.044  output tokens: 15768  words: 1259

---

Fix these three first. They are the ones a new reader hits in the first ten minutes.
- `README.md:14`: add the Nerd Font requirement.
- `README.md:31`: say that `refresh` does not start the loop.
- `README.md:244`: change `five columns` to `six`.

No files were modified. `python3 -m unittest` passes (171 tests, 0.8 s, Python 3.14). I checked every claim below against `daemon.py`.

## Wrong (about 15 minutes to fix all five)

1. **`README.md:244` says "five columns"; there are six.** Commit `65f1e99` added `unsatisfied` without updating the count. Both files in `examples/` also describe a five-column stdin in their line-7 comments, although `pr-signoff-jira:235` reads `parts[5]`. Edit: `five` → `six`, and append `<TAB>unsatisfied` to both example headers.

2. **`README.md:31-34` and `:429-436` imply that `refresh`/`--once` starts the daemon.** It runs one cycle and exits, so the emoji expires after 3 × 120 s = 6 minutes. The Development section says "launch the loop by hand", but the command block below it never shows the loop command.
   - Edit at `:31`: "…so restart herdr once after installing. To see an emoji before that, run one cycle by hand. It publishes once and expires after three intervals; it does not start the loop:"
   - Edit at `:432`: add the line `python3 daemon.py   # the loop itself: replaces the server's copy, writes to daemon.log, prints nothing`.

3. **`README.md:296-297` ("in the order of the table above") and `:330-331` ("ordered the way `blocker_for` decides") are both false.**
   - The rule block starts at draft and ends with merged, closed and no-PR. The table and `blocker_for` start with those three.
   - The order of the blocker rules cannot matter anyway, because a value holds exactly one blocker glyph. The only constraint is that the 💬 rule comes last.
   - Edit: replace both sentences with "A value holds one blocker glyph, so the order of the blocker rules decides nothing. Only 💬 has a place: last, so that in 👀💬 the blocker colours the cell."

4. **`README.md:178-194` is filed under the wrong heading.** Three paragraphs sit under "The 💬 modifier" but explain ❌ and 🟡: re-run attempts, the rollup turning `FAILURE`, and unreported contexts. Edit: move them to "State mapping", after the 🟠 paragraph at `:106`.

5. **`README.md:289` says "the prose below and the table above name the emoji"**, but nearly all of the emoji prose is above it (`:53-255`). Edit: change it to "This README names the emoji throughout…" and move the sentence up to follow line 8. It is also the only place that explains why the hero line shows emoji when the default icon set is not emoji.

## Missing (about 30 minutes)

1. **The Nerd Font requirement is not in Install.** The default is `icons = "nerd"` (`daemon.py:134`), and only `config.example.toml:13` mentions the font, so a fresh install without one likely renders empty boxes. Edit at `:14`: "…git, an authenticated `gh`, and a Nerd Font in the terminal, or `icons = "emoji"` in the [configuration](#configuration), which needs no font."

2. **The README does not say that config changes need a daemon restart.**
   - `main()` reads `config.toml` once, before the loop (`daemon.py:1363`).
   - `refresh` re-reads it, so new icons show for one cycle and then the loop redraws the old ones.
   - The config is parsed by regex, not as TOML: one setting per line, double quotes only.
   - Edit under Configuration: "Read once, when the daemon starts. After an edit restart herdr, or run `python3 daemon.py` by hand, which replaces the running copy."

3. **The README does not say that `signoffCommand` takes no arguments.**
   - `daemon.py:880` runs `[command]`, so `"~/bin/hook --team x"` exits 127.
   - "One argv with no shell" does not tell a newcomer this.
   - The README also does not say where the `SIGNOFF_JIRA_*` variables get set for a daemon that herdr starts.
   - Edit: "The path of one executable: `~` is expanded, arguments and `$VARS` are not. Wrap anything more in a script, which is also where the hook's environment variables go."

4. **Forks and GitHub Enterprise are not mentioned.**
   - `github_slug` reads only `origin` and accepts only `github.com` (`daemon.py:945-962`).
   - A contributor working from a fork has `origin` pointing at the fork while the pull request lives upstream, so their row reads ❔.
   - Edit in Non-goals: "Only the `origin` remote is read, and only on github.com: a GitHub Enterprise host reads empty, and a fork checkout whose pull request lives upstream reads ❔."
   - Edit at `:76`: tighten "a remote that is not GitHub" to "an `origin` that is not on github.com".

5. **There is no Contributing section.** The repo has no CI, no `CONTRIBUTING`, no tags and no changelog. Edit: add this section:
   > ## Contributing
   > `daemon.py` must run on Python 3.9: no `tomllib`, `match` or `X | Y`. Decisions are pure functions above the `# the world` line; add a test to the matching class in `test_daemon.py`. Fixtures are real responses with owners, repositories, branches, numbers and check names replaced, so never commit one unscrubbed. There is no CI, so run `python3 -m unittest` and say in the pull request that it passed. *(Maintainer to fill in: when to bump `version` in `herdr-plugin.toml`, and which formatter.)*

## Unclear (about 30-45 minutes; item 2 is the large one)

1. **`mergr` (`:4`, `:376`) is never linked or explained.** Edit: add a link, or "`mergr`, the plugin this one replaces".

2. **Several terms are used before they are defined.**
   - "The second request" appears at `:113`, `:190` and `:230` but is defined at `:382`.
   - "TTL of three intervals" appears at `:84` but is defined at `:391`.
   - "Blocker", "verdict", "token" and "row" are never defined.
   - `blocker_for` (`:330`) appears with no file name.
   - Edit: move "How it polls" above "State mapping", or add a five-line Terms list after Install. The list would cover row and token, blocker (the first glyph), verdict (blocker plus 💬), first and second request, and TTL.

3. **The two layout examples disagree.** Install (`:25-29`) puts `$pr_emoji` on row 2 after `git_status`. The colour block (`:302-322`) moves it to row 1 and covers only `spaces`. A reader cannot tell whether `rules` needs that position. Edit: keep the Install layout in the colour block, and add "the same `rules` array works in `[ui.sidebar.agents]`".

4. **One thing has four names:** the repo `herdr-pr-emoji`, the install slug `bonkey/herdr-pr-emoji`, the plugin id `bonkey.pr-emoji` and the token `$pr_emoji`. Edit: add one line in Install naming which is which.

5. **The development commands (`:432-442`) assume knowledge a newcomer lacks.**
   - `--sort` "needs HERDR_SOCKET_PATH", but nothing says where the value comes from.
   - `--once` logs to the terminal while the bare loop logs to `daemon.log`, and neither is stated.
   - The `STATE=open` line only works after `signoffCommand` points at `examples/pr-signoff-static`, which is mentioned only in passing.
   - Edit: turn the block into numbered steps: set `signoffCommand`, run `STATE=open … --once`, then look at the sidebar.

## Smaller items

1. `:8`: the hero line still carries personal branch names (`bonkey/apple-ads-interface`). Commit `a5cc614` generalised the others to `TASK-nnn`.
2. `:342`: the sort table uses its first data row as the header, so "First" renders bold. Edit: add a real header row, `| Order | States | Your move |`.
3. `:232-234`: "because a draft swallows…" explains only the draft, not merged, closed or no-PR. There is also a stray mid-sentence line break at `:231-232`.
4. `:14`: the `gh` scopes are unstated. `repo` is likely needed for private repositories and for reading branch protection, which would explain the 🛑 fallbacks at `:171-173`.

Next: tell me to apply "Wrong 1-5" and I will make those edits.