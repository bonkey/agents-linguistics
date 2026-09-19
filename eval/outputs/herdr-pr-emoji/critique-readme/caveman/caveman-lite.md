# caveman-lite / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-lite`  prompt: `critique-readme`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 15  wall: 193s  api: 188s
- cost: $2.0904  output tokens: 15696  words: 1301

---

I reviewed `README.md` against `daemon.py`, `herdr-plugin.toml`, `config.example.toml` and `examples/`, and changed no files. `python3 -m unittest` passes (171 tests). I did not check the herdr-side claims: the `≥ 0.8.2` floor, the sixteen-rule limit, reload-config not running startup hooks. I also did not test the Python 3.9 floor; the local Python is 3.14.7.

## Wrong

1. **`README.md:244` says "five columns".** Stdin carries six (`README.md:213`, `daemon.py:522`). Replace with: "it has a path, a timeout and the columns above".

2. **`README.md:31-34` presents `refresh` as an alternative to a restart.** `refresh` runs `daemon.py --once` (`herdr-plugin.toml:22`): one cycle, no loop, no pid file. The token TTL is 3 × interval, so the glyphs vanish after 6 minutes. Replace with:
   > The daemon starts with the herdr server (`[[startup]]`), so restart herdr after installing. To see a glyph before that, run one cycle by hand. This does not start the loop, and its glyphs expire after three intervals (6 minutes by default):

3. **`README.md:3` and `:8` say "one emoji per sidebar row".** The default is Octicons, and a token can be three glyphs wide. The hero line shows something a default install never draws. Replace with: "as one glyph per sidebar row — Octicons from a Nerd Font by default, emoji with `icons = "emoji"`. A 💬 and an optional sign-off glyph can ride behind it."

4. **`README.md:14` omits the Nerd Font from the requirements.** It is the default, and only `config.example.toml:13` mentions it, so a new user sees empty boxes. Add: "a Nerd Font as the terminal font, or `icons = "emoji"` in the plugin's config; macOS or Linux" (`herdr-plugin.toml:6`).

5. **`README.md:97` says "the last two fall through to ✅".** `UNSTABLE` reads 🆗 by default (`daemon.py:397`). Replace with: "fall through to ✅ or 🆗".

6. **`README.md:289` says "The prose below and the table above".** Most of the emoji prose is above that point. Replace with: "The rest of this README names the emoji, because…".

7. **`README.md:296` and `:330` say the colour rules follow "the order of the table above" and "the way `blocker_for` decides".**
   - The block puts merged, closed and no-PR last; `blocker_for` decides them first (`daemon.py:369-377`).
   - The order among blocker rules does not matter, because a value holds one blocker glyph.
   - Replace with: "A value holds exactly one blocker glyph, so the order of the first fourteen rules does not matter. The 💬 rule must stay last, so that it colours only a 💬 standing alone."

## Missing

8. **How the config is loaded.**
   - It is read once at start (`daemon.py:1363`), so a change needs a daemon restart.
   - It is parsed by regex, not as TOML (`daemon.py:233-249`): only top-level keys and double-quoted strings work.
   - An invalid value silently falls back to the default.
   - Add all three points to Configuration.

9. **How environment variables reach the sign-off hook.** `README.md:439` says the hook inherits the daemon's environment, but only under Development. Add to the sign-off section:
   > The command inherits the daemon's environment, which is the herdr server's. Export `SIGNOFF_JIRA_*` there, or point `signoffCommand` at a wrapper script that sets them.

10. **Limits.**
    - Only `github.com` remotes are recognised (`daemon.py:953`), so GitHub Enterprise Server is not supported.
    - Only `origin` is read, so a fork checkout whose PR lives upstream reads ❔.
    - A detached HEAD shows nothing.
    - The `gh` token needs the `repo` scope, plus SAML authorisation where the organisation requires it.
    - Add a "Limits" list covering these.

11. **Troubleshooting.** Failures are silent. A missing `gh` exits 0 with one stderr line (`daemon.py:1372-1374`), before the log redirect, so the line never reaches `daemon.log`. `--once` and both sorts also log to stderr only. Add a short checklist:
    - the token is rendered in herdr's `config.toml`
    - a Nerd Font is the terminal font
    - `gh auth status` succeeds
    - `daemon.pid` names a live process
    - `daemon.log` shows cycles running
    - the remote is `origin` on github.com

12. **Contributor workflow.** Add these to Development:
    - Tests run in under a second. One prints `signoffCommand exited 124: timed out after 20s`; that is expected, not a failure.
    - There is no CI, so run the tests before opening a PR.
    - Adding a state touches `EMOJI`, `NERD`, `SORT_ORDER`, `blocker_for`, the tests, three README tables, the colour rules, the `herdr-plugin.toml` description and `config.example.toml`.
    - Explain how to record a fixture and scrub private names from it.
    - The code is standard library only with a 3.9 floor: no `tomllib`, no `match`.
    - Say when to bump the version in `herdr-plugin.toml`.
    - `--query` prints private-use glyphs unless `icons = "emoji"`.

## Unclear

13. **There are two files called `config.toml`.** `README.md:17` and `:37` mean herdr's; `:412` means the plugin's. Name them "herdr's `config.toml`" and "the plugin's `config.toml`" throughout. Add to Configuration: "This is not herdr's own `config.toml`, where the sidebar rows and key bindings live."

14. **`README.md:211` says "one argv with no shell".** The daemon runs `[command]` (`daemon.py:880`), so the string is one executable path. Replace with:
    > `signoffCommand` is the path of one executable. The plugin does not split it, so it takes no arguments; `~` is expanded. Wrap anything more in a script.

15. **The TTL and the second request are used before they are defined.** "TTL of three intervals" appears at `:84`, and "the second request" at `:113`, `:164` and `:189`. "How it polls" defines both at `:370`. Either move "How it polls" to follow Install, or open State mapping with:
    > Each cycle makes two GraphQL requests: a lookup for every branch, and a second one for the required checks and review threads of pull requests that fail or are `BLOCKED`. Every token is published with a TTL of three intervals.

16. **`CHANGES_REQUESTED` is never mentioned.** By code it reads 🛑, or 💬 where threads are open. The 🛑 example "a base branch that asks for no reviews at all" (`:100`) does not explain what blocks the merge. Add:
    > `CHANGES_REQUESTED` has no glyph of its own: GitHub reports it as `BLOCKED`, so it reads 🛑, or 💬 where threads are open and the base branch requires them resolved.

    Drop or reword the "no reviews" clause.

17. **"repository", "group", "worktree group" and "parent" are used as one term** (`:36`, `:338`, `:350`, `:352`). Use "worktree group" everywhere and define it once: "A worktree group is a repository's main checkout (the parent) and its linked worktrees, which herdr keeps together in the sidebar."

18. **The colour snippet at `:302` redefines `[ui.sidebar.spaces]`.** It puts the token in a different row than Install does (`:28`), so pasting both gives a duplicate table. The agents row also gets no colour. Add: "This replaces the `[ui.sidebar.spaces]` block from Install. Add the same `rules` to the token in `[ui.sidebar.agents]`."

19. **`mergr` at `README.md:4` has no link or explanation.** Link it, or write "(an earlier herdr plugin)".

20. **The sort table at `:342` uses its first data row as the header.** Add a real header: `| Order | States | What to do |`.

## Structure

21. **`README.md:178-194` sits under "The 💬 modifier" but is about ❌ and 🟡.** The three paragraphs cover re-run attempts, rollup `FAILURE` and unreported contexts. Move them into State mapping, after `:106`.

22. **Development starts at line 424 of 461.** About half the file is design rationale. Keep Install, the tables, Configuration and Development in the README, and move the rationale to `DESIGN.md`. The State mapping and Two icon sets tables duplicate the Nerd Font column, so keep it in one.

23. **The hero line at `:8` still carries `bonkey/…` branch names.** Commit a5cc614 generalised only the sort example. Use `feature/login` and similar.

## Related drift outside the README

- `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` omit the `unsatisfied` column from their header comments.
- The `verdict_for` docstring (`daemon.py:457-458`) says the token is "never wider than two". With a sign-off glyph it can be three.