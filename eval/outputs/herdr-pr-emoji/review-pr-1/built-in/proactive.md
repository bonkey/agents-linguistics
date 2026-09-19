# proactive / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `proactive`  prompt: `review-pr-1`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 24  wall: 237s  api: 232s
- cost: $1.9877  output tokens: 19343  words: 1034

---

# PR #1 review: "Resolve ssh config host aliases to github.com"

**Verdict: request changes.** The diagnosis and the approach are right, but findings 1–3 should be fixed before merge; all three are small.

I ran the code rather than only reading it:

- The PR head passes 74 tests, as the description says.
- It merges cleanly into current `main`, which is 15 commits ahead. The merged tree passes 173 tests (171 on main plus the 2 new ones).
- Against a scratch ssh config, `ssh -G github.com-work` reports `hostname github.com` in about 10 ms.
- A remote the active `gh` account cannot see only adds a log line, because main treats a null GraphQL answer as unanswered. The PR therefore cannot blank other workspaces.

Line numbers refer to the PR head, `e9359c1`.

## Findings, most severe first

**1. Medium: one failed `ssh -G` is remembered for the daemon's lifetime, with no log line**
- **Location:** `daemon.py:533-541`, `ssh_host_is_github`.
- **Cause:** `answer` starts as `False` and is cached unconditionally. A timeout, a non-zero exit, a missing `ssh` and a genuine "not GitHub" all store the same permanent `False`.
- **Effect:**
  - I mocked one 5-second timeout on the first call. The second call returned `''` without asking ssh again, and the cache held `{'github.com-work': False}`.
  - This is the silent empty sidebar the PR sets out to fix, now reachable through a slow `Match exec`, `CanonicalizeHostname` DNS, or load at startup.
  - An alias added to `~/.ssh/config` while the daemon runs is also never seen until restart.
- **Fix:**
  - Cache only when `rc == 0` and a `hostname` line was parsed.
  - On failure, skip the cache and `log()` the exit code, as `run_signoff` does.
  - Optionally give negative answers a TTL, or clear them every N cycles.

**2. Medium: the new logic is untested, and an existing test now runs real `ssh`**
- **Location:** `test_daemon.py:757`, `test_other_remotes`; nothing covers `daemon.py:523-542`.
- **Cause:** `test_other_remotes` calls `slug_from_url("git@gitlab.com:…")` with no resolver, so it falls through to the real `ssh_host_is_github`.
- **Effect:**
  - A spy on `run` recorded `['ssh', '-G', 'gitlab.com']` during that test.
  - The suite therefore depends on the machine's ssh config, which the PR description says the `host_is_github` parameter exists to prevent.
  - The two new tests pass lambdas as the resolver, so output parsing, caching and the failure paths have no coverage.
- **Fix:**
  - Patch `daemon.run` with `mock.patch.object`, which the suite already uses for `gh_graphql`.
  - Add tests for:
    - an alias that resolves to GitHub, and one that resolves elsewhere;
    - a non-zero exit, a timeout, and a missing `ssh`;
    - the cache hit.
  - Clear `SSH_HOST_CACHE` in `setUp`.
  - Pass a resolver in `test_other_remotes`, or patch `run` there.

**3. Low: the host from the remote URL reaches ssh's argument list unvalidated**
- **Location:** `daemon.py:535`, fed by `alias_path` at `:549-554`.
- **Cause:** a URL such as `-oProxyCommand=x:owner/name` or `ssh://-oFoo/owner/name` produces a host that starts with `-`, and ssh parses it as an option. I confirmed this: `-V` as the host printed the version and exited 0.
- **Effect:** it is not exploitable today, because with no destination ssh prints usage and the answer is `False`. It is still the pattern behind CVE-2017-1000117, and the fix is one token.
- **Fix:**
  - Call `run(["ssh", "-G", "--", host], …)`. With `--`, ssh rejects such a host with "hostname contains invalid characters".
  - Also return `""` from `alias_path` when `host.startswith("-")`, as git does.

**4. Low: `ssh://` URLs with a port never resolve**
- **Location:** `daemon.py:549`.
- **Cause:** `rest.partition("/")` leaves `:22` on the host. ssh is asked about `github.com-work:22`, which matches no `Host` block.
- **Effect:** `ssh://git@github.com-work:22/octo-org/app.git` returned `''`, and so did `ssh://git@ssh.github.com:443/…`. The first is a regular alias remote, so the blank-sidebar symptom the PR fixes remains for that form.
- **Fix:** strip a trailing `:<digits>` from the host in the `ssh://` branch, and add both URLs to the test.

**5. Low: only the exact name `github.com` counts as GitHub**
- **Location:** `daemon.py:539`.
- **Cause:** GitHub's documented SSH-over-443 endpoint is `ssh.github.com`, a common alias target behind corporate firewalls. My `gh-443` alias resolved to `hostname ssh.github.com` and got `False`.
- **Fix:** compare against `("github.com", "ssh.github.com")`.

**6. Low, docs: the README is now incomplete in three places**
- **Location:** `README.md:14`, `:377`, `:394`.
- **Cause:** line 394 lists every subprocess that has a timeout (`herdr`, `git`, `gh`, the sign-off command), and ssh is now a fifth. Step 2 at `:377` and the requirements at `:14` also omit it.
- **Effect:** the description's claim that nothing in the README is now wrong does not hold for these lines.
- **Fix:**
  - Add `ssh` to the list at `:394`.
  - Add a clause to step 2 about asking `ssh -G` for alias hosts, once per host.
  - Note ssh as optional at `:14`.
  - A sentence near `:403` would also help. An alias selects the ssh key, but the query runs as whichever account `gh` has active. A work-alias repo under a personal `gh` login logs "no answer for N branch(es)" every cycle.

**7. Nit: API and readability**
- **Location:** `daemon.py:560`, `:555`, `:528`.
- **Cause:**
  - `host_is_github=None` is a parameter that exists only for tests, where the suite otherwise uses `mock.patch.object`.
  - The `"@" in path` check has no comment saying what it guards against.
  - The docstring's "this runs once per repository per cycle" describes the caller, not the function.
- **Fix:** drop the parameter once finding 2 is done, comment or remove the `@` check, and tighten the docstring.

## Not the PR's fault
- `git@alias:/owner/name.git` (leading slash) returns `''`, and so does the literal `git@github.com:/…` on main today.
- `https://user@github.com/…` is likewise unmatched, as it already is on main.
- The author's offer of a follow-up PR that logs "repositories seen vs slugs resolved" is worth accepting. It would also have exposed finding 1.

## Housekeeping
- I changed no tracked file.
- `gh` is not authenticated here, so I fetched the PR with `git fetch origin refs/pull/1/head`. That left a local ref `origin/pr/1`. `git merge-tree` also wrote one unreferenced tree object. Remove the ref with `git update-ref -d refs/remotes/origin/pr/1` if you don't want it.
- Scratch copies are in `/tmp/pr1_*`.
- I posted nothing to GitHub.