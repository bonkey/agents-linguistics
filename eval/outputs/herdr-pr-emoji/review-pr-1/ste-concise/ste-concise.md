# ste-concise / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `ste-concise`  prompt: `review-pr-1`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 14  wall: 527s  api: 510s
- cost: $3.9069  output tokens: 13862  words: 798

---

**Verdict: request changes** for [#1](https://github.com/bonkey/herdr-pr-emoji/pull/1), commit [e9359c1](https://github.com/bonkey/herdr-pr-emoji/pull/1/commits/e9359c1a327d8b9511c40622fdb107b1ff4524d2) (9 September 2026, 11:10 -0500). The approach is correct: `ssh -G` is the right source for an alias, and the change is small. Findings 1 to 3 need a fix before the merge. Each fix is a few lines.

**Validation**
- I ran the 74 tests of `origin/pr-1` in memory. All 74 tests pass.
- I ran `slug_from_url` with a stub resolver on 13 URL shapes, and `ssh -G` on OpenSSH 10.3p1.
- `gh` has no login on this machine. I read the local ref `origin/pr-1`. I did not read the comments or the check status on GitHub.
- Finding 9 has no test against GitHub. I modified no file. Line numbers refer to `origin/pr-1`.

**Findings, most severe first**

1. **Location:** `daemon.py:533-541`, `ssh_host_is_github`.
   - **Cause:** the function stores `False` in `SSH_HOST_CACHE` when `ssh -G` fails (rc 124 after the 5 s `GIT_TIMEOUT`, or rc 255). It writes no log line. I confirmed that the next call returns `False` when ssh is healthy again. A slow `Match exec` or a short config error removes the emoji of that alias until the daemon restarts.
   - **Fix:** store the answer only when `rc == 0`. Log the failure with `log()`.

2. **Location:** `test_daemon.py:757`, `test_other_remotes`.
   - **Cause:** the test calls `slug_from_url` with no stub. The run recorded one subprocess, `['ssh', '-G', 'gitlab.com']`, and left `{'gitlab.com': False}` in the module cache. The test now depends on the ssh binary and on `~/.ssh/config` of the developer.
   - **Fix:** pass `lambda h: False` as the resolver, as `test_ssh_host_alias_for_other_forge` does.

3. **Location:** `daemon.py:547-549`, `alias_path`.
   - **Cause:** the `ssh://` branch keeps the port in the host. `ssh://git@github.com-work:22/octo-org/app.git` asks ssh about `github.com-work:22`. ssh prints `hostname github.com-work:22`, and the slug is empty. `ssh://git@github.com:22/...` and `ssh://git@ssh.github.com:443/...` fail the same way. The commit message claims general parsing of `ssh://` URLs.
   - **Fix:** remove `:port` from the host in the `ssh://` branch. Add the URL with a port to `test_ssh_host_alias_remotes`.

4. **Location:** `daemon.py:520` and `daemon.py:531`.
   - **Cause:** `SSH_HOST_CACHE` lives for the life of the daemon, but the docstring describes a cost per cycle. A changed `HostName` of an alias stays invisible until a restart.
   - **Fix:** clear the cache at the start of `cycle`. This fix also limits finding 1 to one cycle.

5. **Location:** `daemon.py:523`.
   - **Cause:** `ssh_host_is_github` has no test. It holds the output parser, the failure paths and the cache. The two new tests bypass it with a stub.
   - **Fix:** replace `daemon.run` by hand, as `test_daemon.py:675` does for `daemon.cycle`. Cover rc 0 with `github.com`, rc 0 with a different host, rc 124, and the cache.

6. **Location:** `daemon.py:539`.
   - **Cause:** the comparison accepts only `github.com`. An alias with `HostName ssh.github.com` and `Port 443` (SSH over 443) gives an empty slug.
   - **Fix:** accept `github.com` and `ssh.github.com`.

7. **Location:** `daemon.py:535`.
   - **Cause:** the host comes from the remote URL and reaches ssh with no `--`. The origin `ssh://-oProxyCommand=evil/o/r` produces `ssh -G -oProxyCommand=evil`. This ends in a usage error (rc 255) today, because one argument cannot hold an option and a destination. It is not exploitable now.
   - **Fix:** use `["ssh", "-G", "--", host]`. ssh then answers `hostname contains invalid characters`.

8. **Location:** `README.md:14` and `README.md:145`.
   - **Cause:** the README names git and `gh` as the requirements, and lists two local commands for each cycle. The daemon now also runs `ssh -G <host>`, which can run the `Match exec` commands of the user.
   - **Fix:** add ssh to both places. If the cache stays, add the restart rule.

9. **Location:** `daemon.py:567`, with effect in `resolve` (`daemon.py:477`).
   - **Cause:** the slug now resolves, but `gh` sends the query as its one active account. If that account cannot see the work repository, the alias returns null. The daemon then writes three log lines each cycle, and the row stays empty. Repositories of the active account are not affected, because `parse_lookup` reads partial data.
   - **Fix:** document the limit in the README. A change to the code is outside the scope of this pull request.

10. **Location:** `daemon.py:553`.
    - **Cause:** `git@github.com-work:/octo-org/app.git` keeps the first slash of the path. The split gives three parts, and the slug is empty.
    - **Fix:** `path.lstrip("/")`.

11. **Location:** `daemon.py:553`.
    - **Cause:** a string with a colon is always read as scp-style. `/srv/git:mirrors/app` asks ssh about `/srv/git`, and `C:/work/app` asks ssh about `C`. Each costs one subprocess and one cache entry. The slug stays empty.
    - **Fix:** return `""` when the part before the first colon contains `/`. Git uses the same rule.

12. **Location:** `daemon.py:534`.
    - **Cause:** the `shutil.which("ssh")` guard repeats `run`, which returns 127 for a missing binary (`OSError`).
    - **Fix:** delete the guard and keep `if rc == 0:`.

I found no fault in the `host_is_github` parameter. The suite uses no `mock`, so an injected resolver fits its style.