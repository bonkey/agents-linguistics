# learning / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `learning`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 119s  api: 38s
- cost: $0.5562  output tokens: 2742  words: 541

---

The allowlist is in `packages/element/src/embeddable.ts`. I found no second copy anywhere else in the repo (no CSP config or app-level list).

## Where it lives

There are two `Set`s:

- **`ALLOWED_DOMAINS`** (`packages/element/src/embeddable.ts:133`) lists the hostnames that may be embedded by default.
- **`ALLOW_SAME_ORIGIN`** (`packages/element/src/embeddable.ts:152`) lists the subset whose iframe gets `allow-same-origin` added to its `sandbox` attribute. That attribute is set in `packages/excalidraw/components/App.tsx:2096`.

The check itself is `embeddableURLValidator` (`embeddable.ts:502`). `App.tsx` calls it when you paste a link (`:4720`, `:13305`) and when embeddables render (`:1805`).

## What adding a domain involves

1. **Add the bare hostname to `ALLOWED_DOMAINS`.**
   - Leave off `www.`, because `matchHostname` (`embeddable.ts:439`) strips it before looking up.
   - Subdomains need their own entries, which is why `player.vimeo.com` is listed next to `vimeo.com`.
   - Alternatively, use a wildcard entry such as `*.simplepdf.eu`. The wildcard replaces only the first label, so it matches `foo.simplepdf.eu` but not `simplepdf.eu` or `a.b.simplepdf.eu`.

2. **Decide whether the domain also goes in `ALLOW_SAME_ORIGIN`.**
   - This is a security decision. With `allow-same-origin` the embedded page keeps its own origin, so it can use its cookies and storage. Many players and login-dependent embeds need that.
   - `gist.github.com`, `val.town`, `giphy.com` and `link.excalidraw.com` are left out of it on purpose.

3. **Optionally add URL rewriting in `getEmbedLink` (`embeddable.ts:171`).**
   - Do this when the URL people share differs from the URL that can be embedded. Add a `RE_*` regex and a branch that rewrites the link.
   - The branch also sets `type` (`"video"`, `"generic"` or `"document"`) and the `intrinsicSize` aspect ratio.
   - Existing examples: YouTube `watch?v=` becomes `/embed/`, and Figma links are wrapped in `figma.com/embed?...`. Twitter, Reddit and Gist links build a `srcdoc` instead.
   - If you skip this step, the link is used as-is with a 560×840 generic frame.
   - If people paste `<iframe>` or `<blockquote>` snippets rather than URLs, check `maybeParseEmbedSrc` (`:474`) as well.

4. **Add tests in `packages/element/tests/embeddable.test.ts`.**
   - The Google Drive block (`:155`–`:225`) is a good model. It covers both the link rewriting and "should validate … domain by default".
   - Then run `yarn test:update` and `yarn test:typecheck`, as CLAUDE.md asks.

`★ Insight ─────────────────────────────────────`
- **`matchHostname` has a quirk.** When it is passed a `Set`, it ignores that argument and checks `ALLOWED_DOMAINS` directly (`:450`, `:458`). So `matchHostname(link, ALLOW_SAME_ORIGIN)` actually returns the match from `ALLOWED_DOMAINS`, and the outer `ALLOW_SAME_ORIGIN.has(...)` does the real filtering. This works only because `ALLOW_SAME_ORIGIN` is a strict subset. A domain added only to `ALLOW_SAME_ORIGIN` would do nothing.
- **The allowlist is only a default.** Apps embedding Excalidraw can pass the `validateEmbeddable` prop (`packages/excalidraw/types.ts:1001`), which can be a boolean, a list of domain strings, a RegExp or list of RegExps, or a function. It takes precedence over the default list, except that a function returning `undefined` falls through to it. If you only need the domain in your own integration, use the prop rather than editing the library.
- **Results are cached by the original link.** `embeddedLinkCache` stores each result under the pasted link. That is why the Vimeo branch leaves `error` out of the cached value, so the warning shows only once.
`─────────────────────────────────────────────────`

If you have a specific domain in mind, tell me which one and I can wire it up. Whether it goes in `ALLOW_SAME_ORIGIN` is your decision, since that is the security trade-off.