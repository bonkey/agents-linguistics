# explanatory / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `explanatory`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Explanatory"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 17  wall: 187s  api: 126s
- cost: $1.1893  output tokens: 10889  words: 1205

---

I read the README as a first-time contributor and checked its claims against the repo. No files were modified. The README is a good landing page for someone installing the npm package, but it gives a contributor almost nothing: every contributor step is a link to the docs site, and that page has errors of its own.

`★ Insight ─────────────────────────────────────`
- The library vs. app split (`packages/excalidraw` vs. `excalidraw-app`) is the most useful thing for a contributor to know. CI enforces it through required PR-title scopes (`editor`, `app`, …), but the README only shows it as two feature lists.
- Commands, ports and versions that live only on the docs site can't be checked against `package.json` in the same PR, so they go stale. That is how `localhost:3000` survived after `.env.development` moved the port to 3001.
`─────────────────────────────────────────────────`

## Missing

1. **There is no local development path.**
   - "Quick start" (`README.md:83`) is for npm users. The only contributor pointer is a bold note inside that section.
   - `CONTRIBUTING.md` is a single line linking off-site.
   - Clone, install, run, test and lint are not in the repo's own docs at all.
2. **There is no repository layout.** Nothing says where a change should go, and that decides the PR scope (see 3).
3. **PR title rules are missing, and CI enforces them.**
   - `.github/workflows/semantic-pr-title.yml:32-39` sets `requireScope: true`.
   - Allowed scopes are `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker` and `repo`.
   - A first PR titled `fix: typo` fails the check. Neither the README nor the contributing guide mentions scopes.
4. **There is no pre-PR checklist.**
   - `.husky/pre-commit` has its only command commented out (`# yarn lint-staged`), so nothing formats or lints on commit.
   - CI runs `test:other`, `test:code` and `test:typecheck` (`lint.yml:20-22`), and a contributor only finds out from a red check.
5. **Tool versions are not stated.**
   - `package.json` says Node `>=18` and pins `yarn@1.22.22`. CI uses Node 20.x and the Dockerfile uses `node:24`.
   - There is no `.nvmrc`, and the README says nothing.
6. **Minor gaps.** There is no License section (only a badge), no mention of `AGENTS.md` conventions, and no place to report a security issue.

## Wrong

1. **The Google Cloud link at `README.md:110` is dead.** `googlecloudcheatsheet.withgoogle.com/architecture` now redirects to the generic `cloud.google.com/products` page. I checked this with curl; the other README links I checked returned 200. CodeSandbox, which the README does not link, returned 403, likely bot-blocking.
2. **"circle" at `README.md:66` is the wrong name.**
   - The tool is `ellipse` (`packages/common/src/constants.ts:537`).
   - The list is also stale. `TOOL_TYPE` now includes `text`, `frame`, `stickynote`, `embeddable`, `laser` and `lasso`.
3. **Some of the HTML is invalid.**
   - `</br>` at lines 17-18 is not a tag.
   - `alt` on `<source>` at line 3 is not a valid attribute.
   - GitHub renders both fine, so this is low priority.
4. **Nits.**
   - "VScode" should be "VS Code".
   - "following instructions" should be "the following instructions".

## Unclear

1. **"Quick start" is ambiguous.**
   - A contributor expects clone-and-run and gets `npm install`.
   - It is also incomplete for integrators: it stops at install.
   - `packages/excalidraw/README.md:19-42` says the CSS import and a parent with non-zero height are the two easy-to-miss requirements. The root README mentions neither.
2. **"Integrations" (`README.md:103-106`) lists the npm package as an integration of itself.** It also sits next to "Who's integrating Excalidraw", which is confusing.
3. **"We'll be adding these features as drop-in plugins… in the future" (`README.md:81`)** has no date and no link. Either link a tracking issue or drop the line.
4. **The Contributing section is three off-site links.** It leaves out the guide's main rule, which is to open an issue first for major changes.

## Errors in the linked docs (`dev-docs/docs/introduction/`)

The README sends contributors to these pages, so their errors reach every new contributor.

- **`development.mdx:37` gives the wrong port.** It says `localhost:3000`; the real port is **3001** (`.env.development:30`, `vite.config.mts:17`).
- **`development.mdx:75-78` mislabels commands.**
  - `yarn test:code` is labelled "formatting with Prettier", but it runs ESLint.
  - The Prettier check is `yarn test:other`.
  - `yarn fix` runs both, not just Prettier.
- **`development.mdx:81-87` presents docker-compose as a way to work locally.**
  - The Dockerfile builds a static bundle served by nginx, so there is no hot reload.
  - The bind mounts target `/opt/node_app/app`, which the nginx stage never reads.
- **`development.mdx:16` says "Yarn v1 or v2.4.2+".** The repo pins `yarn@1.22.22`, and no Node version is given.
- **`contributing.mdx:41-53` lists PR title types but not the required scopes.** Its examples ("gulp, broccoli", "Travis, Circle") are leftovers from the Angular convention.

## Proposed edits

**A. Rename the quick start and make it work.** This replaces `README.md:83-95`.

````md
## Using the npm package

```bash
npm install react react-dom @excalidraw/excalidraw
```

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css"; // required

export default function App() {
  // the parent must have a non-zero height
  return <div style={{ height: "100vh" }}><Excalidraw /></div>;
}
```

See the [documentation](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation) for Next.js/SSR and the full API.
````

**B. Add a new section before "Contributing".**

````md
## Developing locally

Requires Node.js ≥ 18 (CI uses 20.x) and Yarn 1.x (`corepack enable` picks up the pinned version).

```bash
git clone https://github.com/excalidraw/excalidraw.git && cd excalidraw
yarn          # installs all workspaces
yarn start    # dev server at http://localhost:3001
```

| Path | Contents | PR scope |
| --- | --- | --- |
| `packages/excalidraw/` | The editor, published as `@excalidraw/excalidraw` | `editor` |
| `packages/{common,element,math,utils}/` | Internal packages the editor is built from | `editor` / `packages/utils` |
| `excalidraw-app/` | excalidraw.com (collaboration, sharing, PWA) | `app` |
| `examples/`, `dev-docs/` | Integration examples; source of docs.excalidraw.com | `repo` |

Before opening a PR (there is no pre-commit hook, and CI runs all of these):

```bash
yarn fix             # Prettier + ESLint autofix
yarn test:typecheck  # tsc
yarn test:update     # run tests once, updating snapshots
```

PR titles must be `type(scope): summary`, e.g. `fix(editor): …`. The scope is **required**: `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker`, or `repo`.
````

In the table above, the scope-to-path mapping for `examples/` and `dev-docs/` is my inference. The workflow lists the scopes but does not map them to directories, so a maintainer should confirm it.

**C. Smaller fixes.**
- Line 66: change `circle` to `ellipse` and add `text, frames, sticky notes, embeds, laser pointer`.
- Line 110: remove the Google Cloud link or replace the URL.
- Lines 17-18: change `</br>` to `<br />`. Line 3: drop `alt` from `<source>`.
- Lines 103-106: fold the "Integrations" list into "Who's integrating", or rename it "Official integrations" and drop the npm entry.
- Contributing: prepend "For major changes, please open an issue first."
- Append a `## License` line: "MIT — see [LICENSE](./LICENSE)".

**D. Fix the four `development.mdx` errors and add the scope list to `contributing.mdx`.** Otherwise edit B and the docs site will contradict each other.

`★ Insight ─────────────────────────────────────`
- Part of the PR workflow already works from the title: the `label-scope` job (`semantic-pr-title.yml:45-114`) reads it and applies `s-app`, `s-editor` or `s-package` labels. Documenting scopes therefore also explains how PRs get triaged.
- The commented-out husky hook means the README has to do the hook's job. The "Before opening a PR" block in edit B covers that, so first PRs don't spend a CI round-trip on formatting.
`─────────────────────────────────────────────────`