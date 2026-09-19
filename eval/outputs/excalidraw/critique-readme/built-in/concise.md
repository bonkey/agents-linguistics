# concise / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `concise`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Concise"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 101s  api: 50s
- cost: $0.607  output tokens: 3678  words: 764

---

The README is a product landing page. It gives a first-time contributor nothing to get started with locally: no clone, install, run, test, or repo layout. All of that sits behind external links to `docs.excalidraw.com`, and some of it is wrong. I changed no files.

## Wrong

1. **Dev server port is 3001, not 3000 (linked Development Guide).** `.env.development:30` sets `VITE_APP_PORT=3001`, and `excalidraw-app/vite.config.mts:17` only falls back to 3000 when that variable is unset. The guide tells you to open `localhost:3000`. Port 3000 is what `docker-compose.yml` exposes.
   - Edit: change it to `http://localhost:3001` in `dev-docs/docs/introduction/development.mdx`.
2. **`yarn test:code` and `yarn fix` are mislabeled (same guide).**
   - `yarn test:code` is described as "Test for formatting with Prettier", but it runs ESLint. Prettier is `yarn test:other`.
   - `yarn fix` is described as "Reformat all files with Prettier", but it runs both Prettier and ESLint `--fix`.
3. **README L81: "We'll be adding these features as drop-in plugins for the npm package in the future."** This is a long-standing promise with no link or tracking issue.
   - Edit: delete it, or link the roadmap item.
4. **README L54: "The Excalidraw editor (npm package) supports: 💯 Free & open-source."** The first bullet is not a feature the editor "supports".
   - Edit: move it to the tagline, and fix "Hand-drawn like" to "Hand-drawn-like".

## Missing

5. **No local development section.** The "Quick start" is for npm consumers only. Proposed new section after "Quick start":

   ````md
   ## Developing locally

   Requires Node.js >= 18 (CI uses 20) and Yarn 1.x (`packageManager: yarn@1.22.22`).

   ```bash
   git clone https://github.com/excalidraw/excalidraw.git
   cd excalidraw
   yarn            # install all workspaces
   yarn start      # app at http://localhost:3001
   ```

   Before opening a PR:

   ```bash
   yarn test:typecheck   # tsc
   yarn test:update      # vitest, updates snapshots
   yarn fix              # prettier + eslint --fix
   ```

   See the [Development Guide](https://docs.excalidraw.com/docs/introduction/development) for Docker, collaboration server, and self-hosting.
   ````

6. **No repo layout.** The README never says this is a monorepo. Proposed short section:

   ```md
   ## Repository structure

   - `packages/excalidraw/` – the `@excalidraw/excalidraw` React component (npm)
   - `packages/{common,element,math,utils,…}` – internal/supporting packages
   - `excalidraw-app/` – the excalidraw.com web app
   - `examples/` – integration examples (Next.js, browser script)
   - `dev-docs/` – source of docs.excalidraw.com
   ```

7. **No Node or Yarn versions anywhere a contributor would look.**
   - There is no `.nvmrc`.
   - `engines` says `>=18`, CI uses 20, and the Dockerfile uses 24.
   - The guide says "Yarn v1 or v2.4.2+", but `packageManager` pins `yarn@1.22.22`.
   - Edit: state the versions in the README (see item 5) and consider adding an `.nvmrc` containing `20`.
8. **Quick start omits the two requirements that break first-time setups.** `packages/excalidraw/README.md` calls them "easy-to-miss": the CSS import and a parent with non-zero height. Edit: add after the install block:

   ```tsx
   import { Excalidraw } from "@excalidraw/excalidraw";
   import "@excalidraw/excalidraw/index.css";

   <div style={{ height: "100vh" }}><Excalidraw /></div>
   ```

   Also mention `examples/` and the `@next` tag.
9. **Contributing section lacks the rules contributors trip on.** Edit: add bullets for:
   - PR titles need a semantic prefix (`feat:`, `fix:`, …).
   - Open an issue first for major changes.
   - CI checks on first-time PRs wait for maintainer approval.
   - Each PR gets a staging deploy to test manually.
   - Link the [roadmap](https://github.com/orgs/excalidraw/projects/3) for "Easy" tasks.
10. **No pointer to in-repo docs.** `CONTRIBUTING.md` is a single line linking out. The docs source is in `dev-docs/docs/introduction/*.mdx`, so it is readable offline and fixable by PR.
    - Edit: mention `dev-docs/` in the README.
    - Optionally expand `CONTRIBUTING.md` with the setup steps.
11. **No security/disclosure or Code of Conduct pointer.** Both are common expectations for a project of this size.

## Unclear

12. **The "Quick start" heading is ambiguous.** The disambiguating note is bolded prose under the heading.
    - Edit: rename it to "Quick start (using the npm package)" and keep "Developing locally" as its sibling.
13. **The "Integrations" list has two items, and one is the npm package itself, already linked three times.**
    - Edit: drop the npm entry.
    - Alternatively, merge the list into "Who's integrating Excalidraw".
14. **The "PRs welcome" badge and the Contributing links all go to the external docs site.** If that site is down or drifts (see items 1 and 2), contributors have no fallback.
    - Edit: link the badge to `CONTRIBUTING.md`.
15. **Stale branding and markup:**
    - The alt text says "Follow Excalidraw on Twitter".
    - `</br>` on L17–18 is invalid HTML; it should be `<br />`.
    - "VScode" should be "VS Code".

Priority order if you only make a few changes: item 5 (dev section), items 1 and 2 (wrong port and command descriptions), item 6 (repo layout), item 8 (CSS and height in the quick start).