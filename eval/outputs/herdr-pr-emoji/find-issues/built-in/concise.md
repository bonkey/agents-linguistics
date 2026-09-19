# concise / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `concise`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 9  wall: 279s  api: 266s
- cost: $2.126  output tokens: 21197  words: 1374

---

I found 15 issues in `daemon.py`, listed most severe first. I reproduced 1–3 and 5 with throwaway scripts outside the repo (`os.kill` was stubbed for the `-1` case); the rest come from reading the code. No file in the repo was modified.

**1. High: a stale pid file makes the daemon kill an unrelated process** (`take_over_pidfile`, `daemon.py:1302-1312`)
- **Cause:** The only check is `alive(old)`, which says nothing about whether that pid is still a daemon.
  - The file goes stale whenever the daemon dies without running its `finally`: SIGHUP, SIGKILL, a crash, or power loss.
  - The state directory survives reboots, so a recycled pid is plausible.
  - In my reproduction a plain `sleep 300` named in the file received SIGTERM.
- **Fix:** Hold `fcntl.flock(LOCK_EX|LOCK_NB)` on the pid file for the daemon's whole life.
  - The kernel drops the lock on any kind of death, so the file cannot go stale.
  - Signal the recorded pid only when taking the lock fails, then wait for the lock.
  - Failing that, at least confirm the pid's command line is `daemon.py` before signalling.

**2. High impact, low likelihood: a pid that is not a plausible process id is signalled as-is** (`:1299-1311`)
- **Cause:** `int()` accepts `-1`, and `os.kill(-1, 0)` succeeds.
  - SIGTERM and then SIGKILL go to every process the user owns; `-N` hits process group N.
  - The reproduction produced the calls `[(-1, 15), (-1, 9)]`.
- **Fix:** Reject `old <= 1`, even with the lock from item 1 in place.

**3. Medium: the takeover is a race and the pid file write is not atomic** (`:1297-1314`)
- **Cause:** Read, kill and write are unguarded, so two starters (the herdr hook and a hand launch, or two quick restarts) both pass.
  - Both keep running. The loser is in no pid file, so nothing ever stops it and polling doubles.
  - In my reproduction two processes ran and the file named only one of them.
  - `open(..., "w")` truncates first, so a concurrent reader sees an empty file, gets `old = 0`, and kills nobody.
- **Fix:** The `flock` from item 1 covers this. Write the pid through a temp file and `os.replace`.

**4. Medium: signal handling has gaps that leave stale pid files** (`main`, `:1393-1402`)
- **Cause:**
  - Handlers are installed after `take_over_pidfile()`, and the `try/finally` starts later still. A SIGTERM in that window skips `drop_pidfile`. This includes a handler firing during `log()`.
  - SIGHUP is not handled. A hand-launched copy dies when its terminal closes and leaves the file behind, which feeds item 1.
- **Fix:** Install handlers for TERM, INT and HUP first, and move the takeover inside the `try`.

**5. Medium: a timeout kills only the direct child** (`run`, `:207-215`; it matters most for `run_signoff`, `:880`)
- **Cause:** `subprocess.run` sends SIGKILL to the one pid it started.
  - A shell hook's `gh`, `curl` or `sleep` child survives, and another one is left behind every cycle.
  - In my reproduction the `sleep 300` started by the hook was still running after the 124.
  - The same happens when the daemon is SIGTERMed in the middle of a hook.
  - Separately, a hook that exits 0 but leaves a background child holding stdout blocks until the timeout and is reported as 124.
- **Fix:** Start the child with `Popen(start_new_session=True)`, and call `os.killpg` on timeout and on any exception before re-raising.

**6. Medium-low: a socket reply is never matched to its request** (`read_reply`, `:1229-1238`; `socket_request`, `:1255-1266`)
- **Cause:** The first line received is taken as the answer, and its `id` is never compared.
  - If herdr pushes any event or notice first, a move that succeeded reads as failed and the sort stops half-way.
  - `settimeout` applies to each `recv`, not to the whole reply, so a trickling peer never times out.
  - The receive buffer has no size limit.
- **Fix:** Read lines until `answer.get("id") == request_id`, under one overall deadline and a byte cap.

**7. Medium-low: the sort is many dependent requests planned from one snapshot** (`sort_workspaces`, `:1273-1289`)
- **Cause:** Each move names the previous move's workspace as `before_workspace_id`.
  - If a workspace opens or closes during the sort, or one request fails, a group is left split. Nothing re-lists or verifies afterwards.
  - `workspace_records` raises `AttributeError` when the JSON answer is not a dict, and `--sort` has no guard like the one `cycle` has.
- **Fix:** On failure, re-list, recompute and retry once. Check the final order. Add an `isinstance` check on the answer.

**8. Low-medium: a cycle's duration is added to the interval but not to the TTL** (`:1029`, `:1412`)
- **Cause:** The real period is `interval` plus the length of the cycle, while the TTL is `3 × interval` (180 s at the 60 s floor).
  - `publish` runs one call after another with a 10 s timeout each, across workspaces and panes.
  - git adds up to 10 s per workspace.
  - `os.path.isdir` on a dead network mount (`:1019`) has no timeout at all.
  - A hung herdr therefore makes every emoji expire, and publish timeouts never count towards "herdr unreachable".
- **Fix:** Sleep `max(0, interval - elapsed)`, stop the publish loop at the first 124, and count that as a herdr failure.

**9. Low: the whole GraphQL query is one command-line argument in one request** (`gh_graphql`, `:859`)
- **Cause:** Linux limits a single argument to 128 KiB, and each branch takes about 500 bytes.
  - Roughly 250 branches produce E2BIG, which returns 127 and leaves every branch unanswered. `--resolve` accepts arbitrary input.
  - One oversized query is also all-or-nothing against GitHub's 10 s execution limit.
- **Fix:** Split the pairs into chunks of about 50 per request, and send the body on stdin with `gh api graphql --input -`.

**10. Low: `gh` is not pinned to github.com** (`:859`)
- **Cause:** `slug_from_url` accepts only github.com, but `gh api` follows `GH_HOST`, or the single configured host.
  - With an Enterprise default, the slugs are looked up on the wrong server. They go unanswered, or a same-named repository there supplies a wrong emoji.
- **Fix:** Add `--hostname github.com`.

**11. Low: git inherits the daemon's environment** (`:941`, `:947`)
- **Cause:** `GIT_DIR` or `GIT_WORK_TREE` in a hand-launched shell overrides `-C path`, so every workspace resolves to the same repository.
  - Separately, `slug_from_url` (`:959-961`) tests for `.git` before stripping `/`. The URL `…/repo.git/` becomes the slug `owner/repo.git` and is never answered.
- **Fix:** Pass an `env` with the `GIT_*` variables removed, and call `rstrip("/")` before the `.git` test.

**12. Low: `states.json.tmp` is one fixed name shared by the loop and `--once`** (`save_states`, `:1108`)
- **Cause:** The refresh action runs alongside the daemon by design.
  - Two writers can interleave in the temp file, or one `os.replace` fails with ENOENT.
  - A corrupted file makes `load_states` return `{}`, so `--sort` ranks everything last.
- **Fix:** Use `tempfile.mkstemp(dir=STATE)`, or put the pid in the temp name.

**13. Low: the log is truncated only at startup** (`redirect_to_log`, `:1349`)
- **Cause:** A daemon running for weeks that logs errors every cycle grows past `LOG_LIMIT` without bound.
- **Fix:** Check the size once per cycle and truncate or reopen the file.

**14. Low: `alive()` counts zombies, and nothing re-checks after SIGKILL** (`:1305-1312`, `:1317`)
- **Cause:** A predecessor that has died but not been reaped costs the full 5 s wait and a spurious "ignored TERM" SIGKILL. I saw this in the reproduction.
  - The pid file is then written whether or not the old process is gone.
- **Fix:** The lock from item 1 makes liveness probing unnecessary. Otherwise re-check after the KILL and log if the process is still there.

**15. Low: sign-off hook path resolution and the glyph on hook failure** (`read_signoff`, `:270`; `decide`, `:789`)
- **Cause:** A relative or bare `signoffCommand` is resolved against herdr's working directory and PATH, not the config directory.
  - When the hook fails or gives an unknown answer, the row is republished without the sign-off glyph at once.
  - The `parse_signoff` docstring says otherwise ("keeps the emoji it has until its TTL runs out"), so the glyph flickers with a flaky hook.
- **Fix:** Require an absolute path, or resolve it against the config directory. Either carry the last known sign-off state forward for the TTL, or correct the docstring.