# caveman-ultra / find-issues

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-ultra`  prompt: `find-issues`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 11  wall: 301s  api: 283s
- cost: $2.3495  output tokens: 22315  words: 1402

---

I found 16 bugs and risks in `daemon.py`, most severe first. I reproduced items 1–3 with throwaway scripts outside the repo. The rest come from reading the code. No file in the repo was modified.

**1. HIGH: takeover kills an unrelated process**
- Location: `take_over_pidfile`, daemon.py:1302-1311.
- Cause: only `alive(old)` is checked, never process identity. The pid file goes stale after SIGKILL (including the takeover's own KILL path), OOM, SIGHUP, reboot or crash. The OS reuses the pid, and the next daemon start sends TERM then KILL to whatever process holds it. In my test an unrelated `sleep` died with -15.
- Fix:
  - Hold `fcntl.flock(LOCK_EX | LOCK_NB)` on the pid file for the daemon's lifetime. The kernel frees the lock on death, so a stale pid cannot hold it.
  - Signal the recorded pid only when the lock is busy.
  - As a fallback, check that `ps -o command= -p <pid>` names `daemon.py` before signalling.

**2. HIGH: double start, both daemons run**
- Location: daemon.py:1297-1314.
- Cause:
  - Read, check and write are not atomic. Two starters with no pid file both kept running, and the pid file named only one of them.
  - `open(..., "w")` truncates before it writes. A concurrent reader sees an empty file, gets `ValueError`, sets `old = 0` and kills nothing.
  - The loser never re-checks the pid file.
- Fix: the same flock as item 1. Alternatively, check each cycle that the pid file still holds `os.getpid()` and exit if not.

**3. MEDIUM: a timeout kills only the direct child**
- Location: `run`, daemon.py:207-215. It applies to `gh`, `git`, `herdr` and the sign-off hook.
- Cause:
  - `subprocess.run` sends SIGKILL to the child only. In my test the grandchild survived.
  - `examples/pr-signoff-jira` spawns `curl` and a `SIGNOFF_JIRA_TOKEN_CMD` shell. With 3 pages at 15 s plus 15 s for the token, it can exceed the 20 s default timeout. A hung Jira then leaves one orphan per cycle.
  - The daemon's SIGTERM path has the same gap.
  - A hook that exits 0 but leaves a background child holding stdout returns 124. `communicate` waits for EOF, so the successful answer is thrown away.
- Fix:
  - Start the child with `Popen(start_new_session=True)`.
  - On timeout or exit, call `os.killpg(pid, SIGKILL)`.
  - Follow that with a bounded `wait(timeout=...)`.

**4. MEDIUM: a `git` failure clears the emoji and the recorded state**
- Location: `git_branch` and `github_slug` (daemon.py:940-948), `cycle` (1018-1023), `plan_publications` (840-841), `plan_states` (821-822).
- Cause: any non-zero exit is read as "no branch". That covers rc 124 (5 s timeout under load), rc 127 (git missing) and rc 128 (`safe.directory` refusal). The row then gets `--clear-token` and an empty state, so `--sort` puts it last. This contradicts the rule that an unanswered row keeps its emoji until the TTL runs out.
- Fix:
  - Return `None` when rc is not 0.
  - Have the plan publish nothing for that row and keep its previous state.
  - Treat only rc 0 with empty output as a detached HEAD.

**5. MEDIUM: three herdr failures stop the daemon for good**
- Location: `main` (daemon.py:1401-1411), `herdr_json` (965-972).
- Cause:
  - A failure is any non-zero exit, a 10 s timeout or bad JSON from `herdr`.
  - A busy server or a binary swapped during an upgrade, three cycles in a row, makes the daemon exit 0.
  - Nothing restarts it, because `reload-config` and plugin enable do not run startup hooks.
  - `herdr`'s stderr is discarded, so the log shows no cause.
- Fix:
  - Exit only when `HERDR_SOCKET_PATH` is gone, the connection is refused, or `os.getppid() == 1`.
  - Otherwise back off and retry.
  - Log the exit code and stderr.

**6. MEDIUM: a missing `gh` stops the daemon silently**
- Location: daemon.py:1372-1374, which runs before `redirect_to_log` at 1392.
- Cause:
  - A herdr started by a GUI launcher or launchd can have a short PATH without `/opt/homebrew/bin`.
  - `shutil.which("gh")` then fails and the daemon never starts.
  - The message never reaches `daemon.log`, and the exit code is 0.
- Fix: redirect to the log first when running as the daemon, and return 1.

**7. MEDIUM: the sort is not atomic**
- Location: `sort_workspaces`, daemon.py:1273-1289.
- Cause:
  - One snapshot produces N moves, each on a separate connection, with no lock.
  - A sidebar change, or a second `--sort` from a key pressed twice, interleaves the moves or invalidates `before_workspace_id`.
  - The sort then stops midway and leaves a group split, with no re-plan.
- Fix:
  - Take a flock around the sort.
  - On failure, list the workspaces again and re-plan once.
  - Verify the final order.

**8. LOW-MEDIUM: socket reply handling**
- Location: `read_reply` (daemon.py:1229-1238), `socket_request` (1259-1267).
- Cause:
  - The first line on the socket is taken as the reply, and `id` is never matched against `request_id`. If herdr pushes any other line first, that line reads as the answer.
  - The timeout applies per `recv`, not to the whole request.
  - The buffer has no size limit.
- Fix: read lines until `answer["id"] == request_id`, with a total deadline and a size cap.

**9. LOW-MEDIUM: one pid file per user, not per server**
- Location: `STATE`, daemon.py:52-58.
- Cause: if herdr runs two servers, the second server's daemon kills the first. The survivor inherits one `HERDR_SOCKET_PATH`, so the other server's rows expire. I did not confirm that herdr allows two servers.
- Fix: key the pid file by a hash of the socket path.

**10. LOW: signal gaps**
- Location: daemon.py:1393-1402.
- Cause:
  - SIGHUP has no handler. A hand-launched daemon whose terminal closes dies without the `finally` block and leaves a stale pid file, which feeds item 1.
  - The handlers and the `try` come after the pid file write, so a TERM in that window also leaves a stale file.
- Fix:
  - Install the handlers and enter the `try` before `take_over_pidfile`.
  - Handle SIGHUP.

**11. LOW: unbounded wait after the kill**
- Location: `run`, daemon.py:214, where `subprocess.run` calls `process.wait()` with no limit.
- Cause: a child in uninterruptible sleep blocks the daemon forever, for example `git` on a dead NFS or sshfs mount. The tokens expire and no log line is written. After SIGKILL the takeover sleeps 0.5 s and does not re-check `alive` (1311-1312).
- Fix: use a bounded wait, abandon the child and log it. Re-check `alive` after the KILL.

**12. LOW: shared temporary states file**
- Location: `save_states`, daemon.py:1108.
- Cause: the path `STATES + ".tmp"` is fixed. The daemon and the `--once` refresh action can write it at the same time. The result is torn JSON or `os.replace` failing with ENOENT. `load_states` then returns `{}`, and both the sort ranks and `previous` are lost.
- Fix: `tempfile.mkstemp(dir=STATE)`.

**13. LOW: `gh` argv size and host**
- Location: `gh_graphql`, daemon.py:859.
- Cause:
  - The whole query is passed in argv. Linux `MAX_ARG_STRLEN` is 131072 bytes and each alias is about 520 bytes. Around 250 branches (easy to reach through `--resolve`) gives E2BIG, and every branch goes unanswered.
  - There is no `--hostname`. A `GH_HOST` in the environment sends the query to another host, while `slug_from_url` accepts only github.com.
- Fix:
  - Pass the query as `-F query=@-` on stdin.
  - Send the pairs in chunks.
  - Add `--hostname github.com`.

**14. LOW: `--resolve` crashes on a bad slug**
- Location: `lookup_query` (daemon.py:590), `read_pairs` (1068-1071).
- Cause: a slug without `/` makes `slug.split("/", 1)` raise an uncaught `ValueError`. The command prints a traceback and every answer is lost. `--query` validates the slug, but `--resolve` does not.
- Fix: drop or log such lines in `read_pairs`.

**15. LOW: inherited `GIT_*` environment**
- Location: `run` as called by `git_branch` and `github_slug`, daemon.py:941 and 947.
- Cause: a `GIT_DIR` or `GIT_WORK_TREE` inherited from the launching shell overrides `-C`. Every workspace then reads the same repo.
- Fix: strip `GIT_*` variables from the environment for `git` calls.

**16. LOW: log and output limits**
- Location: `redirect_to_log` (daemon.py:1349-1350), `run` (209-210).
- Cause:
  - The log size is checked only at startup, so a long-lived daemon grows the log without limit.
  - Truncating to 0 wipes the evidence of the crash that came before the restart.
  - The `PIPE` reads of stdout and stderr are unbounded. A runaway hook can exhaust memory until the OOM killer ends the daemon, which leaves a stale pid file.
- Fix: rotate to `daemon.log.1` with a per-cycle size check, and cap how much output is read.