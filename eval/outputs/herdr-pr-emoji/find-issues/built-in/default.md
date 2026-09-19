# default / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `default`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 18  wall: 410s  api: 393s
- cost: $3.1042  output tokens: 31349  words: 1462

---

I found 11 bugs and risks; the worst is the pid file takeover, which can kill an unrelated process. No files were modified. Findings 1, 2, 3, 7 and 8 were reproduced with throwaway probes against a temporary state dir, and the rest come from reading the code. `test_daemon.py` has no tests for the takeover or the signal path; it only asserts the `PIDFILE` path at line 1818.

## High

**1. Takeover signals whatever pid the file names**
- **Location:** `take_over_pidfile`, `daemon.py:1297-1311`
- **Cause:**
  - There is no check that the pid in the file is a daemon. A stale file survives a reboot, because it lives in `~/.local/state`, and pids get reused.
  - The file is left stale by any death that skips the `finally`: an external SIGKILL, power loss, or SIGHUP when a hand-launched daemon's terminal closes (see #6).
  - Probe: a pid file naming an unrelated `sleep` got SIGTERM, and would have got SIGKILL 5 s later.
  - `int()` also accepts `-1`, and `alive(-1)` returns True. `kill(-1, SIGTERM)` then hits every process you own, and `-N` hits a whole process group.
- **Fix:**
  - Make an `fcntl.flock` on a lock file, held for the daemon's lifetime, the proof of liveness. The kernel drops it on any death, so it can never go stale.
  - Only signal `old` when the lock is held, `old > 1`, and `ps -o command= -p old` names `daemon.py`.

**2. Takeover is not mutually exclusive**
- **Location:** `daemon.py:1297-1314`
- **Cause:**
  - The read, kill and write steps run with no lock between them.
  - Probe: two starters at the same instant both survived, and the pid file named one of them.
  - The loser polls in parallel forever and is invisible to every later takeover, because nothing re-reads the file.
  - The write truncates before it writes. A reader in that gap gets `ValueError`, sets `old = 0`, and skips the takeover.
- **Fix:**
  - Use the same lock: try `LOCK_EX|LOCK_NB`, and if that fails, TERM the holder and wait for the lock with a deadline.
  - Write the pid through a temp file and `os.replace`.
  - At the top of each cycle, exit if the pid file no longer names this process.

## Medium

**3. A timeout kills only the direct child**
- **Location:** `run`, `daemon.py:207-215`
- **Cause:**
  - `subprocess.run` SIGKILLs `argv[0]` only.
  - Probe: `run(["sh","-c","sleep 47 & wait"], 1)` returned 124 after 1 s, and `sleep` lived on as an orphan.
  - A sign-off hook that wraps `curl`, as `examples/pr-signoff-jira` does with 15 s per call against the daemon's 20 s, can leak one `curl` per cycle while the endpoint hangs. Nothing enforces a timeout on the orphan.
  - The same happens on shutdown, when the handler's `SystemExit` lands inside `subprocess.run`.
  - On Python older than 3.7.5 this case hangs the daemon instead of leaking.
- **Fix:** Use `Popen(..., start_new_session=True)` with `communicate(timeout=...)`. On timeout or any `BaseException`, call `os.killpg(proc.pid, SIGKILL)` and then `wait()`.

**4. The cycle has no time budget and the sleep ignores cycle time**
- **Location:** `daemon.py:1029-1039`, `1412`, `274`
- **Cause:**
  - Publishing runs one `herdr` subprocess per workspace and per pane, each with up to 10 s, and a failure is only logged.
  - A blocked server costs (workspaces + panes) × 10 s. The header comment at lines 17-19 says herdr's main thread can block.
  - On top of that come git at 2 × 5 s per workspace, gh at 2 × 30 s, and an uncapped `signoffTimeoutSeconds`.
  - The loop then sleeps a full `interval`, so the period is the interval plus the cycle time. The TTL is a fixed 3 × interval, so a slow cycle expires every emoji while the daemon is healthy.
- **Fix:**
  - Stop publishing on the first rc 124 or 127 and return False.
  - Sleep until `start + interval`, measured with `time.monotonic()`.
  - Clamp the hook timeout below the interval.

**5. A busy herdr is treated the same as a gone herdr**
- **Location:** `herdr_json` (`daemon.py:965-972`), `1013-1014`, `1407-1411`
- **Cause:**
  - A timeout, any non-zero exit, or unparsable JSON counts as "unreachable". Three in a row exit the daemon for good.
  - `README.md:429` says nothing restarts it until the server restarts.
  - A busy server, or a CLI and server version mismatch after an upgrade, therefore means no emoji until the next server restart.
- **Fix:** Exit only on evidence the server is gone: `HERDR_SOCKET_PATH` is missing, the connection is refused, or the parent pid changed. Otherwise back off and keep trying.

## Low

**6. Signal handling gaps**
- **Location:** `daemon.py:1393-1395`, `1402-1414`
- **Cause:**
  - Handlers are installed after the pid file is written, and the `try/finally` starts later still. A TERM in that window leaves a stale file, which feeds #1.
  - SIGHUP is not handled.
  - `sys.exit` in the handler raises at an arbitrary bytecode. A second TERM during `drop_pidfile` skips the cleanup.
- **Fix:**
  - Install TERM, INT and HUP handlers before `take_over_pidfile()`, and open the `try/finally` there.
  - Have the handler set a flag, and have the loop wait on an `Event.wait(interval)`.

**7. `alive()` reads a zombie as alive and EPERM as dead**
- **Location:** `daemon.py:1317-1322`, `1305-1312`
- **Cause:**
  - Probe: a predecessor that exited on TERM but had not been reaped stayed "alive" for the full 5 s. The log said "ignored TERM, killing it".
  - This is likely whenever herdr is slow to reap its startup hook.
  - After the SIGKILL, nothing re-checks that the process is gone.
- **Fix:**
  - The lock from #1 makes the wait "lock released", which zombies cannot fool.
  - Otherwise treat a `ps -o stat=` of `Z` as dead.
  - Treat `PermissionError` as "alive, not ours, do not take over".

**8. `gh_graphql` drops the reason for an HTTP-level failure**
- **Location:** `daemon.py:859-867`
- **Cause:**
  - Probe: a rejected token returns `(None, [])`.
  - gh prints `{"message":"Bad credentials",...}` on stdout. That is a dict with no `errors` key, and the code reads stderr only when stdout is not JSON.
  - The log repeats "no answer for N branch(es)" with no cause. The same goes for a 403 rate limit or a SAML block, and there is no backoff.
- **Fix:**
  - When `data` is None and `errors` is empty, build the error from `body.get("message")`, stderr and the exit code.
  - Back off on 401 and 403.

**9. `gh` host and argument size**
- **Location:** `daemon.py:859`
- **Cause:**
  - Without `--hostname github.com`, a `GH_HOST` in the environment sends github.com repository names to an Enterprise host.
  - The whole query is one argument at about 0.5 KB per branch, and Linux caps a single argument at 128 KiB. At roughly 250 branches the call fails with `E2BIG`, which `run` reports as 127, and every branch goes unanswered.
- **Fix:** Pass `--hostname github.com`, and send `{"query": ...}` on stdin with `--input -`.

**10. Socket requests**
- **Location:** `read_reply` and `socket_request` (`daemon.py:1229-1267`), sort loop (`daemon.py:1283-1289`)
- **Cause:**
  - `settimeout` applies per `recv` and the buffer is unbounded, so a peer that trickles bytes with no newline holds `--sort` open forever.
  - The reply `id` is never compared with the request's. herdr's schema (protocol 22) puts `id` on both reply shapes and sends `{event, data}` lines to subscribers. A connection that does not subscribe sees only the reply today, so this is latent.
  - The sort sends N moves over N connections, planned from one `workspace list` snapshot. There is no lock against a second `--sort` and no re-list.
  - A workspace closed mid-sort, or a key pressed twice, stops the sort half done. A timeout leaves the outcome of the in-flight move unknown.
- **Fix:**
  - Give each request a `time.monotonic()` deadline and a size cap.
  - Read lines until the `id` matches.
  - Take a lock around the sort, and re-list and re-plan once on failure.

**11. Minor**
- **Shared temp file, `daemon.py:1108`:**
  - **Cause:** `save_states` uses a fixed temp name. The loop and a concurrent `--once` share it, and can splice `states.json` into invalid JSON, which `load_states` reads as `{}`.
  - **Fix:** Use `tempfile.mkstemp(dir=STATE)`.
- **Log size, `daemon.py:1349`:**
  - **Cause:** The log is truncated only at startup, so a long-lived daemon outgrows `LOG_LIMIT`.
  - **Fix:** Check the size inside the loop.
- **Missing-`gh` message, `daemon.py:1373`, `1392`:**
  - **Cause:** "gh is required" is written before `redirect_to_log()`, so it never reaches `daemon.log`. That is the likely failure when herdr starts from a GUI `PATH` without your mise shims.
  - **Fix:** Redirect the output first when starting as the daemon.

One side effect of my testing: a probe's `pkill -f "sleep 47"` also matched an unrelated zsh process, a shell wrapper from another Claude Code session running a similar probe. That process was gone when I checked afterwards. Later probes killed by pid only.