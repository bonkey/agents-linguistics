# i-have-adhd / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `i-have-adhd`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":true}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 101s  api: 34s
- cost: $0.5403  output tokens: 2340  words: 338

---

The allowlist is `ALLOWED_DOMAINS` in `packages/element/src/embeddable.ts:133`. It is the only place these domains are listed; there is no copy in a CSP header, the docs or the app config.

## Adding a domain

1. Add the bare hostname to `ALLOWED_DOMAINS` (`embeddable.ts:133`), without `www.` because the matcher strips it before comparing. To cover subdomains, use a wildcard entry like `"*.simplepdf.eu"`. The wildcard replaces the first subdomain label only.
2. If the embed needs cookies or storage, such as a login or a player API, add the identical string to `ALLOW_SAME_ORIGIN` (`embeddable.ts:152`). This sets `allow-same-origin` on the iframe sandbox. Skip this for domains you trust less, as was done for `gist.github.com`, `giphy.com`, `val.town` and `link.excalidraw.com`.
3. If the URL users paste is different from the URL that embeds, add a regex near the top of the file and a rewrite branch in `getEmbedLink` (`embeddable.ts:171`). This is optional. Figma (`:281`) and val.town (`:302`) are short examples. Without a branch, the link is used as pasted in a generic 560×840 frame.
4. If the site hands out `<blockquote>` or `<script>` snippets rather than iframe URLs, add a case to `maybeParseEmbedSrc` (`embeddable.ts:474`). This is also optional. Generic `<iframe src=…>` snippets already work.
5. Add a test in `packages/element/tests/embeddable.test.ts`. The Google Drive block at line 155 is the model to follow, including "should validate … domain by default" at `:225`.
6. Run `yarn test:update` and `yarn test:typecheck`.

Steps 1, 5 and 6 take about 10 minutes. Add 20–30 minutes if you need a URL rewrite.

## Behavior that affects the change

- `matchHostname` (`embeddable.ts:450`) always checks `ALLOWED_DOMAINS`, even when it is passed `ALLOW_SAME_ORIGIN`. So an entry in `ALLOW_SAME_ORIGIN` only takes effect if the same exact string is also in `ALLOWED_DOMAINS`.
- If the host app passes the `validateEmbeddable` prop (`packages/excalidraw/types.ts:1001`) and it returns a boolean or is an array or regex, it overrides the allowlist (`embeddable.ts:502`). For a single host app, that prop is the way to allow a domain without editing the library.

Next: open `packages/element/src/embeddable.ts:133` and add your hostname to the set.