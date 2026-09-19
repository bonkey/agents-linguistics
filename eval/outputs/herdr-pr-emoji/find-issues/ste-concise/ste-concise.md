# ste-concise / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `ste-concise`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 14  wall: 374s  api: 359s
- cost: $2.9828  output tokens: 29544  words: 1609

---

The most severe defect: `take_over_pidfile` sends SIGTERM, then SIGKILL, to any live process whose pid is in a stale `daemon.pid`. The fix for it, and for finding 3, is an `fcntl.flock` on the pid file, held for the life of the daemon.

Experiments confirmed findings 1, 2, 4, 6 and 10. The other findings come from the code alone. No file changed, and `git status` shows only the untracked `.claude/` that was there at the start.

## High

1. `daemon.py:1302-1311`, `take_over_pidfile`: the takeover kills a process that it did not identify. Confirmed.
   - Cause: the code trusts the number in `daemon.pid`, and `alive(old)` is the only check. The system can give the pid in a stale file to another process of the same user. In the experiment, a stale pid that named a `sleep 300` process ended that process.
   - Fix:
     - Take `fcntl.flock(LOCK_EX | LOCK_NB)` on the pid file and hold it until the daemon exits. The kernel releases the lock when the process ends, so a stale file has no holder.
     - Send a signal only when another process holds the lock.
     - Before the signal, check that `ps -p <pid> -o command=` contains `daemon.py`.

2. `daemon.py:1392-1402`, `main`: three exit paths leave a stale pid file, which makes finding 1 possible. The SIGHUP path is confirmed.
   - Cause:
     - Only SIGTERM and SIGINT have a handler. SIGHUP ends the process and the `finally` block does not run. A hand-launched daemon gets SIGHUP when its terminal closes.
     - The handlers are installed after `take_over_pidfile()`, and the `try` starts later. A signal in that window also skips `drop_pidfile()`.
     - SIGKILL and a power loss always skip `drop_pidfile()`.
   - Fix: install the handlers before the takeover, add SIGHUP, and call `take_over_pidfile()` inside the `try`. The lock of finding 1 makes the remaining stale files harmless.

## Medium

3. `daemon.py:1297-1314`, `take_over_pidfile`: two daemons that start together both survive.
   - Cause:
     - Read, kill and write are separate steps with no lock. Both starters read the same old pid, and both write. The last writer owns the file.
     - The other daemon never reads the file again, so it polls in parallel.
     - `open(PIDFILE, "w")` truncates the file before the write. A reader in that window gets `old = 0`.
   - Fix: the lock of finding 1 removes the race. Without the lock:
     - Compare the pid file with `os.getpid()` at the start of each cycle, and exit on a mismatch.
     - Write the file through `os.replace`.

4. `daemon.py:207-215`, `run`: a timeout kills the direct child only. Confirmed.
   - Cause:
     - `subprocess.run` calls `process.kill()` on one pid. A hook that is a script leaves its own children alive, and `examples/pr-signoff-jira` starts `curl`.
     - In the experiment, `run(["sh", "-c", "sleep 47 & wait"], 1)` returned 124 and the `sleep` process stayed alive.
     - A hook that hangs leaks one orphan each cycle.
     - The SIGTERM exit has the same gap.
   - Fix: use `Popen(..., start_new_session=True)`. On a timeout or an exit, call `os.killpg(process.pid, signal.SIGKILL)`, then `wait()`.

5. `daemon.py:1031-1039`, `cycle`: a herdr that stops its answers stalls one cycle for `(workspaces + panes) × 10 s`.
   - Cause:
     - Each `publish` is a separate `herdr` process with a 10 s timeout, and they run in sequence.
     - A `publish` failure is logged, but it does not stop the loop and does not count toward the exit after three failures.
     - With 30 workspaces of 3 panes each, one cycle can block for 20 minutes. The tokens expire after `3 × interval`.
   - Fix: leave the loop at the first `publish` that returns 124 or 127, and return `False` from `cycle`.

6. `daemon.py:864-867`, `gh_graphql`: an HTTP failure of `gh` loses its cause. Confirmed.
   - Cause:
     - `gh` prints a JSON object with a `message` key and no `errors` key on stdout, and the reason on stderr.
     - The body is a `dict`, so the function returns `(None, [])`. `resolve` logs only "no answer for N branch(es)".
     - With `GH_TOKEN=invalid`, stdout held `"message": "Bad credentials"` and stderr held `gh: Bad credentials (HTTP 401)`. Neither reached the log.
     - I did not test a rate limit answer.
   - Fix: when `rc != 0` and the body has no `errors`, return `[{"message": err.strip() or body.get("message")}]`.

7. `daemon.py:1270-1289`, `sort_workspaces`: two sorts in parallel, or a sidebar change during a sort, leave a group in a wrong or split order.
   - Cause:
     - The plan comes from one `workspace list` snapshot. The moves then go out one at a time, each on a new connection, with no lock.
     - A key that is pressed twice starts two `--sort` processes, and their moves interleave.
     - A move that names a closed workspace fails, and the sort stops with a partial result.
   - Fix: hold `flock` on a lock file in `STATE` for the whole sort. After a failed move, read `workspace list` again and plan again one time.

8. `daemon.py:965-968` and `daemon.py:1404-1411`: three slow answers from herdr end the daemon, and nothing starts it again.
   - Cause:
     - `herdr_json` returns `None` for a timeout (124), for bad JSON and for an absent server alike. Three such cycles in a row log "herdr is gone".
     - The README says that only a server start runs the `[[startup]]` hook. The emoji stay away until then.
   - Fix: treat 124 as "busy" and keep the loop. Count a failure only when a connection to `HERDR_SOCKET_PATH` is refused or the binary is absent.

## Low

9. `daemon.py:1229-1238` and `daemon.py:1263`, `read_reply` and `socket_request`: the reply check is weak.
   - Cause:
     - `settimeout(10)` applies to each `recv`. A peer that sends bytes without a newline holds the loop with no limit of time or size.
     - The code never compares the `id` of the reply with `request_id`. The presence of a `result` key alone means success.
     - A line that herdr sent before the reply would be read as the reply. The test stub sends only the reply, so no test covers this case.
   - Fix:
     - Set one deadline for the whole request.
     - Cap the buffer at 1 MB.
     - Skip a line whose `id` differs.
     - Fail when an `error` key is present.

10. `daemon.py:1317-1322` and `daemon.py:1309-1314`, `alive` and the end of the takeover. The zombie case is confirmed.
    - Cause:
      - `os.kill(pid, 0)` succeeds for a zombie. A dead daemon that its parent did not reap costs 5.5 s and a false "ignored TERM" log line.
      - `kill` hides every error.
      - After the SIGKILL, the code writes the pid file without a last `alive` check. An old daemon that survives then runs in parallel.
    - Fix: check `alive(old)` again after the SIGKILL wait. If the old daemon is still there, log that fact and exit.

11. `daemon.py:1108`, `save_states`: the daemon and `--once` share one temporary name.
    - Cause:
      - Both write `states.json.tmp`, and the `refresh` action runs `--once` while the daemon runs.
      - When both save at the same time, the second `open(..., "w")` truncates the file of the first.
      - One `os.replace` can then publish a partial document or fail with `ENOENT`. `load_states` returns `{}`, and `--sort` ranks every row last.
    - Fix: use `tempfile.mkstemp(dir=STATE)`, or put the pid in the temporary name.

12. `daemon.py:859`, `gh_graphql`: `gh` inherits `GH_HOST`.
    - Cause:
      - `slug_from_url` accepts only github.com remotes, but `gh api` sends the request to the host in `GH_HOST`.
      - A user with that variable set gets no answer, or an answer for a different repository with the same `owner/name`.
    - Fix: add `"--hostname", "github.com"` to the argv. `gh api --help` lists the flag.

13. `daemon.py:859`, `gh_graphql`: the whole query is one argv element.
    - Cause:
      - Linux limits one argument to 131072 bytes. One branch alias measures 473 bytes, so the query exceeds the limit above 276 branches.
      - `run` then returns 127, and every branch is unanswered.
    - Fix: send the body on stdin with `gh api graphql --input -` and `run(..., text=json.dumps({"query": query}))`.

14. `daemon.py:1019` and `daemon.py:207`: a dead network mount blocks the daemon with no limit.
    - Cause:
      - `os.path.isdir(path)` has no timeout.
      - After a timeout, `subprocess.run` calls `process.wait()` with no timeout. A `git` child in uninterruptible sleep never ends.
      - The loop has no watchdog.
    - Fix:
      - Remove the `isdir` test and let `git -C` fail inside its timeout.
      - With the `Popen` change of finding 4, call `wait(timeout=...)` after the kill and abandon the child.

15. `daemon.py:590` and `daemon.py:1385`: `--resolve` ends with a traceback on a slug without `/`.
    - Cause:
      - `read_pairs` accepts any text left of the tab, and `lookup_query` unpacks `slug.split("/", 1)` into two names.
      - `--query` validates its slug, and `--resolve` does not validate it. Neither mode runs inside `guarded_cycle`.
    - Fix: in `read_pairs`, drop and log a pair whose slug is not `owner/name`.

16. `daemon.py:1359-1362`, `daemon.py:1353` and `daemon.py:1313`: a state directory that cannot be written ends the daemon with a traceback.
    - Cause: `main` hides the `makedirs` error. `redirect_to_log` and `take_over_pidfile` then open files in that directory with no `except`.
    - Fix: log the `makedirs` error and return a non-zero status.

17. `daemon.py:274-275` and `daemon.py:207-213`: the hook has no upper limits.
    - Cause:
      - `signoffTimeoutSeconds` accepts any positive number. A hook that hangs for more than `2 × interval` outlasts the token TTL.
      - `run` reads all of the hook's stdout into memory.
    - Fix: clamp the timeout to `interval`, and stop the read at a fixed size.

Findings 7 and 9 depend on herdr behavior that I did not test: how `workspace.move_block` answers for a closed workspace, and whether herdr sends lines that nobody requested. `take_over_pidfile` has no test. `test_daemon.py:1818` checks only the path of the pid file.