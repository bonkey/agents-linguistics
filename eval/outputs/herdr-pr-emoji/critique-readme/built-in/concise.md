# concise / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `concise`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 15  wall: 149s  api: 145s
- cost: $1.9037  output tokens: 11529  words: 1179

---

I found 3 statements in `README.md` that contradict the code, 9 things a first-time contributor needs that are missing, and 5 unclear spots. Nothing was modified. I checked the README against `daemon.py`, `config.example.toml`, `herdr-plugin.toml`, `examples/` and the local `herdr` CLI. `python3 -m unittest` passes (171 tests).

## Wrong

1. **`README.md:31-34`: `refresh` does not start the daemon.** The action runs `daemon.py --once` (`daemon.py:1387`). That is one cycle, published with a TTL of three intervals, so the emoji appear and then vanish after about 6 minutes. Replace with:
   > The loop starts only with the herdr server (`[[startup]]`), so restart herdr after installing. `herdr plugin action invoke bonkey.pr-emoji.refresh` runs a single cycle. It is useful to confirm the wiring, but its emoji expire after three intervals unless the daemon is running.

2. **`README.md:244`: "five columns of GitHub's own answer".** The hook's stdin has six columns (`daemon.py:522`), because `unsatisfied` was added later. Change "five" to "six". The header comments in both `examples/pr-signoff-*` also list five columns and omit `unsatisfied`.

3. **`README.md:296-297` and `:330-331`: the stated order of the colour rules.** The README says the rules are "in the order of the table above" and "ordered the way `blocker_for` decides". Neither is true. The TOML block starts at draft and puts merged, closed and no-PR near the end. Both the table and `blocker_for` start with no-PR, merged and closed. Either reorder the block or replace both claims with:
   > Only one ordering matters: 💬 last, so the blocker beside it colours the cell. Every value carries exactly one blocker glyph, so the other rules can go in any order.

## Missing

4. **Nerd Font requirement (`README.md:14`).** The default is `icons = "nerd"`, but the intro shows emoji and the requirements never mention a font. A new user sees empty boxes. Add to the requirements line:
   > The default icon set needs a Nerd Font as the terminal font. Set `icons = "emoji"` otherwise (see [Configuration](#configuration)).
   
   Also add "macOS or Linux", which `herdr-plugin.toml:6` declares, and "`gh auth status` must pass for github.com".

5. **How to create the config file.** The README says only "See `config.example.toml`", and an installed user does not know where the plugin tree lives. Add:
   > `mkdir -p "$(herdr plugin config-dir bonkey.pr-emoji)"`, then copy `config.example.toml` from the repository into that directory as `config.toml`.

6. **The config is read once at startup (`daemon.py:1363`).** The README does not say how a change takes effect. It is worse than it looks: `refresh` re-reads the config but the running loop does not, so after switching `icons` the row alternates between the two sets. Add under Configuration:
   > The daemon reads `config.toml` when it starts. After editing it, restart herdr, or launch `python3 daemon.py` by hand from the plugin directory so that it replaces the running daemon.

7. **`signoffCommand` is a single executable path with no arguments.** It runs as `run([command])` (`daemon.py:880`), so `"python3 ~/bin/hook.py"` fails with exit 127. "One argv with no shell" at `README.md:211` does not make that clear. Add:
   > The value is the path of one executable. It takes no arguments and no `$VARS`; only `~` is expanded. Wrap anything else in a script.
   
   Add these too:
   - The answer must be exactly three tab-separated fields, with slug and branch echoed verbatim (`daemon.py:564`).
   - The hook is not run in a cycle that has no open, undrafted PR.
   - Settings are matched by regex, not parsed as TOML, so they need double quotes and one setting per line (`daemon.py:233-272`).

8. **Environment variables for the Jira example.** It needs `SIGNOFF_JIRA_*`, and the daemon inherits the herdr server's environment. The README never says how to set them. Add a wrapper snippet:
   ```sh
   #!/bin/sh
   export SIGNOFF_JIRA_URL=… SIGNOFF_JIRA_JQL=… SIGNOFF_JIRA_EMAIL=… SIGNOFF_JIRA_TOKEN_CMD=…
   exec /path/to/examples/pr-signoff-jira
   ```

9. **A Limitations section.** These all come from the code and none are stated together:
   - Only github.com remotes work; there is no GitHub Enterprise Server support (`slug_from_url`, `daemon.py:953`).
   - Only the `origin` remote is read. In a fork clone, the PR lives in the upstream repository, so the row reads ❔.
   - The lookup matches on `headRefName` alone, so a PR from someone else's fork with the same branch name can match.
   - Only the first 100 check contexts are read (`daemon.py:714`). The README mentions the 100-thread limit but not this one.

10. **Troubleshooting.** Add a short checklist for "nothing shows":
    - the token is present in `[ui.sidebar.*]`;
    - `gh auth status` passes;
    - a Nerd Font is set, or `icons = "emoji"`;
    - `daemon.log` has no errors (a missing `gh` logs "gh is required; not starting" and the daemon exits 0);
    - `python3 daemon.py --once` runs cleanly.

11. **Contributor basics.** The Development section stops at "run the tests". Add:
    - A checklist for adding a state. The places to touch are:
      - `EMOJI`, `NERD`, `SORT_ORDER` and `blocker_for` in `daemon.py`;
      - both README tables, the colour rules and the sort table;
      - the `description` in `herdr-plugin.toml`;
      - `config.example.toml`;
      - the example headers.
      
      The fifth column already went stale in this way.
    - How the fixtures were recorded, which is `gh api graphql -f query=…` with `lookup_query`/`required_query`, and which fields were edited by hand (`test_daemon.py:4-24`).
    - When to bump `version` in `herdr-plugin.toml`.
    - The constraint that the code uses only the standard library and must run on Python 3.9.
    - How to run one test class: `python3 -m unittest test_daemon.EmojiPrecedence`.

12. **Upgrade and uninstall.** `herdr plugin uninstall` exists. Note that the config and state directories survive it, and tell users to restart herdr after an upgrade so the new daemon starts.

## Unclear

13. **`README.md:4`, `:376`: `mergr` is never explained or linked.** Add a link, or "(another herdr PR-status plugin)".

14. **`README.md:178-194` is in the wrong section.** The three paragraphs on re-run attempts, `statusCheckRollup.state` and unreported contexts are about ❌ and 🟡, but they sit under "The 💬 modifier". Move them into State mapping, after the 🟠 paragraph at `:106`.

15. **`README.md:19-29` and `:302-322` place the token differently.** The Install snippet puts `$pr_emoji` in the second row of `[ui.sidebar.spaces]`. The colour snippet puts it in the first row and drops `[ui.sidebar.agents]`. Make the placement the same, and add: "repeat the `rules` on the agents row if you render the token there."

16. **`README.md:289`: "The prose below and the table above"** points the wrong way, because most of the emoji prose comes before it. Change it to "This README names the emoji throughout…".

17. **Development commands (`README.md:433-435`).**
    - `--query` prints the configured icon set, which is private-use glyphs by default. Add "set `icons = "emoji"` to read the output outside a Nerd Font terminal".
    - "Needs `HERDR_SOCKET_PATH`" does not say where that variable comes from. Add "herdr sets it for plugin commands, so invoke the sort through `herdr plugin action invoke`, or export the variable yourself".

Two smaller points:

- `README.md:8` still uses `bonkey/…` branch names, although a5cc614 generalised the other examples.
- `README.md:412`, `:420` and `:422` are unwrapped single lines in a file otherwise wrapped at about 92 columns.

Outside the README, the `verdict_for` docstring (`daemon.py:457-458`) still says the token "is never wider than two". That predates the sign-off glyph and contradicts `README.md:147-148`.