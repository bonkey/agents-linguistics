# ste-concise / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `ste-concise`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 13  wall: 218s  api: 211s
- cost: $2.3238  output tokens: 16997  words: 1133

---

The README describes the state logic correctly, but it has five factual errors, and the Development section leaves out most of what a contributor needs. Fix the errors first, because each one is a small edit. No file changed.

I checked each claim against `daemon.py`, `herdr-plugin.toml`, `config.example.toml`, `examples/` and `test_daemon.py`. `python3 -m unittest` passes (171 tests). I did not check the herdr CLI commands, because herdr is not in this repo.

## Wrong

1. `README.md:31-34` offers `refresh` as an alternative to a restart of herdr. `refresh` runs `daemon.py --once`, which does one cycle and exits. No loop runs, and the token expires after three intervals (360 s at the default). Proposed text: "The daemon starts with the herdr server (`[[startup]]`), so restart herdr after the install. `herdr plugin action invoke bonkey.pr-emoji.refresh` runs one cycle only, and its result expires after three intervals."
2. `README.md:244` says "five columns". The stdin row has six columns since [65f1e99](https://github.com/bonkey/herdr-pr-emoji/commit/65f1e99) (16 Sep, 16:20). Write "six columns". The header comments in `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` also list five columns.
3. `README.md:289` says "The prose below and the table above". Most of the prose is now above that line. Proposed text: "This README names the emoji, because a page cannot show a Nerd Font glyph. Both sets say the same things." Move the sentence below the sample row at line 8.
4. `README.md:296` says the rules follow "the order of the table above", and `:330` says they follow `blocker_for`. The rules start with draft and put merged, closed and no PR after mergeable. Proposed text for both: "Each value holds one state glyph, so the order of the first fourteen rules does not matter. The `oct-comment_discussion` rule must come last, so that the state glyph colours the cell."
5. `README.md:178-194` sits under "The 💬 modifier", but the three paragraphs explain ❌ and 🟡. Move them to "State mapping", after line 106. In line 180, "either" refers to nothing. Proposed text: "A required check run with the `ACTION_REQUIRED` conclusion reports a missing review. It does not count as a failure."

## Missing

1. **The Nerd Font requirement is absent from Install.** The default is `icons = "nerd"`, the sample row shows emoji, and only `config.example.toml:13` names the font. Proposed text for line 14: "Requires herdr ≥ 0.8.2, Python 3.9 or newer (standard library only), git, an authenticated `gh`, and a Nerd Font as the terminal font. Without one, set `icons = "emoji"`."
2. No text says how a config change takes effect. `main()` reads the file one time, before the loop. Add to Configuration: "The daemon reads this file at start only. After a change, restart herdr, or run `python3 daemon.py` by hand. The new copy stops the old one through the pid file."
3. The config parser is a set of regular expressions, not a TOML parser. Add: "Write each string value in double quotes on one line. A value the daemon does not recognise falls back to the default without a log line. `signoffCommand` is the path of one executable. It takes no arguments, and `~` expands."
4. Two files are named `config.toml`. Install means the one that belongs to herdr, and gives no path. Write "herdr's own `config.toml`" with its path at line 17, and "the plugin's `config.toml`" at line 412. I do not know the herdr path.
5. Limits that the code sets, for Non-goals:
   - `slug_from_url` accepts only a github.com `origin`, so a GitHub Enterprise Server host shows nothing.
   - The lookup asks only the `origin` repository. From my read of the query, a pull request from a fork to upstream reads ❔.
   - `contexts(first: 100)` caps the checks that the daemon reads. The README documents the cap on threads, but not this cap.
6. `README.md:171` says "no permission" and does not name the permission that `branchProtectionRule` needs. I did not verify which one it is.
7. The Development section omits these facts:
   - A file map: `daemon.py` holds all the code, `test_daemon.py` holds all the tests, and `fixtures/` holds recorded GraphQL answers.
   - The loop command. The text says "launch the loop by hand", but the list omits `python3 daemon.py`. Add that line with the comment "stops the daemon herdr started; output goes to `daemon.log`".
   - A value or a source for `HERDR_SOCKET_PATH`, which `--sort` needs.
   - The fixture policy, which lives only in `test_daemon.py:4-23`: neutral owners, repositories, branches and check names. Add a command to record a fixture: `gh api graphql -f query="$(python3 -c 'import daemon; print(daemon.lookup_query([("owner/name","branch")]))')"`.
   - A checklist for a new state: `EMOJI`, `NERD`, `SORT_ORDER`, `blocker_for`, the three README tables, the colour rules (fifteen of sixteen used), and `description` in `herdr-plugin.toml`. The test at `test_daemon.py:1255` fails when `SORT_ORDER` lacks a state.
   - A note that a `python3 -m unittest` run that passes prints three `signoffCommand exited …` lines. A new contributor reads them as failures.
   - A note that no CI exists, so the contributor runs the tests. Also say who changes `version` (0.7.0, no tags).
8. A Troubleshooting section. With no `gh`, the daemon writes "gh is required; not starting" to stderr before the log redirect and exits 0, so `daemon.log` stays empty. `--once` and `--sort` also write to stderr. Proposed entries: empty boxes mean no Nerd Font; an empty row means run `gh auth status`, then `printf 'main\n' | python3 daemon.py --query owner/name`.

## Unclear

1. Many words name one thing. "Emoji", "glyph", "verdict", "answer" and "state" all name the row value. "Blocker" also covers ✅ (`:201`, "behind the blocker", then ✅➖). "Trunk" and "default branch" alternate, as do "command" and "hook", and "repository" and "group". Add a "Terms" list after the intro with one word each: token, state glyph, 💬 modifier, sign-off glyph, default branch, sign-off command, worktree group.
2. "The second request" (`:113`, `:230`) and "TTL of three intervals" (`:84`) appear before "How it polls" defines them. Link the first use of each to `#how-it-polls`.
3. `mergr` (`:4`, `:376`) has no link and no description, and nothing else in the repo names it. Add a link or one clause that says what it is.
4. `README.md:438-442` says `--query` tests a sign-off command without herdr, then shows `--once`, which needs herdr. Proposed example: `printf 'main\n' | STATE=open python3 daemon.py --query owner/name`.
5. About 70 lines of design rationale (`:80-143`) separate the state table from the next section a user needs. Put them under a "Why this order" header, or move them to a `DESIGN.md`.
6. In the table at `README.md:342`, the first data row is the header row, so "First" renders as a column title. Add a header row: `| Order | States | What you do |`.
7. The sample row at `README.md:8` keeps the branch names `bonkey/…`. [a5cc614](https://github.com/bonkey/herdr-pr-emoji/commit/a5cc614) (16 Sep, 15:31) changed the sort example to neutral `TASK-…` names and left this row. Use names such as `feature/login`.