# i-have-adhd / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `i-have-adhd`  prompt: `review-pr-2`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 20  wall: 325s  api: 320s
- cost: $3.2722  output tokens: 26480  words: 691

---

**Verdict: merge.** PR #2 was already merged on 2026-09-10 (`39af215`), so the fixes below are follow-ups on `main`. I found no bug in the 🚂/🪃 decision logic, and nothing here would have blocked the merge.

I reviewed `c0baa8e..d1daf8a` from a temporary export of the PR head. No repo file was modified.

## What I checked
- **Tests:** 108 pass at the PR head and 76 at the base, as the PR claims.
- **Refactor claim:** I compared base and head verdicts with the emoji set over 165,888 field combinations and found 0 differences. The Nerd Font set maps one-to-one to the emoji set.
- **Codepoints:** all 15 Octicon codepoints match the Nerd Fonts `glyphnames.json`.
- **Not verified:**
  - I could not confirm the `reason` strings (`merged`, `manual`, `failed_checks`, `merge_conflict`). The public REST timeline omits `reason`, and `gh` is unauthenticated here.
  - I could not confirm that herdr 0.8.2 (the manifest's `min_herdr_version`) supports the README's `rules` block. Your local 0.9.1 config already uses `rules`.

## Findings, by severity

### Medium
1. **The Nerd Font default breaks rows for users without one, and Install does not say so.**
   - **Location:** `daemon.py` `DEFAULT_ICON_SET = "nerd"`, and the `Requires herdr ≥ 0.8.2…` line in `README.md`'s Install section.
   - **Cause:**
     - The default flips from emoji to private-use glyphs. An upgrade from 0.4.1 with no Nerd Font renders every row as an empty box.
     - `--query` and `--resolve` output changes too, which breaks any script that matches emoji.
     - Install never mentions the font; it first appears about 170 lines down. This is still true at `HEAD`.
   - **Fix:** Add to the Requires line: "a Nerd Font as the terminal font, or `icons = "emoji"` in `config.toml`". Log `icons=<name>` at startup.

### Low
2. **The startup log prints a glyph where it used to print the setting name.**
   - **Location:** the `"started pid %d, interval %ds, unstable=%s"` line in `main()` in `daemon.py`.
   - **Cause:** `read_config` now returns the resolved glyph table, so the log writes `icons["unstable"]`. That is a private-use character in `daemon.log`, where it used to read `unstable=ok`. The active icon set is never logged. This is still true at `HEAD`.
   - **Fix:** Have `read_config` also return the setting names, and log `unstable=ok icons=nerd`.

3. **🪃 can survive a pushed fix (not reproduced live).**
   - **Location:** `queue_ejection()` and the `timelineItems(last: 1, …)` call in `lookup_query()`, both in `daemon.py`.
   - **Cause:**
     - I believe GitHub places `PULL_REQUEST_COMMIT` timeline items by commit date, not push time.
     - A commit authored before the ejection and pushed afterwards without a force-push (a local follow-up, a cherry-pick) would then sort before the removal event.
     - Once checks go green, the row would read 🪃 instead of ✅.
     - The README's "a fix erases it" holds only for force-pushes and commits authored after the ejection. The impact is small, because the next step from either glyph is to queue the PR again.
   - **Fix:** Ask for `last: 2`, and clear 🪃 when the head commit's `pushedDate` or `committedDate` is later than the removal's `createdAt`. Otherwise, narrow the README's claim.

### Nits
4. **The README misstates the order of the colour rules.**
   - **Location:** the "Two icon sets" section of `README.md`.
   - **Cause:** It says the rules are "in the order of the table above" and "ordered the way `blocker_for` decides". The block actually starts with draft and puts merged, closed and no-PR near the end. This is harmless, because a verdict holds one blocker glyph and the 💬 rule is last. The second claim is still at `HEAD`, `README.md:330`.
   - **Fix:** Say instead that the order is free, except that the conversation rule must come last.

5. **The PR description is stale.**
   - **Location:** the "Octicons by default" section of the PR body.
   - **Cause:** It says colour "would have to come from herdr". Commits `43e6587` and `d1daf8a` then document that herdr does apply colour through `rules`.
   - **Fix:** Edit the PR body, or leave it as history.

Next: decide on finding 1, since the other four are small and can be batched after it. If you go ahead, the first edit is the `Requires herdr ≥ 0.8.2` line at `README.md:14`.