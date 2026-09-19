#!/usr/bin/env python3
"""Agents linguistics: eval runner.

  ./run.py setup     register the marketplaces of the 3 test plugins
  ./run.py probe     one cheap isolation probe per arm
  ./run.py run       all arms x the project's prompts (skips runs whose .json exists)
  ./run.py table     print the size/cost table (Markdown) from the .json files
  ./run.py cleanup   uninstall the plugins of copies that a killed runner left behind
  ./run.py all       setup, probe, run, table, cleanup (cleanup also runs on abort)
  ./run.py arm ...   one extra arm: your own style file, any plugin dir, or an installed plugin

Projects, refs and prompt texts come from projects.json. Each run is written to
outputs/<project>/<prompt>/<family>/<arm>.json and .md. Runs execute in parallel, each in
its own throwaway copy of the project checkout, with the arm's plugin installed at project
scope in that copy only.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECTS_FILE = HERE / "projects.json"
OUTPUTS = HERE / "outputs"
CACHE = HERE / ".cache"
JOURNAL = CACHE / "installed.json"
DEFAULT_PROJECT = "herdr-pr-emoji"

S = "agents-output-styles@bonkey"
C = "caveman@caveman"
A = "i-have-adhd@i-have-adhd"
PLUGINS = {"S": S, "C": C, "A": A}
MARKETPLACES = ["bonkey/agents-output-styles", "JuliusBrussee/caveman", "ayghri/i-have-adhd"]

# name, enabled plugin (S/C/A/-), outputStyle, CAVEMAN_DEFAULT_MODE, outputs family folder
ARMS = [
    ("default", "-", "", "", "built-in"),
    ("concise", "-", "Concise", "", "built-in"),
    ("proactive", "-", "Proactive", "", "built-in"),
    ("explanatory", "-", "Explanatory", "", "built-in"),
    ("learning", "-", "Learning", "", "built-in"),
    ("ste-concise", "S", "agents-output-styles:STE Concise", "", "ste-concise"),
    ("caveman-lite", "C", "", "lite", "caveman"),
    ("caveman-full", "C", "", "full", "caveman"),
    ("caveman-ultra", "C", "", "ultra", "caveman"),
    ("i-have-adhd", "A", "", "", "i-have-adhd"),
]

PROBE = "probe"
PROBE_TEXT = "Reply with one line: the output style or persona rules in your context, or NONE."

# A session started from inside Claude Code must not inherit that session's identity or effort.
UNSET_ENV = ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_EFFORT"]


@dataclass
class Run:
    project: dict
    prompt: str
    text: str
    arm: str
    on: str = "-"
    style: str = ""
    mode: str = ""
    family: str = ""
    extra_plugin: str = ""
    plugin_dir: str = ""
    extra_env: list = field(default_factory=list)
    tmp: Path | None = None
    installed: bool = False

    @property
    def gh_dir(self) -> Path:
        """An empty gh config directory: gh is logged out inside the session."""
        return self.tmp / "gh"

    @property
    def work(self) -> Path:
        """The run's own copy of the checkout. It keeps the project's name."""
        return self.tmp / self.project["id"]

    @property
    def out(self) -> Path:
        return OUTPUTS / self.project["id"] / self.prompt / (self.family or self.arm) / self.arm

    @property
    def label(self) -> str:
        return f"{self.project['id']}/{self.prompt}/{self.arm}"


def load_projects() -> dict:
    return json.loads(PROJECTS_FILE.read_text())


def find_project(db: dict, project_id: str) -> dict:
    for p in db["projects"]:
        if p["id"] == project_id:
            return p
    sys.exit(f"unknown project: {project_id} (see {PROJECTS_FILE.name})")


def prompts_of(project: dict, only: list | None = None) -> list:
    """(id, text) pairs of the project's prompts, or of the ids in `only`."""
    pairs = [(p["id"], p["text"]) for p in project["prompts"]]
    if not only:
        return pairs
    known = dict(pairs)
    for pid in only:
        if pid not in known:
            sys.exit(f"unknown prompt for {project['id']}: {pid} (has: {', '.join(known)})")
    return [(pid, known[pid]) for pid in only]


def settings_json(on: str, style: str, extra_plugin: str = "") -> str:
    enabled = {plugin: on == flag for flag, plugin in PLUGINS.items()}
    if extra_plugin:
        enabled[extra_plugin] = True
    settings = {"enabledPlugins": enabled}
    if style:
        settings["outputStyle"] = style
    return json.dumps(settings, separators=(",", ":"), ensure_ascii=False)


def claude_argv(run: Run, harness: dict) -> list:
    argv = ["claude", "-p", "--output-format", "json",
            "--model", harness["model"], "--effort", harness["effort"],
            "--setting-sources", "project", "--strict-mcp-config", "--no-chrome",
            "--dangerously-skip-permissions",
            "--settings", settings_json(run.on, run.style, run.extra_plugin)]
    if run.plugin_dir:
        argv += ["--plugin-dir", run.plugin_dir]
    return argv + ["--name", f"bakeoff-{run.arm}-{run.prompt}"]


# A session holds no GitHub credentials and cannot push, so it cannot post or write anywhere as the user.
NO_PUSH = "no-push://disabled/"
PUSH_PREFIXES = ["https://github.com/", "http://github.com/", "git@github.com:", "ssh://git@github.com/", "git://github.com/"]


def is_github_token(name: str) -> bool:
    parts = name.upper().split("_")
    return "TOKEN" in parts and ("GH" in parts or "GITHUB" in parts)


def claude_env(run: Run) -> dict:
    env = {k: v for k, v in os.environ.items() if k not in UNSET_ENV and not is_github_token(k)}
    env["GH_CONFIG_DIR"] = str(run.gh_dir)
    # Git rewrites every push to GitHub, by any remote or URL, to a scheme that fails before any connection.
    count = int(env.get("GIT_CONFIG_COUNT", "0"))
    for i, prefix in enumerate(PUSH_PREFIXES, start=count):
        env[f"GIT_CONFIG_KEY_{i}"] = f"url.{NO_PUSH}.pushInsteadOf"
        env[f"GIT_CONFIG_VALUE_{i}"] = prefix
    env["GIT_CONFIG_COUNT"] = str(count + len(PUSH_PREFIXES))
    if run.mode:
        env["CAVEMAN_DEFAULT_MODE"] = run.mode
    for kv in run.extra_env:
        key, _, value = kv.partition("=")
        env[key] = value
    return env


def checkout(project: dict, repo: str | None = None) -> Path:
    """The project at its pinned ref, cloned once into .cache/. Runs copy it; none runs inside it."""
    ref = project["ref"]
    path = CACHE / f"{project['id']}@{ref}"
    if not (path / ".git").exists():
        CACHE.mkdir(exist_ok=True)
        print(f"clone {repo or project['repo']} @ {ref}", flush=True)
        subprocess.run(["git", "clone", "--quiet", repo or project["repo"], str(path)], check=True)
        subprocess.run(["git", "-C", str(path), "checkout", "--quiet", "--detach", ref], check=True)
    head = subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    if not head.startswith(ref):
        sys.exit(f"{path} is at {head}, expected {ref}. Delete it to clone again.")
    return path


def cc_version() -> str:
    try:
        out = subprocess.run(["claude", "--version"], capture_output=True, text=True).stdout.split()
    except OSError:
        out = []
    return out[0] if out else ""


def num(x):
    """Numbers as jq prints them: no trailing .0."""
    return int(x) if float(x).is_integer() else x


def words(text: str) -> int:
    return len(text.split())


def to_md(j: dict) -> str:
    b = j["eval"]
    h = b.get("harness", {})
    return (
        f"# {b['arm']} / {b['prompt']}\n\n"
        f"- project: `{b.get('project', '')}` at `{b.get('ref', '')}`\n"
        f"- arm: `{b['arm']}`  prompt: `{b['prompt']}`  caveman mode: `{b.get('caveman_mode', '')}`\n"
        f"- settings: `{json.dumps(b['settings'], separators=(',', ':'), ensure_ascii=False)}`\n"
        f"- harness: {h.get('tool', 'Claude Code')} {h.get('version') or '?'}  model: `{h.get('model', '')}`  effort: {h.get('effort', '?')}\n"
        f"- turns: {j.get('num_turns')}  wall: {b['wall_s']}s  api: {int((j.get('duration_api_ms') or 0) // 1000)}s\n"
        f"- cost: ${num(round((j.get('total_cost_usd') or 0) * 10000) / 10000)}  output tokens: {(j.get('usage') or {}).get('output_tokens', 0)}  words: {words(j['result'])}\n\n---\n\n"
        + j["result"]
    )


class Runner:
    """Runs a set of sessions in parallel and keeps the books."""

    def __init__(self, source: Path, harness: dict, jobs: int, timeout: int, max_failures: int):
        self.source = source
        self.harness = harness
        self.jobs = jobs
        self.timeout = timeout
        self.max_failures = max_failures
        self.lock = threading.Lock()
        self.children: set = set()
        self.stop = threading.Event()
        self.done: list = []     # (run, cost)
        self.skipped: list = []
        self.failed: list = []   # (run, reason)
        self.not_started: list = []

    def say(self, line: str) -> None:
        with self.lock:
            print(line, flush=True)

    def fail(self, run: Run, reason: str, stdout: str = "", stderr: str = "") -> None:
        log = run.out.with_name(run.out.name + ".failed.log")
        log.write_text(f"{reason}\n\n--- stdout\n{stdout}\n--- stderr\n{stderr}\n")
        with self.lock:
            self.failed.append((run, reason))
        self.say(f"FAIL  {run.label}: {reason} (see {log})")

    def prepare(self, run: Run) -> bool:
        """Copies the checkout for one run and installs the arm's plugin there. False when the run is not to start."""
        out_json = run.out.with_name(run.out.name + ".json")
        if out_json.exists() and out_json.stat().st_size > 0:
            self.skipped.append(run)
            self.say(f"skip  {run.label} (exists)")
            return False
        run.out.parent.mkdir(parents=True, exist_ok=True)
        # The copy sits outside this repo, so a session cannot read other answers.
        run.tmp = Path(tempfile.mkdtemp())
        try:
            shutil.copytree(self.source, run.work, symlinks=True)
            run.gh_dir.mkdir()
            subprocess.run(["git", "-C", str(run.work), "config", "remote.origin.pushurl", NO_PUSH], check=True)
        except (OSError, subprocess.CalledProcessError) as e:
            self.fail(run, f"could not prepare the copy: {e}")
            return False
        plugin = PLUGINS.get(run.on)
        if plugin:
            # A project-scope install loads only in the directory it was made for.
            journal_add(run.work, plugin)
            run.installed = True
            r = subprocess.run(["claude", "plugin", "install", plugin, "-s", "project"], cwd=run.work, capture_output=True, text=True)
            if r.returncode != 0:
                self.fail(run, f"could not install {plugin}", r.stdout, r.stderr)
                return False
        return True

    def release(self, run: Run) -> None:
        if run.installed:
            subprocess.run(["claude", "plugin", "uninstall", PLUGINS[run.on], "-s", "project"], cwd=run.work, capture_output=True)
            journal_remove(run.work)
        if run.tmp:
            shutil.rmtree(run.tmp, ignore_errors=True)

    def one(self, run: Run) -> None:
        if self.stop.is_set() or len(self.failed) >= self.max_failures:
            self.not_started.append(run)
            return
        self.say(f"run   {run.label}")
        out_json = run.out.with_name(run.out.name + ".json")
        start = time.time()
        try:
            proc = subprocess.Popen(claude_argv(run, self.harness), cwd=run.work, env=claude_env(run), text=True,
                                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                    start_new_session=True)
        except OSError as e:
            return self.fail(run, f"could not start: {e}")
        with self.lock:
            self.children.add(proc)
        try:
            stdout, stderr = proc.communicate(run.text + "\n", timeout=self.timeout)
        except subprocess.TimeoutExpired:
            kill(proc)
            stdout, stderr = proc.communicate()
            return self.fail(run, f"timeout after {self.timeout}s", stdout, stderr)
        finally:
            with self.lock:
                self.children.discard(proc)
        wall = int(time.time() - start)
        if self.stop.is_set():
            return
        try:
            j = json.loads(stdout)
        except ValueError:
            j = None
        if proc.returncode != 0 or not isinstance(j, dict) or not isinstance(j.get("result"), str) or not j["result"] or j.get("is_error"):
            reason = f"rc={proc.returncode}"
            if isinstance(j, dict) and isinstance(j.get("result"), str):
                reason += f": {j['result'][:200]}"
            elif stderr.strip():
                reason += f": {stderr.strip().splitlines()[-1][:200]}"
            return self.fail(run, reason, stdout, stderr)
        models = sorted((j.get("modelUsage") or {}).keys())
        j["eval"] = {
            "project": run.project["id"], "ref": run.project["ref"],
            "arm": run.arm, "prompt": run.prompt, "wall_s": wall,
            "settings": json.loads(settings_json(run.on, run.style, run.extra_plugin)),
            "caveman_mode": run.mode, "plugin_dir": run.plugin_dir,
            "harness": {"tool": "Claude Code", "version": self.harness["version"],
                        "model": models[0] if models else self.harness["model"], "effort": self.harness["effort"]},
        }
        run.out.with_name(run.out.name + ".md").write_text(to_md(j))
        part = out_json.with_name(out_json.name + ".tmp")
        part.write_text(json.dumps(j, indent=2, ensure_ascii=False) + "\n")
        part.replace(out_json)
        run.out.with_name(run.out.name + ".failed.log").unlink(missing_ok=True)
        with self.lock:
            self.done.append((run, j.get("total_cost_usd") or 0))
        self.say(f"done  {run.label} ({wall}s, ${num(round((j.get('total_cost_usd') or 0) * 100) / 100)})")

    def run_all(self, runs: list) -> bool:
        flag = CavemanFlag()
        start = time.time()
        pool = ThreadPoolExecutor(max_workers=max(1, self.jobs))
        try:
            # Every install happens before the first session starts and every uninstall after the last one ends,
            # so no session reads the plugin registry while it changes.
            ready = [r for r in runs if self.prepare(r)]
            for f in [pool.submit(self.one, r) for r in ready]:
                f.result()
        except KeyboardInterrupt:
            self.stop.set()
            self.say("interrupted: stopping the sessions")
            with self.lock:
                for proc in list(self.children):
                    kill(proc)
            pool.shutdown(wait=True, cancel_futures=True)
            raise
        finally:
            pool.shutdown(wait=True)
            for r in runs:
                self.release(r)
            flag.restore()
        cost = sum(c for _, c in self.done)
        print(f"\n{len(self.done)} done, {len(self.skipped)} skipped, {len(self.failed)} failed, "
              f"{len(self.not_started)} not started; {int(time.time() - start)}s wall, ${num(round(cost * 100) / 100)}")
        for run, reason in self.failed:
            print(f"  failed       {run.label}: {reason}")
        for run in self.not_started:
            print(f"  not started  {run.label} (after {self.max_failures} failures)")
        return not self.failed and not self.not_started


def kill(proc: subprocess.Popen) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def journal() -> list:
    return json.loads(JOURNAL.read_text()) if JOURNAL.exists() else []


def journal_add(work: Path, plugin: str) -> None:
    """Records a copy that holds a project-scope install, so `cleanup` finds it after a hard kill."""
    JOURNAL.write_text(json.dumps(journal() + [[str(work), plugin]]))


def journal_remove(work: Path) -> None:
    left = [e for e in journal() if e[0] != str(work)]
    if left:
        JOURNAL.write_text(json.dumps(left))
    else:
        JOURNAL.unlink(missing_ok=True)


def interrupt(signum, frame):
    """SIGTERM stops the set the same way Ctrl-C does, so no session outlives the runner."""
    raise KeyboardInterrupt


class CavemanFlag:
    """Caveman sessions write the machine-wide ~/.claude/.caveman-active. This puts it back as it was."""

    def __init__(self):
        self.path = Path.home() / ".claude" / ".caveman-active"
        self.before = self.path.read_bytes() if self.path.is_file() else None

    def restore(self) -> None:
        if self.before is None:
            self.path.unlink(missing_ok=True)
        elif not self.path.is_file() or self.path.read_bytes() != self.before:
            self.path.write_bytes(self.before)


def arm_runs(project: dict, prompts: list, only: list | None = None) -> list:
    names = [a[0] for a in ARMS]
    for name in only or []:
        if name not in names:
            sys.exit(f"unknown arm: {name} (has: {', '.join(names)})")
    return [Run(project, pid, text, name, on, style, mode, family)
            for name, on, style, mode, family in ARMS if not only or name in only for pid, text in prompts]


def harness_of(db: dict) -> dict:
    h = db["harness_default"]
    return {"model": h["model"], "effort": h["effort"], "version": cc_version()}


def runner(args, db: dict, project: dict) -> Runner:
    return Runner(checkout(project, args.repo), harness_of(db), args.jobs, args.timeout, args.max_failures)


def setup(args, db, project) -> bool:
    checkout(project, args.repo)
    for m in MARKETPLACES:
        subprocess.run(["claude", "plugin", "marketplace", "add", m])
    return True


def cleanup(args, db, project) -> bool:
    """A run uninstalls its own plugin. This handles the copies of a runner that was killed before it could."""
    for work, plugin in journal():
        print(f"cleanup {plugin} in {work}")
        Path(work).mkdir(parents=True, exist_ok=True)
        subprocess.run(["claude", "plugin", "uninstall", plugin, "-s", "project"], cwd=work)
        shutil.rmtree(Path(work).parent, ignore_errors=True)
        journal_remove(Path(work))
    return True


def probe(args, db, project) -> bool:
    runs = arm_runs(project, [(PROBE, PROBE_TEXT)], args.arm)
    ok = runner(args, db, project).run_all(runs)
    for r in runs:
        f = r.out.with_name(r.out.name + ".json")
        first = " ".join(json.loads(f.read_text())["result"].splitlines()[:3]) if f.exists() else "(no answer)"
        print(f"{r.arm:<14} {first}")
    return ok


def run_set(args, db, project) -> bool:
    return runner(args, db, project).run_all(arm_runs(project, prompts_of(project, args.prompt), args.arm))


def table(args, db, project) -> bool:
    """One table per prompt that has recorded runs."""
    for pid, _ in prompts_of(project, args.prompt):
        rows = []
        for r in arm_runs(project, [(pid, "")], args.arm):
            f = r.out.with_name(r.out.name + ".json")
            if not f.exists():
                continue
            j = json.loads(f.read_text())
            rows.append(f"| {r.arm} | {words(j['result'])} | {(j.get('usage') or {}).get('output_tokens', 0)} "
                        f"| {num(round((j.get('total_cost_usd') or 0) * 100) / 100)} | {j['eval']['wall_s']} | {j.get('num_turns')} |")
        if rows:
            print(f"### {pid}\n")
            print("| arm | words | output tokens | cost USD | wall s | turns |")
            print("|---|---:|---:|---:|---:|---:|")
            print("\n".join(rows) + "\n")
    return True


def everything(args, db, project) -> bool:
    try:
        setup(args, db, project)
        ok = probe(args, db, project)
        ok = run_set(args, db, project) and ok
        table(args, db, project)
        return ok
    finally:
        cleanup(args, db, project)


def style_plugin(style_file: Path) -> tuple:
    """Wraps a bare style file in a throwaway plugin, so it loads without touching ~/.claude."""
    if not style_file.is_file():
        sys.exit(f"no such file: {style_file}")
    tmp = Path(tempfile.mkdtemp(prefix="custom-style."))
    (tmp / ".claude-plugin").mkdir()
    (tmp / "output-styles").mkdir()
    (tmp / ".claude-plugin" / "plugin.json").write_text(
        '{"name":"custom-style","description":"ad-hoc output style","version":"0.0.0"}\n')
    shutil.copy(style_file, tmp / "output-styles")
    name = ""
    for line in style_file.read_text().splitlines():
        if line.startswith("name:"):
            name = line[len("name:"):].strip()
            break
    style = f"custom-style:{name or style_file.stem}"
    print(f"style file wrapped as plugin {tmp}, outputStyle={style}")
    return str(tmp), style


def arm(args, db, project) -> bool:
    style, plugin_dir = args.style, args.plugin_dir
    if args.style_file:
        plugin_dir, style = style_plugin(Path(args.style_file).expanduser())
    runs = [Run(project, pid, text, args.name, "-", style, "", args.folder or args.name,
                args.plugin, plugin_dir, args.env)
            for pid, text in prompts_of(project, args.prompt)]
    return runner(args, db, project).run_all(runs)


def main(argv=None) -> int:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--project", default=DEFAULT_PROJECT, help="project id in projects.json (default: %(default)s)")
    common.add_argument("--repo", help="clone the project from this path or URL instead of its repo in projects.json")
    common.add_argument("--jobs", type=int, default=10, help="sessions that run at the same time (default: %(default)s)")
    common.add_argument("--timeout", type=int, default=3600, help="seconds before one session is killed (default: %(default)s)")
    common.add_argument("--max-failures", type=int, default=3, help="failed runs after which no new run starts (default: %(default)s)")
    common.add_argument("--prompt", action="append", help="only this prompt id (repeatable; default: all of the project's)")

    common.add_argument("--arm", action="append", help="only this arm of the built-in table (repeatable; default: all)")

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    commands = {"setup": setup, "probe": probe, "run": run_set, "table": table, "cleanup": cleanup, "all": everything, "arm": arm}
    for name in commands:
        p = sub.add_parser(name, parents=[common])
        if name == "arm":
            p.add_argument("name", help="arm id, also the file name of its outputs")
            p.add_argument("--style", default="", help="outputStyle value")
            p.add_argument("--style-file", help="a bare output style .md file")
            p.add_argument("--plugin-dir", default="", help="a plugin folder to load")
            p.add_argument("--plugin", default="", help="an installed plugin id@marketplace to enable")
            p.add_argument("--env", action="append", default=[], metavar="K=V", help="extra environment for the session (repeatable)")
            p.add_argument("--folder", help="outputs family folder (default: the arm name)")
    args = parser.parse_args(argv)
    db = load_projects()
    signal.signal(signal.SIGTERM, interrupt)
    try:
        return 0 if commands[args.cmd](args, db, find_project(db, args.project)) else 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
