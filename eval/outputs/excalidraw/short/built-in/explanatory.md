# explanatory / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `explanatory`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 109s  api: 46s
- cost: $0.5971  output tokens: 3186  words: 610

---

The allowlist is the `ALLOWED_DOMAINS` set in `packages/element/src/embeddable.ts:133`. A second set, `ALLOW_SAME_ORIGIN` at `:152`, controls iframe sandboxing.

## How the two sets work

- **`ALLOWED_DOMAINS`** decides whether a URL can become an embeddable element at all. `embeddableURLValidator` (`:502`) checks it, but only when the host app's `validateEmbeddable` prop doesn't give an answer. If the prop returns `undefined` or isn't set, the check falls through to `matchHostname(url, ALLOWED_DOMAINS)`.
- **`ALLOW_SAME_ORIGIN`** decides whether the iframe gets `allow-same-origin` in its `sandbox` attribute, which is set at `packages/excalidraw/components/App.tsx:2096`. It is a subset of the allowlist. For example, `gist.github.com`, `giphy.com`, `val.town` and `link.excalidraw.com` are allowed but do not get same-origin.

Entries are bare hostnames:

- `matchHostname` (`:439`) strips a leading `www.` before comparing.
- An entry like `*.simplepdf.eu` wildcards only the first subdomain label, so `a.simplepdf.eu` matches and `a.b.simplepdf.eu` does not.

## Adding a new domain

1. **Add the bare hostname to `ALLOWED_DOMAINS`.** Leave off the protocol and `www.`. If pasted links can arrive on several hosts, add each one, as was done for `vimeo.com` and `player.vimeo.com`.

2. **Decide whether it needs `ALLOW_SAME_ORIGIN`.**
   - Add it only if the embed breaks without it, for example players that need cookies or storage.
   - Most embeds that render through `srcDoc` stay off it. This matters because `allow-scripts` is always on, and scripts in a same-origin `srcDoc` frame would run with the host app's origin. Note that twitter and reddit are in the set today even though they use `srcDoc`.

3. **Add URL rewriting in `getEmbedLink` (`:171`) if the share URL isn't the embeddable URL.** Existing examples:
   - YouTube `watch?v=` becomes `/embed/`.
   - Figma gets wrapped in `figma.com/embed?...`.
   - MS Forms gets `embed=true` appended.
   - Twitter, Reddit and Gist build a `srcdoc` with the provider's script.

   This step usually means:
   - Add a `RE_*` regex at the top of the file.
   - Add a branch that sets `link`, `type` (`"video"`, `"generic"` or `"document"`) and `intrinsicSize`.
   - Write the result to `embeddedLinkCache`.
   - Pass any URL you interpolate into HTML through `escapeDoubleQuotes`.

   If the raw URL already embeds fine, skip this step. The function's final branch passes it through as a generic 560×840 embed.

4. **Add a case to `maybeParseEmbedSrc` (`:474`) if users paste embed snippets.** This only matters when `RE_GENERIC_EMBED` (`<iframe src=…>` or `<blockquote href=…>`) doesn't already pull out the right URL. Giphy has a custom case, for example.

5. **Add tests in `packages/element/tests/embeddable.test.ts`.** The Google Drive block, including "should validate Google Drive domain by default", is a good template. Then run `yarn test:update` and `yarn test:typecheck`, as the project's CLAUDE.md asks.

`★ Insight ─────────────────────────────────────`
- **`matchHostname` always checks `ALLOWED_DOMAINS`.** When it is passed a `Set`, the body ignores the argument and reads `ALLOWED_DOMAINS.has(...)` (`:450`, `:458`). So `matchHostname(link, ALLOW_SAME_ORIGIN)` really matches against the allowlist. The result is still correct, because the outer `ALLOW_SAME_ORIGIN.has(...)` at `:184` filters the returned hostname. The catch is that a wildcard entry in `ALLOW_SAME_ORIGIN` only works if the identical string is also in `ALLOWED_DOMAINS`.
- **`validateEmbeddable` is the better route for a single deployment.** If you need the domain in your own app rather than in upstream Excalidraw, pass the prop instead of editing the library. It accepts `true`, a hostname array, RegExp(s), or a function. A function that returns `undefined` defers to the built-in allowlist, so you can extend the defaults without replacing them. Passing an array replaces the defaults entirely, because that branch ends in `return false`.
- **`embeddedLinkCache` is a module-level `Map` with no eviction, keyed by the original link.** Rewriting logic runs once per distinct URL per session. This is also why the Vimeo branch deliberately leaves `error` out of the cached value, so the warning shows only once.
`─────────────────────────────────────────────────`