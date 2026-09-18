# Bake-off runner and results

Ten response styles, each in an isolated `claude -p` session, each answering the same two prompts in `herdr-pr-emoji`. One `.md` per run holds the full answer under a short header. One `.json` per run holds the raw `--output-format json` result plus the arm's settings.

## Arms

Plugin ids: `S` = `agents-output-styles@bonkey`, `C` = `caveman@caveman`, `A` = `i-have-adhd@i-have-adhd`. Each arm passes an `enabledPlugins` map that enables at most one of them; the style arms add `outputStyle`.

| Arm | Enabled plugin | `outputStyle` | Env |
|---|---|---|---|
| default | none | (Default) | |
| concise | none | `Concise` | |
| proactive | none | `Proactive` | |
| explanatory | none | `Explanatory` | |
| learning | none | `Learning` | |
| ste-concise | S | `agents-output-styles:STE Concise` | |
| caveman-lite | C | | `CAVEMAN_DEFAULT_MODE=lite` |
| caveman-full | C | | `CAVEMAN_DEFAULT_MODE=full` |
| caveman-ultra | C | | `CAVEMAN_DEFAULT_MODE=ultra` |
| i-have-adhd | A | | (`~/.claude/.i-have-adhd-always` exists, so the hook injects the ruleset) |

Common command, from `herdr-pr-emoji` as cwd, prompt on stdin:

```
claude -p --output-format json \
  --model claude-fable-5-1 --effort xhigh \
  --setting-sources project --strict-mcp-config --no-chrome \
  --dangerously-skip-permissions \
  --settings '{"enabledPlugins":{...},"outputStyle":"..."}' \
  --name "bakeoff-<arm>-<prompt>"
```

`--setting-sources project` drops user and local settings, so the nine user-scope plugins, their hooks, the vibe-island hooks and the local `outputStyle` never load. The three test plugins are installed at project scope for the duration of the run and uninstalled after. `~/.claude/CLAUDE.md` loads in every arm.

The probes in `probe/` confirm the isolation: `default` reports only the global CLAUDE.md rules, and each plugin arm reports only its own ruleset.

## Prompts

- `review`: Review this project and propose improvements. Cover the code, the tests, the README, and the plugin's behaviour. Do not modify any file.
- `short`: Why does a PR whose only failing checks are non-required show as mergeable?

## Runner

```
./run.sh setup     # register marketplace, install the 3 plugins at project scope
./run.sh probe     # 4 isolation probes into probe/
./run.sh run       # 20 runs, skips existing .json
./run.sh table     # size/cost table from the .json files
./run.sh cleanup   # uninstall the 3 plugins, restore ~/.claude/.caveman-active
./run.sh all       # everything, cleanup on exit
./run.sh arm ...   # one extra arm, see below
```

## Add your own style or plugin

`arm` runs the prompts for one extra arm with every other plugin off, and writes `<name>--<prompt>.json` and `.md` next to the others.

```
# a style file: wrapped in a throwaway plugin, so nothing under ~/.claude changes
./run.sh arm my-style --style-file ~/.claude/output-styles/my-style.md

# a plugin folder that ships an output style
./run.sh arm my-plugin --plugin-dir ~/src/my-plugin --style "my-plugin:My Style"

# a plugin that injects its rules by hook
./run.sh arm other-plugin --plugin-dir ~/src/other-plugin --env SOME_MODE=full

# a plugin already installed on this machine
./run.sh arm installed --plugin some-plugin@some-marketplace

# only one prompt
./run.sh arm my-style --style-file my.md --prompt short
```

Then `cd ../site && pnpm data` picks the new arm up. Give it a name and a summary in `bakeoff/arms.json`:

```json
{ "my-style": { "name": "My style", "kind": "custom style", "summary": "One line.", "enable": "{ \"outputStyle\": \"My style\" }", "link": "https://..." } }
```

`kind` is one of `built-in`, `custom style`, `plugin`. Without an entry the site lists the arm by its id.

## Size and cost

### review

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 1103 | 24871 | 3.68 | 328 | 22 |
| concise | 782 | 25531 | 4.03 | 346 | 21 |
| proactive | 1209 | 26496 | 3.6 | 360 | 20 |
| explanatory | 1651 | 27747 | 3.74 | 379 | 21 |
| learning | 1418 | 31894 | 4.18 | 2316 | 21 |
| ste-concise | 1093 | 22343 | 3.4 | 314 | 27 |
| caveman-lite | 1221 | 30429 | 4.48 | 393 | 31 |
| caveman-full | 786 | 26068 | 3.95 | 356 | 15 |
| caveman-ultra | 900 | 38824 | 5.11 | 511 | 34 |
| i-have-adhd | 784 | 39048 | 4.93 | 542 | 46 |

### short

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 317 | 2083 | 0.5 | 34 | 7 |
| concise | 243 | 1767 | 0.41 | 31 | 6 |
| proactive | 301 | 1700 | 0.47 | 30 | 5 |
| explanatory | 618 | 4313 | 0.66 | 63 | 6 |
| learning | 394 | 2660 | 0.47 | 40 | 5 |
| ste-concise | 213 | 2759 | 0.64 | 42 | 7 |
| caveman-lite | 227 | 2075 | 0.55 | 34 | 6 |
| caveman-full | 207 | 2376 | 0.6 | 36 | 5 |
| caveman-ultra | 169 | 2156 | 0.53 | 34 | 5 |
| i-have-adhd | 259 | 8549 | 1.19 | 143 | 12 |
