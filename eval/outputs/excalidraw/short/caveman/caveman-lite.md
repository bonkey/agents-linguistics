# caveman-lite / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-lite`  prompt: `short`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 113s  api: 34s
- cost: $0.536  output tokens: 2559  words: 405

---

The allowlist is `ALLOWED_DOMAINS` in `packages/element/src/embeddable.ts:133`. It is a module-private `Set` of bare hostnames. `ALLOW_SAME_ORIGIN` sits next to it at `:152`.

**How matching works** (`matchHostname`, `:439`):
- It strips `www.` from the URL hostname and does an exact `Set` lookup.
- If that misses, it replaces the first subdomain with `*` and looks up again, which is how `*.simplepdf.eu` matches.
- A bare `youtube.com` entry does not match `m.youtube.com`. Add `*.domain` or the explicit subdomain if you need one.
- `embeddableURLValidator` (`:502`) falls back to `ALLOWED_DOMAINS` only when the host app's `validateEmbeddable` prop is unset or returns `undefined`.

**Adding a domain:**
1. Add the bare hostname (no `www.`, no protocol) to `ALLOWED_DOMAINS`. This is enough if the site's URL works directly as an iframe `src`. `getEmbedLink` falls through to the generic branch at `:388` with a 560×840 default size.
2. If the iframe needs `allow-same-origin` in its sandbox, also add the hostname to `ALLOW_SAME_ORIGIN`.
   - `App.tsx:2097` sets the sandbox flag from this set.
   - This loosens security, so add it only for trusted domains that break without it.
   - `gist.github.com`, `val.town` and `giphy.com` are deliberately left out of this set.
3. If the share URL differs from the embed URL, add a `RE_*` regex at the top of the file and a branch in `getEmbedLink` (`:171`).
   - The branch rewrites the link and sets `type` and `intrinsicSize`.
   - Write the result to `embeddedLinkCache`.
   - For script-based embeds, return `type: "document"` with `srcdoc`, as Twitter, Reddit and Gist do. Pass the URL through `escapeDoubleQuotes`.
4. If users paste an embed snippet (`<iframe …>` or `<blockquote …>`), handle it in `maybeParseEmbedSrc` (`:474`). `RE_GENERIC_EMBED` already covers plain `<iframe src>`.
5. Add tests in `packages/element/tests/embeddable.test.ts`. "should validate Google Drive domain by default" at `:225` is a model for the validator case.
6. Run `yarn test:update` and `yarn test:typecheck`. Add a note to `packages/excalidraw/CHANGELOG.md` if the change is user-facing.

**One quirk:** when `matchHostname` receives a `Set`, it ignores that argument and always checks `ALLOWED_DOMAINS` (`:450`, `:458`). The `allowSameOrigin` lookup at `:184` still works, because the returned domain is then checked against `ALLOW_SAME_ORIGIN`. The consequence is that an entry present only in `ALLOW_SAME_ORIGIN` has no effect, so the domain must be in both sets.

To allow a domain in a host app without touching the library, pass the `validateEmbeddable` prop instead. It accepts a boolean, a `RegExp`, an array of strings or `RegExp`s, or a function. The docs are in `dev-docs/docs/@excalidraw/excalidraw/api/props/props.mdx`.