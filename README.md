# Agents linguistics

How a coding agent talks is a variable, and this repo measures it. Ten output styles for Claude Code answered the same questions about the same codebase. The site shows you two answers at a time, names hidden, and you pick the one you would rather read. Ten picks give you a ranking and the line that switches the winner on.

- `site/`: the Vite app. Blind pairwise picks, a Bradley-Terry ranking with a plain explanation, a browse view with two panes. See `site/README.md`.
- `bakeoff/`: the runner, the prompts, the recorded answers, and `projects.json`, the database of projects and prompts still to run. See `bakeoff/README.md`.

Every recorded answer states the harness, version, model and effort that produced it.
