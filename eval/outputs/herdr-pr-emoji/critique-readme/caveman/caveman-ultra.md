# caveman-ultra / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-ultra`  prompt: `critique-readme`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 14  wall: 177s  api: 170s
- cost: $2.0647  output tokens: 13386  words: 1283

---

No files changed. I checked the README against `daemon.py`, `herdr-plugin.toml`, `config.example.toml`, `examples/` and the tests. `python3 -m unittest` runs 171 tests, all pass.

## Wrong

1. **`README.md:31-34` says to run "it" once by hand, but that does not start the daemon.** The `refresh` action runs `daemon.py --once`: one cycle, then exit. No loop runs until herdr restarts, so the emoji expires after the TTL. Edit:
   > The daemon starts with the herdr server (`[[startup]]`), so restart herdr after installing. Without a restart, `herdr plugin action invoke bonkey.pr-emoji.refresh` runs one cycle only, and the emoji expires after three intervals (6 minutes at the default).

2. **`README.md:244` says "five columns of GitHub's own answer", but stdin carries six.**
   - `unsatisfied` is the sixth (`daemon.py:522`).
   - Edit: "a path, a timeout and the six columns above".
   - Outside the README, the header comments of both `examples/` hooks also list five columns.

3. **`README.md:296` and `README.md:330` misdescribe the rule order.**
   - The README says the rules follow "the order of the table above" and "the way `blocker_for` decides". They do not.
   - The rules start at draft and end with merged, closed, no PR, 💬. The table and `blocker_for` start with no PR, merged, closed.
   - A value carries one blocker glyph, so only the 💬 position matters.
   - Edit for `:330`:
   > Order matters in one place: the 💬 rule goes last. 💬 rides behind a blocker, so it must colour a cell only where it stands alone.
   - Also delete "in the order of the table above" at `:296`.

4. **`README.md:289` says "The prose below and the table above", but most of the emoji prose sits above that line.** Edit: "This README names the emoji throughout, because…".

5. **`README.md:353-354` says a sort "only moves what the key asks for". That is not true.**
   - A group lands as one block (`move_requests`, `daemon.py:1195-1198`).
   - A workspace from another group that sits between two members ends up after the block.
   - Add that sentence to the README.

6. **`README.md:363-364` says "the state of each workspace by name", which reads as the workspace name.** The file maps `workspace_id` to a state name (`daemon.py:813`). Edit: "maps each workspace id to the name of its state (`mergeable`, `failing`, …)".

7. **`README.md:429-436` says "launch the loop by hand", but every listed command is a one-shot.** The loop is bare `python3 daemon.py`. Add this line:

       python3 daemon.py    # the loop; output goes to daemon.log, replaces the server-started daemon via the pid file

## Missing

8. **The Nerd Font requirement is missing from Install.**
   - The default is `icons = "nerd"`, yet the intro example at `:8` shows emoji.
   - A fresh install without a Nerd Font shows empty boxes.
   - Only `config.example.toml:13` mentions the font.
   - Edit `:14`: append "A Nerd Font in the terminal, or `icons = "emoji"` (see [Two icon sets](#two-icon-sets))."

9. **The README never says how a config change takes effect.**
   - The loop reads `config.toml` once at start (`daemon.py:1363`).
   - `--once` re-reads it, so `refresh` shows the new icons and the next loop cycle reverts them.
   - Add under Configuration:
   > The daemon reads the file at start. After a change, restart herdr or relaunch `python3 daemon.py`.

10. **The config file is not parsed as TOML.**
    - Each key has its own regex (`daemon.py:233-249`), because Python 3.9 has no `tomllib`.
    - Single-quoted strings are silently ignored.
    - Invalid values silently fall back to the default; only the interval floor is logged.
    - Table headers are ignored.
    - Add one paragraph for users, and one line in Development: "a new config key needs a new regex in `read_config`".

11. **`signoffCommand` takes one executable path and no arguments.**
    - The code runs `run([command])` (`daemon.py:880`), so `"~/bin/x --flag"` exits 127.
    - `~` expands; `$VAR` does not.
    - "As one argv" at `:211` does not tell a newcomer this.
    - Add the wrapper pattern, which also answers how the `SIGNOFF_JIRA_*` variables reach a hook that the herdr server starts:

           #!/bin/sh
           export SIGNOFF_JIRA_URL=… SIGNOFF_JIRA_EMAIL=…
           exec /path/to/examples/pr-signoff-jira

12. **There is no Limitations section.** These facts are scattered or absent; collect them in one place:
    - github.com remotes only, so no GitHub Enterprise Server (`slug_from_url`, `daemon.py:953`).
    - Only the `origin` remote is read, so a pull request from a fork checkout against upstream reads ❔.
    - A repository governed by rulesets has a null protection rule; the README mentions this only under 💬.
    - Only the first 100 check contexts are read (`contexts(first: 100)`, `daemon.py:714`). The README mentions only the 100-thread cap.

13. **`gh` prerequisites are incomplete.**
    - The README does not name the token scope.
    - It does not mention `gh auth status`.
    - It does not say which permission makes `branchProtectionRule` readable.
    - `:403` mentions SAML and gives no fix. Propose `gh auth refresh`, after you confirm that command.

14. **`HERDR_SOCKET_PATH` at `:435` has no source.** Say where the value comes from. `HERDR_BIN_PATH` is honoured (`daemon.py:33`) and is undocumented.

15. **Contributor basics are absent.**
    - The Python 3.9 compatibility constraint is not stated as a rule for contributors.
    - No formatter is named.
    - No CI config exists in the repo.
    - Nothing says how to record and anonymise a new fixture. The procedure lives only in the `test_daemon.py:4-23` header.
    - The test classes are grouped by area, and the README does not say so.
    - Nothing says when to bump `version` in `herdr-plugin.toml`.
    - The commit message style is not described.

16. **`:420` implies all logs land in `daemon.log`.** Only the loop redirects there (`redirect_to_log`). `--once`, `--sort` and `--query` log to stderr.

## Unclear

17. **`:4` names `mergr` with no definition and no link.** Add a clause that says what it is and link it.

18. **Two different files are both called `config.toml`.** `:17` and `:37` mean herdr's own; `:412` means the plugin's. Name the path at first use. I did not verify that herdr's own file is `~/.config/herdr/config.toml`.

19. **"The second request" appears at `:113` but is first defined at `:382`.** Link `[second request](#how-it-polls)`, or add a two-line primer before the State mapping prose.

20. **"Empty answer" has two meanings at `:76-84`.**
    - One meaning is a cleared token: no branch, a remote not on github.com, or a closed pull request on the trunk.
    - The other is a kept glyph: `UNKNOWN`.
    - Use "cleared" for the first and "kept" for the second, consistently.

21. **The sort section never defines "group".** The terms drift between "repository", "group" and "worktree group". Define it once: "A group is one repository: its main checkout (the parent) and its linked worktrees."

22. **The sort table at `:342` uses its first data row as the header.** Add a real header: `| Order | States | Your move |`.

23. **The colour block at `:302` uses a different row layout from Install.** It shows only `[ui.sidebar.spaces]`. Say that the same `rules` go in `[ui.sidebar.agents]`.

24. **The intro at `:5` says "reads as mergeable", but the default glyph is 🆗, not ✅.** Add "(🆗 by default, ✅ with `unstable = "pass"`)".

25. **The intro example at `:8` keeps personal branch names on one horizontal line.** The sort example uses `TASK-153`. Make the intro example vertical with generic names.

## Structure

26. **`:178-194` sits in the wrong section.** The three paragraphs cover re-run attempts, rollup `FAILURE` and unreported contexts. They explain ❌ and 🟡, yet they sit under "The 💬 modifier". Move them to State mapping, after the 🟠 paragraph at `:103`.

27. **Rationale buries the usage.** State mapping runs 90 lines of design reasoning before Configuration appears. Proposed order:
    1. Install
    2. Configuration
    3. State table
    4. Icon sets
    5. Sorting
    6. Sign-off
    7. How it polls
    8. Limitations
    9. Design notes (the current rationale prose)
    10. Development