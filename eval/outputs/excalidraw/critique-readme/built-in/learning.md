# learning / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `learning`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Learning"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 12  wall: 196s  api: 128s
- cost: $1.2671  output tokens: 10790  words: 1320

---

I read the README as a newcomer and checked its claims against the repo. No files were modified.

The main problem is that the README is written for people embedding the npm package. It never mentions `yarn`, Node, tests, or the repo layout, and all contributor guidance sits behind a link to the docs site. The source for those docs is in `dev-docs/`, and they are out of date in ways that will trip up a newcomer.

All 40 README links resolve. npm returns 403, which is just bot-blocking, and a 200 from Discord doesn't prove the invite is still valid. The install command and React peer dependencies match `packages/excalidraw/package.json`.

## Wrong

| # | Issue | Evidence |
|---|---|---|
| 1 | **The dev server port is wrong.** README sends you to the Development Guide, which says to open `localhost:3000`. The dev server actually starts on 3001. | `.env.development` sets `VITE_APP_PORT=3001`; `excalidraw-app/vite.config.mts:17` only falls back to 3000 |
| 2 | **The PR title rule is incomplete.** The contributing guide says titles need a semantic prefix. CI also requires a scope, so `fix: typo` fails. | `semantic-pr-title.yml` has `requireScope: true`; allowed scopes are `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker`, `repo` |
| 3 | **Commands are mislabeled in the dev guide.** "Test for formatting with Prettier: `yarn test:code`" is wrong. | `package.json`: `test:code` is ESLint; `test:other` is Prettier; `yarn fix` runs both |
| 4 | **The docker-compose dev setup doesn't work as described.** The guide says you can "work on Excalidraw locally" with it. | The final Docker stage is nginx serving a static build. The source volume mounts to a path nginx never reads, so every change needs a full rebuild |
| 5 | **A stale promise.** "We'll be adding these features as drop-in plugins… in the future." | Line unchanged since `c587b85b` (2023-02-15) |
| 6 | **The tool list is inaccurate.** It says "circle". | The tool is `ellipse`. The list also omits text, frame, laser, lasso, embeds and sticky notes (`TOOL_TYPE` in `packages/common/src/constants.ts`) |
| 7 | **Invalid HTML.** `</br>` appears twice, and there is an `alt` attribute on `<source>`. | README lines 3, 17–18 |

## Missing

- **No local-dev section.** A contributor sees only `npm install react react-dom …`, which is the wrong path for them.
- **No project structure.** The monorepo layout is documented only in `CLAUDE.md`, not anywhere a human contributor would look.
- **No Node or Yarn versions.**
  - `engines` says `>=18`, CI runs 20.x, the Dockerfile uses 24, and there is no `.nvmrc`.
  - Yarn is pinned to `1.22.22`, but the docs say "v1 or v2.4.2+".
- **No pre-PR checklist.** `.husky/pre-commit` is commented out (`# yarn lint-staged`), so nothing runs locally and CI is the first feedback. "Run `yarn test:update` before committing" appears only in `CLAUDE.md`.
- **Undocumented test commands.** `yarn test` runs in watch mode, and `yarn test:all` mirrors CI. Neither is documented.
- **Collaboration won't work locally without a second repo.** The dev environment points at `localhost:3002`, which needs `excalidraw-room` running.
- **The quick start omits two requirements.** The package's own README calls them "easy-to-miss": the CSS import and a container with non-zero height.
- **No pointer to where the docs live.** The source is `dev-docs/`, which is not a Yarn workspace and has its own `yarn.lock`.
- **No License section, `SECURITY.md`, `CODE_OF_CONDUCT.md`, or issue/PR templates.** The missing security policy stands out for a product sold on end-to-end encryption.
- **No mention of Docker or self-hosting**, even though `Dockerfile` and `docker-compose.yml` are at the repo root.

## Unclear

- **"Features" opens with "The Excalidraw editor (npm package) supports".** A newcomer doesn't yet know that the editor and the app are separate things.
- **The app is called a "minimal showcase".** It is the full excalidraw.com product, and `CLAUDE.md` calls it "full-featured".
- **"Integrations" lists the npm package as an integration of itself.** The VS Code extension is a third-party one (`pomdtr`) and isn't labeled as such.
- **The "Contributing" bullet gives no starting point.** The roadmap and its *Easy* labels are mentioned only in the docs.
- **Small wording fixes:**
  - "following instructions are" should be "The following instructions are".
  - "VScode" should be "VS Code".
  - "hand-drawn like" should be "hand-drawn-like".
  - Decide whether "Twitter" should now read X.

## Proposed edits

**A. Add after "Quick start"** (covers the port, versions, layout and checklist gaps):

````md
## Developing locally

Yarn v1 workspaces monorepo. Use Node.js 20 (what CI runs; `>=18` minimum) and Yarn 1.22.

```bash
git clone https://github.com/excalidraw/excalidraw.git && cd excalidraw
yarn          # installs all workspaces
yarn start    # dev server at http://localhost:3001
```

| Path | What it is |
| --- | --- |
| `packages/excalidraw/` | Editor React component, published as `@excalidraw/excalidraw` |
| `packages/*` (common, element, math, utils, …) | Internal libraries the editor is built from |
| `excalidraw-app/` | The excalidraw.com app (collab, E2EE, PWA) |
| `examples/` | Next.js and browser-script integrations |
| `dev-docs/` | Source of docs.excalidraw.com (separate `yarn` install) |

Before opening a PR (there is no pre-commit hook, so CI will catch what you skip):

```bash
yarn fix              # Prettier + ESLint autofix
yarn test:typecheck   # tsc
yarn test:update      # run tests once, update snapshots
```

Live collaboration locally also requires [excalidraw-room](https://github.com/excalidraw/excalidraw-room) on port 3002.
````

**B. Add to the "Contributing" bullets** (covers the PR title rule and the starting point):

```md
- PR titles must be `type(scope): description`, e.g. `fix(editor): …`. Scope is required: `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker`, or `repo`.
- New here? Pick an *Easy* item from the [roadmap](https://github.com/orgs/excalidraw/projects/3) and comment to get it assigned.
- Docs fixes go in [`dev-docs/`](./dev-docs).
```

I didn't check whether that roadmap link is still maintained, so confirm it before adding.

**C. Quick start:** after the install block, add the 10-line snippet from `packages/excalidraw/README.md` that shows the CSS import and `height: 100vh`.

**D. Line edits:**
- Line 54: "The editor, published as the `@excalidraw/excalidraw` npm package, supports:".
- Line 66: change "circle" to "ellipse" and add "text, frames, laser pointer".
- Line 73: change "a minimal showcase of what you can build" to "the full app built on the editor".
- Line 81: delete it, or replace it with a link to a tracking issue.
- Lines 17–18: change `</br>` to `<br />`.
- Line 3: remove `alt` from `<source>`.
- Line 106: remove the npm bullet, or rename the section "Ecosystem".

**E. Fix the docs the README links to, in the same PR:**
- `dev-docs/docs/introduction/development.mdx`:
  - Correct the port to 3001.
  - Relabel `test:code` and `test:other`.
  - State the Node and Yarn versions.
  - Reword docker-compose as "build and serve locally" rather than a dev environment.
- `dev-docs/docs/introduction/contributing.mdx`: add the required-scope list.

**F. Needs maintainer input.** A `SECURITY.md` with a disclosure contact, and a `## License` line. I can't write the security contact for them.

`★ Insight ─────────────────────────────────────`
- **The contributor guidance lives in the wrong files.** The run-before-commit rule and the package map are in `CLAUDE.md`, and the coding conventions are in `AGENTS.md` and `copilot-instructions.md`. AI agents get better onboarding than human contributors do.
- **The docs describe CI, but CI config is what actually applies.** `requireScope` was added to the workflow without a docs update, which is why the contributing guide drifted. When auditing contributor docs, compare them against `.github/workflows/` first.
- **Port 3001 is set in `.env.development`, not in code.** The Vite config still falls back to 3000, so the docs match the code but not the runtime.
`─────────────────────────────────────────────────`

**Decision for you:** how much setup should live in the README versus the docs site? I recommend edit A as written. It is about 25 lines of setup that a contributor can copy and paste, and the docs site keeps the depth. If you'd rather keep the README as a pure landing page, the minimal alternative is edits B, D and E plus a prominent "Contributing? Start here" link at the top.