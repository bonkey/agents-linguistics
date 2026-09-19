# caveman-full / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-full`  prompt: `review-pr-1`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 19  wall: 227s  api: 203s
- cost: $1.6664  output tokens: 16167  words: 842

---

## Verdict: request changes

The bug is real, and `ssh -G` is the right way to resolve an alias. The PR merges clean onto current `main`, and 173 tests pass on the merged tree.

The blocker is finding 1: the fix can bring back the same silent empty sidebar it removes. Findings 2–4 are cheap to fix in the same round. Line numbers below refer to PR head `e9359c1`.

### Findings, by severity

1. **`daemon.py:541`, `ssh_host_is_github` — a failed lookup is cached for the whole daemon lifetime.**
   - Cause: `SSH_HOST_CACHE[host] = answer` runs for every outcome, including timeout (rc 124), rc 255 and a missing `ssh`, and the cache never expires.
   - I confirmed this: after a simulated `ssh` timeout, a second call still returned `False` even though `ssh` would then have answered `github.com`.
   - A `Match … exec "sleep 8"` line in the ssh config took 8.09 s under `ssh -G`, which is longer than `GIT_TIMEOUT = 5`. So `ssh -G` does run config commands and can time out.
   - Editing `~/.ssh/config` after the daemon starts is also ignored until restart.
   - The docstring at line 528 says "once per repository per cycle", but the code runs once per host per daemon lifetime.
   - Fix: cache only answers where `rc == 0`. Clear the cache at the start of each `cycle()`. Log once when `ssh -G` fails.

2. **`test_daemon.py:757`, `test_other_remotes` — the test runs the real `ssh`.**
   - Cause: `slug_from_url("git@gitlab.com:…")` is called with no resolver, so it falls through to `ssh_host_is_github`.
   - A spy on `daemon.run` confirmed the test spawned `['ssh', '-G', 'gitlab.com']`.
   - The PR body says the tests do not depend on the machine's ssh config; this one now does. It also leaves an entry in the global cache for later tests.
   - Fix: patch `daemon.ssh_host_is_github` in `Remotes.setUp`, or pass `lambda h: False`.

3. **`daemon.py:535` — the host string reaches the `ssh` command line without validation or `--`.**
   - Cause: the host comes from the `origin` URL of any directory a pane sits in, because `workspace_rows` falls back to the pane cwd.
   - A URL such as `-oProxyCommand=x:o/n` results in `ssh -G -oProxyCommand=x`.
   - It is not exploitable on this machine. A single option-like argument gives a usage error (rc 255) and no file is written. OpenSSH 10.3 also rejects shell metacharacters in the hostname.
   - On OpenSSH older than 9.6 with `Match exec … %h` in the config, a hostile hostname would be expanded in a shell (the CVE-2023-51385 class of bug).
   - Fix: return `""` unless the host matches `^[A-Za-z0-9][A-Za-z0-9._-]*$`, and run `["ssh", "-G", "--", host]`. The regex also stops local paths such as `./weird:dir/app` from spawning `ssh`.

4. **`daemon.py:549`, `alias_path` — a port in an `ssh://` URL breaks the lookup.**
   - Cause: `rest.partition("/")` keeps `:22` in the host, so `ssh -G github.com-work:22` reports `hostname github.com-work:22` and the slug comes back empty (checked against real `ssh -G`).
   - This hits `ssh://git@ssh.github.com:443/owner/name.git`, GitHub's SSH-over-443 URL form.
   - Fix: strip `:port` and any `[]` brackets from the host before asking ssh.

5. **`daemon.py:539` — only `github.com` counts as GitHub.**
   - Cause: the comparison is an exact match on one name. An alias with `HostName ssh.github.com` and `Port 443` (the firewall setup) resolves to `False`; I checked this against a test config.
   - Fix: compare against `("github.com", "ssh.github.com")`.

6. **`test_daemon.py` — `ssh_host_is_github` has no test.**
   - Cause: both new tests inject a fake resolver. The output parsing, the return-code handling, the cache and the missing-`ssh` branch are never exercised.
   - Fix: patch `daemon.run` and cover four cases: a `github.com` answer, another host, a non-zero return code that must not be cached, and `ssh` missing.

7. **`README.md:377` — step 2 of "How it polls" no longer lists every local command.**
   - Cause: the step lists the local commands run per workspace, and `ssh -G <host>` is now one of them. The PR body says the README is unaffected.
   - Fix: add `ssh -G` to step 2, with a note that `Match exec` lines in the ssh config will run.

8. **`daemon.py:520,560` — nit: the new code departs from how the rest of the module is written.**
   - Cause: `SSH_HOST_CACHE` is the first mutable module-level global in `daemon.py`. The `host_is_github=None` parameter exists only for tests, while the rest of the suite uses `mock.patch.object(daemon, …)`.
   - Fix: drop the parameter and patch in the tests instead. The per-cycle clear from finding 1 keeps the cache short-lived.

### Worth keeping
- Literal `github.com` URLs still take the prefix path, so they never spawn `ssh`.
- `org-123@github.com:owner/name` now resolves, which is a useful side effect.
- The slug is still inserted into the GraphQL query through `json.dumps`, so the freer path parsing adds no injection risk.

### Housekeeping
- No repository file was modified.
- I created a local branch `pr-1` and a scratch directory in `/tmp` for the checks, and deleted both.
- `gh` is not authenticated here, so I read the PR metadata and its one comment through the public API. The comment is a CodeRabbit auto-skip notice with nothing to act on.