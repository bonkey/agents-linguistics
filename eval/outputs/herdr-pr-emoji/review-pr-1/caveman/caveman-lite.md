# caveman-lite / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-lite`  prompt: `review-pr-1`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 18  wall: 185s  api: 170s
- cost: $1.4975  output tokens: 14139  words: 811

---

## Verdict: request changes

Asking `ssh -G` what an alias points to is the right fix for the empty slug. Two defects block the merge, and both are small to fix. The branch is 15 commits behind `main` but merges cleanly. On the merged tree, all 173 tests pass. I ran everything from temporary copies and modified no file in the repository.

Line numbers refer to the PR head, `e9359c1`. `gh` is not authenticated here, so I fetched `refs/pull/1/head` with git. I could not see PR comments or CI status.

## Findings, most severe first

**1. Medium: a failed `ssh -G` call is cached as "not GitHub" until the daemon restarts.**
- **Location:** `daemon.py:541`, in `ssh_host_is_github`.
- **Cause:** `SSH_HOST_CACHE[host] = answer` stores `False` for every outcome, including a timeout (return code 124), an OS error (127) and a missing `ssh`. The cache is never cleared, and the daemon runs as one long-lived loop.
- **Reproduction:** I stubbed `run` to return 124 on the first call and a valid answer on the second. The slug stayed empty on the second cycle, and `ssh` was called only once.
- **Trigger:** `ssh -G` runs `Match exec` commands from `~/.ssh/config`. A 7-second `Match exec` ran in full, which is longer than `GIT_TIMEOUT` of 5 seconds.
- **Effect:** the repository silently shows no emoji, which is the failure this PR set out to fix. An alias added to `~/.ssh/config` after startup is also never picked up.
- **Fix:** write to the cache only when `rc == 0`, and clear `SSH_HOST_CACHE` at the start of each `cycle()`.
- **Wording:** the commit message says `ssh -G` reads the config "without touching the network". `Match exec` makes that untrue, so correct the message.

**2. Medium: an existing test now runs the real `ssh`, and the new function has no test.**
- **Location:** `test_daemon.py:757`, `test_other_remotes`. The new tests are at lines 742–755.
- **Cause:** `slug_from_url("git@gitlab.com:…")` is called without a resolver, so it now falls through to `ssh_host_is_github`.
- **Reproduction:** the `Remotes` tests spawn `['ssh', '-G', 'gitlab.com']`. That reads the developer's `~/.ssh/config` and runs any `Match exec` commands in it.
- **Side effect:** the tests leave `SSH_HOST_CACHE == {'gitlab.com': False}` in module state, which later tests inherit.
- **Coverage gap:** `ssh_host_is_github` has no test for output parsing, a non-zero return code, a missing `ssh`, or the cache.
- **Fix:** pass `lambda h: False` in `test_other_remotes`. Add tests that stub `daemon.run` and clear the cache in `setUp`. Cover a `hostname` match, an uppercase match, return code 124 not being cached, and `ssh` being absent.

**3. Low: an `ssh://` URL with a port never matches.**
- **Location:** `daemon.py:549`, in `alias_path`.
- **Cause:** for `ssh://git@github.com-work:22/owner/name`, the host passed to `ssh` is `github.com-work:22`. `ssh -G` echoes that string back as the hostname, so the slug is empty.
- **Fix:** strip the port in the `ssh://` branch with `host = host.partition(":")[0]`, after removing the user part.

**4. Low: an alias to `ssh.github.com` is rejected.**
- **Location:** `daemon.py:539`.
- **Cause:** the comparison accepts only `"github.com"`. GitHub's SSH-over-443 endpoint is a common alias target behind firewalls (`HostName ssh.github.com`, `Port 443`).
- **Fix:** compare against `("github.com", "ssh.github.com")`.

**5. Low: the host string reaches the `ssh` command line without validation.**
- **Location:** `daemon.py:535` and `daemon.py:553–556`.
- **Cause:** the host is everything before the first `:` in the URL. A host such as `-oFoo=bar` is parsed by `ssh` as an option. I checked this case: `ssh` exits 255 with no side effect, because no hostname follows. Local paths that contain a colon (`/srv/git/a:b/c.git`, `C:/…`) also spawn a pointless `ssh` call.
- **Fix:** call `["ssh", "-G", "--", host]`; I confirmed `ssh` accepts `--`. In `alias_path`, return `""` when the host starts with `-` or contains `/`. git applies the same guard to hosts.

**6. Low: the README does not mention the new behavior.**
- **Location:** `README.md:76`, `README.md:348` and `README.md:377`.
- **Cause:** the diff changes no documentation. Alias support, the optional `ssh` dependency and the restart needed after editing `~/.ssh/config` are all undocumented.
- **Multi-account caveat:** `gh` uses one active account. A repository behind the other account's alias is now queried and gets no answer, so `no answer for N branch(es)` is logged every cycle. `parse_lookup` tolerates a null repository, and other repositories are unaffected.
- **Fix:** add a short README paragraph covering all of this.

**7. Nit: the docstring is misleading.**
- **Location:** `daemon.py:529`.
- **Cause:** "this runs once per repository per cycle" reads as if the cache lasts one cycle. It lasts for the life of the process.
- **Fix:** reword it once the cache policy from finding 1 is settled.

## Checked, no defect found

- A plain alias resolves correctly.
- An uppercase `HostName GitHub.COM` matches, because the comparison lowercases the value.
- A `user@` prefix is stripped.
- Literal `github.com` URLs still take the fast path and spawn no `ssh`.
- Non-GitHub remotes still produce an empty slug.