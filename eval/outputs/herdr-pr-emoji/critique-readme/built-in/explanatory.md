# explanatory / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `explanatory`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 19  wall: 314s  api: 309s
- cost: $2.8423  output tokens: 25715  words: 1907

---

I found six things that are wrong, eight that are missing and seven that are unclear; proposed edits follow each one. No file was modified and the working tree is still clean. I checked each claim against `daemon.py`, the manifest, the examples and the installed `herdr` 0.9.1. `python3 -m unittest` runs 171 tests and all of them pass.

`★ Insight ─────────────────────────────────────`
- The "how to install" half (Install, Configuration) is where nearly all the "wrong" findings are. The design-rationale half held up against the code.
- Two findings are stale counts left behind when later commits changed the behaviour. No test opens `README.md`, `herdr-plugin.toml` or `config.example.toml`, so nothing catches the drift.
`─────────────────────────────────────────────────`

## Wrong (verified against the code)

**W1. `README.md:244` says "five columns", but the hook gets six.**
`signoff_input` emits six tab-separated fields. The phrase arrived in `c96d124`, and `65f1e99` added `unsatisfied` without updating it. The header comments at `examples/pr-signoff-static:8` and `examples/pr-signoff-jira:7` also list five, although the Jira script reads the sixth.
> it has a path, a timeout and the columns above, every one of them GitHub's own answer.

Dropping the number means it cannot go stale again.

**W2. `README.md:31-34` presents `refresh` as an alternative to restarting herdr, and it is not.**
`refresh` runs `daemon.py --once`: one cycle, then exit. Tokens carry a TTL of three intervals (`daemon.py:1029`). With the default interval the glyphs appear and then vanish six minutes later, because no daemon is running to renew them.
> The daemon is a `[[startup]]` hook, so it starts with the herdr server: restart herdr once after installing. To see a result before you do:
>
>     herdr plugin action invoke bonkey.pr-emoji.refresh
>
> That is a single cycle. Its glyphs expire after three intervals (six minutes by default) unless the daemon is running to renew them.

**W3. `README.md:296-297` and `:330-331` are both wrong about the order of the `rules` block.**
The README says the rules are "in the order of the table above" and "ordered the way `blocker_for` decides". I extracted the codepoints: the block runs draft through mergeable, then merged, closed, no-PR, then conversation. The table and `blocker_for` both start with no-PR, merged, closed. The order also matters far less than the text implies. A value holds exactly one blocker glyph, so the only real constraint is that 💬 comes last.
> `:296` That is one rule per state the pull request itself reports, with one to spare.
>
> `:330` Only one position matters: the 💬 rule goes last, so that in a two-glyph value the blocker on the left colours the cell. Every other value carries exactly one of these glyphs, so the rest may come in any order.

**W4. `README.md:289` points the wrong way.**
"The prose below and the table above name the emoji" no longer fits, because State mapping, 💬 and the sign-off section now sit above it.
> The rest of this README names the emoji throughout, because…

**W5. `README.md:3` says "one emoji per sidebar row", but the default is not an emoji and the token is not always one glyph.**
The default is an Octicon (`DEFAULT_ICON_SET = "nerd"`), and a token can be up to three glyphs wide.
> the pull request state of the workspace's branch, as a glyph on each sidebar row: an Octicon by default, an emoji if you prefer.

**W6. `README.md:236` says "Every kind of silence keeps the row where it is", and four places disagree about what that means.**
I ran `decide` both ways. An answered row gives `✅🎫`, and a row the hook leaves out is republished as `✅`. The glyph is dropped, not kept. The README's next sentence ("costs the third glyph") is right. `config.example.toml:31` ("keeps the glyph it has"), `examples/pr-signoff-jira:35` and the `parse_signoff` docstring all say the opposite.
> Every kind of silence costs the sign-off glyph and nothing else. A row the command leaves out, […]: the row is republished with its pull request state alone.

Bring the other three places into line with this.

## Missing

**M1. Install never mentions the Nerd Font requirement.**
The README opens with emoji, line 14 lists requirements without a font, and the first mention is at line 259. A first-time user whose terminal lacks a Nerd Font sees empty boxes.
> Requires herdr ≥ 0.8.2, Python 3.9 or newer (standard library only), git, an authenticated `gh`, and, for the default icon set, a [Nerd Font](https://www.nerdfonts.com) as the terminal font. Without one, set `icons = "emoji"` (see [Configuration](#configuration)).

**M2. Two different files are both called `config.toml`.**
Lines 17 and 37 mean herdr's file. Line 412 means the plugin's. "Two icon sets" uses both within twenty lines: `icons = "emoji"` goes in the plugin's file and the `rules` block goes in herdr's. Say "herdr's own `config.toml`" at line 17, link "the [plugin's `config.toml`](#configuration)" at line 263, and introduce the block at line 301 with "In herdr's `config.toml`:".

**M3. Nothing says that a config change needs a daemon restart.**
`main` reads the file once (`daemon.py:1363`). `refresh` is a new process, so it does read the new file. It publishes `icons = "emoji"` once, and the old daemon overwrites it with the previous icon set at its next cycle. Add under Configuration:
> The daemon reads this file once, at start. Restart herdr after changing it. `refresh` alone is not enough: it uses the new settings for its one cycle, and the running daemon puts the old ones back at its next.

**M4. The config file is not parsed as TOML, and `signoffCommand` cannot take arguments.**
The file is matched with regexes (`daemon.py:233-276`). I tested two cases:
- `icons = 'emoji'` (single quotes) is ignored with no message.
- `signoffCommand = "~/bin/hook --team abc"` becomes the single executable path `/Users/…/hook --team abc`, which exits 127.

"As one argv with no shell" (line 211) does not tell a reader either of these.
> `:414` Read line by line rather than parsed as TOML (Python 3.9 has no `tomllib`): one key per line, strings in double quotes. A value it does not recognise falls back to the default without a word.
>
> `:211` `signoffCommand` is the path of one executable, with `~` expanded. It is not split into arguments and no shell reads it, so put flags in a wrapper script.

**M5. The README never says how environment variables reach the hook.**
Line 246 puts "every specific of your team in an environment variable". A daemon started by herdr inherits the server's environment, not the shell's. `STATE=open python3 daemon.py --once` works only because it is launched by hand. A wrapper script fixes this and M4 together:

    #!/bin/sh
    export SIGNOFF_JIRA_URL=https://your-team.atlassian.net
    export SIGNOFF_JIRA_TOKEN_CMD='op read op://Private/jira/token'
    exec /path/to/examples/pr-signoff-jira

Also say that the script's header lists every variable.

**M6. There is no Troubleshooting section.**
A short one would cover these:

| You see | Look at |
|---|---|
| empty boxes | no Nerd Font; set `icons = "emoji"` |
| nothing at all | `daemon.log`. A missing `gh` is logged before the log file opens (`daemon.py:1372` vs `:1392`), so that message is in `herdr plugin log list`, not `daemon.log`. |
| glyphs vanish after a few minutes | the daemon is not running; see W2 |
| ❔ on a branch that does have a PR | `origin` is your fork; see M7 |

**M7. Several limits are not stated.**
- Only the `origin` remote is read, and only `github.com` is recognised (`daemon.py:953`). A GitHub Enterprise Server remote reads as "not GitHub".
- In a fork workflow the PR lives upstream, so the row shows ❔ permanently.
- Checks are capped at 100 contexts (`:714`). The README documents only the 100-thread cap.
- 💬 is read only for PRs that get the second request. A conflicted PR with a green rollup is not one of them (`:686-690`), so ⚠️ without 💬 does not mean no conversation is open.

**M8. The contributor on-ramp under Development is thin.**
- **Code map:** one file with three banners (pure decisions, the world, the sort), and the rule that decisions stay pure.
- **Python floor:** the 3.9 minimum as a constraint on contributions, meaning no `tomllib`, `match` or `X | Y`.
- **Recording a fixture:** fixtures hold the whole `{"data": …}` response, so this works:

      gh api graphql -f query="$(python3 -c 'import daemon; print(daemon.lookup_query([("owner/name","branch")]))')"

  Anonymise names afterwards, as `a5cc614` did.
- **Adding a state:** a state appears in about ten places and no test covers the docs. The places are `EMOJI`, `NERD`, `SORT_ORDER`, `blocker_for`, the three README tables, the rules block, the manifest description and `config.example.toml`. A checklist would help.
- **Running the loop:** the text says "launch the loop by hand", but the list that follows has no plain `python3 daemon.py`. Add it, noting that it replaces the running daemon through the pid file and logs to `daemon.log`.
- **`--sort`:** change "needs HERDR_SOCKET_PATH" to "run it in a herdr pane, which exports it". I confirmed the variable is set in this shell.
- **Releases:** the manifest says 0.7.0, and there are no tags and no changelog. What is the release step?

## Unclear

**U1.** `mergr` (lines 4 and 376) is never introduced. Add a link or one clause saying what it is.

**U2.** Lines 178-194 (re-runs, rollup `FAILURE`, *Expected* contexts) explain ❌ and 🟡 but sit under "The 💬 modifier". Move them after line 106. Also, "not breakage either" (line 180) has nothing for "either" to refer back to.

**U3.** The hero line (line 8) still uses `bonkey/purchase-to-unlock…`, although `a5cc614` generalised the other examples. It also shows three rows on one line. Suggested replacement: `✅ TASK-143` / `🟡 TASK-153` / `👀💬 TASK-160`, stacked.

**U4.** The sign-off table shows only the ✅ prefix, which suggests sign-off appears only on mergeable PRs. Add:
> Shown behind ✅ here; it rides behind whatever the row reads, so `❌💬🎫` is a full-width token.

**U5.** Lines 223-234 are one paragraph covering five topics, with a visible splice at lines 231-232. Split it into format, rationale, escaping, and when the column is empty. Move "Only the rows whose answer a glyph could show…" up next to line 211.

**U6.** Sorting has two unclear points.
- Where does `👀💬` sort? It sorts by its left glyph, because `states_of` uses `verdict_for()[0]`. Say so.
- The table at line 342 uses its first data row as the header. Add a real header: `| Order | Reads | Your move |`.

**U7.** The two row examples place the token differently: row 2 at line 28 and row 1 at line 304. The rules example also covers only `spaces`. Say that the same `rules` go on the `agents` row.

`★ Insight ─────────────────────────────────────`
- M3, M4 and M5 come from two facts: the daemon is started by the herdr server, and it reads its config once. Because of this, a hand-launched test run and the running daemon see different environments and settings. One paragraph in Configuration that states both facts would answer all three.
- Python 3.9 has no `tomllib`, which is why the config is read with regexes. That limitation is otherwise invisible in the code, so the README is the only place a contributor would learn that the config file accepts less than TOML does.
`─────────────────────────────────────────────────`

`herdr --help` prints a note to AI agents pointing at setup and debugging guides "only if your task asks". This task did not, so I did not follow it.

Do W1 to W4 and M1 to M3 first. They are the ones that mislead someone installing the plugin.