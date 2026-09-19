# caveman-lite / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-lite`  prompt: `critique-readme`  caveman mode: `lite`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 126s  api: 67s
- cost: $0.7689  output tokens: 5524  words: 898

---

The README works for npm consumers. A first-time contributor gets almost nothing from it and must leave the repo to learn how to run the code. I did not check external links (Discord, Twitter, the CodeSandbox and VS Code extension links); I had no network access. I modified no files.

## Missing

**1. Local development steps.**
- "Quick start" (line 83) covers only npm install. Contributors get one external link (line 85).
- Prerequisites are not stated anywhere in the README:
  - Node: `engines` says `>=18`, CI uses `20.x`, the `Dockerfile` uses `node:24`. There is no `.nvmrc`.
  - Yarn: `packageManager` is `yarn@1.22.22`.
- Proposed new section, placed after "Quick start":

````markdown
## Development

Requirements: Node.js >= 18 (CI uses 20.x), Yarn 1.22.x, Git.

```bash
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
yarn          # install all workspaces
yarn start    # dev server at http://localhost:3001
```

Before opening a PR:

```bash
yarn test:typecheck   # TypeScript
yarn test:update      # tests + snapshot update
yarn fix              # Prettier + ESLint autofix
```

No pre-commit hook runs these for you. CI runs lint and tests on every PR.
See the [Development Guide](https://docs.excalidraw.com/docs/introduction/development) for Docker and collaboration-server setup.
````

- `.husky/pre-commit` has `yarn lint-staged` commented out, so nothing runs locally.

**2. Repo map.**
- Only `CLAUDE.md` describes the monorepo layout.
- Proposed section:

```markdown
## Repository structure

- `packages/excalidraw/` – the editor, published as `@excalidraw/excalidraw`
- `packages/{common,element,math,utils,fractional-indexing,laser-pointer}/` – internal packages
- `excalidraw-app/` – the excalidraw.com web app
- `examples/` – integration examples (`yarn start:example`)
- `dev-docs/` – source of docs.excalidraw.com
```

**3. Contribution basics in the README.**
- `CONTRIBUTING.md` is a one-line redirect.
- The real guide is in the repo at `dev-docs/docs/introduction/contributing.mdx`, but the README links only the external site.
- The README does not mention:
  - the PR title convention (`feat:`, `fix:`, … as in `feat(editor): rightclick to pan canvas`);
  - the roadmap (https://github.com/orgs/excalidraw/projects/3);
  - the "Easy" tasks for newcomers;
  - the "open an issue first for major changes" rule.
- Proposed replacement for lines 99–101:

```markdown
- Found a bug or missing a feature? [Open an issue](https://github.com/excalidraw/excalidraw/issues).
- New here? Pick an *Easy* task from the [roadmap](https://github.com/orgs/excalidraw/projects/3) and comment on the issue to get assigned. Open an issue first for major changes.
- PR titles follow semantic prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`…
- Full [contribution guide](https://docs.excalidraw.com/docs/introduction/contributing) (source: `dev-docs/docs/introduction/contributing.mdx`). Questions? Ask on [Discord](https://discord.gg/UexuTaE).
- Translations: see the [translation guide](https://docs.excalidraw.com/docs/introduction/contributing#translating).
```

**4. Self-hosting and Docker.** The `Dockerfile` and `docker-compose.yml` exist, but the README does not mention them. Add one line that links to the self-hosting docs.

**5. No `.github/ISSUE_TEMPLATE`, `CODE_OF_CONDUCT`, or `SECURITY.md`.** The README also gives no channel for reporting vulnerabilities. Add at least a security contact line.

**6. Coding conventions are visible only to AI tools.** `AGENTS.md` holds real rules: use `app.ownerDocument` and `app.ownerWindow`, and prefer `Merge<Base, Overrides>`. Human contributors are never pointed to it. Link it from "Contributing" or move the rules into the contribution guide.

## Wrong or stale

**7. Wrong port in the linked Development Guide.**
- `development.mdx` says `http://localhost:3000`.
- `.env.development` sets `VITE_APP_PORT=3001`.
- The README delegates to this guide, so a first-timer hits the mismatch immediately.
- The same file has two wrong command labels:
  - `yarn test:code` is labelled "Test for formatting with Prettier", but it runs ESLint.
  - `yarn fix` is labelled Prettier-only, but it also runs `eslint --fix`.

**8. Line 81 is stale.** "We'll be adding these features as drop-in plugins for the npm package in the future." This text has not changed since 2023-02-15 (`c587b85b`). Remove it, or replace it with: "These features are app-specific and not part of the npm package."

**9. Quick start is incomplete for integrators.**
- It gives only the install command.
- It omits the two steps that `packages/excalidraw/README.md` calls "the two most common integration failures": the CSS import and a parent element with non-zero height.
- It also omits the peer dependency range: React `^17.0.2 || ^18.2.0 || ^19.0.0`.
- Proposed addition after line 93:

````markdown
```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default () => (
  <div style={{ height: "100vh" }}>
    <Excalidraw />
  </div>
);
```

The parent element must have a non-zero height. Supports React 17, 18 and 19. See the [package README](./packages/excalidraw/README.md).
````

## Unclear or nits

**10. Line 54.** "The Excalidraw editor (npm package) supports:" is followed by "Free & open-source", which is not an editor capability. Move that bullet to the tagline or drop it.

**11. Line 66.** "circle" is wrong; the tool is named ellipse.

**12. Line 85.** "**Note:** following instructions" should read "**Note:** the following instructions". The section name "Quick start" is also ambiguous. Rename it to "Quick start (npm package)".

**13. "Integrations" section (lines 103–106).** It lists "npm package", which duplicates Quick start. The only other item is a third-party VS Code extension. Merge the section into "Who's integrating Excalidraw" or drop it.

**14. Spelling and markup.**
- "VScode" should be "VS Code".
- "Hand-drawn like" should be "Hand-drawn-like" (lines 46 and 58).
- "json" should be "JSON" (line 65).
- `</br>` on lines 17–18 is invalid HTML; use `<br />`.
- The `alt` attribute on `<source>` (line 3) is invalid; remove it.

**15. No "License" section.** The license appears only as a badge. Add `## License` with "MIT, see [LICENSE](./LICENSE)".

## Priority

Do items 1, 2, 3 and 7 first; they block a first contribution. Items 8 and 9 are next. The rest is polish.