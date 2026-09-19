# ste-concise / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `ste-concise`  prompt: `review-pr-2`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 33  wall: 321s  api: 323s
- cost: $3.745  output tokens: 24028  words: 844

---

**Verdict: merge.** No finding blocks the merge, but fix findings 1 to 3 in a follow-up. [#2](https://github.com/bonkey/herdr-pr-emoji/pull/2) is already merged (commit `39af215`, 10 September 21:05), so this review covers the range `c0baa8e..d1daf8a` after the fact.

Validation that ran:
- The suite of the PR head passes: 108 tests, `python3 -m unittest`.
- All 15 Octicon codepoints in `daemon.py` and in the README colour rules match the Nerd Fonts glyph table v3.5.1.
- The README TOML block parses with `tomllib`.
- The herdr 0.9.1 binary confirms the limit of 16 rules and the `contains` and `fg` keys.
- `gh` has no authentication here, so I read the PR from local git, and no query ran against a live merge queue.
- The repository is unchanged. The temp copies are deleted.

## Findings, most severe first

1. **Default flip without a signal, medium, confirmed**
   - **Location:** `daemon.py:110` (`DEFAULT_ICON_SET = "nerd"`), `README.md:306`.
   - **Cause:** An install on 0.4.1 with no `icons` key changes to private-use glyphs on update. A terminal without a Nerd Font shows a box in every row, and the log says nothing. `--query` and `--resolve` also change their output, while the README still labels it `branch<TAB>emoji`.
   - **Fix:** Log the active icon set at the start. Add an upgrade note to the README. Correct the `--query` label.

2. **The start-up log prints a glyph in place of the setting, low, confirmed**
   - **Location:** `daemon.py:879-882` at the PR head. The defect is still on HEAD at `daemon.py:1397-1398`.
   - **Cause:** `icons["unstable"]` is the resolved glyph. The line reads `unstable=\uf42e`, where the base wrote `unstable=ok`. The name of the icon set is never logged.
   - **Fix:** Return the setting names from `read_config` and log `unstable=ok, icons=nerd`.

3. **An `icons` value that the parser cannot read falls back in silence, low, confirmed**
   - **Location:** `daemon.py:180-182`.
   - **Cause:** The regex accepts only a lowercase value in double quotes. `icons = 'emoji'` is valid TOML, and it still gives Nerd glyphs, as do `"Emoji"` and `"emojis"`. No log line reports the fallback. With finding 1, a user who tries to leave the Nerd set stays on boxes.
   - **Fix:** Accept both quote styles. Log each value that is not in `ICON_SETS`.

4. **No test runs the decision path with the default set, low, confirmed**
   - **Location:** `test_daemon.py:68-76`, the `emoji_for` and `decide` wrappers.
   - **Cause:** Each decision test forces `EMOJI`. I changed `emoji_for` to compare against a literal `"🛑"` and to append a literal `"💬"`, and all 108 tests still passed. That change breaks every Nerd verdict.
   - **Fix:** Run the 💬 cases and one fixture test over each table in `ICON_SETS`.

5. **Two `reason` strings are not verified, low, plausible**
   - **Location:** `daemon.py:338`, `fixtures/lookup_queue.json`.
   - **Cause:** The fixture is built by hand. Public reports confirm `failed_checks`, `merged`, `checks_timed_out` and `invalid_merge_commit` in lowercase, but none shows `manual` or `merge_conflict`. If GitHub records a different string for a manual removal, that row reads 🪃, which the README denies.
   - **Fix:** Record one manual removal from a live queue. Compare with `.lower()`.

6. **The README states a rule order that the block does not have, low, confirmed**
   - **Location:** the "Two icon sets" section of `README.md`.
   - **Cause:** The text says the rules follow "the order of the table above" and "the way `blocker_for` decides". The block puts merged, closed and no PR after mergeable. The colours are still correct, because a token holds one blocker glyph and the 💬 rule is last.
   - **Fix:** State the one constraint that matters: the 💬 rule must be last.

7. **The manifest describes only emoji, low, confirmed**
   - **Location:** `herdr-plugin.toml:5`.
   - **Cause:** The description says "One emoji per sidebar row" and lists only emoji, while the default output is Octicons.
   - **Fix:** Name both icon sets and the `icons` setting.

8. **The position of a commit in the timeline is an assumption, low, plausible**
   - **Location:** `daemon.py:386-388`, `queue_ejection`.
   - **Cause:** `timelineItems(last: 1)` assumes that a pushed commit sorts after an earlier removal event. If GitHub places a `PullRequestCommit` by its commit date, a fix committed before the ejection and pushed after it leaves 🪃 in place. A force push is safe, because that event has its own time. I did not verify the rule that GitHub uses.
   - **Fix:** Record a real response for this sequence and add it as a fixture.

9. **The width of a token with two glyphs depends on the font variant, low, plausible**
   - **Location:** `daemon.py:88-91`, `README.md:181-184`.
   - **Cause:** kitty and WezTerm let a private-use glyph use a second cell only before a space. With a Nerd Font that is not the Mono variant, the first glyph of a verdict with 💬 can draw smaller than a single glyph. I did not test the herdr renderer.
   - **Fix:** Recommend the "Nerd Font Mono" variant in the README.

Sources:
- [Finding which PRs have been taken out of the Merge Queue due to failed status checks](https://www.jvt.me/posts/2026/08/11/github-merge-queue-prs/)
- [5dive-ai/5dive#902](https://github.com/5dive-ai/5dive/pull/902)
- [autumngarage/touchstone#1158](https://github.com/autumngarage/touchstone/pull/1158)
- [PostOakLabs/ainumbers#1857](https://github.com/PostOakLabs/ainumbers/pull/1857)
- [github/gh-stack discussion #223](https://github.com/github/gh-stack/discussions/223)
- [digitaldrywood/detent#2474](https://github.com/digitaldrywood/detent/issues/2474)
- [GitHub Changelog: pull request commits now ordered chronologically](https://github.blog/changelog/2020-07-14-pull-request-commits-now-ordered-chronologically/)
- [Nerd Fonts glyphnames.json](https://raw.githubusercontent.com/ryanoasis/nerd-fonts/master/glyphnames.json)