# proactive / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `proactive`  prompt: `review-pr-2`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 22  wall: 319s  api: 313s
- cost: $3.0427  output tokens: 26425  words: 1023

---

# Review of PR #2: merge

I would merge it; none of the nine findings blocks. The PR was in fact already merged on 2026-09-10 as `39af215`. All 108 tests pass, the behaviour-preserving-refactor and codepoint claims hold, and findings 1–3 are worth one small follow-up commit.

- **Source:** `gh` is not authenticated here, so I reviewed the local range `c0baa8e..d1daf8a` plus the public REST API.
- **Files:** no repository file was modified. Scratch copies of both revisions lived in `/tmp` and have been removed.
- **Still open:** I checked findings 1–4 against current `HEAD` (`81e8933`) and all four are still there.

## What I checked

| Claim in the PR | Result |
|---|---|
| 108 tests pass, up from 76 | Confirmed. I ran the head and base suites from exported copies. |
| The refactor is behaviour-preserving | Confirmed. I compared base `emoji_for(pr, unstable)` with head `emoji_for(pr, icon_set("emoji", unstable))` over 82,944 field combinations and found 0 differences. `required_query` is byte-identical. |
| Codepoints come from the Nerd Fonts glyph table | Confirmed. All 15 match `glyphnames.json` v3.5.1, and the 15 README colour rules name the same codepoints. |
| Every exit from the queue emits the removal event | Confirmed. Two queue-merged `Homebrew/homebrew-core` PRs show `removed_from_merge_queue` next to `merged`, so `reason` does have to tell a merge from an ejection. |
| GraphQL field names and the `reason` values | Not checked. GraphQL needs auth, and the REST timeline does not expose `reason`. |
| herdr's `rules` / `contains` / `\uXXXX` handling | Not checked. |

## Findings, most severe first

**1. Medium: the default glyph set now needs a Nerd Font, and the install notes do not say so**
- **Location:** `daemon.py:110` (`DEFAULT_ICON_SET = "nerd"`), the "Requires" line at `README.md:14`, the sample row at `README.md:8`, and the `herdr-plugin.toml` description.
- **Cause:**
  - The default moved from the one set that needs no font to private-use codepoints.
  - Anyone upgrading 0.4.1 → 0.5.0 without a patched font gets boxes or blanks on every row, with nothing in the log.
  - The font is first mentioned at `README.md:181`.
  - Install still lists only herdr, Python, git and `gh`. The sample row and the manifest still show emoji.
- **Fix:** keep the default if you want it, but add "a Nerd Font, or `icons = "emoji"`" to Requires and to the manifest description, and note the change for upgraders. The alternative is to make `nerd` opt-in.

**2. Low–medium: an unrecognised `icons` value silently falls back to the font-dependent set**
- **Location:** `daemon.py:180-182`.
- **Cause:**
  - `icons = "Emoji"`, `"emojis"`, and `'emoji'` (valid TOML) all fail the regex or the `ICON_SETS` test, and nothing is logged.
  - A user trying to get away from the boxes keeps them and gets no hint.
  - The test comment "keeps the default rather than blanking a row" has it backwards now, because the default is the set that can blank a row.
- **Fix:** log when the key is present but rejected, the way the interval floor already does.

**3. Low: the startup log prints a glyph where the setting used to be**
- **Location:** `daemon.py:879-882`.
- **Cause:**
  - `read_config` now returns the resolved table, so `icons["unstable"]` is a glyph.
  - I ran the line: it writes `unstable=\uf42e` instead of `unstable=ok`.
  - The active icon set is never logged.
- **Fix:** return the setting names alongside the table and log `unstable=ok, icons=nerd`.

**4. Low: nothing in `emoji_for` keeps 💬 off a queued pull request**
- **Location:** the `emoji_for` guard at `daemon.py:357`, compared with `required_targets` at `daemon.py:474`.
- **Cause:**
  - A draft swallows 💬 explicitly.
  - A queued PR relies only on `required_targets` never asking about it.
  - `emoji_for({"in_merge_queue": True, "conversation_block": True, …})` returns `🚂💬` (I ran it).
  - Widening the second request later would break the README guarantee, and no test would catch it.
- **Fix:** add `or pr.get("in_merge_queue")` beside `pr.get("isDraft")`, and add a one-line test.

**5. Low, plausible but not confirmed: "a fix erases it" depends on timeline order**
- **Location:** `daemon.py:386-388` and `queue_ejection`.
- **Cause:**
  - `timelineItems(last: 1)` takes the newest item by timeline position.
  - GitHub positions commits by commit date, not push time. The REST `committed` events have no `created_at` of their own.
  - A fix committed locally before the ejection and pushed after it, or a cherry-pick with an old date, would sort before the removal event. 🪃 then stays after the fix.
  - The impact is limited to the ✅/🛑 slot, and queueing the PR again clears it.
- **Fix:** request `beforeCommit { oid }` on the removal event plus `headRefOid`, and treat a moved head as cleared. Confirm the field by introspection first.

**6. Low: no recorded data backs the `reason` allow-list**
- **Location:** `daemon.py:337-338` and the hand-built `fixtures/lookup_queue.json`.
- **Cause:**
  - The comparison against `"merged"` and `"manual"` is exact.
  - An unknown reason fails towards 🪃, as designed. But if GitHub spells the manual reason differently, every deliberate dequeue reads 🪃.
- **Fix:** compare `reason.lower()`, and record a real removal node into the fixture when one turns up.

**7. Nit: the PR description is out of date against its own last commits**
- **Location:** the PR body.
- **Cause:**
  - It says the glyphs are monochrome and "colour for a token would have to come from herdr".
  - Commit `43e6587` then documents herdr doing exactly that.
- **Fix:** amend the body, since it is the record attached to the merge.

**8. Nit: the README's claim about rule order contradicts the rules block**
- **Location:** the "Two icon sets" section of `README.md`.
- **Cause:**
  - The prose says the rules follow "the order of the table above" and "the way `blocker_for` decides".
  - In the block, merged, closed and no-PR come near the end, not first.
  - This is harmless: a token holds one blocker glyph, so only "conversation last" matters.
- **Fix:** say that instead.

**9. Nit: formatting left over from the mechanical rename**
- **Location:** `test_daemon.py`, around `test_the_queue_owns_a_pull_request_while_it_holds_it`.
- **Cause:**
  - There are two blank lines inside the class.
  - Several `emoji_for(\n{…}\n)` calls were wrapped only because the old `daemon.emoji_for(` name was longer.
- **Fix:** run the formatter.