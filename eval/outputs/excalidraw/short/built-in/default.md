# default / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `default`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 119s  api: 36s
- cost: $0.5445  output tokens: 2633  words: 411

---

The allowlist is in `packages/element/src/embeddable.ts`, as two module-level `Set`s:

- **`ALLOWED_DOMAINS`** (`embeddable.ts:133`) lists the hostnames that pass default validation: YouTube, Vimeo, Drive, Figma, Gist, Twitter/X, `*.simplepdf.eu`, StackBlitz, val.town, Giphy, Reddit and MS Forms.
- **`ALLOW_SAME_ORIGIN`** (`embeddable.ts:152`) is a subset whose iframes also get `allow-same-origin` in the `sandbox` attribute, which is applied at `packages/excalidraw/components/App.tsx:2096`.

### Adding a domain

1. **Add the hostname to `ALLOWED_DOMAINS`** (required).
   - Use the bare hostname with no `www.`, because `matchHostname` (`embeddable.ts:439`) strips `www.` before the lookup.
   - Matching is exact, so other subdomains need their own entry. `vimeo.com` and `player.vimeo.com` are listed separately for this reason.
   - A `*.example.com` entry wildcards the first label only.
2. **Add it to `ALLOW_SAME_ORIGIN`** only if the embed breaks without it, for example players that need cookies or storage.
   - Leave it out otherwise; `gist.github.com`, `val.town`, `giphy.com` and `link.excalidraw.com` are deliberately absent.
   - The entry must be spelled identically in both sets. `matchHostname` returns the key it found in `ALLOWED_DOMAINS`, even when called with the other set, and that key is then looked up in `ALLOW_SAME_ORIGIN`.
3. **Add URL rewriting in `getEmbedLink`** (`embeddable.ts:171`) only if the share URL isn't directly iframe-able.
   - Add a `RE_*` regex at the top of the file and a branch that rewrites the link to its embed form.
   - Set `intrinsicSize` and `type` (`"video"`, `"generic"`, or `"document"` with a `srcdoc`, as Twitter, Reddit and Gist do), and write the result to `embeddedLinkCache`.
   - Without a branch the URL falls through and is embedded as-is at 560×840.
4. **Extend `maybeParseEmbedSrc`** (`embeddable.ts:474`) only if users will paste an embed snippet such as `<blockquote>` or `<script>` that `RE_GENERIC_EMBED` doesn't already unwrap.
5. **Add tests** in `packages/element/tests/embeddable.test.ts`.
   - The Google Drive block there is a good template. Its "should validate Google Drive domain by default" case checks `embeddableURLValidator`, and the others check the rewritten link.
   - Then run `yarn test:update` and `yarn test:typecheck`, as the project's `CLAUDE.md` asks.
6. **Add a `packages/excalidraw/CHANGELOG.md` entry.** Previous domain additions are recorded there.

### Host-app override

`embeddableURLValidator` (`embeddable.ts:502`) only falls back to `ALLOWED_DOMAINS` when the `validateEmbeddable` prop is unset or its function returns `undefined`. The prop accepts `true`, a hostname array, a RegExp or RegExp array, or a function, so a host app can allow a domain without touching the library. It is documented in `dev-docs/docs/@excalidraw/excalidraw/api/props/props.mdx:253`.

That override only affects validation. The `allow-same-origin` decision in `getEmbedLink` always comes from the built-in `ALLOW_SAME_ORIGIN` set, so domains allowed via the prop are still sandboxed without it.