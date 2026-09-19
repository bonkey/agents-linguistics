# caveman-full / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-full`  prompt: `short`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 5  wall: 85s  api: 21s
- cost: $0.4923  output tokens: 1418  words: 208

---

Allowlist lives in `packages/element/src/embeddable.ts:133` as `ALLOWED_DOMAINS` Set. Second Set `ALLOW_SAME_ORIGIN` at `:152`.

Add new domain:

1. Add bare hostname to `ALLOWED_DOMAINS`. No `www.` prefix, `matchHostname` (`:439`) strips it. Wildcard supported for first subdomain only: `*.example.com`.
2. If embed needs cookies/storage/same-origin scripts, add also to `ALLOW_SAME_ORIGIN`. This sets `sandbox.allowSameOrigin` on iframe. Weaker sandbox, add only for trusted domain.
3. If raw URL not directly embeddable, add `RE_*` regex at top plus branch in `getEmbedLink` (`:171`). Branch rewrites link to embed form (see YouTube, Vimeo, Figma), sets `intrinsicSize` and `type`, writes `embeddedLinkCache`. Script-based embeds (Twitter, Reddit, Gist) return `type: "document"` with `srcdoc`. Escape URL with `escapeDoubleQuotes`.
4. If users paste embed HTML snippet, not URL, extend `maybeParseEmbedSrc` (`:474`). Generic `<iframe src>` / `<blockquote href>` already handled by `RE_GENERIC_EMBED`.
5. Add test in `packages/element/tests/embeddable.test.ts`. Run `yarn test:update` and `yarn test:typecheck`.

Plain iframe-friendly domain needs step 1 only. Falls through to generic branch at `:388`.

Gotcha: `matchHostname` with Set argument always checks `ALLOWED_DOMAINS` (`:450`, `:458`), ignores passed Set. Return value then checked against `ALLOW_SAME_ORIGIN.has()` at `:184`, so result still correct. Wildcard entries must use identical string in both Sets.

Host apps skip allowlist via `validateEmbeddable` prop (boolean, RegExp, array, function), see `embeddableURLValidator` at `:502`. No edit to library needed for that path.