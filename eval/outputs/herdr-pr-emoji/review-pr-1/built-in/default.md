# default / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `default`  prompt: `review-pr-1`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 24  wall: 255s  api: 249s
- cost: $1.9875  output tokens: 20387  words: 913

---

## Verdict: request changes

PR #1 fixes a real bug with the right approach, but findings 1 and 2 should be fixed before merge. It merges cleanly onto current `main`, which is 15 commits ahead of the PR's base. Tests pass at the PR head (74, as claimed) and on the merge result (173). The README claim holds. Nothing downstream breaks: `parse_lookup` and `plan_publications` already handle a repo that `gh` can't see.

Line numbers refer to the PR head `e9359c1`.

## Findings, most severe first

**1. Medium: one transient `ssh -G` failure disables a host until herdr restarts, and nothing is logged**
- **Location:** `daemon.py:533-542`, `ssh_host_is_github`.
- **Cause:**
  - `answer = False` is stored in `SSH_HOST_CACHE` on every path, including a timeout (`rc == 124`), an ssh config parse error (`rc == 255`), and a missing `hostname` line.
  - The cache never expires, and the process lives as long as herdr does.
  - The 5 s `GIT_TIMEOUT` is reachable, because `ssh -G` runs `Match exec` commands. I confirmed this on OpenSSH 10.3 with a scratch config.
  - I simulated one timeout followed by a healthy ssh. Both cycles returned an empty slug, ssh was called once, and the cache held `{'github.com-work': False}`.
  - The result is the same silent empty sidebar this PR set out to fix.
- **Fix:**
  - Cache only a definitive answer: `rc == 0` and a `hostname` line was found.
  - On failure, `log()` the host, return code and stderr, and leave the host uncached so the next cycle retries.

**2. Medium: the suite now runs the real `ssh`, and the function that is the fix has no test**
- **Location:** `test_daemon.py:757-764` (`test_other_remotes`), and the new tests at `742-755`.
- **Cause:**
  - `test_other_remotes` calls `slug_from_url("git@gitlab.com:…")` with no resolver, so it now falls through to `ssh_host_is_github`.
  - I spied on `daemon.run` during the `Remotes` tests. It recorded `['ssh', '-G', 'gitlab.com']` and left `SSH_HOST_CACHE == {'gitlab.com': False}`.
  - That is the dependence on the test machine's ssh config that the PR description says the injected resolver avoids.
  - Both new tests inject a lambda, so the `ssh -G` output parsing, the return-code handling and the cache are never exercised.
- **Fix:**
  - Pass `lambda h: False` in `test_other_remotes`.
  - Add tests for `ssh_host_is_github` with `daemon.run` and `shutil.which` stubbed. Cover the `hostname github.com` line, another hostname, `rc != 0`, a missing ssh binary, and a cache hit.
  - Clear `SSH_HOST_CACHE` in `setUp`.

**3. Low–medium: `ssh://` URLs with a port never resolve**
- **Location:** `daemon.py:547-549` and `554`, `alias_path`.
- **Cause:**
  - `rest.partition("/")` leaves the port on the host, so `ssh://git@github.com-work:22/o/r` asks ssh about `github.com-work:22`.
  - `ssh -G` echoes that string back as the hostname, so it never matches. I confirmed this.
  - The commit message says ssh:// URLs are parsed "generally", which this contradicts.
- **Fix:** strip `:port` from the host in the `ssh://` branch, and add a test case.

**4. Low–medium: only the exact hostname `github.com` is accepted**
- **Location:** `daemon.py:539`.
- **Cause:**
  - An alias using GitHub's documented SSH-over-443 setup (`HostName ssh.github.com`, `Port 443`) resolves to `hostname ssh.github.com`, which is treated as not GitHub.
  - I confirmed this with a scratch config.
  - Combined with finding 3, `ssh://git@ssh.github.com:443/…` fails twice over.
- **Fix:** compare against `("github.com", "ssh.github.com")`.

**5. Low (hardening): a host taken from `.git/config` reaches ssh's argv unguarded**
- **Location:** `daemon.py:535`, with the host produced at `554`.
- **Cause:**
  - The workspace path can be any pane's cwd, including an unpacked untrusted repo.
  - A URL such as `-oProxyCommand=x:o/r` hands `-oProxyCommand=x` to ssh as an option.
  - It is not exploitable today. With no destination argument left, ssh prints its usage text and exits 255, and I checked that nothing executed.
  - Git blocks this class of hostname itself ("strange hostname blocked"), so the daemon should too.
- **Fix:**
  - Call `run(["ssh", "-G", "--", host], …)`.
  - Return `""` from `alias_path` when the host starts with `-`.

**6. Low: a local path containing a colon is treated as scp-style**
- **Location:** `daemon.py:553`.
- **Cause:**
  - `/srv/git/mirror:v2/app.git` runs `ssh -G /srv/git/mirror` and caches the result.
  - The answer is still empty, so it is harmless, but it is a wasted subprocess.
  - Git's rule is that a slash before the first colon means a local path.
- **Fix:** add `if "/" in host: return ""` in the scp branch.

**7. Nits**
- **`daemon.py:534`:** `shutil.which("ssh")` is redundant, because `run` already turns a missing binary into `rc 127`.
- **`daemon.py:529-530`:** the docstring's "runs once per repository per cycle" describes the caller, not this cached function.
- **PR description:** "without opening a connection" is accurate, but `Match exec` commands do run (see finding 1).

## Not blocking
In a multi-account setup `gh` is logged in as one account. Repos behind the other account's alias now reach the GraphQL query and come back as not found. That is handled safely, but it writes two log lines per cycle for as long as it lasts.

The author's offer of a follow-up PR that logs "repositories seen vs. slugs resolved" is worth accepting, because it would also have exposed finding 1.

## What I touched
No working-tree file was modified. To read the PR without `gh` auth I added two things to `.git`:
- I fetched `refs/pull/1/head` into `refs/remotes/origin/pr-1`.
- `git merge-tree --write-tree` wrote one tree object.

Tests ran in a `/tmp` scratch directory, which I deleted. `git update-ref -d refs/remotes/origin/pr-1` removes the ref. The fetched objects and that tree stay in `.git` until git garbage-collects them.