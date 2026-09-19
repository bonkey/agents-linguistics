# caveman-full / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-full`  prompt: `critique-readme`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 13  wall: 224s  api: 217s
- cost: $2.2803  output tokens: 17976  words: 1296

---

No files changed. I checked the README's claims against `daemon.py`, `herdr-plugin.toml`, `config.example.toml` and `examples/`. `python3 -m unittest` passes (171 tests).

## Wrong

1. **README.md:244 says "five columns".** Hook stdin has six, because `unsatisfied` was added. Edit: "a path, a timeout and six columns". The header comments in `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` have the same error.

2. **README.md:31-34 says "run it once by hand" with `refresh`.** `refresh` runs `daemon.py --once` (`herdr-plugin.toml:22`). That is one cycle and no loop, so the emoji vanish after 3 intervals. Proposed text:
   > The polling loop is a `[[startup]]` hook, so it starts only with the herdr server: restart herdr after installing. `herdr plugin action invoke bonkey.pr-emoji.refresh` runs a single cycle; its emoji expire after three intervals (6 minutes by default) unless the loop is running.

3. **README.md:429-436 says "launch the loop by hand", but the block has no loop command.** Add this as the first line:
   `python3 daemon.py &   # the loop; stops a running copy through the pid file`
   Also add that `--once`, `--query`, `--resolve` and `--sort` log to stderr. Only the loop writes `daemon.log` (`daemon.py:1392`).

4. **README.md:297 and :330 say the rules are ordered like the table and like `blocker_for`.** The colour rules put merged, closed and no-PR last. The table and `blocker_for` (`daemon.py:369-377`) put them first. Replace :330 with:
   > Every value starts with exactly one blocker glyph, so the order of the first fourteen rules does not matter. Only the 💬 rule has to stay last, or it would colour `👀💬` too.

   Drop "in the order of the table above" at :297.

5. **README.md:402 says "stays on 🛑".** Without the second request's answer, the pull request reads what the first request decides: 👀, 🆗 or 🛑. Edit: "reads what the first request alone decides, usually 🛑".

6. **README.md:386 says "Two calls per cycle".** Edit: "At most two". The second call runs only when targets exist (`daemon.py:918`).

7. **README.md:353 says "A workspace without a worktree is left where it is".** A group lands as one block (`daemon.py:1196-1198`). Add: "unless it sits between two members of one group; then it ends up after the block."

## Missing

8. **Nerd Font requirement.** Default is `icons = "nerd"`, but the first mention is at :259 and Install says nothing. A user without a Nerd Font sees empty boxes. Add after :15:
   > The default icon set needs a [Nerd Font](https://www.nerdfonts.com) as the terminal font. Without one, set `icons = "emoji"` (see [Configuration](#configuration)).

   Move the note at :289-290 ("this README names the emoji") under the sample at :8.

9. **Applying a config change.** The daemon reads config once, in `main` (`daemon.py:1363`). Add to Configuration:
   > The daemon reads this file once, at start. After a change restart the herdr server, or run `python3 daemon.py &` from the plugin directory: the new copy stops the old one through the pid file.

10. **Config parser limits.** Parsing is regex, not TOML. Only double-quoted strings work, and the key must start the line. An invalid value falls back to the default with no log line (`icons = "Emoji"` gives nerd).

11. **`signoffCommand` is one executable path.** `run([command])` (`daemon.py:880`) takes no arguments. "One argv with no shell" at :211 is ambiguous, and `"~/bin/hook --flag"` fails with 127. Add two sentences:
    - "Path of one executable: no arguments, no shell, `~` expanded. Wrap arguments in a script."
    - "On a non-zero exit, the last stderr line of the hook goes to the log."

12. **Limits.** None of these are stated:
    - Only the `origin` remote is read.
    - Only `github.com` URLs are accepted (`daemon.py:953`), so GitHub Enterprise Server does not work.
    - In a fork workflow, `origin` is the fork and the pull request lives upstream, so the row reads ❔.
    - Platforms are macOS and Linux only (`herdr-plugin.toml:6`).
    - The branch comes from the worktree checkout, else from the first pane's `cwd` (`daemon.py:991`).
    - At :76, "no branch" means detached HEAD or a directory that is not a git checkout.

13. **Troubleshooting section.** Proposed text:
    > **Nothing shows.** 1. Is the token in a sidebar row of herdr's `config.toml`? 2. `gh auth status`; is `gh` on the PATH of the herdr server? A missing `gh` logs "gh is required; not starting" to herdr's startup output, not to `daemon.log`. 3. `tail ~/.local/state/herdr/plugins/bonkey.pr-emoji/daemon.log`. 4. Empty boxes: set `icons = "emoji"`. 5. `printf 'my-branch\n' | python3 daemon.py --query owner/name` tests the GitHub side without herdr.

14. **Contributor guide.** Proposed text:
    > **Layout.** `daemon.py`: pure decisions, the world (subprocesses, network), the sort. `test_daemon.py`: no network. `fixtures/`: recorded GraphQL responses. `examples/`: sign-off hooks. `herdr-plugin.toml`: manifest and version.
    > **Adding a state** touches `EMOJI`, `NERD`, `SORT_ORDER`, `blocker_for`, three README tables, the colour rules block, and `description` in `herdr-plugin.toml`. No test checks the README against the code.

    The maintainer must supply the rest:
    - The command to record a fixture and the rule for anonymising it.
    - The formatter (the code looks like `black` output).
    - The version bump policy (no tags, no changelog).
    - The `gh` scopes needed to read `branchProtectionRule`.

15. **`HERDR_SOCKET_PATH`** at :435 has no source named. State whether herdr panes export it. The `HERDR_BIN_PATH` override (`daemon.py:33`) is undocumented.

## Unclear

16. **`mergr`** (:4, :376) has no link and no explanation.

17. **Two files are named `config.toml`.** Edit :17: "in herdr's own `config.toml` (not the plugin's, see Configuration)".

18. **Terms are used before they are defined.**
    - "Blocker" first appears at :201, and it covers ✅ too.
    - "The second request" is used at :113 and defined at :382.
    - "TTL" is used at :84 and defined at :391.

    Add a glossary after the intro:
    > **token**: the value published as `$pr_emoji`. **blocker**: its first glyph, the pull request state (✅ included). **💬 modifier**, **sign-off glyph**: optional second and third glyphs. **first / second request**: the two GraphQL calls of a cycle.

19. **Sorting terms.**
    - "Group" and "parent" at :352 are undefined.
    - The README says "every repository" where the manifest says "every group".
    - "Same groups" at :350 reads as the state groups from the table above it.

    Proposed edits:
    - :350: "`sort-name` orders the worktrees of every repository by name alone, case folded; state plays no part."
    - :352: "A group is the main checkout (the parent) plus its linked worktrees. Only linked worktrees move."
    - In the example, `app` is blank, but :77 says a trunk without a pull request reads ❔. Show ❔ or explain the blank.

20. **The sorting table at :342** uses its first data row as the header. Edit: use the header `| Order | States | Your move |`.

21. **"keeps its last glyph, next poll"** at :74 is cryptic. Edit: "unchanged; next poll decides".

22. **Two blocks are in the wrong place.**
    - :229-234 joins two topics. Move "Only the rows…" next to the stdin format at :213.
    - :178-194 is about check attempts and the rollup, not 💬. Move it to State mapping after :106.

23. **Token placement differs.** The colour example at :304 puts the token on row 1, and Install at :28 puts it on row 2. Make them consistent.

24. **The sample at :8** still has personal branch names, which a5cc614 generalised elsewhere. It also shows emoji although the default set is Nerd Font.

## Structure

25. 461 lines with no table of contents. Rationale at :80-194 sits before the five config keys. Proposed order:
    1. Install
    2. Configuration
    3. State mapping (table only)
    4. 💬
    5. Sign-off
    6. Icons and colours
    7. Sorting
    8. Troubleshooting
    9. Development
    10. How it polls
    11. Design notes (all the "why" prose)
    12. Non-goals
    13. License

I could not check herdr's sixteen-rule limit, `herdr api snapshot`, or the path of herdr's own config. The README's paths, defaults, 60 s floor, sort order, codepoints and Octicon names all match the code.