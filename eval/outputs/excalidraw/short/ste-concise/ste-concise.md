# ste-concise / short

- project: `excalidraw` at `c0ad61c6743a`
- arm: `ste-concise`  prompt: `short`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 115s  api: 37s
- cost: $0.6373  output tokens: 2487  words: 382

---

The allowlist is the `ALLOWED_DOMAINS` set at `packages/element/src/embeddable.ts:133`. A second set, `ALLOW_SAME_ORIGIN` at `packages/element/src/embeddable.ts:152`, controls the iframe sandbox.

## How the allowlist is used

`embeddableURLValidator` (`packages/element/src/embeddable.ts:502`) checks a URL against `ALLOWED_DOMAINS` when the host app gives no `validateEmbeddable` prop. `matchHostname` (`packages/element/src/embeddable.ts:439`) removes a leading `www.` and then looks for an exact match. If that fails, it replaces the first subdomain with `*` and looks again.

## Steps to add a domain

1. Add the bare domain to `ALLOWED_DOMAINS`. Write it without `www.` and without a protocol. Use the `*.example.com` form to allow every first-level subdomain, as `*.simplepdf.eu` does.
2. Decide whether the embed needs `allow-same-origin` in the iframe sandbox. If it does, add the same string to `ALLOW_SAME_ORIGIN`. `App.tsx:2097` adds the sandbox token only for domains in that set. Caution: this token lets the embedded page use its own cookies and storage, so add it only when the embed fails without it.
3. If the share URL of the site differs from its embed URL, add a regex constant at the top of the file and a branch in `getEmbedLink` (`packages/element/src/embeddable.ts:171`). The branch rewrites the link, sets `intrinsicSize` and `type`, and stores the result in `embeddedLinkCache`. The Figma and val.town branches are short models. A domain that embeds as-is needs no branch and falls through to the generic case at line 388.
4. If users paste an HTML embed snippet for the site that `RE_GENERIC_EMBED` does not match, add a case to `maybeParseEmbedSrc` (`packages/element/src/embeddable.ts:474`).
5. Add a test to `packages/element/tests/embeddable.test.ts`. The test at line 225 for Google Drive shows the pattern for the default validation.
6. Run `yarn test:typecheck` and `yarn test:update`.

## Two facts that affect the change

- **Subdomains:** an entry matches the bare domain and `www.` only. `player.vimeo.com` has its own entry for that reason.
- **`matchHostname` with a Set:** the function always reads `ALLOWED_DOMAINS`, not the set passed in (lines 450 and 458). A domain in `ALLOW_SAME_ORIGIN` that is absent from `ALLOWED_DOMAINS` has no effect.

I found no CSP header or `frame-src` rule in the repository, so no second list needs an update. A host app that needs one extra domain can pass `validateEmbeddable` with a list of hostnames and skip the library change. Note that such a list replaces the default allowlist and does not extend it.