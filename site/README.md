# Agents linguistics, the site

Blind pairwise test of Claude Code output styles. Two answers at a time, names hidden, your results as a Bradley-Terry ranking after each round of ten picks. Picks stay in the visitor's browser (`localStorage`); nothing is sent anywhere.

```
pnpm install
pnpm dev        # local dev server
pnpm test       # ranking logic (vitest)
pnpm build      # dist/
pnpm data       # rebuild src/data/samples.json from ../bakeoff/*.json
```

`src/data/samples.json` is committed, so a deploy never reads outside this directory. Run `pnpm data` after new bake-off runs and commit the result.

Arm names, summaries and enable snippets for the ten original arms live in `src/data/arms.ts`. Arms added with `../bakeoff/run.sh arm` take their metadata from `../bakeoff/arms.json`, and an arm without any metadata is listed by its id.

Vercel: project root directory `site`, framework preset Vite, build `pnpm build`, output `dist`.
