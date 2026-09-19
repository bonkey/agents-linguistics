# caveman-lite / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-lite`  prompt: `review-pr-2`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 33  wall: 316s  api: 314s
- cost: $3.435  output tokens: 23114  words: 782

---

## Verdict: merge, with follow-ups

PR #2 is already merged (39af215, 2026-09-10), so I reviewed the diff `c0baa8e..d1daf8a` and these are follow-up items.

I found no blocking defect:
- All 108 tests pass at the PR head.
- All 15 Octicon codepoints match the Nerd Fonts `i_oct.sh` table.
- The enum names and `RemovedFromMergeQueueEvent.reason` in the GraphQL query are as I recall the schema; I could not run the query because `gh` is unauthenticated here.
- The herdr `rules` claims hold: herdr has a 16-rule limit and supports `contains` and `fg`. These shipped in 0.8.2, which equals `min_herdr_version`.
- The `reason` values `merged` and `failed_checks` match real API output reported by other projects.

I changed no repository files.

## Findings, most severe first

Line numbers refer to the PR head `d1daf8a`.

**1. Medium: the default flip breaks existing installs silently.**
- Location: `daemon.py:110` (`DEFAULT_ICON_SET = "nerd"`), `README.md:14`, `herdr-plugin.toml:5`.
- Cause:
  - Upgrading from 0.4.1 to 0.5.0 replaces every emoji with private-use codepoints. A user without a Nerd Font sees empty boxes.
  - Existing herdr `rules` keyed on emoji stop matching.
  - `--query` and `--resolve` output changes for scripts that consume it.
  - Install "Requires" does not list a Nerd Font, the README intro sample still shows emoji, and the manifest still says "One emoji per sidebar row".
- Fix:
  - Either keep `emoji` as the default, or add the Nerd Font to "Requires", add an upgrade note, and update the manifest description.
  - Log the active icon set at start.

**2. Low to medium: the `manual` literal is unverified, and it is the only spelling that changes behaviour.**
- Location: `daemon.py:338`, `test_daemon.py:494`, `fixtures/lookup_queue.json`.
- Cause:
  - The fixture is hand-built.
  - `merged` and `failed_checks` match real output, but I found no source confirming `manual`.
  - If GitHub spells it differently, every manual dequeue reads 🪃 until the next push.
  - `merged` is covered by `state == MERGED`, apart from a window of about 1 second between the removal event and the merge.
- Fix: dequeue one PR by hand, record the response, and pin the literal. Until then, mark it unverified in the docstring.

**3. Low, plausible: 🪃 can stick after a plain push.**
- Location: `daemon.py:386-388`, `daemon.py:333-335`.
- Cause:
  - I believe GitHub orders timeline commits by commit date, not push time; I did not confirm this.
  - If so, a commit authored before the ejection and pushed after it, or a cherry-pick with an old date, sorts before the removal event. `last: 1` then still returns the removal.
  - A force-push is safe because it emits its own event.
- Fix: document the limit, since re-queueing clears it. A head-oid comparison needs a recorded response first, because `beforeCommit` may not be the PR head.

**4. Low: 🪃 hides a block that re-queueing cannot fix.**
- Location: `daemon.py:283-286`.
- Cause:
  - An ejected PR that later gets `CHANGES_REQUESTED` has status `BLOCKED` but reads 🪃, which suggests queueing it again.
  - The docstring claim that every rung above 🪃 names the fix does not cover this case.
- Fix: test `reviewDecision == "CHANGES_REQUESTED"` above the ejected rung, or exclude it from 🪃.

**5. Low: the startup log lost the setting names.**
- Location: `daemon.py:879-882`.
- Cause: `unstable=%s` now prints `icons["unstable"]`, a private-use glyph in `daemon.log` by default. The `ok`/`pass`/`warn` name is gone and the icon set is never logged.
- Fix: return the names from `read_config` and log `icons=<name>, unstable=<name>`.

**6. Low: an invalid `icons` value falls back silently.**
- Location: `daemon.py:180-182`.
- Cause: `icons = 'emoji'` (single quotes), `"Emoji"` or a typo keeps `nerd` with no log line. With the new default, a failed opt-out means empty boxes and no hint why.
- Fix: log when the key is present but its value is rejected, as the interval floor already does.

**7. Nit: the README description of rule order is wrong.**
- Location: `README.md:211`, `README.md:242`.
- Cause: the README says the rules are "in the order of the table above" and "ordered the way `blocker_for` decides", but the block starts at draft and puts merged, closed and no-PR last. This is harmless, because a verdict holds one blocker glyph and only the conversation rule must be last.
- Fix: state that actual invariant instead.

**8. Nit: the README claim about recorded fixtures is stale.**
- Location: `README.md:310`.
- Cause: it says fixtures are "recorded from real pull requests", but `lookup_queue.json` is hand-built. `test_daemon.py:21` admits this; the README does not.
- Fix: name the exception in the README.

Sources:
- [Nerd Fonts i_oct.sh](https://raw.githubusercontent.com/ryanoasis/nerd-fonts/master/bin/scripts/lib/i_oct.sh)
- [Jamie Tanna: PRs taken out of the merge queue](https://www.jvt.me/posts/2026/08/11/github-merge-queue-prs/)
- [5dive-ai/5dive PR #902](https://github.com/5dive-ai/5dive/pull/902)
- [PostOakLabs/ainumbers PR #1857](https://github.com/PostOakLabs/ainumbers/pull/1857)
- [autumngarage/touchstone PR #1158](https://github.com/autumngarage/touchstone/pull/1158)
- [digitaldrywood/detent issue #2474](https://github.com/digitaldrywood/detent/issues/2474)
- [herdr CHANGELOG](https://github.com/herdrdev/herdr/blob/master/CHANGELOG.md)