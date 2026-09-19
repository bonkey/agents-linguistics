# Eval runner and results

Ten response styles, each in an isolated `claude -p` session, each answering the same prompts about the same project. `projects.json` names the projects, their pinned refs and their prompts. One `.md` per run holds the full answer under a short header. One `.json` per run holds the raw `--output-format json` result plus the arm's settings and the harness that produced it.

## Layout

```
run.py  projects.json  tests/
outputs/
  herdr-pr-emoji/                 project id from projects.json
    review/  short/  review-pr-2/  review-pr-1/  find-issues/  critique-readme/  probe/
                                  prompt id from projects.json, plus the isolation probe
      built-in/      default, concise, proactive, explanatory, learning
      caveman/       caveman-lite, caveman-full, caveman-ultra
      i-have-adhd/   i-have-adhd
      ste-concise/   ste-concise
.cache/                           project checkouts, not in git
```

Each run is `outputs/<project>/<prompt>/<family>/<arm>.json` and `.md`. The family folder is the arm name, or a shared name when several arms come from one source. The `ARMS` table in `run.py` sets it. A repeat run of the same arm is `<arm>--<n>.json`. The site reads every family folder of every prompt in `projects.json`, so a new folder needs no registration.

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
| i-have-adhd | A | | (`~/.claude/.i-have-adhd-always` must exist, so the hook injects the ruleset) |

Common command, prompt on stdin. Model and effort come from `harness_default` in `projects.json`:

```
claude -p --output-format json \
  --model claude-fable-5-1 --effort xhigh \
  --setting-sources project --strict-mcp-config --no-chrome \
  --dangerously-skip-permissions \
  --settings '{"enabledPlugins":{...},"outputStyle":"..."}' \
  --name "bakeoff-<arm>-<prompt>"
```

`--setting-sources project` drops user and local settings, so user-scope plugins, their hooks and the local `outputStyle` never load. `~/.claude/CLAUDE.md` loads in every arm.

## Isolation

The runner clones the project from `repo` in `projects.json` into `.cache/<project>@<ref>/` and checks out `ref`. No session runs there. Each run gets its own copy of that checkout in the system temp directory, so parallel sessions cannot see each other's files, and no session can read the recorded answers of another style.

A plugin installed at project scope loads only in the directory it was installed for. So the runner installs the arm's one plugin at project scope in the run's copy, and uninstalls it when the set ends. Every install happens before the first session starts and every uninstall after the last one ends, so no session reads the plugin registry while it changes. Caveman keeps its level per session, so the three Caveman arms run at the same time. The runner puts `~/.claude/.caveman-active` back as it found it.

Sessions run without GitHub credentials and cannot push: `gh` gets an empty config directory, GitHub token variables are removed from the environment, and git rewrites every push to GitHub to a URL that fails before any connection. Reading stays possible, so a session can fetch `pull/<n>/head` of a public repository or open the pull request's URL.

`./run.py probe` proves the isolation: it asks every arm, all at once, which style rules it sees. `default` reports none, and each other arm reports only its own ruleset. The answers are in `outputs/<project>/probe/`.

## Prompts

The prompt texts are in `projects.json`, per project. The probe text is in `run.py`.

## Runner

Python 3.9 or later, standard library only. It needs `git` and `claude` on `PATH`.

```
./run.py setup     # clone the project, register the 3 plugin marketplaces
./run.py probe     # one isolation probe per arm
./run.py run       # all arms x the project's prompts, skips runs whose .json exists
./run.py table     # size/cost table from the .json files
./run.py cleanup   # uninstall plugins from the copies of a runner that was killed
./run.py all       # setup, probe, run, table, cleanup
./run.py arm ...   # one extra arm, see below
```

Options for every command:

- `--project <id>`: a project of `projects.json`. Default: `herdr-pr-emoji`.
- `--prompt <id>` and `--arm <name>`: only these prompts or arms. Repeatable.
- `--jobs <n>`: sessions that run at the same time. Default: 10.
- `--timeout <s>`: seconds before one session is killed. Default: 3600.
- `--max-failures <n>`: failed runs after which no new run starts. Default: 3.
- `--repo <path or URL>`: clone the project from here, for example a local clone, instead of `repo` in `projects.json`.

A run fails when `claude` exits with an error, returns an error result, returns no answer, or exceeds the timeout. A failed run writes `<arm>.failed.log` and no `.json`, so the next `./run.py run` tries it again. The runner never retries by itself. It ends with a summary of done, skipped, failed and not started runs, the wall time and the cost. Ctrl-C stops every session.

## Add your own style or plugin

`arm` runs the project's prompts for one extra arm with every other plugin off, and writes `outputs/<project>/<prompt>/<name>/<name>.json` and `.md`. Pass `--folder <family>` to put the arm in a shared family folder.

```
# a style file: wrapped in a throwaway plugin, so nothing under ~/.claude changes
./run.py arm my-style --style-file ~/.claude/output-styles/my-style.md

# a plugin folder that ships an output style
./run.py arm my-plugin --plugin-dir ~/src/my-plugin --style "my-plugin:My Style"

# a plugin that injects its rules by hook
./run.py arm other-plugin --plugin-dir ~/src/other-plugin --env SOME_MODE=full

# a plugin already installed on this machine at user scope
./run.py arm installed --plugin some-plugin@some-marketplace

# only one prompt
./run.py arm my-style --style-file my.md --prompt short

# one more arm of a family that has a folder
./run.py arm caveman-other --plugin-dir ~/src/caveman --env CAVEMAN_DEFAULT_MODE=other --folder caveman
```

Then `cd ../site && pnpm data` picks the new arm up. Give it a name and a summary in `eval/arms.json`:

```json
{ "my-style": { "name": "My style", "kind": "custom style", "summary": "One line.", "enable": "{ \"outputStyle\": \"My style\" }", "link": "https://..." } }
```

`kind` is one of `built-in`, `custom style`, `plugin`. Without an entry the site lists the arm by its id.

## Tests

```
python3 -m unittest discover -s tests -v
```

The tests run `run.py` against a stub `claude`, so they start no session and cost nothing. They cover the output layout, the `claude` call of every arm (`tests/fixtures/claude_calls.jsonl`), skipping, `arm`, parallel runs in separate copies, plugin installs per copy, failures, the timeout and interruption.

## Size and cost

`herdr-pr-emoji`, from `./run.py table`.

### review

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 1299 | 29510 | 3.86 | 376 | 16 |
| concise | 1141 | 19263 | 2.68 | 267 | 16 |
| proactive | 1736 | 30782 | 3.72 | 394 | 21 |
| explanatory | 1548 | 28314 | 3.84 | 367 | 17 |
| learning | 1840 | 28125 | 3.34 | 367 | 21 |
| ste-concise | 1906 | 33565 | 3.52 | 416 | 15 |
| caveman-lite | 1585 | 21671 | 3.3 | 283 | 12 |
| caveman-full | 970 | 20172 | 2.92 | 263 | 16 |
| caveman-ultra | 1955 | 29615 | 3.74 | 368 | 9 |
| i-have-adhd | 895 | 22721 | 3.1 | 299 | 16 |

### short

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 287 | 1807 | 0.51 | 26 | 8 |
| concise | 230 | 2221 | 0.54 | 29 | 8 |
| proactive | 383 | 3048 | 0.82 | 39 | 11 |
| explanatory | 386 | 2424 | 0.74 | 35 | 9 |
| learning | 376 | 2357 | 0.56 | 32 | 10 |
| ste-concise | 236 | 1997 | 0.64 | 28 | 8 |
| caveman-lite | 249 | 1832 | 0.53 | 26 | 6 |
| caveman-full | 187 | 1128 | 0.43 | 20 | 4 |
| caveman-ultra | 203 | 2304 | 0.6 | 35 | 8 |
| i-have-adhd | 175 | 1777 | 0.48 | 26 | 7 |

### review-pr-2

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 797 | 30981 | 4.05 | 405 | 43 |
| concise | 674 | 18020 | 2.36 | 234 | 22 |
| proactive | 1023 | 26425 | 3.04 | 319 | 22 |
| explanatory | 1487 | 36223 | 3.89 | 442 | 25 |
| learning | 1018 | 33721 | 3.74 | 416 | 21 |
| ste-concise | 844 | 24028 | 3.74 | 321 | 33 |
| caveman-lite | 782 | 23114 | 3.44 | 316 | 33 |
| caveman-full | 1036 | 27543 | 3.68 | 361 | 29 |
| caveman-ultra | 700 | 19368 | 2.89 | 269 | 24 |
| i-have-adhd | 691 | 26480 | 3.27 | 325 | 20 |

### review-pr-1

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 913 | 20387 | 1.99 | 255 | 24 |
| concise | 588 | 11713 | 1.28 | 147 | 17 |
| proactive | 1034 | 19343 | 1.99 | 237 | 24 |
| explanatory | 1126 | 25886 | 2.26 | 315 | 23 |
| learning | 1225 | 23119 | 2.25 | 292 | 26 |
| ste-concise | 798 | 13862 | 3.91 | 527 | 14 |
| caveman-lite | 811 | 14139 | 1.5 | 185 | 18 |
| caveman-full | 842 | 16167 | 1.67 | 227 | 19 |
| caveman-ultra | 664 | 18018 | 1.76 | 231 | 17 |
| i-have-adhd | 709 | 16944 | 1.69 | 218 | 21 |

### find-issues

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 1462 | 31349 | 3.1 | 410 | 18 |
| concise | 1374 | 21197 | 2.13 | 279 | 9 |
| proactive | 1950 | 28957 | 2.87 | 398 | 15 |
| explanatory | 1371 | 28454 | 2.82 | 383 | 14 |
| learning | 1596 | 28998 | 2.74 | 381 | 11 |
| ste-concise | 1609 | 29544 | 2.98 | 374 | 14 |
| caveman-lite | 1495 | 25518 | 2.63 | 327 | 11 |
| caveman-full | 1521 | 35472 | 3.48 | 473 | 18 |
| caveman-ultra | 1402 | 22315 | 2.35 | 301 | 11 |
| i-have-adhd | 1008 | 27825 | 2.83 | 379 | 14 |

### critique-readme

| arm | words | output tokens | cost USD | wall s | turns |
|---|---:|---:|---:|---:|---:|
| default | 1256 | 19335 | 2.49 | 251 | 15 |
| concise | 1179 | 11529 | 1.9 | 149 | 15 |
| proactive | 1780 | 20787 | 2.48 | 261 | 12 |
| explanatory | 1907 | 25715 | 2.84 | 314 | 19 |
| learning | 1505 | 20972 | 2.53 | 263 | 16 |
| ste-concise | 1133 | 16997 | 2.32 | 218 | 13 |
| caveman-lite | 1301 | 15696 | 2.09 | 193 | 15 |
| caveman-full | 1296 | 17976 | 2.28 | 224 | 13 |
| caveman-ultra | 1283 | 13386 | 2.06 | 177 | 14 |
| i-have-adhd | 1259 | 15768 | 2.04 | 200 | 12 |
