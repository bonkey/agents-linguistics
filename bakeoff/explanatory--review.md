# explanatory / review

- arm: `explanatory`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 379s  api: 372s
- cost: $3.7398  output tokens: 27747  words: 1651

---

The project is in good shape. The decision logic is pure and thoroughly tested, the fixtures are real recorded responses with their provenance documented, and the README explains every rule. Nothing was modified. What follows is what I would change, ranked within each area.

Tests: 171 pass on Python 3.9.6 and 3.14.7. Syntax also parses cleanly under a 3.9 feature check.

`★ Insight ─────────────────────────────────────`
Two design moves carry most of this plugin's resilience and are worth recognising as patterns. First, publication is three-valued: a glyph, an empty string that clears the row, or `None` that leaves the row alone and lets the TTL decide. That is what turns one failed GraphQL request into "nothing changes" rather than "the sidebar blanks". Second, the merge queue's timeline is used as the state file, so 🪃 needs no local memory and survives restarts. The same trick could serve other transient states.
`─────────────────────────────────────────────────`

## Behaviour and code

- **Changes requested has no rung.** Confirmed by probe: a pull request with `reviewDecision` of CHANGES_REQUESTED reads ✅ when CLEAN, 🆗 when UNSTABLE and 🛑 when BLOCKED. That is the clearest author errand GitHub reports, and it either looks mergeable or looks like an unexplained block. Add a state between 🟡 and 👀 at `daemon.py:391`, with a glyph in both sets, a rank in the first sort group, a README row and a colour rule. The README's own list of what reaches 🛑 at line 98 also omits this case.
- **BEHIND reads as mergeable.** GitHub reports BEHIND only where the base requires branches to be up to date, and then the merge button is disabled until "Update branch" is pressed and the checks re-run. So ✅ at `daemon.py:399` promises a merge that will not happen. Either give it its own glyph or make it configurable the way UNSTABLE is. This is a design call, so I am flagging it rather than calling it a bug.
- **An over-answering hook decorates rows it was never asked about.** Confirmed by probe: a hook answering for a merged, closed or absent pull request yields 🟣🏁, 🚪🎫 and ❔📭. The README promises only open, undrafted rows are sent, but nothing enforces that on the way back. Attach the sign-off at `daemon.py:789` only where the same open-and-undrafted filter holds.
- **The pid file can kill an unrelated process.** After a crash or SIGKILL the pid file is stale, pids recycle quickly on macOS, and the check at `daemon.py:1294` treats any live same-user process as the old daemon before sending SIGTERM and then SIGKILL. Verify identity first, for example that the command line of that pid contains `daemon.py`, or record the process start time alongside the pid.
- **Two writers share one temporary file.** The refresh action runs a full cycle in a second process while the daemon may be mid-cycle. Both write to the same path from `daemon.py:1108`, so one rename can promote the other's half-written file. The loader tolerates bad JSON, so the cost is a sort that falls back to name order, but a per-process temp name removes the race entirely.
- **The sign-off command cannot carry arguments.** Confirmed: a value of `/bin/sh -c 'cat'` fails with "No such file". The README says one argv, but the config value looks like a shell string and the example uses one. Either split with `shlex` or accept a TOML array, and state the rule in the example config.
- **Check contexts are read without pagination.** The query at `daemon.py:714` asks for the first hundred, and re-runs inflate the count. The p2 fixture already shows four attempts of one check. Past the window a required check is either invisible or reported as EXPECTED forever, which pins 🟡. Read the page info and paginate for the rare pull request that needs it, or at least log when the page is full.
- **Remote URL parsing is narrow.** Confirmed: URLs with a user prefix, an explicit SSH port, an SSH host alias like `github.com-work`, or a capitalised host all yield a blank row. A single regex on the host and path would cover these. Fork workflows are also unsupported, since the pull request lives on the parent repository while origin is the fork. Worth a README note at minimum.
- **Cycle failures log without a traceback.** The guard at `daemon.py:1054` exists precisely for surprising payload shapes, and "'list' object has no attribute 'get'" does not say where. Log the formatted traceback.
- **Config is parsed with regexes, twice.** Python 3.11 ships a TOML parser. Use it when available and keep the regexes as the 3.9 fallback. Merging the two readers into one config record would also remove the second file read.
- **The pull request record is an untyped dict.** It gains keys across four functions, mixing GitHub's camelCase with local snake_case, and every test builds one by hand. A dataclass or typed dict would document the contract, and the test helper that builds one already exists inside the sign-off tests and could be hoisted.
- **A missing gh exits zero.** The daemon and the refresh action both return success at `daemon.py:1372` after logging, so herdr sees a healthy startup hook. Return non-zero, and consider one authentication check at startup with a clear message instead of one error per cycle.
- **Stale docstrings.** The four-tuple returned at `daemon.py:722` is documented as a pair, and the wording at lines 904 and 926 predates 🟠 and 💬. The README-in-docstrings style means each rule lives in three places, which is where this rot comes from.
- **Smaller items.** The period is the interval plus the cycle time, and a signal-driven refresh would avoid spawning a racing second process. Name sort is plain casefold, so TASK-1010 sorts before TASK-2; a natural sort key is a few lines. The `.claude` directory is untracked and unignored.

## Tests

The suite is a strength. It tests decisions as pure functions, keeps recorded fixtures with notes on what was anonymised and what was hand-built, and runs the sort end to end against a stub herdr and a stub socket. The gaps are mostly the "world" half of the daemon.

- **Nothing covers a real cycle.** The only `--once` test has no checkouts, so gh never runs and publishing never happens. A stub gh answering with the lookup fixture plus a temporary git repository would cover the workspace rows, the pane fan-out, the token and TTL arguments, and the slug lookup in one test.
- **The exit-one-with-data path is untested at the boundary.** The README leans on it, but only the parser is tested. Patch the runner to return status one with a JSON body and assert data comes back.
- **The pid file logic is untested.** A test with a fake pid is also where the identity guard above would be specified.
- **Missing cases for confirmed findings.** The over-answering hook, the URL shapes above, and whatever is decided for CHANGES_REQUESTED and BEHIND should each be pinned.
- **The Jira example has real logic and no tests.** Ticket matching, the no-ticket fallback, the unsatisfied column parser and paging are all testable if the file is loaded by path.
- **Hygiene.** The guarded-cycle test at `test_daemon.py:1208` passes the string "pass" where an icon table is expected, a leftover from an older signature, and patches by assignment while every other test uses `mock.patch.object`. Shutil is imported inline in three places, twice via a dunder call inside a lambda.
- **No CI.** A workflow running the suite on 3.9 and a current release would make the README's 3.9 claim a checked fact rather than a remembered one.

`★ Insight ─────────────────────────────────────`
One small trick in the code is worth naming. The blocker function is handed a glyph table and returns whatever the table maps a state to, so passing a table that maps each name to itself makes the same function return state names for sorting. That is how the sort reads the last verdict back without parsing glyphs, and it is why the invariant test that every named state has a rank matters.
`─────────────────────────────────────────────────`

## README, examples and manifest

- **Length and structure.** At 461 lines, most of it rationale, the README reads as a design document rather than a manual. Keep Install, Configuration, the two tables and Development at the top, and move the "why" paragraphs to a Design notes section or a separate file. Three paragraphs about re-runs and the rollup at lines 178 to 187 sit under the 💬 heading but are about required checks.
- **The sort table has no header.** The row at line 342 is rendered as the header, so "First" and its glyphs appear in bold as column titles. Add a real header row.
- **Both example hooks document five stdin columns.** The daemon sends six and the Jira example reads the sixth. The headers at line 7 and line 8 of the two examples are stale.
- **No troubleshooting section.** Where the log is lives under Configuration, but nothing explains "no answer for N branches", SAML authorisation of the token, or that repositories governed by rulesets return a null protection rule and therefore 🛑.
- **No changelog or tags.** The manifest says 0.7.0 over a history of thirty behaviour-changing commits. A short changelog or one tag per version.
- **The manifest description is a paragraph.** Plugin listings will truncate it. Keep one line and leave the glyph legend to the README.
- **Jira example messages format a list.** Confirmed: the failure text at `examples/pr-signoff-jira:118` reads like this.

```
curl exited 22: ['line one']
```

  Take the first line rather than a one-element slice. Also note that its token command is a shell string while the daemon's sign-off command is not; that asymmetry will surprise someone.

If you want a starting order, the first three behaviour items and the pid guard give the most value for the least change, and the cycle end-to-end test would lock in all four.
