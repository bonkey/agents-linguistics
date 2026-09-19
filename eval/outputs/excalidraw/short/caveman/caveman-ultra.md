# caveman-ultra / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-ultra`  prompt: `short`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 101s  api: 33s
- cost: $0.5802  output tokens: 2483  words: 279

---

Search done. The allowlist is `ALLOWED_DOMAINS` at `packages/element/src/embeddable.ts:133`. It is a hardcoded `Set` and nothing else in the repo references it.

**Matching** (`matchHostname`, `embeddable.ts:439`)
- Hostnames are compared as bare domains, with `www.` stripped.
- Subdomains do not match automatically. `player.vimeo.com` has its own entry.
- A wildcard covers the first subdomain label only, as in `*.simplepdf.eu`. `*.foo.com` does not match bare `foo.com`.
- `embeddableURLValidator` (`:502`) reads the list only when the host's `validateEmbeddable` prop gives no verdict.

**Add a domain**
1. Add the bare domain string to `ALLOWED_DOMAINS`.
2. If the embed needs cookies or storage inside the iframe, also add it to `ALLOW_SAME_ORIGIN` (`:152`).
   - That adds `allow-same-origin` to the iframe sandbox at `packages/excalidraw/components/App.tsx:2096`.
   - Treat it as a security decision. `gist.github.com`, `val.town`, `giphy.com` and `link.excalidraw.com` are left out of that set.
3. If the share URL differs from the embed URL, add a `RE_*` regex and a rewrite branch in `getEmbedLink` (`:171`).
   - Follow the existing pattern: set `link`, `type`, `aspectRatio`, write `embeddedLinkCache`, then return.
   - Script-based embeds (Twitter, Reddit, Gist) return `type: "document"` with `srcdoc`, and pass the URL through `escapeDoubleQuotes`.
   - With no branch, the generic fallback at `:388` iframes the raw link at 560×840.
4. If users paste an HTML snippet instead of a URL, add an extraction regex to `maybeParseEmbedSrc` (`:474`). The generic `<iframe src>` / `<blockquote href>` case is already handled.
5. Add cases to `packages/element/tests/embeddable.test.ts` and an entry to `packages/excalidraw/CHANGELOG.md`, where earlier domain additions are recorded.
6. Run `yarn test:typecheck`, then `yarn test:update`.

Hosts embedding the library don't need to patch anything. They can pass `validateEmbeddable` as a boolean, `RegExp`, array of domains, or function, and it overrides the list.