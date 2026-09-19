# learning / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `learning`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 11  wall: 381s  api: 365s
- cost: $2.7407  output tokens: 28998  words: 1596

---

I found 12 issues in the areas you named: three in the pid file takeover and signals, four in the subprocess and herdr CLI handling, and five smaller ones, including the socket requests. I reproduced findings 1, 2 and 4 in a scratch state dir under `/tmp`. The rest come from reading the code. No file in the repo was modified, and `git status` is still clean.

## Critical

**1. The takeover signals whatever pid the file names**
- **Location:** `take_over_pidfile` `daemon.py:1297-1312`, `alive` `:1317`
- **Cause:** The pid is read from disk and sent TERM, then KILL five seconds later. Nothing checks that the process is a `daemon.py`.
  - The state dir survives a reboot while pid numbering restarts, so a stale file soon names something else of yours.
  - Reproduced: a pid file naming an unrelated `sleep 300` got that process terminated.
  - `int()` also accepts negatives. A file holding `-1` passes `alive()` and becomes `os.kill(-1, SIGTERM)`, which hits every process you own, then KILL. `-N` hits process group N. I did not run that case.
- **Fix:** Hold `fcntl.flock(LOCK_EX | LOCK_NB)` on the pid file for the life of the process.
  - If the lock is held, the recorded pid is a live daemon and is safe to signal.
  - If the lock is free, the holder is dead whatever the number says, so signal nobody.
  - Reject `old <= 1` regardless.
  - Stop unlinking the file in `drop_pidfile`. Removing a lock file lets two processes lock different inodes.

## High

**2. Two starters both win the takeover**
- **Location:** `daemon.py:1297-1314`; the loop at `:1403-1412` never re-checks ownership
- **Cause:** Read, kill, wait and write are not atomic.
  - Reproduced: two starters against one old daemon both reported owning the pid file, and both stayed alive.
  - The loser polls GitHub and publishes in parallel indefinitely. A later takeover only kills the pid in the file.
  - `open(PIDFILE, "w")` truncates before writing. A reader in that gap gets `ValueError`, sets `old = 0` and skips the kill.
- **Fix:** The flock from finding 1 is the atomic step. On contention, TERM the holder, wait on the lock with a deadline, then KILL. Short of that, re-read the pid file each cycle and exit if it names another process.

**3. Signal gaps leave the stale pid files that set off finding 1**
- **Location:** `daemon.py:1392-1395`, `:1413`
- **Cause:**
  - SIGHUP is unhandled, so its default action skips the `finally` that drops the pid file.
  - The daemon never calls `setsid`. It stays in herdr's session, or your terminal's, where a SIGHUP is likely.
  - Handlers are installed after the pid file is written, and the `try` begins later still. A TERM in that window also leaves a stale file.
- **Fix:** Install the TERM, INT and HUP handlers first, and move the takeover inside the `try`. With flock in place a stale file is harmless, so this drops to low severity.

## Medium

**4. A timeout kills only the direct child**
- **Location:** `run` `daemon.py:194-222`
- **Cause:**
  - Reproduced: `sh -c 'sleep 47 & wait'` with a 1 s timeout returned 124 and left the `sleep` running.
  - `examples/pr-signoff-jira` runs `curl` and a `shell=True` token command, each with its own 15 s timeout, under a 20 s daemon budget. A slow Jira can therefore orphan one `curl` per cycle.
  - Reproduced the reverse case too: a hook exits 0 at once but a backgrounded child keeps stdout open. `communicate()` waits for end of file, returns 124 after the full timeout, and the hook's answer is discarded.
- **Fix:** Start the child with `Popen(start_new_session=True)` and call `os.killpg` on timeout and on any `BaseException`. If the direct child has already exited, keep `TimeoutExpired.output` and its real return code.

**5. A transient git failure clears the token**
- **Location:** `git_branch` and `github_slug` `daemon.py:940-948`, used at `:1018-1023`, `:841`, `:822`
- **Cause:**
  - Return codes 124 (timeout) and 127 (cannot spawn) collapse to `""`, the same value as "no branch".
  - The row is then published with `--clear-token`, and its sort state is recorded as empty.
  - Every other path keeps the emoji until its TTL runs out when it gets no answer.
  - The 5 s git timeout is tightest when agents are building in every worktree.
  - stderr is discarded, so nothing is logged.
  - There is a `shutil.which` guard for `gh` but none for `git`. A missing `git` silently blanks every row every cycle.
- **Fix:** Separate "git answered empty" from "git did not answer". On 124 or 127, return `None`, skip the row, keep its state and log it.

**6. The sign-off hook blocks publication and its timeout has no ceiling**
- **Location:** `read_signoff` `daemon.py:271-275`, `resolve` `:929-936`, TTL at `:1029`
- **Cause:**
  - `resolve` waits for the hook before `decide` runs, so every row waits on the hook.
  - Any positive `signoffTimeoutSeconds` is accepted.
  - The real period is interval plus cycle time, against a TTL of three intervals. A timeout above roughly twice the interval expires every emoji. That contradicts the README's "costs its own glyph and nothing else".
- **Fix:** Clamp the timeout (for example to `interval // 2`) and log the clamp, the way the interval floor is logged. Sleep for `interval - elapsed`, measured with `time.monotonic()`.

**7. A slow herdr is treated as a dead herdr**
- **Location:** `herdr_json` `daemon.py:965`, `cycle` `:1013`, the loop at `:1404-1411`, `guarded_cycle` `:1055`
- **Cause:**
  - A timeout, a non-zero exit and unparseable JSON all return `None`.
  - Three in a row exit the daemon for good, because startup hooks only run when the server starts.
  - A cycle that raises an exception returns `True`. That resets the failure count, so a herdr that answers garbage never counts as gone.
- **Fix:** Count only clear absence, such as return code 127 or a missing socket path. Treat 124 as a skipped cycle. Do not reset `failures` when a cycle raises.

## Low

**8. The socket reply is read without a deadline or an id check**
- **Location:** `read_reply` and `socket_request` `daemon.py:1229-1267`
- **Cause:**
  - `settimeout` applies to each `recv`, not to the whole reply. A peer that trickles bytes without a newline blocks `--sort` forever while `buffer` grows.
  - The reply's `id` is never compared to the request's. The first line is taken as the answer, and any `"result"` key counts as success, even next to an `error`.
  - A failure at move k of n leaves the group half-sorted, and nothing re-reads the order to verify it.
- **Fix:** Add a monotonic deadline and a size cap. Read lines until the `id` matches. Treat a non-null `error` as failure. Re-plan after the batch and expect no moves.

**9. The `gh` guard fails silently, and the query travels in argv**
- **Location:** `main` `daemon.py:1372-1374`, `gh_graphql` `:859`
- **Cause:**
  - The check for `gh` runs before `redirect_to_log()` and returns 0.
  - If herdr is launched with a minimal `PATH` that lacks `/opt/homebrew/bin`, the daemon never starts, the log says nothing and the exit code reports success.
  - The whole query is passed as one argument. Linux caps a single argument at 128 KiB, which is roughly 200 branches. Past that, `E2BIG` makes every cycle return 127.
- **Fix:** Redirect to the log first and exit non-zero. Pass the query with `-F query=@-` on stdin, which `run(text=...)` already supports.

**10. The log is only trimmed at startup**
- **Location:** `redirect_to_log` `daemon.py:1346-1355`
- **Cause:** `LOG_LIMIT` is checked once, at startup. A daemon that lives for weeks and hits a recurring `gh` error logs a line naming every branch each cycle, without bound. The startup truncate also wipes the record of why the previous daemon died.
- **Fix:** Check the size at the start of each cycle (truncating is safe because the file is opened with `O_APPEND`), or rotate to `daemon.log.1`.

**11. The daemon and `--once` share one temp file name**
- **Location:** `save_states` `daemon.py:1108`
- **Cause:** The daemon and a `--once` refresh can both write `states.json.tmp`. The longer write's tail survives as invalid JSON, `load_states` returns `{}`, and the next sort falls back to names. The window is narrow.
- **Fix:** Use `tempfile.mkstemp(dir=STATE)`.

**12. `alive()` misreads EPERM and zombies**
- **Location:** `daemon.py:1317-1322`, `:1311-1312`
- **Cause:**
  - EPERM is read as "dead". That is accidentally safe for pid reuse, but it is wrong as a liveness test.
  - A zombie reads as alive. That causes a 5 s stall, a bogus "ignored TERM" log line and a pointless KILL.
  - There is no re-check after the KILL.
- **Fix:** The flock makes `alive()` unnecessary.

`★ Insight ─────────────────────────────────────`
- Findings 1, 2, 3 and 12 share one root cause: the pid file is treated as evidence, but it records only what was true when it was written. A lock records what is true now. The kernel drops it when the holder dies, whether by SIGKILL, SIGHUP or power loss. One `flock` call therefore covers four findings.
- The flock fix interacts with finding 4. A flock belongs to the open file description, so an orphaned grandchild that inherited the file descriptor would keep the daemon's lock held after the daemon died. Python protects you here: file descriptors are non-inheritable by default (PEP 446) and `subprocess` closes them. If you ever pass `close_fds=False`, the two findings combine.
- Finding 5 breaks a rule the rest of the file follows carefully. Everywhere else `None` means "nobody answered, so leave the row alone" and `""` means "answered, and there is nothing to show". `git_branch` is the one producer that maps "nobody answered" to `""`.
`─────────────────────────────────────────────────`