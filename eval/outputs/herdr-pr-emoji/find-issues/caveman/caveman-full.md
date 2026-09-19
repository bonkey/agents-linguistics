# caveman-full / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-full`  prompt: `find-issues`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 18  wall: 473s  api: 438s
- cost: $3.4782  output tokens: 35472  words: 1521

---

No files in the repo were changed. The probes ran in a temp directory outside the repo, which I removed afterwards. "Confirmed" below means a probe reproduced the behaviour; everything else is read from the code only.

**1. HIGH: the takeover signals whatever process the pid file names.** Confirmed.
- Location: `daemon.py:1297-1311` (`take_over_pidfile`), `1317-1322` (`alive`).
- Cause:
  - The only test is `os.kill(pid, 0)`, which does not check that the pid is a daemon. A stale file is left by SIGKILL, SIGHUP, a crash or power loss. If that pid has been reused, the takeover sends SIGTERM, then SIGKILL after 5 s, to an unrelated process. In the probe, a stale file named a `sleep` process, and that `sleep` exited with -15.
  - `int()` also accepts negative numbers. A file holding `-1` passes the gate, because `alive(-1)` returned True. `kill(-1, SIGTERM)` then signals every process the user owns.
- Fix:
  - Hold `fcntl.flock(LOCK_EX | LOCK_NB)` on the pid file for the daemon's whole life, so the lock, not the number, proves a daemon is alive.
  - The kernel drops the lock on any kind of death.
  - Signal the recorded pid only while another process holds the lock.
  - Reject `old <= 1`.

**2. MEDIUM-HIGH: one pid file serves every herdr session.** The mechanism is certain from the code; the sequence in your local log is my interpretation.
- Location: `daemon.py:52-58` (the path), `1393`.
- Cause:
  - The path ignores `HERDR_SOCKET_PATH`, but each daemon serves one server. Two sessions are running here (`default` and `tbtest`), and only one `bonkey.pr-emoji` state directory exists. I did not check whether herdr passes both sessions the same `HERDR_PLUGIN_STATE_DIR`.
  - Session B's startup daemon kills session A's. Nothing restarts A's, because startup hooks run only when the server starts.
  - When B stops, its daemon exits after 3 failures and no daemon is left. Your `daemon.log` for 2026-09-15 17:08–17:15 shows that shape, and no daemon is running now.
  - The same gap applies to a hand launch with no reachable herdr. It kills the healthy daemon first, then exits 2 intervals later.
- Fix:
  - Key the pid file by socket path, for example `daemon-<sha1(HERDR_SOCKET_PATH)[:8]>.pid`.
  - Run one `herdr workspace list` before the takeover.
  - If that fails, exit without touching the pid file.

**3. MEDIUM: there is no mutual exclusion, so two simultaneous starts both survive.** Confirmed.
- Location: `1297-1314`, loop at `1403-1412`.
- Cause:
  - Read, kill and write are three unlocked steps. `open(PIDFILE, "w")` truncates before it writes, so a concurrent reader sees an empty file, gets `ValueError`, and kills nothing.
  - In the probe, two daemons started together, both stayed alive, and the file named one of them. The loser never rechecks ownership, so it polls GitHub and publishes in parallel until its herdr dies. Later takeovers cannot see it.
- Fix:
  - Use the flock from finding 1.
  - At the top of each cycle, exit when the pid file no longer names `os.getpid()`.

**4. MEDIUM: a timeout kills only the direct child.** Confirmed.
- Location: `daemon.py:207-215` (`run`).
- Cause:
  - `subprocess.run` kills the child pid, not its process group. With `sh -c 'sleep … & wait'` and a 1 s timeout, the `sleep` was still alive afterwards.
  - `examples/pr-signoff-jira` spawns `curl` and `sh -c "$SIGNOFF_JIRA_TOKEN_CMD"`. A hung `op read` prompt would leak one process per cycle.
  - The same happens when the daemon itself receives SIGTERM.
- Fix:
  - Use `Popen(..., start_new_session=True)`.
  - On timeout and on any exception, call `os.killpg(proc.pid, signal.SIGKILL)`, then `wait()`.

**5. MEDIUM: a hook that exits 0 is treated as a timeout if a descendant still holds stdout.** Confirmed.
- Location: `daemon.py:207-213`.
- Cause:
  - `communicate()` waits for pipe EOF, not for the child to exit. In the probe the hook printed its answer and exited 0 immediately while a background child kept the pipe open. The result was `rc=124` after the full timeout, with the answer dropped.
  - The cycle stalls for `signoffTimeoutSeconds` every time this happens.
  - Separately, PIPE buffers unlimited output in memory, so a runaway hook can grow the daemon by gigabytes in 20 s.
- Fix:
  - Send stdout and stderr to `tempfile.TemporaryFile()`.
  - Call `proc.wait(timeout)`.
  - Then read the files, with a size cap.

**6. MEDIUM-LOW: the socket reply is not matched to the request `id`.** Confirmed against a stub; I did not verify that herdr ever sends unsolicited lines.
- Location: `daemon.py:1229-1267`.
- Cause:
  - The first line received counts as the reply. When another line came before the real reply, the result was `(False, {})`, although herdr would already have applied the move; the sort then stops half done. A reply carrying a different id plus a `result` field came back as `(True, …)`.
  - `settimeout` applies per `recv`, not per request, so a peer that trickles bytes never times out.
- Fix:
  - Use one deadline per request.
  - Read lines until `answer.get("id") == request_id`.
  - Skip the rest.

**7. LOW-MEDIUM: a sort is N unlocked requests planned from one snapshot.**
- Location: `daemon.py:1270-1291`.
- Cause:
  - Each move uses its own connection with a 10 s timeout, and a silent server blocked the probe for 10.0 s. A timed-out move is ambiguous, because the request was sent and herdr may still apply it. A failure leaves the group half moved.
  - Two `--sort` runs (the key pressed twice) interleave their `before_workspace_id` anchors.
- Fix:
  - Take a `flock` on a lock file in `STATE` for the whole sort.
  - On failure, list again and re-plan once.
  - The planner skips groups already in order, so a rerun converges.

**8. LOW-MEDIUM: signal handlers are installed late, and SIGHUP is not handled.**
- Location: `daemon.py:1393-1395`, with `try` at `1402`.
- Cause: The pid file is written before any handler exists, and the `try/finally` opens after `log`. A SIGTERM in those windows, or a SIGHUP at any time (a hand-launched terminal closing), ends the process and leaves the pid file behind. That stale file feeds finding 1.
- Fix:
  - Install TERM, INT and HUP handlers before `take_over_pidfile()`.
  - Move the takeover inside the `try`.

**9. LOW-MEDIUM: a slow herdr counts as a gone herdr, and a publish hang never counts at all.**
- Location: `daemon.py:965-972`, `1011-1014`, `1031-1039`, `1404-1411`.
- Cause:
  - A return code of 124 (the 10 s timeout) counts the same as connection refused. Three slow polls make the daemon exit permanently, and nothing restarts it until the server restarts.
  - Failures in `publish` are only logged. A herdr that answers list calls but hangs on `report-metadata` costs 10 s × (workspaces + panes) per cycle. The cycle then outlasts the TTL of 3 × interval, and the emoji flicker off.
- Fix:
  - Count only non-timeout failures toward exit.
  - Abort publication after 3 consecutive publish timeouts and return False.

**10. LOW: `gh api graphql` is not pinned to github.com.** Confirmed.
- Location: `daemon.py:859`.
- Cause: Slugs are filtered to github.com remotes, but `GH_HOST` in the server's environment redirects the query. With `GH_HOST=ghe.example.invalid`, gh reported "error connecting to ghe.example.invalid". With `--hostname github.com` added, it answered. Without the pin, every branch goes unanswered and rows go blank after the TTL.
- Fix: Use `["gh", "api", "--hostname", "github.com", "graphql", …]`.

**11. LOW: start failures are invisible.**
- Location: `daemon.py:1359-1362`, `1372-1374`, `1392`.
- Cause:
  - "gh is required" is logged before `redirect_to_log()` and the process exits 0. Nothing appears in `daemon.log`, and herdr sees success.
  - A server started with a short PATH (on this machine `gh` is a mise shim) means the daemon is silently absent.
  - A failure in `os.makedirs` is swallowed, and then `open(LOG)` raises uncaught.
- Fix:
  - In loop mode, redirect first.
  - Exit non-zero.
  - Log the makedirs error.

**12. LOW: `--once` and the loop share one temp file.**
- Location: `daemon.py:1108-1112`.
- Cause: The refresh action runs beside the loop, and both write `states.json.tmp`. It is the same inode, so interleaved JSON can be renamed into place. `load_states` then returns `{}`, the sort ranks every row last, and retained states are lost.
- Fix: Use `STATES + ".%d.tmp" % os.getpid()`.

**13. LOW: a zombie reads as alive.** Confirmed.
- Location: `daemon.py:1305-1312`.
- Cause: `kill(pid, 0)` succeeds on a zombie. If the old daemon's parent does not reap it, the takeover waits the full 5 s, logs "ignored TERM", and sends SIGKILL to a dead process.
- Fix: Use the flock from finding 1.

These came out clean:
- **git:** `git -C <pane cwd>` runs only `branch --show-current` and `remote get-url`. Neither refreshes the index or runs hooks, so `core.fsmonitor` in an untrusted repository never runs.
- **Hook:** it runs as a single argv with no shell.
- **gh:** `gh -f` does not expand `@file`.
- **Exceptions:** a SIGTERM during a child raises SystemExit past `except Exception`, which kills the direct child and reaches `finally`.
- **EPIPE:** a hook that ignores stdin is handled.

One side effect of my probing: my first probe's cleanup used `pgrep -f`, which matched its own wrapper shell and killed it (exit 144). I reran it matching exact command lines, and nothing in the repo was touched.