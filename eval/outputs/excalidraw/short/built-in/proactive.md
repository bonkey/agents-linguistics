# proactive / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `proactive`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 6  wall: 112s  api: 33s
- cost: $0.5251  output tokens: 2557  words: 504

---

I've traced the allowlist and how it's used. It lives in `packages/element/src/embeddable.ts`, and adding a domain is one required edit plus up to three optional ones.

## Where it's kept

`packages/element/src/embeddable.ts` holds two hardcoded `Set`s:

- **`ALLOWED_DOMAINS`** (`embeddable.ts:133`) lists the hosts that may be embedded by default: YouTube, Vimeo, Google Drive, Figma, Gist, Twitter/X, `*.simplepdf.eu`, StackBlitz, val.town, Giphy, Reddit and MS Forms.
- **`ALLOW_SAME_ORIGIN`** (`embeddable.ts:152`) is a subset of those. Iframes for these hosts also get `allow-same-origin` in their sandbox. Gist, Giphy, val.town and `link.excalidraw.com` are deliberately left out.

`embeddableURLValidator` (`embeddable.ts:502`) is the function that checks a URL against the list. It is called from `App.tsx:1807` when rendering and `App.tsx:4720` when pasting. If the host app passes a `validateEmbeddable` prop (boolean, RegExp, array or function), that takes precedence over the built-in list. The built-in list is used only when the prop is unset or the function returns `undefined`.

## Adding a domain

1. **Add the bare hostname to `ALLOWED_DOMAINS`.** This is the only required step.
   - Leave off `www.`, because `matchHostname` (`embeddable.ts:439`) strips it before comparing.
   - Matching is exact. A subdomain such as `player.vimeo.com` needs its own entry.
   - A wildcard such as `*.simplepdf.eu` replaces only the first label. It matches `foo.simplepdf.eu` but not `a.b.simplepdf.eu` or the bare apex.

2. **Add it to `ALLOW_SAME_ORIGIN` only if the embed needs it.** Some embeds break without same-origin access to their own cookies or storage. It loosens the sandbox, so leave the domain out unless the embed fails without it.
   - The entry must use the same string as in `ALLOWED_DOMAINS`, wildcards included. When given a Set, `matchHostname` always matches against `ALLOWED_DOMAINS` and ignores the Set passed in, and the result is then looked up in `ALLOW_SAME_ORIGIN`.

3. **Add URL rewriting in `getEmbedLink` (`embeddable.ts:171`) if the share URL differs from the embeddable URL.**
   - Most providers need a `RE_*` regex and a branch that rewrites the link. YouTube becomes `/embed/…`, Figma becomes `/embed?embed_host=…`, and MS Forms gets `embed=true` appended.
   - Script-based embeds (Twitter, Reddit, Gist) return `type: "document"` with a `srcdoc` instead.
   - Each branch sets `intrinsicSize` and writes to `embeddedLinkCache`.
   - If the raw URL already works in an iframe, the generic fallthrough at the bottom handles it and you can skip this step.

4. **Add a branch to `maybeParseEmbedSrc` (`embeddable.ts:474`) if users will paste the provider's embed snippet.** The generic `<iframe src=…>` and `<blockquote href=…>` regex already covers most snippets.

5. **Add tests in `packages/element/tests/embeddable.test.ts`.** The Google Drive block (line 155 onwards) is a good template. It covers both the `getEmbedLink` rewriting and "should validate … domain by default" via `embeddableURLValidator`. Then run `yarn test:update` and `yarn test:typecheck`, as `CLAUDE.md` asks.

I found no CSP or other config file listing these domains. The only other mention is `packages/excalidraw/CHANGELOG.md`, so a new default domain needs a changelog line there.

If you only need a domain in your own integration, pass `validateEmbeddable={["example.com", /regex/]}` (or a function) to `<Excalidraw>` instead of editing the list. Such a domain never matches `ALLOW_SAME_ORIGIN`, so its iframes are sandboxed without `allow-same-origin`.