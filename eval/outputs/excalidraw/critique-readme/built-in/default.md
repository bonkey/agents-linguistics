# default / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `default`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 11  wall: 176s  api: 113s
- cost: $1.1973  output tokens: 10003  words: 935

---

I read the README as a first-time contributor and checked its claims against the repo and its links. No files were modified. The main problem is that the README has no contributor path of its own. It sends you to the docs site, and the pages it points to contain errors.

## Wrong

1. **The Google Cloud link is dead** (`README.md:110`). `googlecloudcheatsheet.withgoogle.com/architecture` now redirects to the generic `cloud.google.com/products` page. Every other README link I requested returned 200.
2. **The tool list is stale** (`README.md:66`). It says "circle", but the tool is `ellipse`. It omits text, frames, sticky notes, web embeds, laser pointer and lasso selection, all of which are in `ToolType` (`packages/excalidraw/types.ts:147`).
3. **Invalid HTML** (`README.md:17-18`, `:3`). `</br>` should be `<br />`, and `alt` is not a valid attribute on `<source>`.
4. **Naming nits.** `README.md:105` should say "VS Code", not "VScode". At `README.md:35-36` the Twitter link now redirects to x.com.
5. **The linked guides are wrong in several places.** `README.md:85` and `:100` send contributors to pages built from `dev-docs/docs/introduction/*.mdx`:
   - **Port:** the dev guide says `yarn start` serves `localhost:3000`. It is actually 3001 (`.env.development` sets `VITE_APP_PORT=3001`, read at `excalidraw-app/vite.config.mts:17`).
   - **Lint commands:**
     - "Test for formatting with Prettier: `yarn test:code`" is wrong. That command runs ESLint; Prettier is `yarn test:other`.
     - "Reformat with Prettier: `yarn fix`" is incomplete. It also runs `eslint --fix`.
   - **Yarn version:** the guide says "v1 or v2.4.2+", but `package.json` pins `yarn@1.22.22`.
   - **Node version:** none is given. `engines` says >=18, CI uses 20.x and the Dockerfile uses 24.
   - **PR titles:** the contributing guide lists the type prefixes only. CI sets `requireScope: true` with a fixed scope list (`.github/workflows/semantic-pr-title.yml`), so a title like `fix: foo` fails the check.
   - **Docker Compose:** the guide presents it as a way to work locally without Node. The Dockerfile builds a static bundle into nginx, and the compose volume mounts don't affect that image, so there is no live reload.
   - **404 in the package README:** the "Contributing" link in `packages/excalidraw/README.md` (`…/docs/@excalidraw/excalidraw/contributing`) does not exist.

## Missing

1. **Local dev instructions.** The only pointer is a bold "Note" inside a Quick start written for npm consumers (`README.md:85`). The README has no clone, install, start or test steps.
2. **Prerequisites.** Node and Yarn versions are not stated.
3. **A repo map.** Nothing tells you that `packages/excalidraw` is the editor, `excalidraw-app` is excalidraw.com, or what `packages/{common,element,math,utils}`, `examples/` and `dev-docs/` hold.
4. **A pre-PR checklist.** `.husky/pre-commit` is commented out, so nothing runs locally. CI runs `test:other`, `test:code`, `test:typecheck` and tests with coverage.
5. **A usage snippet.** Quick start stops at `npm install`. `packages/excalidraw/README.md` names two easy-to-miss requirements: the CSS import and a parent container with non-zero height.
6. **Smaller gaps.**
   - No pointer to the roadmap's "Easy" tasks.
   - No mention of `yarn start:example`.
   - No mention that collaboration needs `excalidraw-room` locally.
   - No mention that the docs source lives in `dev-docs/`.
   - No `SECURITY.md` or `CODE_OF_CONDUCT.md`.

## Unclear

1. **"Quick start"** does not say who it is for: integrators or contributors.
2. **"We'll be adding these features as drop-in plugins… in the future"** (`README.md:81`) has no tracking issue or status. It reads like a stale promise.
3. **"Integrations" and "Who's integrating Excalidraw" overlap**, and listing the npm package as an "integration" is circular.
4. **The library/app split** is only implied by the phrase "(npm package)" at `README.md:54`. That split decides where a contributor's code goes.

## Proposed edits

**Replace `README.md:83-101` (Quick start and Contributing) with:**

````md
## Using Excalidraw in your app

```bash
npm install react react-dom @excalidraw/excalidraw
```

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css"; // required

export default function App() {
  return (
    <div style={{ height: "100vh" }}> {/* parent needs a non-zero height */}
      <Excalidraw />
    </div>
  );
}
```

See the [docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation) and [`examples/`](./examples) (Next.js, browser script).

## Developing locally

Requires Node.js 18+ (CI runs 20.x) and Yarn 1.x (`yarn@1.22.22`).

```bash
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
yarn
yarn start   # opens http://localhost:3001
```

| Path | Contents |
| --- | --- |
| `packages/excalidraw/` | The editor, published as `@excalidraw/excalidraw` |
| `packages/{common,element,math,utils}/` | Shared internal packages |
| `excalidraw-app/` | The excalidraw.com app (collaboration, E2EE, PWA) |
| `examples/` | Integration examples (`yarn start:example`) |
| `dev-docs/` | Source of docs.excalidraw.com |

Before opening a PR:

```bash
yarn test:typecheck   # TypeScript
yarn test:update      # tests, updating snapshots
yarn fix              # Prettier + ESLint autofix
```

PR titles must follow `type(scope): description`, e.g. `fix(editor): …`.
Scopes: `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker`, `repo`.

## Contributing

- Found a bug or missing something? [Open an issue](https://github.com/excalidraw/excalidraw/issues).
- New here? Pick an *Easy* task from the [roadmap](https://github.com/orgs/excalidraw/projects/3), then read the [contribution guide](https://docs.excalidraw.com/docs/introduction/contributing).
- Questions: [Discord](https://discord.gg/UexuTaE). Translations: [translation guide](https://docs.excalidraw.com/docs/introduction/contributing#translating).
````

**One-line fixes:**
- `README.md:17-18`: change `</br>` to `<br />`. At `:3`, drop `alt` from `<source>`.
- `README.md:66`: "Wide range of tools - rectangle, ellipse, diamond, arrow, line, free-draw, text, frames, sticky notes, embeds, eraser, laser pointer…".
- `README.md:81`: link a tracking issue or delete the sentence.
- `README.md:103-110`: merge the two sections into one "Integrations" section, drop the npm-package self-link, write "VS Code", and replace or remove the Google Cloud link.
- `README.md:36`: change the alt text to "Follow Excalidraw on X" and link `https://x.com/excalidraw`.

**Fixes outside the README, but on the path it sends contributors down:**
- In `dev-docs/docs/introduction/development.mdx`:
  - Change port 3000 to 3001.
  - Fix the `test:code`/`test:other` labels.
  - State "Yarn 1.x" and a Node version.
  - Describe Docker Compose as a production-build preview, not a dev environment.
- In `dev-docs/docs/introduction/contributing.mdx`, document the required PR title scope.
- In `packages/excalidraw/README.md`, fix the 404 Contributing link so it points to `/docs/introduction/contributing`.