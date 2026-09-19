# caveman-ultra / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-ultra`  prompt: `review-pr-1`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 17  wall: 231s  api: 221s
- cost: $1.7558  output tokens: 18018  words: 664

---

**Verdict: request changes.** The bug is real and `ssh -G` is the right way to resolve the alias. But the permanent negative cache brings back the same silent empty sidebar the PR fixes, and the test suite now calls real ssh.

I verified on a scratch copy in `/tmp`, since deleted. The repo is untouched. `gh` has no auth, so I fetched the diff from the public API.

The PR base is `798dfa9`, 15 commits behind main. The patch applies clean on `81e8933` (offset 431) and 173 tests pass, so the PR's "74 tests" figure is stale. Ask for a rebase. Line numbers below are from the PR head.

**Findings, most severe first**

1. **`daemon.py:533-541` `ssh_host_is_github` — a failed lookup is cached as False for the daemon's lifetime.**
   - Cause: `SSH_HOST_CACHE[host] = answer` runs on every path, including rc 124 (timeout) and rc 255.
   - Probe: a first call returning 124 and a second returning `hostname github.com` both gave slug `''`, with cache `{'github.com-work': False}`.
   - One slow `ssh -G` at login blanks that host until the daemon restarts, with no log line.
   - An alias added to `~/.ssh/config` after the daemon starts is never seen.
   - Fix: cache only when rc is 0. Retry negatives each cycle, give them a TTL, or key the cache on the config mtime. Log once per host when ssh fails.

2. **`test_daemon.py:757` `test_other_remotes`, plus missing tests — the suite is not hermetic.**
   - Cause: the test calls `slug_from_url(url)` without a resolver, so it falls through to real ssh.
   - A logging stub `ssh` placed first in `PATH` recorded `-G gitlab.com` during the run.
   - The test therefore reads the machine's ssh config and fills the global `SSH_HOST_CACHE`. The PR body says it wanted to avoid exactly this.
   - `ssh_host_is_github` itself has no coverage: output parsing, caching, rc 124 or 255, missing `hostname` line, missing ssh.
   - Fix: pass `lambda h: False` in that test, or patch `daemon.ssh_host_is_github` in `Remotes.setUp`. Add tests that use `mock.patch.object(daemon, "run", ...)` and clear the cache.

3. **`daemon.py:547-549` `alias_path` — the `ssh://` branch keeps the port in the host.**
   - Cause: `rest.partition("/")` leaves `github.com-work:22` as the host.
   - Real `ssh -G github.com-work:22` returns `hostname github.com-work:22`, so the slug is empty.
   - `ssh://git@ssh.github.com:443/owner/name`, a form GitHub documents, fails the same way.
   - Fix: strip `:port` from the host in the `ssh://` branch, and handle `[v6]:port`.

4. **`daemon.py:539` — `== "github.com"` rejects `HostName ssh.github.com`.**
   - Cause: GitHub's documented port-443 setup uses that HostName.
   - Real `ssh -G` on such an alias returns `hostname ssh.github.com`, so the slug stays empty.
   - Fix: test `in ("github.com", "ssh.github.com")`.

5. **`daemon.py:535` and `:553-555` — the host reaches the ssh argv without validation.**
   - Cause: `url.partition(":")` takes anything before the first colon as the host.
   - Origin `-oProxyCommand=touch /tmp/x:o/n` hands the host `-oProxyCommand=touch /tmp/x` to `ssh -G`. `-F/tmp/evil/config:o/n` does the same.
   - It is not exploitable today: ssh exits 255 with usage because there is no positional host, and OpenSSH 10.3 rejects such a host even after `--`. Git blocks the same class of input (CVE-2017-1000117).
   - Junk hosts such as `./local` or `C` also start an ssh process each.
   - Fix: require `re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", host)` before the call, and put `"--"` before the host.

6. **`daemon.py:524-530` docstring and the PR claim — `ssh -G` does more than read the config file.**
   - Cause: `ssh -G` runs `Match exec` commands from the user's config; I confirmed a marker file was created. With `CanonicalizeHostname` set it also does DNS lookups.
   - The daemon now runs the user's `Match exec` commands in the background, once per host. Slow ones hit the 5s `GIT_TIMEOUT` and trigger finding 1.
   - Fix: say so in the docstring. Finding 1's fix covers the timeout.

7. **`daemon.py:555` — a leading slash in the path is rejected.**
   - Cause: `git@github.com-work:/octo-org/app.git` splits into three parts, so the slug is empty. Git accepts that form.
   - Fix: `path.lstrip("/")`.

No injection through the wider input: `lookup_query` escapes owner and name with `json.dumps`.