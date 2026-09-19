# i-have-adhd / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `i-have-adhd`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 14  wall: 379s  api: 352s
- cost: $2.8276  output tokens: 27825  words: 1008

---

Start with `take_over_pidfile()` at `daemon.py:1294`. Holding an `fcntl.flock` on the pid file for the daemon's lifetime fixes findings 1, 2 and 8 together, in about 30 minutes. I changed no files. Each "confirmed" finding below was reproduced in a temp dir outside the repo.

## High

1. **Takeover kills whatever process owns the recorded pid** (confirmed)
   - Location: `daemon.py:1297-1311`
   - Cause:
     - The only check before SIGTERM and SIGKILL is `alive(old)`; nothing checks that the pid is a daemon.
     - SIGKILL, SIGHUP, a crash or power loss leave the pid file stale, because `finally` never runs.
     - After a reboot pids restart low and the state dir persists, so the pid can belong to your shell or to herdr itself.
     - In my test an unrelated `sleep` was killed in 0.5 s.
     - `int()` also accepts a negative pid (the parse was tested, the kill was not run). A file holding `-1` would send TERM, then KILL, to every process you own.
   - Fix:
     - Open the pid file and take `fcntl.flock(fd, LOCK_EX | LOCK_NB)`, keeping the fd open for the daemon's lifetime.
     - Signal the recorded pid only when the lock is held, which proves a live daemon.
     - Reject `old <= 1`.

2. **Two starters both survive** (confirmed)
   - Location: `daemon.py:1297-1314`
   - Cause:
     - Reading the pid and writing the new one is not atomic, and the 0.5 s poll loop widens the window.
     - Two starters launched 0.1 s apart both killed the old process and both kept running.
     - The pid file named only one of them, so the other polls GitHub forever and no later takeover can find it.
   - Fix: the same flock. Write the pid only while holding the lock, and have the loser retry until it gets it.

3. **Timeout kills only the direct child** (confirmed)
   - Location: `run()`, `daemon.py:207-215`
   - Cause:
     - Python's `subprocess.run` SIGKILLs only the direct child on timeout, and the same happens when the SIGTERM handler raises `SystemExit`.
     - Grandchildren survive. The shipped hook spawns `curl` at `examples/pr-signoff-jira:106`.
     - A hung hook therefore leaks one orphan per cycle, about 720 a day at the 120 s default.
     - A hook that answers, exits 0 and leaves a background process holding stdout got return code 124, and its valid answer was discarded.
   - Fix:
     - Start the child with `Popen(..., start_new_session=True)`.
     - On timeout, and in a `finally`, call `os.killpg(proc.pid, SIGKILL)`.
     - Keep the stdout gathered so far when the child had already exited 0.

## Medium

4. **`gh_graphql` drops the reason for HTTP failures** (confirmed)
   - Location: `daemon.py:859-867`
   - Cause:
     - On a 401, `gh` prints `{"message":"Bad credentials"}` on stdout and exits 1.
     - That body parses as a dict with no `data` and no `errors`, so the function returns `(None, [])` and the stderr text is discarded.
     - A 403 rate limit and a SAML refusal should lose their cause the same way; I only tested the 401.
     - The log shows only "no answer for N branch(es)", and every emoji expires with no cause recorded.
   - Fix: when `rc != 0` and `errors` is empty, return `[{"message": err.strip() or body.get("message")}]`.
   - Related, at `daemon.py:1372`: "gh is required" is logged before `redirect_to_log()` and the daemon exits 0, so `daemon.log` stays empty. Move the redirect above the check.

5. **Cycle period can outrun the token TTL**
   - Location: `daemon.py:1029`, `daemon.py:1412`
   - Cause:
     - The TTL is `3 × interval`, but the real period is `interval` plus the cycle duration.
     - The cycle is serial: two git calls at 5 s per workspace, 10 s per publish, 30 s per `gh` call and 20 s for the hook.
     - About 24 workspaces on a hung mount, or a stalled herdr, pushes a cycle past 240 s. Every emoji then blinks out while the daemon still looks healthy.
   - Fix:
     - Sleep `max(0, interval - elapsed)`.
     - Cache the slug per path.
     - Stop publishing after the first herdr timeout in a cycle.

## Low

6. **Socket read has no total deadline and ignores the reply `id`** (confirmed)
   - Location: `daemon.py:1229-1267`
   - Cause:
     - `settimeout` applies to each `recv`, not to the whole request. A trickling peer held a 2 s timeout open for 9 s, with an unbounded buffer.
     - A reply carrying someone else's `id` was accepted as `ok=True`.
   - Fix:
     - Use a `time.monotonic()` deadline and a size cap.
     - Read lines until `answer.get("id") == request_id`.

7. **Sort is unlocked and not re-planned**
   - Location: `daemon.py:1273-1289`
   - Cause:
     - The moves are planned from one snapshot.
     - Pressing the key twice, or closing a workspace mid-sort, interleaves the moves or stops after N of M, leaving a half-sorted sidebar.
   - Fix:
     - `flock` a `sort.lock` file for the duration of the sort.
     - On a failed move, list again and re-plan once.

8. **Signal setup leaves gaps**
   - Location: `daemon.py:1393-1402`
   - Cause:
     - The pid file is written before the handlers are installed and before the `try`.
     - SIGHUP is never handled.
     - Both paths leave a stale pid file, which feeds finding 1.
   - Fix:
     - Install handlers for TERM, INT and HUP first.
     - Do the takeover inside the `try`.

9. **Takeover mistakes an unreaped child for a live process** (confirmed)
   - Location: `alive()`, `daemon.py:1317-1322`
   - Cause:
     - `kill(pid, 0)` succeeds for an exited child its parent has not yet reaped (a zombie).
     - The takeover waited the full 5.5 s and logged a false "ignored TERM, killing it".
   - Fix: the flock tells you when the old daemon has died, so drop the poll loop.

10. **`--once` bypasses the single-instance guard**
    - Location: `daemon.py:1108`, `daemon.py:1387`
    - Cause:
      - `--once` and the daemon both write the same `states.json.tmp`. A collision can publish a half-written file or raise `ENOENT` on the rename.
      - The sign-off hook can also run twice at the same time.
    - Fix: write through `tempfile.mkstemp(dir=STATE)`, and take the cycle lock for `--once` as well.

Next: open `daemon.py:1294` and sketch the flock version of `take_over_pidfile()`, or tell me to apply it.