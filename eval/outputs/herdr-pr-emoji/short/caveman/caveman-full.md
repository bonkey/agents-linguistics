# caveman-full / short

- project: `herdr-pr-emoji` at `81e8933`
- arm: `caveman-full`  prompt: `short`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 4  wall: 20s  api: 15s
- cost: $0.4326  output tokens: 1128  words: 187

---

By design. Plugin mirrors GitHub, and GitHub lets such PR merge.

**GitHub side**
- Branch protection blocks merge only on *required* checks. Non-required failure never blocks.
- GitHub reports that case as `mergeStateStatus == UNSTABLE`: "mergeable, with non-passing commit status". Merge button stays green.
- Required check failing gives `BLOCKED` instead.

**Plugin side** (`daemon.py:397`, README state table)
- Failing check counts only when `isRequired` is true. Then row shows 🟠 (others still running) or ❌ (all settled).
- No required failure, no running checks, no missing review, then `UNSTABLE` falls to its own row.
- Default glyph there is 🆗 (`oct-check`), not ✅. So "mergeable, optional checks red" stays distinct from clean ✅.

This was reason plugin exists: replace `mergr`, which showed such PR as broken (README.md:5).

Want different reading? Set `unstable` in plugin `config.toml` (`config.example.toml:8`):

```toml
unstable = "ok"    # 🆗 default
unstable = "pass"  # ✅ same as clean
unstable = "warn"  # ⚠️ same glyph as conflict
```

One caveat: check marked `isRequired: false` while branch protection lists its context in `requiredStatusCheckContexts` still counts as required (README.md:190-192). So truly optional failures only reach 🆗.