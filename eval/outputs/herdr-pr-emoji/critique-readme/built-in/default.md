# default / critique-readme

- project: `herdr-pr-emoji` at `81e8933`
- arm: `default`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 15  wall: 251s  api: 243s
- cost: $2.4868  output tokens: 19335  words: 1256

---

I found five places where the README is wrong, eight things a first-timer needs that are missing, and six that are unclear. Proposed edits follow each item; no file was modified.

I checked the README against `daemon.py`, the manifest, the example config, both example hooks and the installed herdr 0.9.1. The tests pass on Python 3.14.7 (171 tests in about a second).

## Wrong

1. **`README.md:244` says the hook gets "five columns of GitHub's own answer".** It gets six: `README.md:213` lists six and `signoff_input` writes six.
   - Edit: "it has a path, a timeout and the six columns above".
   - Both `examples/` script headers still list five columns.

2. **`README.md:236` says "Every kind of silence keeps the row where it is."** A row the hook leaves out is republished that same cycle without its third glyph. I ran `decide` both ways: an answered row gives `✅🎫`, a left-out row gives `✅`.
   - Edit: "Every kind of silence costs the third glyph on that cycle, and nothing else: …".
   - The same wrong claim is in `config.example.toml` ("keeps the glyph it has"), the `pr-signoff-jira` header and the `parse_signoff` docstring.

3. **`README.md:296` and `:330` describe the colour rules as ordered like the table and like `blocker_for`.** They are not: the block starts at draft and puts merged, closed and no-PR after mergeable. The order is also irrelevant, because each value carries exactly one state glyph.
   - Edit: replace both claims with "The order of the fourteen state rules is free; only 💬 must come last, so it colours the cell only where it stands alone."

4. **`README.md:178-194` sits under "The 💬 modifier" but is about ❌ and 🟡.** Those paragraphs cover newest-attempt logic, rollup `FAILURE`, and unreported required contexts.
   - Edit: move them to the end of "State mapping", after line 106.

5. **`README.md:289` says "The prose below and the table above".** Nearly all the prose is above that point. The hero row on line 8 also shows emoji, while a default install draws Octicons.
   - Edit: move the sentence under the hero row: "This README names the emoji throughout; a default install draws [Octicons](#two-icon-sets) instead and needs a Nerd Font."

## Missing

1. **The Nerd Font requirement is not in Install.** It appears only in `config.example.toml`. With the default `icons = "nerd"`, following Install exactly gives empty boxes.
   - Edit: add to the Requires line "…and a Nerd Font as the terminal font, or `icons = "emoji"`".

2. **`README.md:31-34` does not say what the refresh action actually does.** It runs `--once`, which publishes with a TTL of three intervals. The emoji therefore appear and vanish after six minutes, and the loop itself only starts with the next herdr server start.
   - Edit: "The loop is a `[[startup]]` hook and first runs when the herdr server next starts. Until then `…refresh` runs one cycle, whose emoji expire after three intervals."

3. **Nothing says how a config change takes effect.**
   - The loop reads `config.toml` once at start; `refresh` reads it every time. A refresh shows the new setting, and the loop repaints the old one on its next cycle.
   - Edit: say the loop must be restarted, either by restarting the herdr server or with `nohup python3 daemon.py &`, which replaces the running copy through the pid file.
   - The parser is a regex, not TOML: only double-quoted strings are read. `unstable = 'pass'` and `unstable = "bogus"` both silently fall back to `ok`.
   - Edit: add one line stating this.

4. **There are two files called `config.toml`.** `README.md:17` and `:37` mean herdr's own (`~/.config/herdr/config.toml`); `:412` means the plugin's own.
   - Edit: name each file explicitly.
   - Edit: add `mkdir -p "$(herdr plugin config-dir bonkey.pr-emoji)" && cp config.example.toml "$_/config.toml"`.

5. **`signoffCommand` is a single executable path, and the README does not make that plain.** The code runs `run([command])`, so `"python3 ~/bin/hook.py"` exits 127. "One argv with no shell" does not convey this.
   - Edit: "the whole string is the path of one executable: no arguments, `~` expanded, `$VAR` not".

6. **Nothing says where the hook's environment comes from in normal use.** "Inherits the daemon's environment" appears only under Development. The server-started daemon has the herdr server's environment, so `SIGNOFF_JIRA_*` has no obvious home.
   - Edit: recommend a wrapper script as the `signoffCommand` that exports the variables and then runs `exec …/pr-signoff-jira`.

7. **There is no Troubleshooting or Limitations section.** Facts from the code worth putting there:
   - "gh is required; not starting" is logged before output is redirected to `daemon.log`, and the daemon exits 0. The message lands in herdr's capture of the hook, not in the log. `herdr plugin log` exists; I did not check its arguments.
   - Only the `origin` remote is read, so a fork checkout whose PR lives upstream reads ❔ forever.
   - Only `github.com` URLs are recognised, so GitHub Enterprise is not supported.

8. **The Development section has several gaps.**
   - It says "launch the loop by hand" but never shows `python3 daemon.py`. It also does not say that the loop prints nothing (output goes to `daemon.log`) or that it stops the server's copy.
   - `--query` and `--resolve` print in the configured icon set. By default that is private-use glyphs, which look like blank output. Edit: suggest `icons = "emoji"` while developing.
   - `HERDR_SOCKET_PATH` is already set inside any herdr pane. Outside one, it is the `socket:` line of `herdr status`.
   - The test run prints three `signoffCommand exited 127/3/124` lines that are expected. Edit: say so. Nothing checks the Python 3.9 floor, since there is no CI.
   - There is no checklist for adding a state. It touches `EMOJI`, `NERD`, `SORT_ORDER` and `blocker_for`, both README tables, the colour block (which uses the last spare of the sixteen rules), the sort table, the `herdr-plugin.toml` description, and the tests.
   - There is no fixture recipe. Edit: add `gh api graphql -f query="$(python3 -c 'import daemon; print(daemon.lookup_query([("o/r","b")]))')"`, then anonymise as the header of `test_daemon.py` describes. I ran only the Python half of this recipe (it prints the query), not the `gh` call.
   - Nothing says who bumps `version`. There are no tags and no changelog.

## Unclear

1. **`mergr` is never linked or explained** (`README.md:4` and `:376`).

2. **The colour block at `README.md:301` redefines `[ui.sidebar.spaces]`.** It puts the token in a different row than Install does, and pasting both is a duplicate-table TOML error.
   - Edit: "replace the Install entry with this one; the same `rules` go on the `[ui.sidebar.agents]` entry".

3. **How a row with 💬 attached sorts is not stated.** `👀💬` sorts as 👀, because the blocker's name decides, yet the table lists 💬 in the first group.
   - Edit: add one sentence saying so.

4. **The sort table at `README.md:342` uses its first data row as the header.**
   - Edit: add `| Order | States | Your move |`.

5. **Some content is repeated.** The Nerd Font column appears in two tables, and the three-interval TTL is explained four times (lines 84, 239, 391 and 400).

6. **The reader meets ninety lines of design rationale before Configuration.**
   - Proposed order: Install, Configuration, State mapping (table only), 💬, Sign-off, Icon sets, Sorting, Troubleshooting, Development, then the rationale ("How it polls" and "Why this order", or a `DESIGN.md`), then Non-goals.

## Not verified

- herdr's sixteen-rule limit on colour rules.
- Whether `herdr plugin link` coexists with an installed copy of the same id. Testing that would have changed herdr state.

One unrelated finding in the code: the `verdict_for` docstring says the token is "never wider than two", while the README correctly says three.