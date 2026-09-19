# caveman-lite / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-lite`  prompt: `find-issues`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 11  wall: 327s  api: 319s
- cost: $2.6315  output tokens: 25518  words: 1495

---

I found 14 issues in `daemon.py`. The two most serious are in the pid file takeover: it can kill an unrelated process, and a concurrent start leaves two daemons running. No files were modified. Six items were confirmed by running the code and are marked "verified"; the rest come from reading the code.

## High

**1. Takeover kills an unrelated process after PID reuse**
- Location: `daemon.py:1297-1312`, `take_over_pidfile`.
- Cause: The pid read from the file is trusted with no check that it is this daemon. A stale file is left behind by power loss, a kernel panic, the OOM killer, `kill -9` or SIGHUP (see item 9). If that pid now belongs to another process of the same user, it gets SIGTERM and then SIGKILL 5 s later.
- Fix: Hold `fcntl.flock(LOCK_EX | LOCK_NB)` on the pid file for the life of the process, because the lock dies with the process. If you keep the current scheme, at least check that `ps -o command= -p <pid>` names `daemon.py` before signalling.

**2. The pid value is not validated** (verified)
- Location: `daemon.py:1299`, `1302-1311`.
- Cause: `int("-1")` parses, and `os.kill(-1, 0)` succeeds, so `alive(-1)` is True. `kill(-1, SIGTERM)` and later SIGKILL then hit every process the user owns. A value like `-4242` hits a whole process group. A huge value raises `OverflowError`, which `except OSError` does not catch, so the daemon crashes on every start until someone fixes the file by hand.
- Fix: Accept only `1 < pid < 2**22`, and catch `OverflowError` alongside `OSError`.

## Medium

**3. Concurrent starts leave two daemons running**
- Location: `daemon.py:1297-1314`; the main loop at `1403-1412` never re-checks who owns the pid file.
- Cause: Reading the file, killing the old daemon and writing the new pid are not atomic. Two starters, such as the server hook and a hand launch, both pass the check and both write, and the last writer wins. The loser keeps polling forever, and no later takeover finds it because its pid is no longer in the file. The `open(..., "w")` truncate-then-write sequence also lets a concurrent reader see an empty file, which parses as `old = 0`, so it kills nobody.
- Fix: Use the same `flock` as item 1. As a fallback, re-read the pid file each cycle and exit when it holds another pid.

**4. A git failure or timeout blanks the row** (verified)
- Location: `daemon.py:940-948`, `1019-1023`, `830-846`.
- Cause: A return code of 124 (timeout) or 127 (no git) collapses to `""`, the same value as "no branch". `plan_publications` then sends `--clear-token`, and `plan_states` records `""`. I simulated a 5 s git timeout: the cycle published `('workspace','w1','')` and overwrote the stored `mergeable` state. This contradicts the rule that a failure keeps the emoji until its TTL runs out. The git stderr is also discarded, so nothing is logged.
- Fix: Return `None` for 124, 127 and unexpected return codes. Keep git's own 128 ("not a repository") and 2 ("no origin") as "nothing to say". Carry the `None` through the rows to `plan_publications`, and log the stderr.

**5. A `log()` failure kills the daemon** (verified)
- Location: `daemon.py:187-191`, `1053-1054`, `1408`.
- Cause: stderr is the log file, so a full disk or a quota limit makes `log` raise `OSError`. Inside the `except` of `guarded_cycle` that error escapes the guard. I confirmed `OSError(28)` leaks out. Nothing restarts the daemon, so every emoji expires.
- Fix: Wrap the write and flush in `log` with `try/except OSError: pass`.

**6. The old daemon is killed before the new one has secured its place**
- Location: `daemon.py:1313-1314`; also `1353`, and the swallowed `makedirs` error at `1360-1362`.
- Cause: The `open(PIDFILE, "w")` and the write are unguarded and run after the old daemon is already dead. Any `OSError` there (disk full, read-only directory) leaves no daemon at all.
- Fix: Acquire the lock, or write a temp file and `os.replace` it, before signalling the old daemon. Catch `OSError`, and either run without a pid file or abort before the kill.

**7. A timeout kills only the direct child** (verified)
- Location: `daemon.py:207-215`; this matters most for `run_signoff` at `880`.
- Cause: `subprocess.run` sends SIGKILL to the direct child only. With `sh -c "sleep 7 & wait"` and a 1 s timeout, `sleep` survived as an orphan. `examples/pr-signoff-jira` allows 15 s per call for a token command plus up to 3 pages, which can exceed the 20 s default, so `curl` or `op` is orphaned each cycle. The SIGTERM exit path has the same gap. A second effect: a hook that answers and exits 0 while a grandchild still holds the stdout pipe comes back as 124, and its answer is discarded.
- Fix: Start the child with `Popen(..., start_new_session=True)`. On timeout, and on any `BaseException`, call `os.killpg(proc.pid, SIGKILL)` and then wait.

## Medium-low

**8. The reason for an HTTP-level `gh` failure is lost** (verified)
- Location: `daemon.py:859-867`.
- Cause: On a 401, 403, rate limit or 502, `gh` prints a JSON body such as `{"message": ...}` on stdout, puts the reason on stderr, and exits 1. The body parses as a dict with no `data` and no `errors` key, so the function returns `(None, [])`. The log shows only "no answer for N branch(es)", and "Bad credentials" never appears.
- Fix: When `rc != 0` and there are no `errors`, synthesize one from `err.strip()` or `body.get("message")`.

**9. The herdr "unreachable" check conflates several causes and ends the daemon for good**
- Location: `daemon.py:965-972`, `1011-1014`, `1406-1411`.
- Cause: A 10 s timeout, a missing `herdr` binary (127) and invalid JSON all count as "herdr is gone". Three in a row exit the daemon, and the startup hook never runs again. The herdr stderr is discarded, so the log has no reason.
- Fix: Count only a connection failure (socket missing or refused) as "gone". Back off on timeouts, and log the return code and the last stderr line.

**10. Signal setup happens too late and misses SIGHUP**
- Location: `daemon.py:1393-1395`.
- Cause: The handlers are installed after the pid file is written, and the `try/finally` starts at line 1402. A SIGTERM in that window leaves a stale file. SIGHUP is never handled, so its default action skips `drop_pidfile`. Both produce the stale file that item 1 depends on.
- Fix: Install handlers for TERM, INT and HUP before `take_over_pidfile`, and put the takeover inside the `try`.

## Low

**11. The sign-off hook can delay every row**
- Location: `daemon.py:929-936`, `274-275`, `270`.
- Cause, timing: The hook runs before anything is published, and `signoffTimeoutSeconds` has no upper bound. A slow hook delays every row and can outlast the TTL of 3 × interval. That contradicts "costs its own glyph and nothing else".
- Cause, docs: `config.example.toml` and the Jira hook say a row "keeps the glyph it has". `decide` actually republishes without the glyph, so the glyph disappears on the next cycle.
- Cause, path: A relative `signoffCommand` resolves through PATH or the daemon's working directory.
- Fix: Clamp the timeout to at most the interval. Cache the last answer and reuse it on a hook failure, or correct the docs. Require an absolute path after `expanduser`.

**12. The branch lookup is all-or-nothing**
- Location: `daemon.py:859`, `586-607`.
- Cause: All branches go into one query on argv with one 30 s timeout. I measured about 477 bytes per branch. Linux caps a single argument at 128 KiB, so around 270 branches produce `E2BIG` (return code 127). GitHub's 10 s server-side limit is likely to hit sooner.
- Fix: Send chunks of about 50 branches, and pass the query on stdin with `-F query=@-`.

**13. `socket_request` and the sort are loosely checked**
- Location: `daemon.py:1229-1267`, `1273-1289`.
- Cause, reply handling: The reply `id` is never matched to the request. `settimeout` applies to each `recv`, not to the whole reply, and the buffer has no size limit.
- Cause, two transports: The workspace list comes from the CLI, but the moves go to `HERDR_SOCKET_PATH`. A stale environment variable sends them to a different server.
- Cause, unguarded parsing: `sort_workspaces` parses outside any guard, so a non-dict JSON answer produces a traceback.
- Fix: Check `answer.get("id") == request_id`, use an overall deadline, and cap the buffer. Read the list over the same socket as the moves, and wrap the parsing.

**14. `--once` and the daemon share `states.json.tmp`**
- Location: `daemon.py:1108`.
- Cause: The refresh action runs a full cycle next to the daemon. Both writers can interleave in the shared temp file, and the GitHub requests and the hook run twice.
- Fix: Use `tempfile.mkstemp(dir=STATE)`. Have `--once` try the `flock` and skip the cycle when it cannot get it, or send the daemon SIGUSR1 to poll immediately.

Smaller risks: the environment is never scrubbed, so `GH_HOST` sends github.com slugs to another host (add `--hostname github.com`), and an inherited `GIT_DIR` overrides `-C path`. `os.path.isdir` and the `wait()` after a kill have no time bound, so a dead network mount can hang them.