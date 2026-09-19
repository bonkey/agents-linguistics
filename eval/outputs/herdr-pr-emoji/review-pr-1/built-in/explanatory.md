# explanatory / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `explanatory`  prompt: `review-pr-1`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 23  wall: 315s  api: 309s
- cost: $2.2629  output tokens: 25886  words: 1126

---

**Verdict: request changes** on PR #1, "Resolve ssh config host aliases to github.com".

The diagnosis is correct and `ssh -G` is the right way to resolve an alias. However, the cache can bring back the permanent silent failure the PR set out to fix (finding 1). Every fix below is small, so rejecting would be wrong.

The PR merges cleanly into current `main`, which is 15 commits ahead. Tests pass on the PR head (74) and on the merged result (173). The repo has no CI, so those local runs are the only check. `gh` was unauthenticated here, so I read the PR through the public API and `refs/pull/1/head`. Nothing was posted to GitHub and no file was changed.

Line numbers below refer to the PR head `e9359c1`.

## Findings, most severe first

**1. Medium: "not GitHub" answers are cached for the life of the daemon, including failed lookups**
- **Location:** `daemon.py:531-541`, where `SSH_HOST_CACHE[host] = answer` runs unconditionally.
- **Cause:**
  - A timeout (rc 124), a usage error (rc 255) and a missing `ssh` all store `False`, and nothing ever expires it.
  - With a stubbed `run`, the first cycle timed out and the second cycle had a healthy ssh. The slug stayed empty and ssh was called only once.
  - The same happens when the alias is added to `~/.ssh/config` after the daemon first saw the URL.
  - Either way, that host's workspaces stay blank until the daemon restarts, and nothing is logged.
- **Fix:**
  - Cache only when `rc == 0`.
  - Clear `SSH_HOST_CACHE` at the top of each `cycle()`, so it only avoids repeat lookups within one cycle.
  - One `ssh -G` call takes about 7 ms here, once per distinct host per cycle of at least 60 s.
  - Log a line when `rc != 0`, as `run_signoff` does.

**2. Medium: an existing test now runs the real `ssh`**
- **Location:** `test_daemon.py:757-764` (`test_other_remotes`).
- **Cause:**
  - The test calls `slug_from_url("git@gitlab.com:…")` with no resolver, so it falls through to `ssh_host_is_github`.
  - A spy on `run` recorded `['ssh', '-G', 'gitlab.com']`, and `SSH_HOST_CACHE` was left holding `{'gitlab.com': False}` after the test.
  - The PR description says the tests should not depend on the machine's ssh config, and this one now does.
- **Fix:** Pass `lambda host: False` in that test, or patch `daemon.run` in `Remotes.setUp` so any unexpected subprocess fails the test.

**3. Medium: the code that reads `ssh -G` output has no tests**
- **Location:** `daemon.py:523-542`.
- **Cause:** Both new tests inject a fake resolver. Parsing the `hostname` line, handling `rc` and the cache are never exercised, and finding 1 sits in that code.
- **Fix:**
  - Use `mock.patch.object(daemon, "run", ...)`, the idiom already used at `test_daemon.py:1028`.
  - Cover `hostname github.com` giving True and another hostname giving False.
  - Cover `rc != 0` giving False without caching it.
  - Cover a second call not spawning ssh again.

**4. Low–medium: only the exact string `github.com` counts, and ports are not stripped**
- **Location:** `daemon.py:539` and `daemon.py:548-554`.
- **Cause:**
  - GitHub's documented SSH-over-443 setup uses `HostName ssh.github.com`. An alias pointing there still comes back empty.
  - `ssh://git@alias:22/owner/name` hands `alias:22` to ssh unchanged, and ssh echoes `hostname github.com:22`.
  - GitHub's own `ssh://git@ssh.github.com:443/…` form fails the same way.
- **Fix:** Accept `{"github.com", "ssh.github.com"}` after `rstrip(".")`, and drop `:port` from the `ssh://` host before asking ssh.

**5. Low: the host reaches ssh unvalidated, so a leading `-` is read as an option**
- **Location:** `daemon.py:535` and `daemon.py:554-557`.
- **Cause:**
  - An origin of `git@-oProxyCommand=x:o/n.git` produces `['ssh', '-G', '-oProxyCommand=x']`. Locally, `ssh -G -V` exited 0.
  - The impact is contained. Only one argument is attacker-controlled, so ssh never gets a host and exits before reading its config or connecting.
  - Anyone who can write `.git/config` already has stronger options. git itself blocks this case ("strange hostname blocked").
- **Fix:**
  - Use `["ssh", "-G", "--", host]`.
  - Reject hosts that do not match `[A-Za-z0-9][A-Za-z0-9._-]*` in `alias_path`.
  - The second change also stops pointless ssh calls for origins like `C:/repos/app` or `foo/bar:baz`.

**6. Low: the README is now incomplete**
- **Location:** `README.md:14` and `README.md:377`.
- **Cause:**
  - The README lists the required tools and every subprocess each cycle runs. `ssh` is now an optional tool, and step 2 can run `ssh -G`.
  - The author's claim that nothing in the README became wrong holds; the README is missing things rather than incorrect.
  - `gh` uses one active account. A repo behind another account's alias comes back unanswered and logs `no answer for N branch(es)` every cycle. The daemon handles this correctly, but README readers are not told.
- **Fix:** Add one clause to each line, plus a sentence about the multi-account case.

**7. Nits**
- **`daemon.py:534`:**
  - **Cause:** `shutil.which("ssh")` is redundant, because `run` already turns a missing binary into rc 127.
  - **Fix:** Remove the check.
- **`daemon.py:535`:**
  - **Cause:** `GIT_TIMEOUT` is reused for a call that is not git.
  - **Fix:** Add an `SSH_TIMEOUT` constant.
- **`test_daemon.py:744`:**
  - **Cause:** `alias = lambda …` is the only assigned lambda in the test file.
  - **Fix:** Use a `def`.

## What is good

- Remotes that name `github.com` literally still match the prefix loop first, so the common case is unchanged.
- The optional `host_is_github` argument keeps the two new tests independent of the machine's ssh config; the pre-existing test in finding 2 is the exception.
- A repo the active `gh` account cannot see is logged as unanswered and does not break the rest of the lookup. Users with several accounts do not lose the emoji that already worked.
- Two URL forms the description does not mention now resolve: `org-123@github.com:o/n.git`, and aliases produced by `insteadOf` rewrites, since `git remote get-url` expands those.
- The author's offer of a follow-up PR that logs repositories seen against slugs resolved is worth accepting. It would also have made finding 1 visible.

For finding 1, the change is roughly:

```python
rc, out, _ = run(["ssh", "-G", "--", host], GIT_TIMEOUT)
if rc != 0:
    log("ssh -G %s exited %d, asking again next cycle" % (host, rc))
    return False            # not cached
...
SSH_HOST_CACHE[host] = answer
```

It also needs `SSH_HOST_CACHE.clear()` at the top of `cycle()`.

`★ Insight ─────────────────────────────────────`
- This daemon logs every failure it contains and lets stale emoji expire through TTLs. A cache with no expiry and no log line goes against both habits, which is why finding 1 outweighs its size.
- A cached "no" that came from a failed lookup is not the same as a cached "no" from a real answer. Cache only the real answers, and the cost is one 7 ms call per cycle.
- The injected resolver protects only the tests that pass it. `test_other_remotes` relies on the default, so it silently picked up the real `ssh`.
`─────────────────────────────────────────────────`