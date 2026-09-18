#!/usr/bin/env bash
# Agents linguistics: bake-off runner.
#
#   ./run.sh setup     register the bonkey marketplace, install the 3 test plugins at project scope
#   ./run.sh probe     4 cheap isolation probes into probe/
#   ./run.sh run       all arms x prompts into this directory (skips runs whose .json exists)
#   ./run.sh table     print the size/cost table (Markdown) from the .json files
#   ./run.sh cleanup   uninstall the 3 plugins, restore ~/.claude/.caveman-active
#   ./run.sh all       setup, probe, run, table, cleanup (cleanup also runs on abort)
#   ./run.sh arm ...   one extra arm: your own style file, any plugin dir, or an installed plugin (see arm())
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
PROJECT=/Users/bonkey/Projects/Personal/bonkey/herdr-pr-emoji
MODEL=claude-fable-5-1
EFFORT=xhigh
CAVEMAN_FLAG="$HOME/.claude/.caveman-active"

S=agents-output-styles@bonkey
C=caveman@caveman
A=i-have-adhd@i-have-adhd

# name | enabled plugin (S/C/A/-) | outputStyle | CAVEMAN_DEFAULT_MODE
ARMS=(
  "default|-||"
  "concise|-|Concise|"
  "proactive|-|Proactive|"
  "explanatory|-|Explanatory|"
  "learning|-|Learning|"
  "ste-concise|S|agents-output-styles:STE Concise|"
  "caveman-lite|C||lite"
  "caveman-full|C||full"
  "caveman-ultra|C||ultra"
  "i-have-adhd|A||"
)
PROBE_ARMS=(default ste-concise caveman-full i-have-adhd)
PROMPTS=(review short)

settings_json() { # $1 enabled (S/C/A/-), $2 style, $3 extra plugin id to enable (optional)
  jq -cn --arg on "$1" --arg style "$2" --arg extra "${3:-}" --arg S "$S" --arg C "$C" --arg A "$A" '
    {enabledPlugins: ({($S): ($on=="S"), ($C): ($on=="C"), ($A): ($on=="A")} + (if $extra=="" then {} else {($extra): true} end))}
    + (if $style=="" then {} else {outputStyle: $style} end)'
}

arm_spec() { # $1 arm name -> echoes the spec line
  local a; for a in "${ARMS[@]}"; do [[ "${a%%|*}" == "$1" ]] && { echo "$a"; return; }; done
  echo "unknown arm: $1" >&2; return 1
}

run_arm() { # $1 arm name, $2 prompt name, $3 out dir
  local spec name on style mode
  spec=$(arm_spec "$1") || return 1
  IFS='|' read -r name on style mode <<<"$spec"
  run_one "$name" "$on" "$style" "$mode" "$2" "$3"
}

# EXTRA_PLUGIN (installed plugin id), PLUGIN_DIR (path) and EXTRA_ENV (K=V lines) come from the `arm` subcommand.
run_one() { # $1 name, $2 enabled S/C/A/-, $3 style, $4 caveman mode, $5 prompt name, $6 out dir
  local name="$1" on="$2" style="$3" mode="$4" p="$5"
  local out="$6/$name--$p"
  if [[ -s "$out.json" ]]; then echo "skip  $name/$p (exists)"; return 0; fi
  echo "run   $name/$p"
  local settings; settings=$(settings_json "$on" "$style" "${EXTRA_PLUGIN:-}")
  local -a envs=(-u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT -u CLAUDE_CODE_SESSION_ID -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_EFFORT)
  [[ -n "$mode" ]] && envs+=("CAVEMAN_DEFAULT_MODE=$mode")
  local kv; for kv in ${EXTRA_ENV:-}; do envs+=("$kv"); done
  local -a extra=()
  [[ -n "${PLUGIN_DIR:-}" ]] && extra+=(--plugin-dir "$PLUGIN_DIR")
  local start; start=$(date +%s)
  ( cd "$PROJECT" && env "${envs[@]}" claude -p --output-format json \
      --model "$MODEL" --effort "$EFFORT" \
      --setting-sources project --strict-mcp-config --no-chrome \
      --dangerously-skip-permissions \
      --settings "$settings" "${extra[@]}" \
      --name "bakeoff-$name-$p" \
      < "$HERE/prompts/$p.md" ) > "$out.json.tmp" 2> "$out.stderr"
  local rc=$?
  local wall=$(( $(date +%s) - start ))
  if [[ $rc -ne 0 ]] || ! jq -e '.result' "$out.json.tmp" >/dev/null 2>&1; then
    echo "FAIL  $name/$p rc=$rc (see $out.stderr)"; rm -f "$out.json.tmp"; return 1
  fi
  local cc_version; cc_version=$(claude --version 2>/dev/null | awk '{print $1}')
  jq --arg wall "$wall" --arg settings "$settings" --arg mode "$mode" --arg plugin_dir "${PLUGIN_DIR:-}" \
     --arg ccv "$cc_version" --arg model "$MODEL" --arg effort "$EFFORT" \
     '. + {bakeoff: {arm: "'"$name"'", prompt: "'"$p"'", wall_s: ($wall|tonumber), settings: ($settings|fromjson), caveman_mode: $mode, plugin_dir: $plugin_dir,
                     harness: {tool: "Claude Code", version: $ccv, model: ((.modelUsage // {} | keys | .[0]) // $model), effort: $effort}}}' \
     "$out.json.tmp" > "$out.json" && rm -f "$out.json.tmp" "$out.stderr"
  to_md "$out.json" > "$out.md"
}

to_md() { # $1 json -> markdown on stdout
  jq -r '
    "# \(.bakeoff.arm) / \(.bakeoff.prompt)\n\n" +
    "- arm: `\(.bakeoff.arm)`  prompt: `\(.bakeoff.prompt)`  caveman mode: `\(.bakeoff.caveman_mode // "")`\n" +
    "- settings: `\(.bakeoff.settings|tojson)`\n" +
    "- harness: \(.bakeoff.harness.tool // "Claude Code") \(.bakeoff.harness.version // "?")  model: `\(.bakeoff.harness.model // ((.modelUsage // {} | keys | join(",")) // ""))`  effort: \(.bakeoff.harness.effort // "?")\n" +
    "- turns: \(.num_turns)  wall: \(.bakeoff.wall_s)s  api: \((.duration_api_ms // 0)/1000|floor)s\n" +
    "- cost: $\(.total_cost_usd // 0 | . * 10000 | round / 10000)  output tokens: \(.usage.output_tokens // 0)  words: \(.result | [scan("\\S+")] | length)\n\n---\n\n" +
    .result' "$1"
}

setup() {
  claude plugin marketplace add bonkey/agents-output-styles || true
  ( cd "$PROJECT" && for p in "$S" "$C" "$A"; do claude plugin install "$p" -s project; done )
  ( cd "$PROJECT" && claude plugin list --json | jq -r '.[] | select(.scope=="project") | "\(.id // .name)\t\(.scope)"' )
  echo "--- $PROJECT/.claude/settings.json"; cat "$PROJECT/.claude/settings.json" 2>/dev/null || echo "(missing)"
}

cleanup() {
  echo "cleanup"
  ( cd "$PROJECT" && for p in "$S" "$C" "$A"; do claude plugin uninstall "$p" -s project; done )
  local f="$PROJECT/.claude/settings.json"
  if [[ -f "$f" ]] && [[ "$(jq -c 'del(.enabledPlugins) | if .enabledPlugins==null then . else . end' "$f" 2>/dev/null)" == "{}" ]] \
     && [[ "$(jq -c '.enabledPlugins // {}' "$f")" == "{}" ]]; then rm -f "$f"; fi
  printf 'full' > "$CAVEMAN_FLAG"
  ( cd "$PROJECT" && git status --short )
}

probe() {
  mkdir -p "$HERE/probe"
  local a; for a in "${PROBE_ARMS[@]}"; do run_arm "$a" probe "$HERE/probe"; done
  for a in "${PROBE_ARMS[@]}"; do printf '%-14s %s\n' "$a" "$(jq -r '.result' "$HERE/probe/$a--probe.json" | head -3 | tr '\n' ' ')"; done
}

run_all() {
  local spec a p
  for spec in "${ARMS[@]}"; do a="${spec%%|*}"; for p in "${PROMPTS[@]}"; do run_arm "$a" "$p" "$HERE"; done; done
}

table() {
  local spec a p f
  for p in "${PROMPTS[@]}"; do
    echo "### $p"; echo
    echo "| arm | words | output tokens | cost USD | wall s | turns |"
    echo "|---|---:|---:|---:|---:|---:|"
    for spec in "${ARMS[@]}"; do a="${spec%%|*}"
      f="$HERE/$a--$p.json"; [[ -s "$f" ]] || continue
      jq -r '"| \(.bakeoff.arm) | \(.result | [scan("\\S+")] | length) | \(.usage.output_tokens // 0) | \(.total_cost_usd // 0 | . * 100 | round / 100) | \(.bakeoff.wall_s) | \(.num_turns) |"' "$f"
    done; echo
  done
}

# ./run.sh arm <name> [--style <outputStyle>] [--style-file <file.md>] [--plugin-dir <path>]
#                     [--plugin <id@marketplace>] [--env K=V]... [--prompt <name>]...
# Runs the prompts for one extra arm and writes <name>--<prompt>.json/.md here.
# A bare style file is wrapped in a throwaway plugin, so it loads without touching ~/.claude.
arm() {
  local name="${1:?arm name}"; shift
  local style="" style_file="" ; local -a prompts=()
  PLUGIN_DIR="" EXTRA_PLUGIN="" EXTRA_ENV=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --style) style="$2"; shift 2 ;;
      --style-file) style_file="$2"; shift 2 ;;
      --plugin-dir) PLUGIN_DIR="$2"; shift 2 ;;
      --plugin) EXTRA_PLUGIN="$2"; shift 2 ;;
      --env) EXTRA_ENV="$EXTRA_ENV $2"; shift 2 ;;
      --prompt) prompts+=("$2"); shift 2 ;;
      *) echo "unknown option: $1" >&2; return 2 ;;
    esac
  done
  [[ ${#prompts[@]} -gt 0 ]] || prompts=("${PROMPTS[@]}")
  if [[ -n "$style_file" ]]; then
    [[ -f "$style_file" ]] || { echo "no such file: $style_file" >&2; return 2; }
    local tmp; tmp=$(mktemp -d "${TMPDIR:-/tmp}/bakeoff-style.XXXXXX")
    mkdir -p "$tmp/.claude-plugin" "$tmp/output-styles"
    printf '{"name":"bakeoff-style","description":"ad-hoc style for the bake-off","version":"0.0.0"}\n' > "$tmp/.claude-plugin/plugin.json"
    cp "$style_file" "$tmp/output-styles/"
    local sname; sname=$(awk '/^name:/{sub(/^name:[ ]*/,""); print; exit}' "$style_file")
    [[ -n "$sname" ]] || sname=$(basename "$style_file" .md)
    PLUGIN_DIR="$tmp"; style="bakeoff-style:$sname"
    echo "style file wrapped as plugin $tmp, outputStyle=$style"
  fi
  local p; for p in "${prompts[@]}"; do run_one "$name" "-" "$style" "" "$p" "$HERE"; done
}

case "${1:-all}" in
  arm) shift; arm "$@" ;;
  setup) setup ;;
  probe) probe ;;
  run) run_all ;;
  table) table ;;
  cleanup) cleanup ;;
  all) trap cleanup EXIT; setup; probe; run_all; table ;;
  *) echo "usage: $0 setup|probe|run|table|cleanup|all | arm <name> [--style S] [--style-file F] [--plugin-dir D] [--plugin ID] [--env K=V] [--prompt P]" >&2; exit 2 ;;
esac
