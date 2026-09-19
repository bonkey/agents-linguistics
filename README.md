# Agents linguistics

How a coding agent talks is a variable, and this repo measures it. Ten output styles for Claude Code answered the same questions about the same codebase. The site shows you two answers at a time, names hidden, and you pick the one you would rather read. Ten picks give you a ranking and the line that switches the winner on.

- `site/`: the Vite app. Blind pairwise picks, a Bradley-Terry ranking with a plain explanation, a browse view with two panes. See `site/README.md`.
- `eval/`: the runner, the recorded answers in `outputs/`, one folder per project, prompt and style family, and `projects.json`, the database of projects and prompts. See `eval/README.md`.

Every recorded answer states the harness, version, model and effort that produced it.

## Test your own style

Every recorded answer comes from one command. The same command takes your own style file, runs the same prompts against the same codebase, and adds the result as a new style in the site.

```
git clone https://github.com/bonkey/agents-linguistics && cd agents-linguistics/eval
./run.py arm my-style --style-file ~/.claude/output-styles/my-style.md
cd ../site && pnpm install && pnpm data && pnpm dev
```

The command answers every prompt of the project, each in an isolated session with every plugin off. Pass `--prompt <id>` to pick one. The runner clones [herdr-pr-emoji](https://github.com/bonkey/herdr-pr-emoji) at `81e8933`, the codebase the prompts are about, and runs each session in its own copy. It needs Python 3, `git` and `claude`.

For plugins, the other options and naming the new style, see `eval/README.md`.
