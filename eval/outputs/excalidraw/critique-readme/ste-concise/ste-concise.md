# ste-concise / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `ste-concise`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":true,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"agents-output-styles:STE Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 10  wall: 178s  api: 112s
- cost: $1.1958  output tokens: 9592  words: 1018

---

The README serves a developer who installs the npm package. It gives a first-time contributor no setup steps, and the guides it links to have errors that stop the first run and the first PR. I changed no file. I checked the claims against the repository config and tested 12 links with `curl`. I did not run `yarn start`.

## Wrong

- **Dev port:** the README sends contributors to the [Development Guide](https://docs.excalidraw.com/docs/introduction/development), which says to open `http://localhost:3000`. `.env.development` sets `VITE_APP_PORT=3001`, and `excalidraw-app/vite.config.mts:17` reads that value. The live page and `dev-docs/docs/introduction/development.mdx` both say 3000.
- **Quick start (`README.md:87-93`):** it shows only the install command. `packages/excalidraw/README.md` names two "easy-to-miss requirements": the CSS import and a parent with a non-zero height. A reader who follows the root README gets an invisible canvas.
- **Tool list (`README.md:66`):** "circle" is wrong, because the tool is `ellipse` (`packages/excalidraw/types.ts:147`). The line is from 15 February 2023. It omits text, frame, sticky note, laser pointer, lasso and embeddable.
- **Google Cloud link (`README.md:110`):** `https://googlecloudcheatsheet.withgoogle.com/architecture` now redirects to `https://cloud.google.com/products`. The architecture tool page is gone.
- **PR title rule:** the [contribution guide](https://docs.excalidraw.com/docs/introduction/contributing) asks for a prefix only. `.github/workflows/semantic-pr-title.yml` sets `requireScope: true` with six scopes, so `fix: typo` fails CI.
- **Command labels in the Development Guide:**
  - The guide lists `yarn test:code` under "Test for formatting with Prettier". That command runs ESLint.
  - The Prettier check is `yarn test:other`.
  - `yarn fix` runs Prettier and the ESLint autofix.
- **Docker Compose in the Development Guide:** the guide offers Compose "to work on Excalidraw locally". The last stage of the `Dockerfile` is nginx with a static build. The mounted volumes have no effect, and there is no live reload.
- **Small items:**
  - `</br>` at `README.md:17-18` is invalid HTML.
  - `alt` on `<source>` at `README.md:3` is invalid HTML.
  - `twitter.com/excalidraw` redirects to `x.com`.

## Missing

- **Development section:** the only pointer for contributors is inside a "Note" in the npm Quick start (`README.md:85`). `CONTRIBUTING.md` is a one-line link.
- **Repository map:** the README does not say that the repository is a monorepo. The layout is only in `CLAUDE.md`, which omits `packages/fractional-indexing` and `packages/laser-pointer`.
- **Tool versions:**
  - `package.json` pins `yarn@1.22.22` and `node >=18`.
  - CI uses Node 20.x.
  - The `Dockerfile` uses Node 24.
  - The Development Guide says "Yarn v1 or v2.4.2+" and gives no Node version.
- **Checks before a PR:** `.husky/pre-commit` has `yarn lint-staged` commented out, so no check runs on commit. `yarn test` starts Vitest in watch mode, which a new contributor does not expect.
- **Examples:** the README does not mention `examples/with-nextjs`, `examples/with-script-in-browser` or `yarn start:example`.
- **Docs source:** `dev-docs/` is the source of docs.excalidraw.com. The README does not say this, so a docs fix has no entry point.
- **Local collaboration:** `.env.development` expects [excalidraw-room](https://github.com/excalidraw/excalidraw-room) at `http://localhost:3002`. The README does not mention it.

## Unclear

- **"Excalidraw" has three meanings:** the npm package, the app and the repository. No sentence connects each one to its directory.
- **"Quick start":** the title does not name its reader. A contributor reads it as the setup for the repository.
- **Plugin plan (`README.md:81`):** "We'll be adding these features as drop-in plugins... in the future" is from 15 February 2023. It links no issue. I did not find out whether the plan is still active.
- **"Integrations" (`README.md:105-106`):** the list includes the npm package as an integration. "VScode" is "VS Code".

## Proposed edits

1. Rename `## Quick start` to `## Quick start (use the npm package)`. Replace the note with "To work on this repository, see [Development](#development)." After the install block, add the minimum setup from the package README:

````markdown
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

Import the CSS, and give the parent a non-zero height. Without the height, the canvas is not visible. In Next.js, render the component on the client only. See [examples/with-nextjs](./examples/with-nextjs).
````

2. Add a new section after Quick start:

````markdown
## Development

This repository is a Yarn workspaces monorepo:

- `packages/excalidraw/`: the editor, published as `@excalidraw/excalidraw`.
- `packages/{common,element,math,utils,fractional-indexing,laser-pointer}/`: support packages.
- `excalidraw-app/`: the app at excalidraw.com.
- `examples/`: sample apps (Next.js, browser script). Run `yarn start:example`.
- `dev-docs/`: the source of docs.excalidraw.com.

Requirements: Node.js 20 (the CI version, minimum 18) and Yarn 1.22.

```bash
git clone https://github.com/excalidraw/excalidraw.git
cd excalidraw
yarn
yarn start           # app at http://localhost:3001
```

Run these commands before you open a pull request. No pre-commit hook runs them.

```bash
yarn fix             # Prettier and ESLint autofix
yarn test:typecheck  # tsc
yarn test:update     # all tests, no watch mode, updates snapshots
```

The PR title must match `type(scope): summary`, for example `fix(editor): keep arrow label on resize`. The allowed scopes are `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker` and `repo`.

Collaboration needs a local [excalidraw-room](https://github.com/excalidraw/excalidraw-room) server on port 3002.
````

3. Add an intro line before `## Features`: "This repository holds the editor (`packages/excalidraw`, the npm package) and the excalidraw.com app (`excalidraw-app`) that uses the editor."
4. Change `README.md:66` to: `Wide range of tools - rectangle, ellipse, diamond, arrow, line, free-draw, text, frame, sticky note, laser pointer, eraser...`
5. At `README.md:110`, remove the link from "Google Cloud", or ask a maintainer for the current URL. I have no verified replacement.
6. At `README.md:81`, delete the sentence or link a roadmap issue. A maintainer must decide which.
7. Rename `## Integrations` to `## Editor integrations`. Write "VS Code extension". Remove the npm package item, because the Quick start already links it.
8. In `dev-docs/docs/introduction/development.mdx`:
   - Change the port to 3001.
   - Correct the labels for `yarn test:code`, `yarn test:other` and `yarn fix`.
   - State Node 20 and Yarn 1.22.
   - Describe Docker Compose as a production build on port 3000.
9. In `dev-docs/docs/introduction/contributing.mdx`, add the rule that a scope is required, and list the scopes.
10. Replace `</br>` with `<br />`. Remove `alt` from `<source>`. Point the Twitter badge to `https://x.com/excalidraw`.

All 12 links returned HTTP 200, except CodeSandbox, which returned 403. That result can come from a block on bots, so it does not prove that the link is broken.