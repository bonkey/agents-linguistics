# learning / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `learning`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 16  wall: 263s  api: 258s
- cost: $2.5305  output tokens: 20972  words: 1505

---

I read the README against `daemon.py`, `herdr-plugin.toml`, `config.example.toml`, both example hooks and the tests, and modified no files; the working tree is still clean. I found five statements that are wrong, nine things that are missing, and six that are unclear, each with a proposed edit below.

The command `python3 -m unittest` runs as the README documents it: 171 tests, all OK. The glyph tables, the sort order, the two state and config paths, both internal links and the count of fifteen colour rules all match the code and the manifest.

## Wrong

**1. `README.md:31-34`: running `refresh` does not start the daemon.**
- `refresh` is `daemon.py --once` (`herdr-plugin.toml:22`), which runs one cycle and exits.
- Tokens are published with a TTL of three intervals (`daemon.py:1029`).
- A new user who follows this sees emoji appear and then vanish about six minutes later.
- Proposed text: "The daemon starts with the herdr server (`[[startup]]`), so **restart herdr** after installing. To see emoji before that, `herdr plugin action invoke bonkey.pr-emoji.refresh` runs a single cycle, but nothing polls until the restart, and what it published expires after three intervals (six minutes by default)."

**2. `README.md:244`: "five columns of GitHub's own answer" is stale.**
- `README.md:213` documents six columns, and the daemon sends six (`daemon.py:522`).
- The phrase dates from c96d124; commit 65f1e99 added `unsatisfied` afterwards.
- Proposed text: "it has a path, a timeout and the six columns above."

**3. `README.md:363`: "Both sorts read `states.json`" is not true.**
- Only `--sort` reads it (`daemon.py:1278`); `--sort-name` uses the workspace list alone.
- Proposed text: "`sort` reads `states.json` next to the log… `sort-name` needs only herdr's workspace list. Neither asks GitHub anything, so…"

**4. `README.md:296` and `:330`: the colour rules are not in either order the README claims.**
- The README says they follow "the order of the table above" and "the way `blocker_for` decides".
- The rule block starts at draft and ends with merged, closed and no PR. The table and `blocker_for` both start with those three.
- The order among the blocker rules cannot matter anyway, because a value holds exactly one blocker glyph.
- Proposed text: "A value carries exactly one blocker glyph, so the order of the first fourteen rules is free. The one constraint is that `oct-comment_discussion` comes last, so the blocker colours a two-glyph value and a lone 💬 still gets a colour."

**5. `README.md:289`: "The prose below and the table above name the emoji" points the wrong way.**
- It sits in the fifth section, and almost all the emoji prose is above it. It was left over from 607abf5.
- Proposed edit: delete it and put one line under the sample at line 8: "This README names states by their emoji; by default the sidebar draws the Nerd Font Octicon from the same table row."

## Missing

**6. The Nerd Font requirement is absent from Install.**
- The default is `icons = "nerd"` (`daemon.py:134`), while line 8 shows emoji, so a user without a Nerd Font gets empty boxes.
- Proposed addition after line 15: "The default glyphs are Nerd Font Octicons. Use a Nerd Font in your terminal, or set `icons = "emoji"` ([Configuration](#configuration))."

**7. How to apply a config change is not explained.**
- The loop reads `config.toml` once, at startup (`daemon.py:1363`).
- `refresh` re-reads it every time, so an `icons` edit appears after a refresh and the loop flips it back within 120 seconds.
- Proposed text: "The loop reads this file once, when it starts. After editing, restart herdr or relaunch the daemon by hand." You should pick which of the two to recommend.

**8. Development says "launch the loop by hand", but the code block never shows how.**
- Proposed addition to the block: `python3 daemon.py   # the loop itself: replaces the server's copy through the pid file; silent, output goes to daemon.log`

**9. There is no Troubleshooting section.**
- The `gh` check (`daemon.py:1372`) runs before `redirect_to_log()` (`:1392`). When the daemon herdr starts cannot find `gh` on its `PATH`, "gh is required" never reaches `daemon.log`, and the exit code is 0.
- Proposed entries:
  - "Empty boxes → no Nerd Font."
  - "Nothing, and no `daemon.log` → `gh` is not on the PATH the herdr server runs with."
  - "Emoji vanished after a `refresh` → the loop is not running."
  - "❔ on a branch that has a PR → see Limitations."

**10. Limitations are scattered or unstated.**
- Only the remote named `origin` is read (`daemon.py:947`).
- Only `github.com` URLs are recognised (`:953`), so GitHub Enterprise Server shows nothing.
- In a fork workflow, where `origin` is the fork, the row reads ❔.
- Only the first 100 check contexts are read (`:714`). The README mentions the 100-thread cap but not this one.
- The rulesets caveat at `README.md:171-174` belongs with these.
- Proposed edit: add a `## Limitations` section before Non-goals.

**11. `signoffCommand` is a path, not a command line.**
- It runs as `run([command])` (`daemon.py:880`), so arguments are impossible. `~` is expanded, and `$VARS` are not.
- "One argv with no shell" at `README.md:211` does not tell a new reader this.
- Proposed text: "`signoffCommand` is the path of one executable (`~` expands, nothing else). No arguments, no shell; wrap anything longer in a script."

**12. Config parsing is stricter than TOML, and the README does not say so.**
- It uses regexes (`daemon.py:233-249`), since `tomllib` needs Python 3.11 and the floor is 3.9.
- Only double-quoted, lowercase values are read. A bad value falls back to the default with no log line.
- Proposed edit: add one sentence to Configuration saying this.

**13. There is no contributor workflow.**
- Adding a state touches `EMOJI`, `NERD`, `SORT_ORDER`, `blocker_for`, four places in the README and the manifest description.
- Nothing enforces that these stay in sync. `test_the_whole_order_is_what_the_readme_says` compares `SORT_ORDER` with itself and never opens the README.
- Proposed edit: add a checklist for adding a state, plus a recording recipe (the query-building half runs; I did not send it to GitHub):

      gh api graphql -f query="$(python3 -c 'import daemon; print(daemon.lookup_query([("owner/name", "branch")]))')" > fixtures/new.json

  Follow it with a pointer to the anonymising rules in the header of `test_daemon.py`.
- Also say that there is no CI, so the tests are the only gate.

**14. `mergr` is never explained or linked** (`README.md:4` and `:376`).

## Unclear

**15. `README.md:178-194` is in the wrong section.**
- The three paragraphs on re-run checks, rollup `FAILURE` and expected contexts are about ❌ and 🟡, but they sit under "The 💬 modifier".
- Proposed edit: move them into State mapping, and put a `### Why this order` heading over lines 80-143 so a user can skip the rationale.

**16. `README.md:236`: "Every kind of silence keeps the row where it is" contradicts the next sentence.**
- In fact the row is republished without the sign-off glyph on the next cycle (`daemon.py:789`).
- Proposed text: "Every kind of silence drops the sign-off glyph and nothing else."
- `config.example.toml:31` and `examples/pr-signoff-jira:35` say the row "keeps the glyph it has until its TTL runs out", which is wrong for the same reason.

**17. `README.md:342`: the sort table uses its first data row as the header.**
- Proposed edit: use a header row `| Order | States | Whose move |`.
- Also add: "A row like 👀💬 sorts by its blocker; only a lone 💬 sorts as 💬."

**18. `README.md:8`: the sample still shows `bonkey/purchase-to-unlock` and similar names.**
- Commit a5cc614 generalised the other examples.
- Proposed text: `✅ TASK-143   🟡 TASK-153   👀💬 TASK-132`, with a caption saying it shows the emoji set.

**19. The two `[ui.sidebar.spaces]` layouts differ.**
- The Install block at lines 25-29 and the colour block at lines 302-322 are different layouts.
- The colour block also omits `[ui.sidebar.agents]`.
- Proposed edit: say the rules go on whichever cell holds the token, in both tables.

**20. `README.md:442`: the `STATE=open … --once` trick does not last.**
- The running loop republishes with its own environment within one interval, so the glyph flips back.
- Proposed edit: add one clause saying so.

The header comments in both example hooks still document five input columns, the same staleness as finding 2.

`★ Insight ─────────────────────────────────────`
- The README is strict about what the daemon decides and loose about how a user operates it; findings 1, 7 and 9 share one cause, that `--once` and the loop are different processes with different lifetimes.
- The 3.9 floor is why the config is parsed by regex, since `tomllib` arrived in 3.11. The hidden cost is that a mistyped config value falls back to the default without a word.
- A test named after the README does not read it. A real one could parse the markdown tables and compare them with `EMOJI`, `NERD` and `SORT_ORDER`, which would have caught the stale column count in finding 2.
`─────────────────────────────────────────────────`

I would fix 1 and 6 first, because a new user hits both within ten minutes of installing. After those I would take 2 to 5, which are one-line corrections.