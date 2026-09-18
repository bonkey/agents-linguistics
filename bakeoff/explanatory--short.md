# explanatory / short

- arm: `explanatory`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.274  model: `claude-fable-5-1`  effort: xhigh
- turns: 6  wall: 63s  api: 61s
- cost: $0.6642  output tokens: 4313  words: 618

---

It is deliberate. The README's first paragraph names it as the reason the plugin exists: it replaced mergr specifically so that "a PR whose only failing checks are non-required reads as mergeable, the way GitHub itself treats it." GitHub's own merge button stays green in that state, with a yellow warning banner rather than a block.

**How the daemon reaches that verdict**

1. **GitHub reports the merge state, not the plugin.** When a check fails but branch protection does not require it, GitHub sets the pull request's merge state to UNSTABLE. A failing required check produces BLOCKED instead. So the required-versus-optional distinction is already made server-side before the daemon sees anything.

2. **The rollup alone cannot be trusted, so a second query asks which checks are required.** The status check rollup reports FAILURE as soon as any single context fails, required or not. The comment on `required_targets` in `daemon.py:664` spells this out. Every open PR with a FAILURE or ERROR rollup, or a BLOCKED state, gets a follow-up GraphQL query that asks `isRequired` on each check run and status context.

3. **Optional failures are discarded before they can count.** In `required_state` at `daemon.py:311`, any context whose `isRequired` is not true is skipped outright. Only the newest attempt of each required check feeds the `required_failing` and `required_running` flags. A failing optional check therefore leaves both flags false.

4. **The ladder in `blocker_for` falls through to the UNSTABLE rung.** In `daemon.py:385` onward, the failing glyphs fire only on `required_failing`. The running glyph fires on a PENDING rollup or a required check still in flight. Neither applies, so evaluation reaches the UNSTABLE branch at `daemon.py:397` and returns the "unstable" icon.

**What the row actually shows**

The default is not the plain mergeable glyph. Out of the box UNSTABLE renders as 🆗, which is `oct-check` in the Nerd Font set, while fully clean renders as ✅, which is `oct-check_circle_fill`. The two look alike at sidebar size, so if you are reading it as identical to a clean PR that is likely why. The `unstable` key in `config.toml` chooses among three renderings:

| Setting | Glyph |
|---|---|
| `"ok"` (default) | 🆗 / `oct-check` |
| `"pass"` | ✅ / `oct-check_circle_fill`, indistinguishable from clean |
| `"warn"` | ⚠️ / `oct-alert`, same glyph as a merge conflict |

The `icon_set` function at `daemon.py:170` resolves that setting into the icon table once, so nothing downstream knows UNSTABLE is configurable. The sort action ranks "unstable" right beside "mergeable" for the same reason. Tests at `test_daemon.py:317` and `test_daemon.py:695` pin the default and the ignoring of optional checks.

`★ Insight ─────────────────────────────────────`
- The plugin trusts GitHub's `mergeStateStatus` for the mergeable verdict but does not trust `statusCheckRollup.state` for the failure verdict. The rollup is a coarse aggregate that flattens required and optional checks together, so the second query exists purely to un-flatten it for PRs that look broken or blocked.
- Review gating is checked before UNSTABLE on purpose. The docstring notes GitHub reports a missing review regardless of merge state, so an unreviewed PR with only optional failures shows 👀 rather than 🆗. The UNSTABLE rung is reached only once everything a person would have to act on has been ruled out.
- Failure containment shapes the fallback. If the required-check query goes unanswered, the PR keeps default marks that "name no check and blame none." For a BLOCKED PR that costs the ❌ and 🟡 verdicts and leaves 🛑. For an UNSTABLE PR it costs nothing, because GitHub already established that no required check failed.
`─────────────────────────────────────────────────`

If you would rather such PRs stand out, set `unstable = "warn"` in the plugin's config and reload. If you want them to read as fully clean, set `"pass"`.
