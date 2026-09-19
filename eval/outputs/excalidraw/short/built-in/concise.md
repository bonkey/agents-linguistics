# concise / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `concise`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 6  wall: 99s  api: 24s
- cost: $0.3727  output tokens: 1589  words: 271

---

The allowlist is the `ALLOWED_DOMAINS` set in `packages/element/src/embeddable.ts:133`. No other file in the repo references these domains apart from the changelog.

To add a domain:

1. **Add the bare hostname to `ALLOWED_DOMAINS`**, without `www.` (it is stripped before matching). A `*.example.com` entry wildcards only the first subdomain label. `embeddableURLValidator` (line 502) falls back to this set when the host app passes no `validateEmbeddable` prop.
2. **Add it to `ALLOW_SAME_ORIGIN` (line 152) only if the embed needs it.** That adds `allow-same-origin` to the iframe sandbox, which some embeds need for cookies or storage. Leave the domain out if the embed works without it, because it weakens the sandbox.
3. **Add URL rewriting in `getEmbedLink` (line 171) if the share URL differs from the embeddable URL.** The pattern is a `RE_*` regex at the top of the file plus a branch that rewrites the link and sets `type` and `aspectRatio`. YouTube, Vimeo, Figma, Google Drive and others do this. Sites that need script-based embeds (Twitter, Reddit, gists) return a `srcdoc` via `createSrcDoc` instead.
4. **Add a regex branch in `maybeParseEmbedSrc` (line 474) if users will paste site-specific embed HTML.** `RE_GENERIC_EMBED` already handles plain `<iframe src=…>` snippets.

Watch for a quirk in `matchHostname` (line 450). When given a Set, it checks `ALLOWED_DOMAINS` rather than the set that was passed in. The `ALLOW_SAME_ORIGIN` lookup at line 184 still works because the returned hostname is checked again with `ALLOW_SAME_ORIGIN.has(...)`, but a domain must be in `ALLOWED_DOMAINS` for that lookup to match at all.

The repo has no dedicated tests for the allowlist. Run `yarn test:update` and `yarn test:typecheck` as usual, and add a note to `packages/excalidraw/CHANGELOG.md`.