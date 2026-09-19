# caveman-full / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `caveman-full`  prompt: `critique-readme`  caveman mode: `full`
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":true,"i-have-adhd@i-have-adhd":false}}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 7  wall: 113s  api: 52s
- cost: $0.7756  output tokens: 4322  words: 928

---

No files changed. I read `README.md` and checked its claims against the repo; I did not test the external links.

## Wrong or outdated

1. **README.md:85: the dev setup link leads to a doc with the wrong port.** The linked doc `dev-docs/docs/introduction/development.mdx` says `http://localhost:3000`. `.env.development:30` sets `VITE_APP_PORT=3001`, and `excalidraw-app/vite.config.mts:17` reads that value. Following the docs, a new contributor opens a dead port.
   - Fix the doc to say 3001, and state the port in the README.

2. **README.md:83-95: "Quick start" is incomplete.** It gives only the install command. `packages/excalidraw/README.md` names two "easy-to-miss requirements": the CSS import and a parent container with non-zero height. Without them the canvas does not show.
   - Add this after the install block:
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
   - Add a one-line SSR note: render on the client only, see `examples/with-nextjs`.

3. **README.md:81: "We'll be adding these features as drop-in plugins for the npm package in the future."** No timeline or tracking issue backs this up.
   - Link a tracking issue, or replace with: "These features are app-only and are not part of the npm package."

4. **README.md:54: "The Excalidraw editor (npm package) supports: 💯 Free & open-source."** That is a project property, not a feature the package "supports". Small wording problem.
   - Move that bullet out of the list, or change the lead to "Excalidraw editor features:".

5. **README.md:17-18: `</br>` is invalid HTML.** Use `<br />`.

6. **README.md:35-36: the Twitter badge.** The shields.io follow-count badge may be stale; I did not check. Relabel to X or drop it.

## Missing for a first-time contributor

7. **No local development section.** The README sends the reader to an external site. `CONTRIBUTING.md` is 3 lines and also only links out. Nothing in the repo root says how to run the project. Proposed new section, placed before "Contributing":

   ````markdown
   ## Development

   Requirements: Node.js >= 18 (CI uses 20.x), Yarn 1.22.x, Git.

   ```bash
   git clone https://github.com/excalidraw/excalidraw.git
   cd excalidraw
   yarn
   yarn start        # app at http://localhost:3001
   ```

   Before opening a PR:

   ```bash
   yarn test:typecheck   # TypeScript
   yarn test:update      # tests + snapshot updates
   yarn fix              # prettier + eslint autofix
   ```

   See the [Development Guide](https://docs.excalidraw.com/docs/introduction/development) for Docker and collaboration-server setup.
   ````

   - Sources: `package.json` has `engines.node >=18.0.0` and `packageManager: yarn@1.22.22`. The workflows use `node-version: 20.x`.

8. **No repo map.** The README never says this is a monorepo. Proposed text:

   ```markdown
   ## Repository structure

   - `packages/excalidraw/`: React component, published as `@excalidraw/excalidraw`
   - `packages/{common,element,math,utils}/`: supporting packages
   - `excalidraw-app/`: excalidraw.com app (collaboration, persistence, PWA)
   - `examples/`: Next.js and browser-script integrations
   - `dev-docs/`: source for docs.excalidraw.com
   ```

9. **No mention that docs live in the repo.** A contributor fixing docs does not know `dev-docs/` exists.
   - Add one line: "Docs source: [`dev-docs/`](./dev-docs)."

10. **No PR conventions.** The contributing doc requires semantic PR title prefixes (`feat:`, `fix:`, and so on). CI checks need maintainer approval before they run. Neither fact is in the README.
    - Add to "Contributing": "PR titles need a semantic prefix (`feat:`, `fix:`, `docs:`, ...). CI runs after maintainer approval."

11. **Pre-commit hook is disabled.** `.husky/pre-commit` has `yarn lint-staged` commented out, so nothing auto-formats on commit.
    - Item 7 covers this by telling the contributor to run `yarn fix` manually.

12. **No "where to start" pointer.** The contributing doc links the roadmap and *Easy* tasks. The README does not.
    - Add a bullet: "New here? Check the [roadmap](https://github.com/orgs/excalidraw/projects/3) and start with *Easy* issues."

13. **Examples never mentioned.** `examples/with-nextjs` and `examples/with-script-in-browser` exist, and `yarn start:example` runs the script example.
    - Link both under Quick start.

14. **Self-hosting and Docker absent.** `Dockerfile`, `docker-compose.yml` and a Docker Hub image exist, and "how to self-host" is a common question.
    - Add a one-line link to the self-hosting doc section. State the limit: no sharing or collaboration when self-hosted.

15. **No security or code-of-conduct pointer.** The repo has no `SECURITY.md` and no `CODE_OF_CONDUCT.md`. The README claims end-to-end encryption, so it needs a vulnerability report channel.
    - Add one, or state an email address.

## Unclear

16. **README.md:85: the "Quick start" note is buried.** It opens by saying the instructions are not for repo development. The contributor path sits inside a sentence about npm users.
    - Split into two headed sections: "Use the npm package" and "Develop locally" (item 7).

17. **README.md:103-106: "Integrations" lists the npm package again.** It is already covered three times above. The VS Code extension is third-party (`pomdtr`) and is not labeled as such.
    - Drop the npm bullet. Label the other as "VS Code extension (community)".

18. **React version support unstated.** `packages/excalidraw/package.json:77` has peer dependencies `^17.0.2 || ^18.2.0 || ^19.0.0`.
    - Add to Quick start: "Supports React 17, 18, 19."

19. **`@next` tag unmentioned.** The package README notes `@excalidraw/excalidraw@next` for unreleased changes. It helps contributors verify merged fixes.
    - Add one line to Quick start.

## Adjacent problems outside the README

- `dev-docs/docs/introduction/development.mdx`:
  - Port 3000 is wrong (item 1).
  - "Yarn (v1 or v2.4.2+)" conflicts with the `packageManager: yarn@1.22.22` pin.
  - "Reformat all files with Prettier" labels `yarn fix`, but `yarn fix` also runs eslint `--fix`.
  - "Test for formatting with Prettier" labels `yarn test:code`, but that command is eslint. Prettier is `yarn test:other`.
  - `docker-compose` should be `docker compose`.
- `CONTRIBUTING.md` is a 3-line stub.
  - Inline the essentials, or accept the external-docs dependency.
  - Risk of external-only: docs drift from the repo state, as the port shows.

## Priority

Do items 7, 1, 2 and 8 first. They give the largest first-hour gain for a new contributor.