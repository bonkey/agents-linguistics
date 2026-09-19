# caveman-ultra / review-pr-2

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-ultra`  prompt: `review-pr-2`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 24  wall: 269s  api: 274s
- cost: $2.8885  output tokens: 19368  words: 700

---

**Verdict: merge.** PR #2 is already merged (39af215, 2026-09-10), and nothing below justifies a revert. Findings 1–3 need a follow-up.

I reviewed `c0baa8e..d1daf8a` from local git because `gh` is not authenticated. Line numbers are at d1daf8a. I changed no repo files.

**What I checked**
- The test suite passes at the PR head: 108 tests OK on Python 3.14.7.
- All 15 Nerd Font codepoints match the official `glyphnames.json`.
- GitHub's public GraphQL schema has `isInMergeQueue: Boolean!`, the four `itemTypes` enum values, and `RemovedFromMergeQueueEvent.reason: String`.
- Public reports confirm the real `reason` values `merged` and `failed_checks` (lowercase).

## Findings, by severity

1. **Medium: the default icon set now needs a Nerd Font.**
   - Location: `daemon.py:110`, `README.md:8-15`.
   - Cause: `DEFAULT_ICON_SET = "nerd"`, so an upgrade from 0.4.1 to 0.5.0 draws every row as tofu where the terminal has no Nerd Font. The daemon cannot detect the font. The Install section does not list a Nerd Font, and the intro sample shows emoji that a default install no longer prints. The default `--query` and `--resolve` output also changes to private-use glyphs, which breaks scripts that match emoji.
   - Fix: keep `emoji` as the default with `nerd` as the opt-in. Or add the Nerd Font to the Install requirements, add an upgrade note, and fix the intro sample.

2. **Medium: the `manual` reason is unverified, and the compare is case-sensitive.**
   - Location: `daemon.py:338`, `fixtures/lookup_queue.json`.
   - Cause: the fixture is hand-built, which `test_daemon.py:21-24` admits. `manual` and `merge_conflict` are guesses. The webhook spells the same reasons `MANUAL` and `MERGE`. If GraphQL spells `manual` any other way, a deliberate dequeue reads 🪃, which contradicts the docstring.
   - Fix: use `reason.lower()`, accept `merge` as well as `merged`, record one real removal event, and mark which literals were observed.

3. **Low: the startup log prints a glyph instead of the setting.**
   - Location: `daemon.py:880-881`; still present at HEAD, `daemon.py:1397`.
   - Cause: `unstable=%s` now receives `icons["unstable"]`, which by default is an unreadable private-use codepoint. The icon set name is never logged.
   - Fix: log the setting names `unstable` and `icons`, for example by returning them from `read_config` or logging them there.

4. **Low: a bad `icons` value falls back without a log line.**
   - Location: `daemon.py:180-182`.
   - Cause: `icons = "Emoji"` or `icons = "emojis"` fails the `[a-z]*` regex or the `in ICON_SETS` test, so the daemon uses `nerd` with no log line. With the new default, that typo draws every row as tofu.
   - Fix: log the rejected value, as the interval floor already does.

5. **Low (plausible, unverified): 🪃 can outlast a fix push.**
   - Location: `daemon.py:386-388`, `timelineItems(last: 1, …)`.
   - Cause: GitHub may place `PullRequestCommit` in the timeline by commit date, not push time. A commit authored before the ejection and pushed after it sorts below the removal event, so 🪃 survives the fix push. The harm is small, because the pull request needs queueing again either way.
   - Fix: compare `createdAt` of the newest queue event against `pushedDate` or `committedDate` of the head commit, or document the limit.

6. **Low: the README rule-order claims contradict its own example.**
   - Location: `README.md:211` and `README.md:242`.
   - Cause: the text says the rules are "in the order of the table above" and "ordered the way `blocker_for` decides". The example starts with draft and puts merged, closed and no pull request near the end. Order only matters for conversation, which must come last.
   - Fix: say that, and drop both claims.

7. **Low: the manifest still says "One emoji per sidebar row".**
   - Location: `herdr-plugin.toml:5`.
   - Cause: the description does not mention Octicons or the font requirement.
   - Fix: mention `icons` and the Nerd Font.

8. **Nit: extra blank lines inside a test class.**
   - Location: `test_daemon.py:330-331`.
   - Cause: two blank lines sit inside the `EmojiPrecedence` class (E303).
   - Fix: leave one blank line.

9. **Nit: the PR bundles two features.**
   - Location: the PR scope.
   - Cause: it combines the queue states with the icon-set default flip, so the two cannot be reverted apart.
   - Fix: split such changes next time.

Sources:
- [ryanoasis/nerd-fonts glyphnames.json](https://raw.githubusercontent.com/ryanoasis/nerd-fonts/master/glyphnames.json)
- [GitHub public GraphQL schema](https://docs.github.com/public/fpt/schema.docs.graphql)
- [5dive-ai/5dive PR #902](https://github.com/5dive-ai/5dive/pull/902)
- [Jamie Tanna, merge queue PRs](https://www.jvt.me/posts/2026/08/11/github-merge-queue-prs/)
- [moooon-B-V/motir-core PR #2932](https://github.com/moooon-B-V/motir-core/pull/2932)
- [digitaldrywood/detent issue #2474](https://github.com/digitaldrywood/detent/issues/2474)