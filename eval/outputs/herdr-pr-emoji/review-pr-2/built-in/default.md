# default / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `default`  prompt: `review-pr-2`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 43  wall: 405s  api: 409s
- cost: $4.0495  output tokens: 30981  words: 797

---

Verdict: merge. None of the six findings blocks it.

PR #2 is already on `main` as merge commit `39af215`. `gh` isn't authenticated here, so I reviewed the five commits locally, `c0baa8e..d1daf8a`. The two medium findings are still present at HEAD `81e8933`, so they are follow-ups to file now.

**Checks run:**
- **Tests:** 108 pass at the PR head, against 76 at the base.
- **Queue-exit reasons:** GitHub really does spell them `merged`, `manual` and `failed_checks`, so `queue_ejection` special-cases the right strings. I confirmed this against three unrelated projects that read the same GraphQL field.
- **Octicon codepoints:** all 15 match the upstream Nerd Fonts 3.5.1 glyph table.
- **Colour rules:** the README's claims about herdr's `rules` (at most 16, `contains`, first match wins) match herdr's config reference. The same 15-rule block is in your own `~/.config/herdr/config.toml`.
- **Precedence:** 🚂 early, 🪃 between 👀 and 🛑, and queued pull requests skipped by the second request all behave as documented.
- **Scratch copies:** I ran the code from exports outside the repo, one under `/tmp` and one under `$TMPDIR`. The first disappeared mid-review and I deleted the second. The working tree is untouched.

## Findings, most severe first

**1. Medium: upgrading silently changes what every existing install draws.**
- **Where:** `daemon.py:110` (`DEFAULT_ICON_SET = "nerd"`), `README.md:8` and `:14`, `herdr-plugin.toml:5`.
- **Cause:** an untouched 0.4.1 `config.toml` now resolves to the Nerd Font set (I ran this).
    - Without a Nerd Font, every row shows empty boxes.
    - The Install section still lists only herdr, Python, git and `gh`.
    - The intro example and the manifest description still show emoji.
    - The font requirement appears only at README line 181 and in `config.example.toml`.
    - `--query` and `--resolve` output changes for any script that reads it.
- **Fix:** add "a Nerd Font, or `icons = "emoji"`" to the Install requirements. Say the same in the manifest description. Fix 2 adds the missing log line.

**2. Medium: the start-up log line lost the setting it used to print.**
- **Where:** `daemon.py:879-882`.
- **Cause:** `read_config` now returns the resolved glyph table, so the line formats `icons["unstable"]`.
    - It prints `unstable=\uf42e`, a private-use character, where it used to print `unstable=ok` (I ran this).
    - The chosen icon set is never logged.
    - An unrecognised value such as `icons = 'emoji'` or `"Emoji"` falls back to the Nerd Font set with no log line (I ran this too).
- **Fix:** keep the two setting names and log `unstable=%s, icons=%s`, plus one line when an `icons` value is rejected.

**3. Low: two README sentences about rule order are wrong.**
- **Where:** `README.md:211` and `:242`.
- **Cause:** the rules run draft first and end with merged, closed, no PR, then 💬. That is neither "the order of the table above" nor the order `blocker_for` decides.
    - It does no harm in practice: a token carries one blocker glyph, so only the 💬 rule's last position matters.
- **Fix:** reorder the block, or say instead that the only constraint is 💬 last.

**4. Low: the default path is barely tested.**
- **Where:** `test_daemon.py:70-77` and the `IconSets` class.
- **Cause:** the wrappers pin nearly every assertion to the emoji set.
    - The Nerd Font default is checked on a single key.
    - Nothing tests the 🛑→💬 swap in that set.
    - Separately, `queue_cleared`, used as a reason "GitHub has yet to invent", very likely already exists.
- **Fix:** loop the `Conversations` cases over both icon sets, and use an obviously made-up reason.

**5. Low, not confirmed: 🪃 may stick after a fix.**
- **Where:** `daemon.py:386-388`.
- **Cause:** `timelineItems(last: 1)` assumes a commit lands in the timeline at the time it was pushed.
    - If GitHub places it by commit date instead, a non-force push of a commit dated before the ejection sorts ahead of the removal event.
    - 🪃 would then stay until the pull request is queued again.
- **Fix:** also fetch the removal event's `createdAt` and compare it with the head commit's `committedDate`.

**6. Note: a crash that predates this PR is now easier to reach.**
- **Where:** `daemon.py:436-437`.
- **Cause:** `nodes: [null]` raises `AttributeError` in `parse_lookup` at both base and head (I ran this). That costs the whole cycle.
    - `timelineItems` is a non-null connection, so a GitHub error inside it would null the pull request's node and trigger exactly this.
- **Fix:** treat a null node as unanswered.

I could not establish which herdr release introduced token `rules`. If it is later than the `min_herdr_version = "0.8.2"` the manifest declares, the colour section of the README needs a version note.

Sources:
- [Nerd Fonts glyphnames.json](https://raw.githubusercontent.com/ryanoasis/nerd-fonts/master/glyphnames.json)
- [Jamie Tanna, PRs taken out of the merge queue](https://www.jvt.me/posts/2026/08/11/github-merge-queue-prs/)
- [5dive PR #902](https://github.com/5dive-ai/5dive/pull/902)
- [dismech PR #10989](https://github.com/monarch-initiative/dismech/pull/10989)
- [ainumbers PR #1857](https://github.com/PostOakLabs/ainumbers/pull/1857)
- [herdr config reference](https://herdr.dev/docs/config-reference/)
- [GitHub changelog, PR commit ordering](https://github.blog/changelog/2020-07-13-pull-request-commits-now-ordered-chronologically/)