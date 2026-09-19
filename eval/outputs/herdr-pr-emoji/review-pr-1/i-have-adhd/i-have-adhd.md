# i-have-adhd / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `i-have-adhd`  prompt: `review-pr-1`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 218s  api: 212s
- cost: $1.6884  output tokens: 16944  words: 709

---

**Verdict: request changes.** Two things need fixing first: a failed `ssh` lookup is cached for the daemon's whole lifetime, and the host from the origin URL goes to `ssh` unvalidated. The feature itself is sound, and fixes 1 and 2 are about 30 minutes of work for the author.

The PR merges cleanly into `main` even though it is 15 commits behind. All 173 tests pass on the merged tree, which I ran in a temp dir. `gh` is not authenticated here, so I could not read PR comments or CI status. Line numbers below are from the PR head `e9359c1`.

## Must fix

1. **`daemon.py:520-542`, `ssh_host_is_github`: a failed lookup is cached until the daemon restarts (medium).**
   - **Cause:** `SSH_HOST_CACHE` is module-level and never cleared. It stores `False` when `ssh -G` times out (rc 124), exits non-zero, or `ssh` is missing, and the daemon runs a `while True` loop. One slow `ssh -G`, or an alias added to `~/.ssh/config` after start, leaves the repo with an empty slug and no emoji until restart. That is the same silent failure this PR sets out to fix.
   - **Reproduced:** the first call returned rc 124. On the second call `ssh` was healthy, but the slug was still `''` and `ssh` had been spawned only once. The docstring says "once per repository per cycle", which does not match the code.
   - **Fix:** cache only when `rc == 0`, clear the cache at the top of `cycle()`, and log when `ssh -G` fails.

2. **`daemon.py:545-557`, `alias_path` into `run(["ssh", "-G", host])`: the host is not validated (low to medium, hardening).**
   - **Cause:** the host is whatever precedes the first `:` in the origin URL. `-oProxyCommand=x:o/n` reaches `ssh` as an option, and `../odd:dir/app` reaches it as a host. On OpenSSH 10.3 this is harmless: it exits 255 and creates no file. However, `Match exec` does run under `ssh -G`, and OpenSSH before 9.6 expands `%h` unchecked (the CVE-2023-51385 class). Git passes the host to `ssh` only on fetch or push. The daemon does it automatically for every workspace directory.
   - **Fix:** return `""` unless `re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", host)`, and call `["ssh", "-G", "--", host]`.

## Should fix (low)

3. **`daemon.py:539`, `== "github.com"`: aliases to `ssh.github.com` are rejected.**
   - **Cause:** GitHub's SSH-over-443 setup uses `Hostname ssh.github.com`. `ssh -G` prints exactly that, so the check returns `False` and the repo gets no emoji.
   - **Fix:** accept both `github.com` and `ssh.github.com`.

4. **`daemon.py:547-549`, the `ssh://` branch: the port is not stripped.**
   - **Cause:** `ssh://git@github.com-work:22/o/n` asks `ssh` about `github.com-work:22`. `ssh` echoes that back as the hostname, so the check returns `False`.
   - **Fix:** apply `host.partition(":")[0]` in that branch.

5. **`test_daemon.py:742-763`: `ssh_host_is_github` is untested, and an existing test now spawns the real `ssh`.**
   - **Cause:** the new tests inject a lambda, so the `ssh -G` output parsing, the cache and the no-`ssh` path have no coverage. The unchanged `test_other_remotes` now runs the real `['ssh','-G','gitlab.com']` against the developer's `~/.ssh/config`, and leaves an entry in the module cache.
   - **Fix:** patch `daemon.run` with canned `ssh -G` output for four cases: match, non-match, rc≠0, and rc 124 followed by success. Pass `lambda h: False` in `test_other_remotes`, and clear the cache in `setUp`.

6. **`README.md:14` and `README.md:377`: the docs are not updated.**
   - **Cause:** the requirements and the "how it works" step 2 do not mention `ssh` or `ssh -G`. The multi-account limit is also undocumented: `gh api graphql` always uses `gh`'s active account, so a repo visible only to the other account gets NOT_FOUND, no emoji, and a log line every cycle. Other repos are unaffected, because `parse_lookup` contains partial errors.
   - **Fix:** document `ssh` as an optional dependency, and state that the active `gh` account must see every aliased repo.

7. **Nits.**
   - **Cause:** `GIT_TIMEOUT` is reused for `ssh`. `host_is_github=None` is a test-only parameter in a production signature. The commit message says "without touching the network", which is not strictly true because `Match exec` runs under `-G`.
   - **Fix:** add an `SSH_TIMEOUT`, mock `daemon.run` in the tests instead, and reword the commit message.

No file in the working tree was modified. I fetched the PR ref into `refs/remotes/origin/pr-1` and used temp dirs under `$TMPDIR`.

Next: run `gh auth login`, then tell me to post findings 1 and 2 as a review on PR #1.