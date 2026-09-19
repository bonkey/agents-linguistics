# learning / review-pr-1

- project: `herdr-pr-emoji` at `81e8933`
- arm: `learning`  prompt: `review-pr-1`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 26  wall: 292s  api: 283s
- cost: $2.2517  output tokens: 23119  words: 1225

---

# Verdict: request changes

Asking `ssh -G` what an alias points at is the right fix, and the fast path for literal `github.com` remotes is unchanged. But finding 1 can bring back the same silent failure the PR set out to remove. The fixes for all nine findings together come to about 20 lines.

**What I checked:**
- The PR's base is 15 commits behind `main`. The patch still applies cleanly to `main` (`81e8933`), and all 173 tests pass with it applied.
- The author's "74 tests" count comes from the old base.
- Everything ran in a scratch copy under `/tmp`, which I deleted afterwards. The repo is unmodified.
- `gh` is not authenticated here, so I read the PR through GitHub's public API and the `.diff` URL.

## Findings, most severe first

### 1. Medium-high: a failed `ssh -G` is cached as "not GitHub" until the daemon restarts
- **Location:** `daemon.py`, `ssh_host_is_github`, the unconditional `SSH_HOST_CACHE[host] = answer`.
- **Cause:** A timeout (rc 124), a missing `ssh` (rc 127), an ssh error (rc 255) and a missing `hostname` line are all stored the same way as a real "no". There is no expiry and no log line.
- **Reproduced:** I made the first call time out and every later call succeed. Cycles 1–3 all returned `''`, `ssh` ran once, and the cache held `{'github.com-work': False}`.
- **Likely triggers:**
  - a slow `Match exec` line in the user's ssh config;
  - an `Include` on a slow mount;
  - a loaded machine at login, which is when the daemon starts.
- **Effect:** Repos behind that alias stay blank with no hint in the log, which is the symptom this PR fixes.
- **Fix:** Cache only when `rc == 0` and a `hostname` line was parsed. Log a non-zero rc with `log()`. Optionally expire "no" answers so a later edit to the ssh config is picked up.

### 2. Medium: the existing `test_other_remotes` now runs the real `ssh`
- **Location:** `test_daemon.py`, `Remotes.test_other_remotes`. The PR does not touch this test, but its behaviour changes.
- **Cause:** `git@gitlab.com:octo-org/app.git` is passed with no resolver, so it reaches the real `ssh_host_is_github`.
- **Confirmed:** Running the `Remotes` tests spawned `['ssh', '-G', 'gitlab.com']` against the real `~/.ssh/config`. It also left `{'gitlab.com': False}` in the module-level cache.
- **Why it matters:** The test file's header calls these "Offline tests". The PR description gives avoiding exactly this dependency as its reason for the injectable resolver.
- **Fix:** Pass `lambda h: False` in that test, or patch `daemon.ssh_host_is_github` in a `setUp` for `Remotes`. Also assert that `https://` URLs never call the resolver.

### 3. Medium: `ssh_host_is_github` has no tests of its own
- **Location:** `test_daemon.py`; both new tests replace the function with a lambda.
- **Cause:** The output parsing, the return-code handling and the caching are never exercised. Finding 1 lives in that code.
- **Fix:**
  - Use `mock.patch.object(daemon, "run", …)`, as the suite already does for `gh_graphql`.
  - Cover an alias that resolves to `github.com`, one that resolves elsewhere, and a non-zero rc that returns `False` without being cached.
  - Assert that a second call for the same host does not run `ssh` again.
  - Clear `SSH_HOST_CACHE` in `setUp`.

### 4. Low-medium: the host from the URL is passed to `ssh` without `--`
- **Location:** `daemon.py`, `run(["ssh", "-G", host], …)`, fed by `alias_path`.
- **Cause:** Only the `user@` part is stripped. The URL `-oProxyCommand=…:o/n` produces the argv `['ssh', '-G', '-oProxyCommand=…']`.
- **Exploitability:**
  - Not exploitable with OpenSSH 10.3. A lone option leaves no host, so `ssh` prints usage and exits 255. `-E/path` creates no file.
  - The URL comes from the local git config, which git already trusts.
  - This is hardening, not a vulnerability. It is the same pattern as CVE-2017-1000117, where git now rejects such hosts itself.
- **Fix:** Use `["ssh", "-G", "--", host]` (I verified `ssh` honours `--`). Also return `""` from `alias_path` when `host.startswith("-")`.

### 5. Low: an alias with `HostName ssh.github.com` is rejected
- **Location:** `daemon.py`, the comparison `== "github.com"`.
- **Cause:** GitHub's documented SSH-over-port-443 setup uses `HostName ssh.github.com`. A throwaway config with such an alias gave `False` and an empty slug.
- **Fix:** Accept `("github.com", "ssh.github.com")`.

### 6. Low: a port in an `ssh://` URL is not stripped before asking `ssh`
- **Location:** `daemon.py`, `alias_path`, `rest.partition("/")`.
- **Cause:** `ssh` does not split `host:port` in a bare destination. `ssh -G 'github.com:22'` prints `hostname github.com:22`, so `ssh://git@alias:22/o/n` never matches.
- **Fix:** In the `ssh://` branch, use `host = host.partition(":")[0]`, return `""` for bracketed IPv6 hosts, and add a test case.

### 7. Low, for the author to be aware of: aliased repos that `gh` cannot see will log every cycle
- **Location:** `daemon.py`, `resolve`. This is an effect of the PR, not code it changes.
- **Cause:**
  - `gh` is logged in as one account. Aliased repos that belong to another account come back as `null` with a NOT_FOUND error.
  - `parse_lookup` handles this correctly: the row keeps its last emoji and nothing breaks.
  - `resolve` still logs two lines every cycle for those repos.
- **Fix:** Nothing is required in this PR. A follow-up could log once per slug, and would go well with the author's offer to log "repos seen vs slugs resolved". I would accept that offer.

### 8. Nit: the README requirements line
- **Location:** `README.md`, "Requires … git and an authenticated `gh`".
- **Cause:** The author is right that nothing there is now wrong. But `ssh` is now consulted for aliased remotes, and someone debugging an alias would want to know that.
- **Fix:** Add one sentence saying `ssh -G` decides whether an alias points at GitHub.

### 9. Nit: style
- **Location:** `daemon.py` and `test_daemon.py`.
- **Cause:**
  - `shutil.which("ssh")` is redundant because `run()` already returns 127 when the binary is missing. It is harmless, and `main` does the same for `gh`.
  - `alias = lambda host: …` assigns a lambda to a name (PEP 8 E731), which the suite does nowhere else.
- **Fix:** Optional. Drop the `which` check and use a `def`.

## What the PR gets right
- The output parsing is correct against real `ssh -G` output. No other key starts with `hostname `, and `HostName GitHub.COM` still matches.
- The optional `host_is_github` argument is resolved at call time, so tests can patch `daemon.ssh_host_is_github`.
- The downstream code was already written to handle partial GraphQL answers. That is why finding 7 produces log noise and not blank rows.

`★ Insight ─────────────────────────────────────`
- **Caching a yes/no answer needs three states.** "Yes", "no" and "couldn't find out" are different answers. Storing `False` for both of the last two is how finding 1 happens. `parse_lookup` in this codebase already keeps "unanswered" separate from "no PR" for the same reason.
- **Changing a default can change tests the diff never touches.** `test_other_remotes` is not in the patch, but its behaviour changed. I found that by logging every call to `run()` during the tests, which caught it when reading the diff did not.
- **Put `--` before any externally supplied value in a command's arguments.** It is a small change, and the code no longer relies on the order in which `ssh` happens to check its arguments.
`─────────────────────────────────────────────────`

I can draft the review comment for the PR. Posting it needs `gh auth login` on your side, and I would confirm with you first because it is public.