# concise / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `concise`  prompt: `review-pr-2`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 22  wall: 234s  api: 231s
- cost: $2.3589  output tokens: 18020  words: 674

---

**Verdict: request changes.** PR #2 was already merged on Sep 10 (`39af215`), so these are follow-ups. Findings 1 and 3 are unchanged on `main`.

`gh` is not logged in here, so I did not see PR comments or CI. I reviewed the merged range `c0baa8e..d1daf8a` locally and changed no repo files.

- **Tests:** the PR head's suite passes, 108 tests.
- **Glyphs:** all 15 Nerd Font codepoints match their `oct-*` names in an installed Nerd Font.
- **Colour rules:** the README block parses as TOML and covers every state.
- **Reason strings:** I could not check GitHub's real GraphQL `reason` values, because that needs a token.

Line numbers are at the PR head `d1daf8a`.

1. **Medium — `daemon.py:337-338`, `queue_ejection`, and `fixtures/lookup_queue.json`.**
   - **Cause:** the two exempt reasons are lowercase `"merged"` and `"manual"`, compared case-sensitively. They come only from a hand-built fixture. GitHub's schema declares `reason: String` and documents no values. The only published dequeue reasons, in the webhook's `reason` enum, are uppercase and spelled differently: `MANUAL`, `MERGE`, `ALREADY_MERGED`, `CI_FAILURE` and so on. If GraphQL uses those, a PR someone removes from the queue by hand reads 🪃 until the next push. The docstring says that case must not happen. Because unknown reasons count as ejections by design, a wrong guess here fails without any sign.
   - **Fix:** record one real `RemovedFromMergeQueueEvent` and use its strings. Until then, normalise with `reason.lower()` and exempt `{"manual", "merge", "merged", "already_merged"}`. Correct the fixture reasons and the README paragraph to match.

2. **Medium — `daemon.py:110`, `DEFAULT_ICON_SET = "nerd"`, and `herdr-plugin.toml` description.**
   - **Cause:** the default flips for every existing install that has no `icons` key. After upgrading to 0.5.0, rows show private-use codepoints, which render as empty boxes without a Nerd Font. With a Nerd Font they are monochrome until the user pastes 15 colour rules. The plugin name, the `$pr_emoji` token and the manifest's "One emoji per sidebar row" now describe the non-default set.
   - **Fix:** keep `"emoji"` as the default and make `"nerd"` opt-in. If the flip is deliberate, put the font requirement and the `icons = "emoji"` escape hatch at the top of the README install section and in the manifest description.

3. **Low — `daemon.py:880-881`, startup log.**
   - **Cause:** `unstable=%s` is now fed `icons["unstable"]`. The log prints a glyph, a private-use character by default, instead of `ok`, `pass` or `warn`. It never says which icon set loaded.
   - **Fix:** have `read_config` also return the two setting names and log `icons=<name>, unstable=<name>`.

4. **Low — `README.md`, "Two icon sets" section, around lines 210-240.**
   - **Cause:** the text says the rules are "in the order of the table above" and "ordered the way `blocker_for` decides". The block actually starts at `draft` and puts `merged`, `closed` and `no_pr` near the end, so it matches neither. This does no harm today, since only 💬 can share a token with another glyph and its rule is last. But the stated reason for the order is wrong.
   - **Fix:** reorder the block to match the table. Or replace both sentences with the one rule that matters: the 💬 rule must come last.

5. **Low — `test_daemon.py:70-76`, module-level `emoji_for` and `decide` wrappers.**
   - **Cause:** every behavioural test goes through the emoji set, so the default Nerd Font path is never tested end to end. I checked by hand that blocked plus an open conversation gives the conversation glyph under the default set, and it does.
   - **Fix:** run the conversation and queue precedence cases once per entry in `ICON_SETS`, asserting on state keys.

6. **Low, unconfirmed — `daemon.py:386-387`, `timelineItems(last: 1, …PULL_REQUEST_COMMIT…)`.**
   - **Cause:** I believe GitHub orders timeline commits by commit date, not push date. If so, a fix committed before the ejection and pushed after it without force sorts ahead of the removal event, and 🪃 stays. The cost is small, since 🪃 and ✅ both mean "queue it again" at that point.
   - **Fix:** confirm the ordering against the API. If it holds, compare the removal event's `createdAt` with the head commit's `pushedDate`, or state the limit in the README.