# caveman-full / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-full`  prompt: `review-pr-2`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 29  wall: 361s  api: 356s
- cost: $3.6821  output tokens: 27543  words: 1036

---

**Verdict: merge.** No blocker found. Queue logic holds up, all 108 tests pass at PR head `d1daf8a`, and the GitHub schema and the glyph table confirm the new fields and codepoints. Findings 1–3 deserve a follow-up commit.

PR #2 is already merged as `39af215`. The review covers `c0baa8e..d1daf8a`, and line numbers are from `d1daf8a`. Every finding below is still present at HEAD `81e8933`. I changed no repo file; a scratch copy under `/tmp` was used and is already gone.

## Findings, most severe first

1. **Medium — the default icon set flips with no warning on upgrade.** `daemon.py:110`, `herdr-plugin.toml:3`.
   - Cause: `DEFAULT_ICON_SET = "nerd"`. Every 0.4.1 install switches to private-use glyphs on upgrade to 0.5.0 without any config change. A terminal without a Nerd Font shows an empty box on every row. The plugin cannot detect the font. No upgrade note exists.
   - The flip is deliberate per the PR title; only the missing warning is the defect.
   - Fix: add an upgrade note at the top of the README and in `config.example.toml` that says "no Nerd Font: set `icons = "emoji"`". Or keep `emoji` as the default and make Octicons opt-in.

2. **Medium — the Octicon table needs Nerd Fonts 3.0 or later, and nothing says so.** `daemon.py:92-108`, `README.md:179`, `config.example.toml:13`.
   - Cause: all 15 codepoints match Nerd Fonts 3.5.1 `glyphnames.json`. On 2.3.3, `U+F4A4` is `oct-ellipses`, so a mergeable PR reads "…". `U+F4DB`, `F4DC`, `F4DD`, `F4F4`, `F52F` and `F530` are absent from the 2.x Octicons table. Queued, closed, draft, blocked and both failing states then draw no Octicon; `…` on a mergeable PR is the worse failure.
   - Fix: state "Nerd Fonts ≥ 3.0" in the README section and in the `config.example.toml` comment.

3. **Low/medium — 🪃 survives a pushed fix when the commit predates the ejection.** `daemon.py:386-388`, `daemon.py:317-338`, README claim at `README.md:116`.
   - Cause: a PR timeline sorts `PULL_REQUEST_COMMIT` by committer date, not push time. On `rust-lang/cargo#17399` (REST timeline), commits dated 09-03T09:50 sit after a review dated 08-27 and just before the 09-03T09:52 force-push event. The GraphQL order is assumed to match.
   - Scenario: someone commits locally while the queue holds the PR, the queue ejects it, then they push without force. The commit sorts before the removal event, so `last: 1` still returns the removal. The row reads 🟡 while CI runs, then 🪃 again instead of ✅.
   - Fix: ask for `headRefOid` and `... on RemovedFromMergeQueueEvent { reason beforeCommit { oid } }`, and report an ejection only while `beforeCommit.oid == headRefOid`. Check detent issue #2474 first: it reports `beforeCommit` is not always the PR head, so record one real ejection before relying on it.

4. **Low — the queue fixture is hand-built and its reason strings are partly guessed.** `fixtures/lookup_queue.json`, `test_daemon.py:21-24`, README claim at `README.md:310`.
   - Cause: no ejected PR was recorded. `failed_checks`, `merged` and `manual` appear in real API output in the sources below. `merge_conflict` is unverified; GitHub's webhook enum names that reason differently.
   - Risk is limited: any unknown reason counts as an ejection, and `state == MERGED` outranks the check on `merged`.
   - Fix: record one real ejected response. Until then, word README line 310 so it excludes `lookup_queue.json`.

5. **Low — the startup log prints a glyph instead of the setting.** `daemon.py:879-882`.
   - Cause: it logs `icons["unstable"]`. Under the default set that writes `unstable=` plus a private-use character into `daemon.log`. The icon set name is never logged. Commit `2da771b` claims behaviour is identical; this line regressed.
   - Fix: keep the setting names next to the resolved table and log `unstable=ok icons=nerd`.

6. **Low — a rejected `icons` value falls back without a word.** `daemon.py:180-182`.
   - Cause: `icons = 'emoji'` (TOML single quotes), `"Emoji"` or a typo falls back to `nerd` with no log line. `unstable` already behaved this way, but now the fallback is an unreadable glyph set.
   - Fix: log the rejected value and the fallback. Accept single quotes in both regexes.

7. **Low — the README colour block needs herdr 0.9.0 and does not say so.** `README.md:203-246`, `herdr-plugin.toml:4`.
   - Cause: value-based `rules` arrived in herdr 0.9.0 (its CHANGELOG, #3693). The manifest minimum stays `0.8.2`, which is correct for the plugin itself.
   - Fix: add one sentence, "the colour rules need herdr ≥ 0.9.0".

8. **Nit — the README contradicts itself about the order of the rules.** `README.md:211`, `README.md:242`.
   - Cause: line 211 says "in the order of the table above" and line 242 says "ordered the way `blocker_for` decides". Both are false: the block starts at draft and ends with merged, closed, no PR, conversation.
   - The order does no harm, because a token holds at most one blocker glyph plus the conversation glyph.
   - Fix: replace both sentences with "the conversation rule must come last; the rest may be in any order".

9. **Nit — the manifest description still describes emoji only.** `herdr-plugin.toml:5`.
   - Cause: it says "One emoji per sidebar row" and lists emoji, while the default now draws Octicons.
   - Fix: mention Octicons by default, emoji with `icons = "emoji"`.

10. **Nit — `emoji_for` detects "blocked" by comparing glyphs.** `daemon.py:359`.
    - Cause: `verdict == icons["blocked"]` compares a glyph, not a state. Only the test `test_no_state_borrows_another_state_glyph` keeps this safe. A future icon set or alias that shares a glyph breaks the 💬 replacement without any error.
    - Fix: have `blocker_for` return the state key and map it to a glyph once, in `emoji_for`.

11. **Nit — the 💬-replaces-blocked test covers one icon set only.** `test_daemon.py:332`, class `Conversations`.
    - Cause: two blank lines sit inside the class body before `test_the_queue_owns…`. `test_open_threads_alone_replace_the_unexplained_block` runs with `EMOJI` only, so the default set never exercises that branch.
    - Fix: drop one blank line. Run `test_open_threads_alone_replace…` over every set in `ICON_SETS`.

## Checked and correct

- `isInMergeQueue`, `RemovedFromMergeQueueEvent.reason: String` and the four `itemTypes` enum values exist in GitHub's public GraphQL schema.
- The README TOML colour block parses with `tomllib`. Its 15 rules cover all 15 states, and the conversation rule is last.
- The precedence of 🚂 and 🪃 is coherent. Skipping a queued PR in `required_targets` is consistent with `blocker_for`.

Sources:
- [5dive-ai/5dive PR #902](https://github.com/5dive-ai/5dive/pull/902)
- [Jamie Tanna — PRs taken out of the Merge Queue](https://www.jvt.me/posts/2026/08/11/github-merge-queue-prs/)
- [monarch-initiative/dismech PR #10989](https://github.com/monarch-initiative/dismech/pull/10989)
- [datanika-io/datanika-landing PR #491](https://github.com/datanika-io/datanika-landing/pull/491)
- [digitaldrywood/detent issue #2474](https://github.com/digitaldrywood/detent/issues/2474)