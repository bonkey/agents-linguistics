# i-have-adhd / probe

- project: `excalidraw` at `c0ad61c6743a`
- arm: `i-have-adhd`  prompt: `probe`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 1  wall: 8s  api: 6s
- cost: $0.2151  output tokens: 511  words: 71

---

ADHD MODE (`i-have-adhd`, always-on via SessionStart hook) is the only output style in context. Its rules: lead with the next action, number multi-step tasks, end with one concrete next action, suppress tangents, restate state each turn, give specific time estimates, make completed work visible, keep a matter-of-fact tone for errors, cap lists at 5 items, and use no preamble, recap, or closing pleasantries. Say "stop adhd mode" to turn it off.