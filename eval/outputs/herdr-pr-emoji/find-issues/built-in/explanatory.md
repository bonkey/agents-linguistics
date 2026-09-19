# explanatory / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `explanatory`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 14  wall: 383s  api: 372s
- cost: $2.8157  output tokens: 28454  words: 1371

---

I found 12 bugs and risks in `daemon.py`, listed below by severity. No file was modified. The findings marked "Verified" I reproduced with throwaway `python3 -B` experiments that wrote nothing and left no processes behind; the rest come from reading the code.

`★ Insight ─────────────────────────────────────`
- A pid file records a number, and the kernel reuses pid numbers. `os.kill(pid, 0)` only proves that some process has that pid, not that it is this daemon.
- The design rule "an unanswered branch keeps its emoji" holds in the GitHub layer but not in the `git` and `gh` layers below it.
`─────────────────────────────────────────────────`

## High

**1. Takeover can kill an unrelated process after pid reuse (`daemon.py:1297-1312`)**
- **Cause:** The pid file is removed only by the `finally` at `daemon.py:1414`. A `SIGKILL`, `SIGHUP` (no handler is installed for it), crash or power loss leaves it behind, and `~/.local/state` survives reboots. On the next start, `alive(old)` succeeds for whatever same-user process now holds that pid. That process gets `SIGTERM`, then `SIGKILL` five seconds later, which is enough to kill an editor sitting on a "save changes?" prompt.
- **Fix:** Hold `fcntl.flock(fd, LOCK_EX | LOCK_NB)` on the pid file for the daemon's lifetime, and keep the fd in a module global.
  - If the lock is free, the file is stale and nobody is signalled.
  - If the lock is held, the pid inside was written under the lock by a live daemon and is safe to signal.
  - Python fds are non-inheritable, so `gh` and the hook do not inherit the lock.

**2. A non-positive pid signals every process you own (`daemon.py:1299`, `1302-1304`)**
- **Cause:** `int()` accepts `-1`, which is truthy and not equal to `getpid()`. Verified: `alive(-1)` returns `True`. `kill(-1, SIGTERM)` then signals every process of the user, and `-N` signals a whole process group. A corrupted file is enough to trigger it.
- **Fix:** Treat `old <= 1` as "no previous daemon". This one-line guard is worth adding even once the lock from 1 is in place.

## Medium

**3. Two simultaneous starters both survive (`daemon.py:1294-1314`)**
- **Cause:** Read, kill and write are not atomic, and `open(PIDFILE, "w")` truncates before it writes. Two starters, such as a server restart plus a hand launch, both see the same old pid or an empty file, and both write their own. The loser is recorded nowhere, so no later takeover ever stops it. The README's promise that a hand-launched copy "never polls in parallel" breaks, and GitHub calls and hook runs double.
- **Fix:** The lock from finding 1: only one starter gets past `flock`. Write the pid with `ftruncate` and `write` under the lock, or through a temp file and `os.replace`.

**4. A timeout kills only the direct child (`run()`, `daemon.py:206-215`)**
- **Cause:** `subprocess.run(timeout=)` sends `SIGKILL` to one pid. Verified: `sh -c 'sleep … & wait'` returned 124 and the `sleep` lived on. `examples/pr-signoff-jira` is a Python script that spawns `curl`, and `gh` spawns credential helpers, so a slow endpoint leaks one orphan per cycle. The same leak happens when the daemon is terminated in the middle of a call.
- **Second symptom, verified:** A hook that prints its answer, exits 0 and leaves a background child holding stdout returns `124, ''`. `communicate()` waits for the pipe to close rather than for the child to exit, so the correct answer is discarded.
- **Fix:** Use `Popen(..., start_new_session=True)`. On `TimeoutExpired`, and on `BaseException` (the `SystemExit` raised by the TERM handler), call `os.killpg(proc.pid, SIGKILL)` and then `proc.wait()`. If `proc.poll() == 0` at the timeout, use the output already captured in the exception.

**5. Three slow herdr answers end the daemon until the next server start (`daemon.py:965-972`, `1011-1014`, `1406-1411`)**
- **Cause:** `herdr_json` returns `None` for a 10-second timeout (rc 124), a missing binary (rc 127) and unparseable JSON alike. Three consecutive cycles of that log "herdr is gone" and the daemon exits. `[[startup]]` runs once per server start, so nothing brings it back. The file's own header notes that herdr can block its main thread.
- **Fix:** Count only evidence that the server is absent, such as `ECONNREFUSED` or `ENOENT` on `HERDR_SOCKET_PATH`. Treat timeouts as "busy", and back off instead of exiting.

**6. A failed `git` call reads as "no branch" and clears the row (`daemon.py:940-948`, `1018-1023`, `841`)**
- **Cause:** Any nonzero return code yields `""`, including a 5-second timeout (124) and git missing from `PATH` (127). `cycle` then records `(id, "", "")`, `plan_publications` sends `--clear-token`, and `plan_states` writes `""`, so `--sort` ranks that worktree last. This breaks the rule the GitHub layer follows and tests (`test_an_unanswered_branch_is_left_alone`). Nothing is logged.
- **Fix:** Return `None` for rc 124 and 127 and map it to the "publish nothing" `None` in the plan. Clear the row only when git actually answered. Log the stderr.

## Low

**7. HTTP-level `gh` failures vanish (`gh_graphql`, `daemon.py:859-867`)**
- **Cause:** On a 401, 403 or 5xx, `gh` prints the REST-style body to stdout. Verified with a bad token: `{"message": "Bad credentials", …}`, rc 1. That body is a dict with neither `data` nor `errors`, so the function returns `(None, [])`. Stderr and the return code are dropped. The log shows only "no answer for N branch(es)", and a secondary rate limit is polled again at full speed.
- **Fix:** When `rc != 0` and the body has no `data` or `errors` key, build the error from `body.get("message")` or stderr. Back off when the error is a rate limit.

**8. The daemon and the refresh action share one temp file (`save_states`, `daemon.py:1108-1112`)**
- **Cause:** The `--once` run deliberately bypasses the pid file, but both processes write `STATES + ".tmp"`. If they overlap, one truncates the other's write, and the first `os.replace` can publish a half-written file. `load_states` then returns `{}` and `--sort` silently sorts by name.
- **Fix:** Create the temp file with `tempfile.mkstemp(dir=STATE)`.

**9. A cycle has no time budget against the token TTL (`daemon.py:1029-1039`, `1412`)**
- **Cause:** Each `publish` can block for 10 seconds per workspace and per pane, and a failure only logs. A herdr that has hung can stretch one cycle past the three-interval TTL, so rows go blank. `time.sleep(interval)` also makes the period equal to the interval plus the cycle time.
- **Fix:** Abort the publish loop on the first rc 124 and sleep for `max(0, interval - elapsed)`.

**10. Takeover kills the old daemon before its own startup can fail (`daemon.py:1313`, `1393-1395`)**
- **Cause:** The old daemon is killed before the unguarded `open(PIDFILE, "w")`. An `ENOSPC` at flush leaves no daemon at all. The signal handlers are installed only after the takeover, so a TERM during the wait of up to 5.5 seconds skips the `finally` cleanup.
- **Fix:** Install the handlers first, acquire the lock file before signalling anyone, and catch `OSError`.

**11. Socket replies are unbounded and unmatched (`daemon.py:1229-1238`, `1245-1267`, `1283-1289`)**
- **Cause:** `settimeout` applies to each `recv`, so it is not a deadline, and the buffer has no size cap. The reply's `id` is never compared with `request_id`, so any unsolicited line from herdr would read as a failed move. `HERDR_SOCKET_PATH` is checked only after the list call and the planning. Concurrent sorts interleave their single-workspace moves. A re-run converges, because the plan is rebuilt from a fresh snapshot.
- **Fix:** Add an overall monotonic deadline and a size cap, skip lines whose `id` differs, check the environment variable first, and take a `flock` around the sort.

**12. A zombie counts as alive (`alive`, `daemon.py:1317-1322`)**
- **Cause:** Verified: `alive()` returns `True` for an exited child that has not been reaped. The takeover then waits the full five seconds and logs "ignored TERM, killing it" about a process that is already dead.
- **Fix:** The lock from finding 1 removes this, because the kernel releases the lock when the holder dies.

## Smaller notes

- `signoffCommand` runs as a single argv element, so it cannot take arguments; `shlex.split` would allow them.
- `gh` missing from a minimal `PATH` makes the daemon exit 0 before the log redirect.
- The whole GraphQL query travels as one argv element, which Linux limits to 128 KiB. That is about 269 branches, so it is not worth acting on yet.

Findings 1, 3 and 12 share one fix: the `flock` on the pid file.