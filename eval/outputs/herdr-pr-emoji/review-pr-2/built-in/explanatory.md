# explanatory / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `explanatory`  prompt: `review-pr-2`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 25  wall: 442s  api: 435s
- cost: $3.8855  output tokens: 36223  words: 1487

---

# Review of PR #2: "🚂 queued to merge, 🪃 thrown out of the queue, and Octicons by default"

## Verdict: merge

PR #2 was already merged on 2026-09-10 as `39af215`, so the fixes below are follow-ups, not blockers. I found no defect that produces a wrong row in realistic conditions. The most serious items are an undocumented breaking default and tests that do not pin the mechanism the PR's main claim depends on.

`gh` is not authenticated here. I read the PR metadata from the anonymous GitHub API and rebuilt the diff from the merge commit's parents (`c0baa8e...d1daf8a`). I modified nothing in the repository; the final `git status --porcelain --ignored` is clean. All line numbers refer to the PR head, `d1daf8a`.

### Claims in the PR description that I checked

| Claim | Result |
|---|---|
| 108 tests pass, up from 76 | True: base runs 76 and head runs 108, all passing on Python 3.14. |
| The refactor is behaviour-preserving over 165888 combinations, with both queries byte-identical | True: my own enumeration gave 165,888 combinations and 0 mismatches between `33ebcab` and the head, and both queries are identical. |
| Codepoints come from the Nerd Fonts glyph table | True: all 15 match upstream `glyphnames.json` v3.5.1. |
| The README's `\uXXXX` colour rules match the `NERD` table | True: 15 rules, all present in the table, none missing. |
| Field names, `reason` values and the live Homebrew run | Not checked: GraphQL needs authentication. The enum and field names match the public schema as I know it. |

## Findings, most severe first

### 1. Medium: the default glyph set now needs a Nerd Font, and the install instructions do not say so
- **Location:** `daemon.py:110` (`DEFAULT_ICON_SET = "nerd"`), `README.md:14` (the "Requires…" line) and `herdr-plugin.toml:5`.
- **Cause:** Anyone upgrading from 0.4.1 has every row switch to private-use codepoints without asking for it. In a terminal without a Nerd Font, every state draws as the same empty box.
  - The README first mentions the font at line 181, well below Install.
  - The manifest description still promises "One emoji per sidebar row".
  - The plugin cannot detect the font, so nothing falls back.
- **Fix:** Either keep `"emoji"` as the default and make Octicons opt-in, or keep the new default and document the requirement.
  - Add "a Nerd Font, or `icons = "emoji"`" to the Requires line.
  - Say the same in the manifest description.
  - State the change as an upgrade note for 0.5.0.

### 2. Medium: no test pins the `itemTypes` list that lets 🪃 clear on a push
- **Location:** `daemon.py:386-387`; `test_daemon.py:937-946`.
- **Cause:** Removing `PULL_REQUEST_COMMIT` or `HEAD_REF_FORCE_PUSHED_EVENT` from the query leaves all 108 tests passing (I ran both mutations).
  - The tests only assert that `REMOVED_FROM_MERGE_QUEUE_EVENT` is in the query.
  - Tests such as `test_a_commit_after_the_removal_clears_it` (`:507`) feed hand-built timelines to the parser and never check that the query asks for those types.
  - If either type is lost in a later edit, 🪃 stays after a fix is pushed and nothing fails.
- **Fix:** Assert all four enum names in `lookup_query`'s output. The simplest way is to make the list a module constant and test the constant.

### 3. Medium: the two rules for queued pull requests are untested, and one test passes without the code it names
- **Location:** `test_daemon.py:733` and `fixtures/lookup_queue.json` (#110); `daemon.py:474-475`, `:270-271`; `test_daemon.py:332`.
- **Cause:**
  - The fixture's queued pull request is `UNKNOWN` with a `SUCCESS` rollup, so it would never be a second-request target anyway. Deleting the `in_merge_queue` skip leaves the suite passing.
  - Moving the 🚂 check below `DIRTY` also passes, although the README says a conflicting queued pull request reads 🚂.
- **Fix:**
  - Make #110 `BLOCKED` in the fixture. That is the shape the PR body itself describes, and it makes the existing test exercise the skip.
  - Add a `DIRTY` and `in_merge_queue` case that expects 🚂.

### 4. Low: the startup log prints a glyph instead of the setting, and does not name the icon set
- **Location:** `daemon.py:880-881`; `daemon.py:180-182`.
- **Cause:**
  - The `started pid…` line used to log `unstable=ok`. It now logs `icons["unstable"]`, which under the default set is `unstable=\uf42e`, unreadable in `daemon.log`.
  - The active icon set is never logged.
  - An unrecognised value such as `icons = "emojis"` is dropped silently, which is exactly the misconfiguration that produces finding 1's empty boxes.
  - The log line is still this way on `main` today (`daemon.py:1397`).
- **Fix:** Have `read_config` return the setting names as well, log `icons=nerd unstable=ok`, and log a rejected `icons` value the way the interval floor is already logged.

### 5. Low: "no 💬 on a queued pull request" is enforced in a different function from the one that handles 💬
- **Location:** `daemon.py:356-361`, compared with `:474-475`.
- **Cause:** `emoji_for` guards `isDraft` explicitly but not `in_merge_queue`.
  - The queued rule holds only because `required_targets` never fetches conversation data for a queued pull request.
  - Called directly, `emoji_for` returns `🚂💬`.
  - This cannot happen in the current code path, but one edit to `required_targets` would break the README's promise.
- **Fix:** Add `or pr.get("in_merge_queue")` to the guard at `:357`, plus a one-line test.

### 6. Low: the `reason` comparison is case-sensitive, and an unexpected casing reads as an ejection
- **Location:** `daemon.py:337-338`.
- **Cause:** The reason strings are observed from live pull requests rather than taken from a documented enum. If GitHub ever returned `MANUAL`, as its webhook enum is cased, it would read 🪃. I confirmed that `MANUAL` and `Merged` both return `ejected=True`.
- **Fix:** Compare `reason.lower()`.

### 7. Low, not verified: "a push clears 🪃" assumes the timeline orders commits by push time
- **Location:** `daemon.py:321-324`, `README.md` (the 🪃 paragraphs).
- **Cause:**
  - GitHub's documentation says pull request timelines place commits chronologically, which is why rebased commits can appear out of order.
  - If `PullRequestCommit` items sort by commit date, a commit authored before the ejection but pushed after it lands before the removal event, and 🪃 stays.
  - Force-pushes are timestamped at push time, so rebases are unaffected.
  - The effect would be a stale 🪃 on a fixed pull request until it is queued again.
  - I could not test this without an authenticated token.
- **Fix:** Check it once against a real pull request. If it holds, either note it in the README or compare `createdAt` on the removal with the head commit's `pushedDate`.

### 8. Nit: documentation no longer matches the final commits
- **Location:** the PR body; `README.md:211`, `:242`; `daemon.py:5`.
- **Cause:**
  - The PR description still says the glyphs are monochrome and that colour would have to come from herdr. Commit `43e6587` retracts that.
  - The README says the rules follow "the order of the table above" and "the way `blocker_for` decides". They do not: merged, closed and no-PR come near the end rather than first. This is harmless, because each token holds one blocker glyph and the 💬 rule is last.
  - The header comment in `daemon.py:5` still says "publish one emoji".
- **Fix:** Edit the PR description. In the README, state the real rule: order does not matter as long as the 💬 rule is last.

## What is good about the PR

- The timeline-as-state design holds up under mutation testing: the ordering mutants for 🪃, the `manual` reason mutant, and the `last`-versus-`first` mutant were all caught by the tests.
- Counting unknown `reason` values as ejections is the right choice, because a missed ejection would read ✅ on a pull request nothing will merge.
- `test_no_state_borrows_another_state_glyph` guarantees glyph uniqueness, which makes the `verdict == icons["blocked"]` comparison safe.
- I re-ran the equivalence claim for the refactor commit and it holds.

## One slip in my own process

Partway through, my scratch directory under `/tmp` was deleted between commands. A failed `cd` then made one batch of checks run against the repository's current `HEAD` instead of the PR head. I noticed because the output showed a README heading that was added after this PR. I confirmed the repository was untouched and re-ran every affected check against `d1daf8a`. The line numbers and outputs above come from that re-run.

`★ Insight ─────────────────────────────────────`
- **The tests cover the parser but not the query.** `queue_ejection` is well tested, but the behaviour "🪃 clears on a push" depends on the query string. The tests feed hand-built timelines to the parser, so they still pass if the query stops asking for push events.
- **Deleting a line shows a vacuous test.** `test_a_queued_pull_request_needs_no_second_request` names the skip in `required_targets`, but removing that skip changes nothing in the results. The fixture data decides whether a test exercises the code it is named for.
- **The refactor made the log regression easy.** Resolving `unstable` into the icon table simplified `blocker_for`, but it discarded the setting's name. The only place that still wanted the name, the startup log, was left printing the resolved glyph.
`─────────────────────────────────────────────────`