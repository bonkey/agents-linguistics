# proactive / critique-readme

- project: `excalidraw` at `c0ad61c6743a`
- arm: `proactive`  prompt: `critique-readme`  caveman mode: ``
- settings: `{"enabledPlugins":{"agents-output-styles@bonkey":false,"caveman@caveman":false,"i-have-adhd@i-have-adhd":false},"outputStyle":"Proactive"}`
- harness: Claude Code 2.1.278  model: `claude-fable-5-1`  effort: xhigh
- turns: 10  wall: 163s  api: 96s
- cost: $1.0195  output tokens: 7815  words: 882

---

The README gives a first-time contributor almost nothing to work with. It has one "Contributing" section of three links, and the guide it links to has errors that will trip a newcomer. I changed no files. Each finding below was checked against the repo, and I tested every external link in the README.

## Wrong

| Where | Problem | Proposed edit |
|---|---|---|
| `README.md:110` | The Google Cloud link (`googlecloudcheatsheet.withgoogle.com/architecture`) now redirects to the generic `cloud.google.com/products` page. It no longer shows any Excalidraw integration. | Unlink it or drop the entry. Every other link returned 200. npm returned 403, which I take to be its bot protection rather than a dead link. |
| `README.md:66` | The list says "circle", but the tool is `ellipse`. The list is also out of date: `TOOL_TYPE` in `packages/common/src/constants.ts:532` now includes text, frame, sticky note, embeddable, laser and lasso. | Change to `rectangle, ellipse, diamond, arrow, line, free-draw, text, frames, sticky notes, eraser...` |
| `README.md:81` | "We'll be adding these features as drop-in plugins… in the future" has been unchanged since Feb 2023 (`c587b85b`). | Delete it, or replace it with a link to a tracking issue. |
| `README.md:17-18`, `:3` | `</br>` is invalid HTML, and `alt` is not a valid attribute on `<source>`. | Change `</br>` to `<br />` and remove `alt` from `<source>`. |
| `README.md:85` | Grammar: "following instructions are…" | Change to "The following instructions are…" |

## Missing

1. **No steps for running the repo locally.** The only pointer is a bold "Note" inside the npm-install section (`:85`). A contributor scanning the headings reaches "Quick start" and gets `npm install`, which is not what they need.
2. **No prerequisites.**
   - `package.json` requires Node `>=18` and pins `yarn@1.22.22`.
   - CI runs Node 20.x and the Dockerfile uses Node 24.
   - There is no `.nvmrc`, and none of this appears in the README.
3. **No repo map.** The repo is a monorepo with `excalidraw-app/`, `packages/{excalidraw,element,common,math,utils}` and `examples/`. The README never says where a change belongs. `CLAUDE.md` explains it; the README, which people actually read, does not.
4. **No pre-PR checklist.** `.husky/pre-commit` has `yarn lint-staged` commented out, so nothing runs automatically. Contributors must know to run `yarn fix`, `yarn test:typecheck` and `yarn test:update` themselves.
5. **The PR title rule is not documented anywhere.**
   - `.github/workflows/semantic-pr-title.yml` sets `requireScope: true`.
   - The allowed scopes are `app | editor | packages/excalidraw | packages/utils | docker | repo`.
   - The contributing guide lists only the types, so a first PR titled `fix: …` fails CI.
6. **The Quick start omits two requirements.** `packages/excalidraw/README.md` itself calls them "easy-to-miss": importing `@excalidraw/excalidraw/index.css`, and giving the container a non-zero height. The README also has no link to `examples/`.

## Unclear

- **Editor vs. excalidraw.com:** The README does not connect "the Excalidraw editor (npm package)" and "Excalidraw.com" to directories, which is the key mental model for a contributor.
- **Integrations section:** It lists the "npm package" as an integration, which duplicates Quick start. It also doesn't say the VS Code extension is third-party (publisher `pomdtr`).
- **Discord prompt:** "Let us know on Discord" doesn't say what to tell them.

## Proposed replacement for the `## Contributing` section

```markdown
## Contributing

- Found a bug or missing something? Search the [issues](https://github.com/excalidraw/excalidraw/issues) first, then [open a new one](https://github.com/excalidraw/excalidraw/issues/new).
- For major changes, open an issue to discuss before writing code. Questions? Ask in `#contributing` on [Discord](https://discord.gg/UexuTaE).
- Translations are handled on [Crowdin](https://crowdin.com/project/excalidraw), not via PRs.

### Run it locally

Requires Node.js 20+ (>=18 supported) and Yarn 1.x (`corepack enable` picks the pinned version).

    git clone https://github.com/<you>/excalidraw.git && cd excalidraw
    yarn          # install all workspaces
    yarn start    # dev server at http://localhost:3001

### Where things live

| Path | What |
|---|---|
| `packages/excalidraw/` | The editor, published as `@excalidraw/excalidraw` — most features go here |
| `packages/{element,common,math,utils}/` | Supporting packages |
| `excalidraw-app/` | excalidraw.com (collab, sharing, PWA) |
| `examples/` | Next.js and browser-script integrations |
| `dev-docs/` | Source of docs.excalidraw.com |

### Before opening a PR

    yarn fix              # prettier + eslint --fix (no pre-commit hook does this for you)
    yarn test:typecheck
    yarn test:update      # run tests, update snapshots

PR titles must be `type(scope): summary`, e.g. `fix(editor): …`.
Scopes: `app`, `editor`, `packages/excalidraw`, `packages/utils`, `docker`, `repo`.
Full guide: [contributing](https://docs.excalidraw.com/docs/introduction/contributing) · [development](https://docs.excalidraw.com/docs/introduction/development)
```

- **Discord channel name:** `#contributing` is a placeholder; I couldn't check the real channel name.
- **Quick start retitle:** Retitle `## Quick start` to `## Using the npm package`. Add the CSS-import and container-height snippet from `packages/excalidraw/README.md:19-40`. The bold Note at `:85` can then be removed.
- **Integrations fix:** Drop "npm package" from `## Integrations` and label the extension "VS Code extension (community)".

## Bugs in the linked docs

These are in `dev-docs/docs/introduction/`, the guide the README sends contributors to.

- **Wrong port:** `development.mdx` says to open `localhost:3000`. `.env.development:30` sets `VITE_APP_PORT=3001`, so `yarn start` serves on 3001.
- **Wrong script labels:**
  - `development.mdx` labels `yarn test:code` "Test for formatting with Prettier", but it runs ESLint. The Prettier check is `yarn test:other`.
  - It labels `yarn fix` "Reformat with Prettier", but it also runs `eslint --fix`.
- **Yarn version:** `development.mdx` requires "Yarn v1 or v2.4.2+", which conflicts with the pinned `yarn@1.22.22`. It gives no Node version.
- **PR scope:** `contributing.mdx` doesn't mention the required scope (item 5 above).