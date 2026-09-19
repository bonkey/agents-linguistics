# concise / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `concise`  prompt: `review-pr-1`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 17  wall: 147s  api: 140s
- cost: $1.2803  output tokens: 11713  words: 588

---

**Verdict: request changes.** The diagnosis is right and the approach (`ssh -G` with a per-host cache) is sound. Finding 1 brings back the silent-blank failure the PR sets out to fix, and finding 2 undoes the test isolation the PR describes.

The PR (e9359c1) is 15 commits behind main but merges without conflicts, and all 173 tests pass on the merged tree. A real alias with `HostName github.com` resolves to `octo-org/app`. `gh` is not authenticated here, so I read the PR through a git fetch and the public API.

Findings, most severe first. Line numbers are from the merged tree.

1. **`daemon.py:966-972`, `ssh_host_is_github`: a failed lookup is cached as "not GitHub" for the life of the daemon.**
   - Cause: `answer = False` is stored in `SSH_HOST_CACHE` even when `ssh -G` exits non-zero, hits the 5-second timeout, or `ssh` is missing. One bad lookup, such as a slow `Match exec`, a DNS stall under `CanonicalizeHostname`, or `~/.ssh/config` being mid-edit, leaves every repository behind that alias blank until the daemon restarts. Nothing is logged.
   - Reproduced: with `ssh` failing once and then recovering, the slug stayed `''`.
   - Fix: cache only when `rc == 0` and a `hostname` line was parsed. Otherwise return False uncached and log once per host.

2. **`test_daemon.py`, `test_other_remotes`: the test now runs the real `ssh`.**
   - Cause: `slug_from_url("git@gitlab.com:…")` has no resolver argument, so it falls through to the real `ssh -G gitlab.com` and writes to the global `SSH_HOST_CACHE`. I traced the call. This is the dependence on the machine's ssh config that the PR description says it avoids.
   - Fix: pass `lambda h: False` in that test, or patch `daemon.ssh_host_is_github` for the whole `Remotes` class.

3. **`daemon.py:954`, `ssh_host_is_github`: the function has no tests.**
   - Cause: the new tests cover only the injected resolver. The `hostname` line parsing, the cache and the failure paths are never exercised.
   - Fix: add tests that `mock.patch.object(daemon, "run")` for a github.com answer, another host, a non-zero exit, a timeout, and "second call does not re-run".

4. **`daemon.py:976-980`, `alias_path`: an `ssh://` URL with a port never resolves.**
   - Cause: the port stays in the host string. `ssh://git@github.com-work:22/octo-org/app.git` asks `ssh -G github.com-work:22`, which reports `hostname github.com-work:22`, so the slug is `''`.
   - Fix: strip a trailing `:<digits>` from the host in the `ssh://` branch.

5. **`daemon.py:970`: only `github.com` is accepted, so `ssh.github.com` is rejected.**
   - Cause: GitHub's documented SSH-over-443 setup (`HostName ssh.github.com`, `Port 443`) is common on the firewalled multi-account machines this PR targets. Reproduced: such an alias returns `''`.
   - Fix: compare against `("github.com", "ssh.github.com")`.

6. **`daemon.py:967`: the host from the remote URL is passed to `ssh` as a bare argument.**
   - Cause: `git@-oProxyCommand=x:o/r` runs `ssh -G -oProxyCommand=x`. It is not exploitable here, because a single argument cannot be both an option and a host, so ssh exits 255 with a usage error. It is the same argument-injection shape as CVE-2017-1000117.
   - Fix: return `""` when the host starts with `-`, and call `["ssh", "-G", "--", host]`.

7. **Nits.**
   - `shutil.which("ssh")` is redundant, because `run` already returns 127 on `OSError`.
   - The docstring sentence "this runs once per repository per cycle" describes the caller, not the function.
   - The README Install line lists git and `gh` but not `ssh`, which is now an optional dependency; worth a clause.
   - The commit message says `ssh -G` never touches the network, but `CanonicalizeHostname` and `Match exec` can, which is what makes finding 1 reachable.

I changed no tracked files. I removed the temporary PR ref I fetched and the scratch copies under `/tmp`.