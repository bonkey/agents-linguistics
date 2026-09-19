# proactive / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `proactive`  prompt: `find-issues`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 15  wall: 398s  api: 363s
- cost: $2.8734  output tokens: 28957  words: 1950

---

I found 15 bugs and risks in `daemon.py`, listed below by severity. Findings 1–7 and 11 were reproduced in experiments against scratch state directories. Findings 8–10 and 12–15 come from reading the code and were not run. No files were modified, the tree is clean, and your real daemon and pid file were not touched.

## High

**1. The takeover can kill a process that is not the daemon** — `take_over_pidfile`, `daemon.py:1297-1312`
- **Cause:** The number in the pid file is trusted completely, and nothing checks that the pid is a pr-emoji daemon.
  - The file lives in `~/.local/state`, so it survives reboots. Any exit that skips the `finally` leaves it behind (see finding 3).
  - When that pid is reused, the next start sends SIGTERM and then SIGKILL to whatever owns it. In my test, a stale file naming an unrelated `sleep` got it killed in 0.5 s.
  - A negative number is accepted too. A pid file containing `-<pgid>` killed a whole process group, and `-1` would signal every process you own.
- **Fix:**
  - Hold an `fcntl.flock` on the pid file for the daemon's lifetime instead of testing pids. A lock that cannot be taken means a live daemon, and a dead daemon's lock goes away with it.
  - If you keep the kill, reject `old <= 1` and confirm identity before signalling, for example check that `ps -p <pid> -o command=` contains `daemon.py`.

**2. Two daemons that start together both survive** — `daemon.py:1302-1314`, `drop_pidfile` at `1332-1343`
- **Cause:** The read, kill, wait and write steps are not atomic, and the wait polls in 0.5 s steps, so the race window is at least that wide.
  - Two successors both read the old pid, both kill it, and both write the file. The loser then runs unnoticed, doubling every `gh` and `herdr` call.
  - I reproduced this. One later takeover killed only the daemon the file named, and the other copy kept running.
  - The `open(..., "w")` also truncates before it writes. A reader in that gap sees an empty file, takes `old = 0`, and skips the takeover.
- **Fix:**
  - Use the same `flock` as in finding 1, or create the file with `O_EXCL`.
  - Write through a temporary file and `os.replace`, as `save_states` already does.
  - At the top of each cycle, exit if the pid file no longer names this process.

**3. Signals other than TERM and INT leave a stale pid file** — `daemon.py:1393-1414`
- **Cause:** Only SIGTERM and SIGINT are handled. The `try/finally` starts after the pid file is written, the handlers are installed, and the first `log()` call has run.
  - In my test, SIGHUP killed the daemon and the pid file kept naming the dead pid. SIGHUP is what a closing terminal sends to a hand-launched copy. That stale file is the input to finding 1.
  - The daemon also never detaches: there is no `setsid` and stdin stays inherited, so it shares the launcher's session.
- **Fix:**
  - Handle SIGHUP (and SIGQUIT) the same way as SIGTERM, and install the handlers before taking the pid file.
  - Move `take_over_pidfile()` inside the `try`.
  - With `flock`, a stale file no longer matters.

## Medium

**4. A timeout kills only the direct child, and a lingering grandchild discards a good answer** — `run`, `daemon.py:206-215`
- **Cause:** `subprocess.run` kills one pid on timeout.
  - A hook such as `examples/pr-signoff-jira` runs `curl` underneath, and `gh` runs `git` and credential helpers. Those grandchildren are orphaned and keep running, so one can leak per cycle while an endpoint hangs. In my test, `sh -c 'sleep 47 & wait'` timed out and the `sleep` lived on.
  - The opposite case also fails. A hook that exits 0 with a valid answer, but leaves a background process holding stdout, blocks `communicate()` until the timeout. `run` then returns 124 with empty output, so the answer is thrown away.
- **Fix:**
  - Use `Popen(..., start_new_session=True)` and call `os.killpg(proc.pid, SIGKILL)` on timeout and on `SystemExit`.
  - Once the direct child has exited, stop waiting for the pipes to reach EOF and keep what was read.

**5. A failed git call is read as "no branch" and clears the row** — `git_branch` and `github_slug`, `daemon.py:940-948`; consumed at `1019-1023`
- **Cause:** Any non-zero return code becomes `""`. `plan_publications` and `plan_states` both treat an empty branch as nothing to say.
  - A 5 s timeout (124) or a missing `git` (127) therefore sends `--clear-token` for the workspace and every pane, and overwrites its sort state with `""`. My test reproduced exactly this.
  - A slow disk, a sleeping volume or an `index.lock` stall is enough to trigger it. The rest of the file holds the opposite policy: a row nobody answered for keeps its emoji until the TTL runs out.
- **Fix:** Return `None` for 124 and 127, and keep `""` for git's own "not a repo" and "no origin" exit codes. Have the two planners skip a `None` row, the way they skip an unanswered branch.

**6. A slow herdr is treated as a dead one, and the daemon exits for good** — `cycle`, `daemon.py:1011-1014`; `main`, `1404-1411`
- **Cause:** `herdr_json` returns `None` for a 10 s timeout and for unparsable output, the same as for "connection refused". After three such cycles the daemon logs "herdr is gone, exiting".
  - Only a server restart runs `[[startup]]` again, so every emoji expires until then.
  - `publish` never feeds the failure counter. A herdr that hangs mid-cycle costs `(workspaces + panes) × 10 s` of blocking, and the cycle still returns True.
- **Fix:**
  - Count only real absence towards the exit: return code 127, a connection-refused error, or a missing socket file.
  - Treat timeouts as a busy herdr and keep going.
  - Abort the publish loop after the first timeout.

**7. HTTP-level failures from `gh` are dropped without a logged cause** — `gh_graphql`, `daemon.py:864-867`
- **Cause:** A 401, a rate limit or an SSO failure returns a JSON object such as `{"message": "Bad credentials", ...}` that has neither `data` nor `errors`.
  - That object passes the `isinstance(body, dict)` check, so the function returns `(None, [])` and ignores stderr. My test confirmed this.
  - The log then shows only "no answer for N branch(es)", repeated every cycle, with no reason given.
- **Fix:** When `data` is `None` and `errors` is empty, build the error from `body.get("message")`, or from stderr and the return code.

**8. Total cycle time is unbounded, but the TTL assumes it is small** — `daemon.py:1029`, `1412`, `274-275`
- **Cause:** The real polling period is `interval` plus the cycle duration, because the sleep comes after the work. The TTL is `3 × interval`.
  - `signoffTimeoutSeconds` has no upper limit. Git costs up to 10 s per workspace, run one after another, and every publish is its own subprocess with a 10 s timeout.
  - A slow hook with a large timeout, or many workspaces on a slow mount, lets the tokens expire between refreshes.
- **Fix:**
  - Sleep for `max(0, interval - elapsed)`.
  - Cap the hook timeout, for example at `interval / 2`.
  - Compute the TTL from the measured period.

**9. One daemon per user, but herdr can run more than one server** — `STATE` and `PIDFILE`, `daemon.py:52-58`
- **Cause:** The XDG fallback gives every herdr server the same pid file. Starting herdr a second time, or hand-launching a copy with a different `HERDR_SOCKET_PATH`, kills the daemon serving the first server.
  - Both servers also write the same `states.json`.
  - The risk is smaller if herdr always passes a per-server `HERDR_PLUGIN_STATE_DIR`.
- **Fix:** Include the server's identity in the pid file and states file names, for example a hash of `HERDR_SOCKET_PATH`.

## Low

**10. A missing `gh` is reported where nobody looks** — `daemon.py:1372-1374`
- **Cause:** The check runs before `redirect_to_log()`, so the message goes to herdr's captured hook output, never reaches `daemon.log`, and the daemon exits 0. A herdr launched from a GUI with a minimal PATH, which cannot see Homebrew or mise shims, produces a daemon that never starts and no log entry saying so.
- **Fix:** Redirect to the log first, exit non-zero, and include the PATH in the message.

**11. The socket reply is never matched to its request** — `read_reply` and `socket_request`, `daemon.py:1229-1267`
- **Cause:** The first line received is taken as the reply, and only the presence of a `"result"` key is checked. In my test, a line with another id arrived first and the real error reply followed it. The request returned `(True, …)` and the sort went on to its next move.
  - The 10 s timeout applies per `recv`, not to the whole reply.
  - The read buffer has no size limit.
- **Fix:**
  - Read lines until one has `id == request_id`.
  - Use a single deadline for the whole exchange.
  - Cap the buffer size.

**12. The sort has no lock and works from a stale snapshot** — `sort_workspaces`, `daemon.py:1273-1291`
- **Cause:** The moves are planned from one `workspace list` and sent one connection at a time. Pressing the key twice interleaves two plans. A workspace closed during the sort makes a `before_workspace_id` disappear, and the sort stops with the group half-moved. A timeout after the request was sent is reported as "stopped after N", although that move may have been applied.
- **Fix:** Take an `flock` on a `sort.lock` file, and on any failure list the workspaces again and re-plan once.

**13. The states temp file has a fixed name** — `save_states`, `daemon.py:1108`
- **Cause:** The daemon, a `--once` refresh, and the duplicate daemon from finding 2 all write `states.json.tmp`. Two writers can interleave in the same file, and the one that renames it puts corrupt JSON in place. `load_states` then returns `{}`, so every workspace loses its sort rank.
- **Fix:** Use `tempfile.mkstemp(dir=STATE)`, or put the pid in the temp file name.

**14. Waiting for the old daemon misreads zombies and never checks the SIGKILL** — `alive` and `take_over_pidfile`, `daemon.py:1305-1312`, `1317-1322`
- **Cause:**
  - `kill(pid, 0)` still succeeds for a zombie whose parent has not reaped it. In my test, startup took 5.5 s and logged a false "ignored TERM, killing it".
  - After the SIGKILL the code sleeps 0.5 s and carries on without checking that the old process died.
  - `alive` treats a permission error (EPERM) as "dead".
- **Fix:** `flock` removes the problem. Otherwise check again after the SIGKILL, and return `False` from `alive` only for a "no such process" error (ESRCH).

**15. Smaller items**
- **No state directory (`daemon.py:1359-1362`):** A failed `makedirs` is ignored. `open(LOG)` or `open(PIDFILE)` then raises an uncaught traceback.
- **Log size (`daemon.py:1349`):** The log is checked against `LOG_LIMIT` only at startup, so a long-lived daemon grows it without limit.
- **Git environment (`daemon.py:940-948`):** Git runs with the inherited environment. If `GIT_DIR` or `GIT_WORK_TREE` is exported, for example when launched from a git alias or hook, `git -C` reports the wrong repository for every row. Remove `GIT_*` from the environment before git calls.
- **`--resolve` (`daemon.py:590`):** A stdin line whose slug has no `/` raises `ValueError` and stops the whole batch. `--query` validates this and `--resolve` does not.
- **Startup log line (`daemon.py:1398`):** It prints `icons["unstable"]`, which is a glyph, so with the nerd icon set the log reads `unstable=` followed by a private-use character instead of the setting name.

## Suggested order of fixes

Replacing the pid check with a lifetime `flock` on the pid file covers findings 1, 2 and 14, and makes the stale file in 3 harmless. After that, the process-group kill in finding 4 and the `None`-versus-`""` distinction in finding 5 are the two behaviour bugs most likely to show up in normal use.