# caveman-ultra / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-ultra`  prompt: `critique-readme`  caveman mode: `ultra`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 8  wall: 147s  api: 80s
- cost: $1.0146  output tokens: 7070  words: 677

---

README review complete. No files modified. `yarn start` not run; claims below come from config files and `curl` checks.

## Wrong

1. `README.md:110`: Google Cloud link is dead. `https://googlecloudcheatsheet.withgoogle.com/architecture` redirects to `https://cloud.google.com/products`. Drop link or keep plain text "Google Cloud".
2. `README.md:81`: "We'll be adding these features as drop-in plugins... in the future." Unchanged since 2023-02-15 (`c587b85b`). Stale promise. Delete, or link a tracking issue.
3. `README.md:66`: "circle". Tool name is `ellipse` (`packages/common/src/constants.ts:537`). List omits text, image, frame, embeddable, laser.
4. `README.md:52-69`: feature list outdated. Missing frames, Mermaid import (`@excalidraw/mermaid-to-excalidraw` dependency), embeds, laser pointer, sticky notes (`afa3a653`).
5. `README.md:85`: linked Development Guide says `http://localhost:3000`. `.env.development` sets `VITE_APP_PORT=3001`, and `excalidraw-app/vite.config.mts:17` reads it. Real port 3001.
6. Same guide (`dev-docs/docs/introduction/development.mdx`): `yarn test:code` labeled "formatting with Prettier". It runs eslint; Prettier check is `yarn test:other`. Guide says "Yarn v1 or v2.4.2+"; `package.json` pins `yarn@1.22.22`.
7. `README.md:105`: "VScode". Correct: "VS Code".
8. `README.md:17-18`: `</br>` invalid HTML. `README.md:3`: `alt` on `<source>` invalid.
9. `README.md:35`: twitter.com redirects to x.com. Minor.

## Missing (first-time contributor view)

1. No local setup in README. Only an external link (`README.md:85`), buried in a note about npm install.
2. No prerequisites. `engines.node >=18.0.0`, CI uses Node 20.x, Dockerfile uses `node:24`. No `.nvmrc`. Yarn 1.22.22 required.
3. No repository map. Contributor cannot tell `excalidraw-app/` from `packages/excalidraw/`. `packages/` also holds `common`, `element`, `math`, `utils`, `fractional-indexing`, `laser-pointer`. `dev-docs/` holds docs source.
4. No test and lint commands: `yarn test`, `yarn test:update`, `yarn test:typecheck`, `yarn test:code`, `yarn fix`, `yarn test:all`.
5. Pre-commit hook disabled: `.husky/pre-commit` has `# yarn lint-staged` commented out. Nothing auto-formats. Contributor must run `yarn fix` manually. README silent.
6. PR title rule absent. `.github/workflows/semantic-pr-title.yml` enforces semantic prefix (`feat:`, `fix:`, ...).
7. Collaboration setup absent. Dev app expects `excalidraw-room` at `http://localhost:3002` (`.env.development`).
8. Quick start has install only, no usage. CSS import and non-zero container height are required (`packages/excalidraw/README.md` documents both). Blank canvas otherwise.
9. No roadmap or starter-issue pointer. Roadmap link exists only in external docs.
10. `CONTRIBUTING.md` is one redirect line. Offline contributor gets nothing.

## Unclear

1. "Quick start" targets integrators, not contributors. Title does not say so.
2. `README.md:73`: "minimal showcase". App has collaboration, encryption, PWA, Firebase. Not minimal.
3. "Integrations" and "Who's integrating Excalidraw" overlap. "Integrations" lists npm package as an integration of itself.

## Proposed edits

Rename `## Quick start` to `## Quick start (npm package)`. Replace note and body:

````markdown
Install the package with its React peer dependencies:

```bash
npm install react react-dom @excalidraw/excalidraw
```

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw />
    </div>
  );
}
```

The parent container must have a non-zero height. See the [package README](./packages/excalidraw/README.md) and the [documentation](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation) for details.
````

Add new section before `## Contributing`:

````markdown
## Development

Requirements: Node.js 20 (18 or newer works), Yarn 1.22.x, Git.

```bash
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
yarn
yarn start   # opens http://localhost:3001
```

Repository layout:

- `excalidraw-app/` - the excalidraw.com web app
- `packages/excalidraw/` - the `@excalidraw/excalidraw` React component
- `packages/{common,element,math,utils}/` - shared internal packages
- `examples/` - integration examples (Next.js, browser script)
- `dev-docs/` - source of docs.excalidraw.com

Before opening a pull request:

```bash
yarn fix             # format and lint (no pre-commit hook does this for you)
yarn test:typecheck  # TypeScript
yarn test:update     # tests, updates snapshots
```

Pull request titles must start with a semantic prefix such as `feat:` or `fix:`.
Real-time collaboration needs a local [excalidraw-room](https://github.com/excalidraw/excalidraw-room) server on port 3002.
````

Smaller edits:

- `README.md:66`: `rectangle, ellipse, diamond, arrow, line, free-draw, text, image, frame, eraser...`
- `README.md:52-69`: add bullets for frames, Mermaid import, embeds, laser pointer.
- `README.md:81`: delete sentence.
- `README.md:73`: "minimal showcase" becomes "full-featured example".
- `README.md:100`: append roadmap link `https://github.com/orgs/excalidraw/projects/3`.
- `README.md:103-106`: merge "Integrations" into "Who's integrating Excalidraw", drop npm package bullet, fix "VS Code".
- `README.md:110`: unlink Google Cloud.
- `README.md:17-18`: `</br>` becomes `<br />`. `README.md:3`: remove `alt` from `<source>`.
- `dev-docs/docs/introduction/development.mdx`: port 3000 becomes 3001, fix `yarn test:code` label, state Yarn 1.22.x.

Unverified: CodeSandbox link returned 403 to `curl`. Likely bot block, not a dead link.