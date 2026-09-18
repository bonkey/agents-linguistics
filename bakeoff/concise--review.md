# concise / review

- arm: `concise`  prompt: `review`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 346s  api: 337s
- cost: $4.0329  output tokens: 25531  words: 782

---

**Verdict:** the decision core is solid and well tested, with 171 tests passing on Python 3.12 and 3.14 and the sources parsing under 3.9 grammar. The weak spots are the process-lifecycle layer, three GitHub enum values, and stale hook docs. On this machine the daemon is not running at all, and the installed plugin is pinned 22 commits behind this checkout.

## Behaviour and code

- **Pidfile takeover can kill an unrelated process.** `take_over_pidfile` at `daemon.py:1302` trusts any live PID in the file. After a crash or reboot that PID can belong to another of the user's processes, which then gets TERM and KILL. Check the PID's command line names daemon.py before signalling.
- **"herdr is gone" exits for good, and fires on the wrong evidence.** The log shows it happen on Sep 15: a dev-build herdr server launched a second daemon, which took over the pidfile and killed the production one. When the dev server's binary went away, three failed CLI calls made that daemon exit, and the production server, still up today, has had no emoji since. Judge reachability by HERDR_SOCKET_PATH rather than HERDR_BIN_PATH, back off instead of exiting, and key the pidfile by socket path so two servers can each own a daemon. The socket already serves workspace.list, pane.list and both report_metadata methods, so the loop could use the existing `socket_request` throughout and drop the CLI dependency.
- **PENDING check runs read 🛑 instead of 🟡.** GitHub's CheckStatusState includes PENDING alongside QUEUED and WAITING, verified by introspection. `RUNNING_STATUS` at `daemon.py:75` lacks it, and the `state == "PENDING"` branch only covers StatusContext. The same applies to a StatusContext in state EXPECTED, the reported form of the case the code already handles for absent contexts. A STALE conclusion falls to 🛑 too, which is defensible but undocumented.
- **Config is read once at startup, but refresh reads it fresh.** Change `icons` or `unstable`, invoke refresh, and the row flips for one interval then flips back. Re-read the config each cycle. That also removes the restart-to-change-interval chore.
- **The sleep ignores cycle time.** `daemon.py:1412` sleeps a full interval after a cycle that can take a minute when gh and the hook time out. Sleep the remainder instead.
- **A sign-off command cannot take arguments.** `run_signoff` passes one argv element, so `python3 hook.py` or `hook --team x` cannot be configured. `shlex.split` keeps the no-shell property and allows both.
- **Fork workflows read ❔.** The slug comes from `origin` only, so a PR opened from a fork lives on upstream and the lookup finds nothing. Worth a README line or a `remote` setting.
- **Minor.** Branch and remote lookups repeat per workspace with no cache by path. `slug_from_url` misses `https://user@github.com/` URLs. The regex config reader could try `tomllib` on 3.11 and up, with the regex as fallback.

## Tests

- **The world layer is untested.** No test covers `publish` argv, the pane-cwd fallback in `workspace_rows`, `gh_graphql` on the exit-1-with-data path the README leads with, pidfile take-over and drop, the timeout path of `run`, or the three-strikes exit. A stub gh in the style of the sort end-to-end class would cover most in one go.
- **Missing decision cases.** PENDING and EXPECTED above, UNSTABLE combined with a failing required check, ejected combined with UNSTABLE, and two required contexts with an empty name collapsing into one.
- **No CI.** The 3.9 claim is unverifiable here since only 3.12 to 3.14 are installed. A GitHub Actions matrix on 3.9 and 3.13 running `python3 -m unittest` would make it true by construction.
- **Cosmetic.** `GuardedCycle` assigns over `daemon.cycle` instead of using `mock.patch.object`, and `shutil` is imported inside three functions.

## README and packaging

- **Both example hooks document five stdin columns.** The format has had six since the `unsatisfied` column landed. The static example reads five variables, so the sixth silently joins `merge`. Harmless, but the first thing a hook author copies.
- **Structure.** Most of the 461 lines are rationale. Keep Install, the two tables, Configuration and Development at the top, and move the why-prose about 🚂, 🪃, 👀 gating and the timeline under one Design notes header or a separate file.
- **The opening still says emoji.** The default is Octicons now. Say so in the first paragraph and in the install example.
- **Add Troubleshooting.** Where the log is, what "no answer for N branches" and "keep their last emoji" mean, SAML organisations, and the two-servers case above.
- **Releases.** The manifest says 0.7.0 but there are no tags and no changelog. The installed copy is at 73f7978, so what herdr runs is not what the tests test. Tag releases, or link this checkout while developing.
- **Ignore `.claude/`.** It is untracked and holds `settings.local.json`.
