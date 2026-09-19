# learning / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `learning`  prompt: `review-pr-2`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 21  wall: 416s  api: 411s
- cost: $3.7375  output tokens: 33721  words: 1018

---

## Verdict: **merge**, with follow-ups

PR #2 was already merged on 2026-09-10 as `39af215`, with no review. CodeRabbit was rate-limited and there are no human comments. I reviewed it as submitted (`c0baa8e..d1daf8a`) and did not modify any repo file. Nothing I found would have blocked it. All findings are medium or lower, and four of them are still open on `main`.

### What I verified

- **Tests:** 108 pass at the PR head and 76 at the base, as the PR claims.
- **Refactor equivalence:** I rebuilt the harness that was not committed. All 165888 field combinations give identical results between base and head. The emoji and Nerd sets also agree on every state, including the two new fields.
- **Codepoints:** all 15 Nerd Font codepoints match the upstream `glyphnames.json` name for name.
- **Not verified:**
  - I could not run live GraphQL because `gh` is unauthenticated, so the two merge-queue findings marked "not confirmed live" are plausible rather than confirmed.
  - I could not tell whether herdr's `rules` feature exists at the manifest's `min_herdr_version = "0.8.2"`. The local 0.9.1 has it.
  - I did not check glyph width in non-Mono Nerd Fonts.

### Findings, most severe first

Line numbers refer to the PR head, `d1daf8a`.

**1. Medium: the new default breaks existing users silently.**
- **Location:** `daemon.py:110` (`DEFAULT_ICON_SET = "nerd"`), README "Two icon sets" (`README.md:179`).
- **Cause:** upgrading from 0.4.1 to 0.5.0 replaces every row's emoji with private-use codepoints. Without a Nerd Font those render as empty boxes. There is no upgrade note, the daemon cannot detect the font, and the log does not say which set is active.
- **Fix:** add an upgrade note to the README and log `icons=<name>` at startup. Alternatively, keep `emoji` as the default and make `nerd` the opt-in.
- **Status:** still open on `main` (`daemon.py:134`).

**2. Low to medium: the way out of finding 1 fails silently.**
- **Location:** `daemon.py:180-182`.
- **Cause:** the regex only accepts a lowercase value in double quotes. I ran it:

  | Setting | Result |
  |---|---|
  | `icons = 'emoji'` (valid TOML) | Nerd set, no log line |
  | `icons = "Emoji"` | Nerd set, no log line |

  The same pattern was harmless for `unstable`. Here it means a user without a Nerd Font sees empty boxes and nothing tells them why.
- **Fix:** accept `['"]` and log any unrecognised value, the way the interval floor already does.

**3. Low to medium: `manual` assumes the person who dequeued the PR is you (design issue, not confirmed live).**
- **Location:** `daemon.py:338`, `README.md:122`.
- **Cause:** "a person took it out and knows" is only true if that person is the viewer. Merge queues are used in team repos, and a maintainer dequeuing your PR leaves it reading ✅ while nothing will merge it. That is the failure this PR set out to remove.
- **Fix:** request `actor { login }` on the removal event and `viewer { login }` once per query. Exempt `manual` only when the two match.

**4. Low: 🪃 depends on timeline order, and GitHub places commits by commit date rather than push time (not confirmed live).**
- **Location:** `daemon.py:386-388` and `daemon.py:333-338`, plus the README claim at `README.md:116` ("a fix erases it").
- **Cause:** a fix committed before the ejection and then pushed normally, or a cherry-pick that keeps its author date, sorts before the removal event. `last: 1` still returns the removal, so 🪃 comes back once the checks pass. Force-pushes are covered by their own event. The impact is mild, because 🪃 reads "queue it again", which is still true.
- **Fix:** compare the event's `beforeCommit { oid }` with the PR's `headRefOid`. I believe `beforeCommit` exists on this event, but confirm by introspection. That removes the dependence on ordering.

**5. Low: `emoji_for` compares glyphs instead of states.**
- **Location:** `daemon.py:359`.
- **Cause:** `verdict == icons["blocked"]` relies on the blocked glyph being unique, and `icon_set` already gives two states the same glyph for `unstable`. There is no live bug, because a test enforces uniqueness.
- **Fix:** return state names and map to glyphs last.
- **Status:** already fixed on `main` (`STATE_NAMES`, `daemon.py:469`).

**6. Low: the startup log prints a glyph instead of the setting.**
- **Location:** `daemon.py:879-882`.
- **Cause:** `unstable=%s` now formats `icons["unstable"]`, so the log reads `unstable=\uf42e`. The icon set is not logged at all.
- **Fix:** log the setting names.
- **Status:** still open on `main` (`daemon.py:1397`).

**7. Low: the 🪃 path was never exercised against real data.**
- **Location:** `fixtures/lookup_queue.json`, `test_daemon.py:21`.
- **Cause:** the fixture was built by hand, which the PR discloses. Every other fixture in the repo was recorded from GitHub.
- **Fix:** record one from a throwaway repo whose `merge_group` check fails on purpose.

**8. Nit: the README colour rules contradict their own snippet.**
- **Location:** `README.md:211` and `README.md:242`.
- **Cause:** the text says the rules are in "the order of the table above" and "ordered the way `blocker_for` decides". The snippet starts at draft and puts merged, closed and no-PR last. This is harmless, because a token holds one blocker glyph and only the conversation rule has to come last.
- **Fix:** say that instead.

**9. Nit: the PR body is out of date.**
- **Location:** the PR description.
- **Cause:** it says the glyphs are "monochrome… the plugin cannot change that", but commits `43e6587` and `d1daf8a` show that herdr colours them.
- **Fix:** edit the body.

**10. Nit: PEP 8 blank lines.**
- **Location:** `test_daemon.py:330-331`.
- **Cause:** two blank lines sit inside `EmojiPrecedence` before the new methods.
- **Fix:** reduce to one.

`★ Insight ─────────────────────────────────────`
- The `last: 1` timeline query stores the ejection state in GitHub, but it inherits GitHub's event ordering, which is why finding 4 exists. Comparing `beforeCommit` with `headRefOid` asks the same question without depending on order.
- Findings 1, 2 and 6 share a cause: a default that can fail visibly was paired with config handling that was only safe when falling back to the default was harmless.
`─────────────────────────────────────────────────`

The highest-value follow-ups are 1, 2 and 6 together, as one small change to `read_config` and the startup log.