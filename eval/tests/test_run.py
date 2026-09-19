"""Tests for ../run.py. No test starts a real `claude`: PATH holds a stub that logs its call.

Run from eval/:  python3 -m unittest discover -s tests -v
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from collections import Counter
from pathlib import Path

EVAL = Path(__file__).resolve().parent.parent
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "claude_calls.jsonl"
PROJECT = "herdr-pr-emoji"

STUB = r'''#!%s
import json, os, sys, time
if sys.argv[1:] == ["--version"]:
    print("9.9.9 (Claude Code)"); sys.exit(0)
if sys.argv[1] == "plugin":
    with open(os.environ["STUB_LOG"] + ".plugin", "a") as f:
        f.write(json.dumps({"argv": sys.argv[2:], "cwd": os.getcwd(), "time": time.time()}) + "\n")
    sys.exit(1 if sys.argv[3] in os.environ.get("STUB_PLUGIN_FAIL", "").split(",") else 0)
name = sys.argv[sys.argv.index("--name") + 1]
seen = sorted(os.listdir("."))
open("side-effect-" + name, "w").close()
if os.environ.get("CAVEMAN_DEFAULT_MODE"):
    open(os.path.expanduser("~/.claude/.caveman-active"), "w").write(os.environ["CAVEMAN_DEFAULT_MODE"])
start = time.time()
stdin = sys.stdin.read()
if name in os.environ.get("STUB_SLEEP_NAMES", name).split(","):
    time.sleep(float(os.environ.get("STUB_SLEEP", "0")))
keys = ("CAVEMAN_DEFAULT_MODE", "SOME_MODE", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_EFFORT")
rec = {"argv": sys.argv[1:], "stdin": stdin, "env": {k: os.environ.get(k) for k in keys},
       "cwd": os.getcwd(), "seen": seen, "start": start, "end": time.time(), "all_env": dict(os.environ)}
gh_dir = os.environ.get("GH_CONFIG_DIR")
rec["gh_dir_listing"] = sorted(os.listdir(gh_dir)) if gh_dir and os.path.isdir(gh_dir) else None
if os.environ.get("STUB_GUARDS"):
    import subprocess
    def sh(*cmd):
        r = subprocess.run(cmd, capture_output=True, text=True)
        return [r.returncode, r.stdout + r.stderr]
    rec["pushes"] = [sh("git", "push", "--dry-run", *target, "HEAD:refs/heads/x") for target in (
        ["origin"], ["https://github.com/example/example"], ["git@github.com:example/example.git"],
        ["ssh://git@github.com/example/example.git"])]
    if os.environ.get("STUB_GH"):
        rec["gh_token"] = sh(os.environ["STUB_GH"], "auth", "token")
with open(os.environ["STUB_LOG"], "a") as f:
    f.write(json.dumps(rec) + "\n")
fail = os.environ.get("STUB_FAIL", "").split(",")
if name in fail or "all" in fail:
    print(json.dumps({"result": "Credit balance is too low", "is_error": True})); sys.exit(1)
if name in os.environ.get("STUB_IS_ERROR", "").split(","):
    print(json.dumps({"result": "API Error: 529 overloaded", "is_error": True})); sys.exit(0)
print(json.dumps({"result": "stub answer one two", "num_turns": 1, "total_cost_usd": 0.25, "duration_api_ms": 1500,
                  "usage": {"output_tokens": 3}, "modelUsage": {"stub-model": {}}}))
'''


def real_gh():
    """The gh binary itself: a version-manager shim stops working when the test changes HOME."""
    paths = os.pathsep.join(p for p in os.environ.get("PATH", "").split(os.pathsep) if "shims" not in p)
    return shutil.which("gh", path=paths)


def fixture_calls():
    return [json.loads(line) for line in FIXTURE.read_text().splitlines()]


def key(call):
    """What one claude call is made of: argv, stdin and the environment that matters."""
    return json.dumps([call["argv"], call["stdin"], call["env"]], sort_keys=True)


class RunnerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="eval-test-")).resolve()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.home = self.tmp / "home"
        (self.home / ".claude").mkdir(parents=True)
        self.eval = self.tmp / "eval"
        self.eval.mkdir()
        shutil.copy(EVAL / "run.py", self.eval)
        bin_dir = self.tmp / "bin"
        bin_dir.mkdir()
        stub = bin_dir / "claude"
        stub.write_text(STUB % sys.executable)
        stub.chmod(0o755)
        self.log = self.tmp / "calls.jsonl"
        self.env = {"PATH": f"{bin_dir}:/usr/bin:/bin", "HOME": str(self.home), "STUB_LOG": str(self.log),
                    "TMPDIR": str(self.tmp / "tmp"), "CLAUDECODE": "1", "CLAUDE_EFFORT": "low",
                    "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
                    "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
                    "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}
        (self.tmp / "tmp").mkdir()

        src = self.tmp / "src"
        src.mkdir()
        (src / "README.md").write_text("hello\n")
        for cmd in (["init", "-q"], ["add", "."], ["commit", "-q", "-m", "init"]):
            subprocess.run(["git", "-C", str(src), *cmd], check=True, env=self.env)
        sha = subprocess.run(["git", "-C", str(src), "rev-parse", "HEAD"], check=True, env=self.env,
                             capture_output=True, text=True).stdout.strip()
        self.ref = sha[:7]

        db = json.loads((EVAL / "projects.json").read_text())
        project = next(p for p in db["projects"] if p["id"] == PROJECT)
        project.update(repo=str(src), ref=self.ref,
                       prompts=[p for p in project["prompts"] if p["id"] in ("review", "short")])
        db["projects"] = [project]
        (self.eval / "projects.json").write_text(json.dumps(db))
        self.out = self.eval / "outputs" / PROJECT

    def run_py(self, *args, **env):
        return subprocess.run([sys.executable, str(self.eval / "run.py"), *args], env={**self.env, **env},
                              capture_output=True, text=True)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def plugin_calls(self):
        log = Path(str(self.log) + ".plugin")
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def outputs(self, suffix=".json"):
        return sorted(str(p.relative_to(self.out)) for p in self.out.rglob(f"*{suffix}"))

    def test_run_writes_project_prompt_family_arm(self):
        r = self.run_py("run")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        expected = sorted(f"{prompt}/{family}/{arm}.json" for prompt in ("review", "short") for family, arm in [
            ("built-in", "default"), ("built-in", "concise"), ("built-in", "proactive"), ("built-in", "explanatory"),
            ("built-in", "learning"), ("ste-concise", "ste-concise"), ("caveman", "caveman-lite"),
            ("caveman", "caveman-full"), ("caveman", "caveman-ultra"), ("i-have-adhd", "i-have-adhd")])
        self.assertEqual(self.outputs(), expected)
        self.assertEqual(self.outputs(".md"), [p.replace(".json", ".md") for p in expected])
        self.assertIn("20 done, 0 skipped, 0 failed", r.stdout)

    def test_claude_calls_match_the_recorded_ones(self):
        self.run_py("run")
        self.run_py("probe")
        self.run_py("arm", "my-plugin", "--plugin-dir", "/tmp/some-plugin", "--style", "my-plugin:My Style",
                    "--env", "SOME_MODE=full", "--plugin", "other@market", "--prompt", "short")
        got = Counter(key(c) for c in self.calls())
        want = Counter(key(c) for c in fixture_calls())
        self.assertEqual(want - got, Counter(), "a recorded call was not reproduced")
        extra = [json.loads(k)[0][-1] for k in (got - want)]
        self.assertTrue(all(name.endswith("-probe") for name in extra), extra)

    def test_json_and_md_describe_the_run(self):
        self.run_py("run", "--prompt", "short")
        j = json.loads((self.out / "short" / "caveman" / "caveman-ultra.json").read_text())
        self.assertEqual(j["result"], "stub answer one two")
        self.assertEqual(j["eval"]["project"], PROJECT)
        self.assertEqual(j["eval"]["ref"], self.ref)
        self.assertEqual(j["eval"]["arm"], "caveman-ultra")
        self.assertEqual(j["eval"]["prompt"], "short")
        self.assertEqual(j["eval"]["caveman_mode"], "ultra")
        self.assertEqual(j["eval"]["settings"]["enabledPlugins"]["caveman@caveman"], True)
        self.assertEqual(j["eval"]["harness"], {"tool": "Claude Code", "version": "9.9.9", "model": "stub-model", "effort": "xhigh"})
        md = (self.out / "short" / "caveman" / "caveman-ultra.md").read_text()
        self.assertTrue(md.startswith("# caveman-ultra / short\n"))
        self.assertIn("harness: Claude Code 9.9.9  model: `stub-model`  effort: xhigh", md)
        self.assertIn("cost: $0.25  output tokens: 3  words: 4", md)
        self.assertTrue(md.endswith("---\n\nstub answer one two"))

    def test_existing_json_is_skipped(self):
        self.run_py("run", "--prompt", "short")
        before = len(self.calls())
        r = self.run_py("run", "--prompt", "short")
        self.assertEqual(len(self.calls()), before)
        self.assertIn("skip  herdr-pr-emoji/short/default (exists)", r.stdout)
        self.assertIn("0 done, 10 skipped, 0 failed", r.stdout)

    def test_arm_goes_to_its_own_folder_or_to_a_family(self):
        self.run_py("arm", "my-style", "--style", "X", "--prompt", "short")
        self.run_py("arm", "caveman-other", "--env", "CAVEMAN_DEFAULT_MODE=other", "--folder", "caveman", "--prompt", "short")
        self.assertEqual(self.outputs(), ["short/caveman/caveman-other.json", "short/my-style/my-style.json"])
        self.assertEqual(self.calls()[1]["env"]["CAVEMAN_DEFAULT_MODE"], "other")

    def test_arm_runs_every_prompt_of_the_project_by_default(self):
        self.run_py("arm", "my-style", "--style", "X")
        self.assertEqual(self.outputs(), ["review/my-style/my-style.json", "short/my-style/my-style.json"])

    def test_arm_wraps_a_style_file_in_a_plugin(self):
        style = self.tmp / "mine.md"
        style.write_text("---\nname: My Style\n---\nBe brief.\n")
        r = self.run_py("arm", "my-style", "--style-file", str(style), "--prompt", "short")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        argv = self.calls()[0]["argv"]
        plugin_dir = Path(argv[argv.index("--plugin-dir") + 1])
        self.assertEqual(json.loads(argv[argv.index("--settings") + 1])["outputStyle"], "custom-style:My Style")
        self.assertEqual((plugin_dir / "output-styles" / "mine.md").read_text(), style.read_text())
        self.assertEqual(json.loads((plugin_dir / ".claude-plugin" / "plugin.json").read_text())["name"], "custom-style")

    def test_arm_option_selects_arms_of_the_table(self):
        self.run_py("run", "--prompt", "short", "--arm", "concise", "--arm", "caveman-full")
        self.assertEqual(self.outputs(), ["short/built-in/concise.json", "short/caveman/caveman-full.json"])

    def test_unknown_project_and_prompt_are_refused_before_any_call(self):
        self.assertNotEqual(self.run_py("run", "--project", "nope").returncode, 0)
        self.assertNotEqual(self.run_py("run", "--arm", "nope").returncode, 0)
        self.assertNotEqual(self.run_py("run", "--prompt", "nope").returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_runs_are_parallel_and_each_has_its_own_copy(self):
        start = time.time()
        r = self.run_py("run", "--jobs", "20", STUB_SLEEP="1.5")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertLess(time.time() - start, 15, "20 runs of 1.5 s each did not overlap")
        calls = self.calls()
        self.assertEqual(len({c["cwd"] for c in calls}), 20)
        latest_start, earliest_end = max(c["start"] for c in calls), min(c["end"] for c in calls)
        self.assertLess(latest_start, earliest_end, "all 20 sessions were alive at the same time")
        cache = self.eval / ".cache" / f"{PROJECT}@{self.ref}"
        for c in calls:
            self.assertEqual(Path(c["cwd"]).name, PROJECT)
            self.assertNotIn(str(self.eval), c["cwd"])
            self.assertEqual(c["seen"], [".git", "README.md"], "a session saw another session's files")
            self.assertFalse(Path(c["cwd"]).exists(), "the copy is removed after the run")
        self.assertEqual(sorted(p.name for p in cache.iterdir()), [".git", "README.md"])

    def test_each_plugin_arm_installs_its_plugin_in_its_own_copy_only(self):
        self.run_py("run", "--prompt", "short")
        cwd = {c["argv"][-1]: c["cwd"] for c in self.calls()}
        installs = {(c["argv"][1], c["cwd"]) for c in self.plugin_calls() if c["argv"][0] == "install"}
        self.assertEqual(installs, {
            ("agents-output-styles@bonkey", cwd["bakeoff-ste-concise-short"]),
            ("caveman@caveman", cwd["bakeoff-caveman-lite-short"]),
            ("caveman@caveman", cwd["bakeoff-caveman-full-short"]),
            ("caveman@caveman", cwd["bakeoff-caveman-ultra-short"]),
            ("i-have-adhd@i-have-adhd", cwd["bakeoff-i-have-adhd-short"])})
        self.assertTrue(all(c["argv"][2:] == ["-s", "project"] for c in self.plugin_calls()))
        uninstalls = {(c["argv"][1], c["cwd"]) for c in self.plugin_calls() if c["argv"][0] == "uninstall"}
        self.assertEqual(uninstalls, installs)

    def test_the_plugin_registry_changes_only_while_no_session_runs(self):
        self.run_py("run", "--prompt", "short", "--jobs", "3", STUB_SLEEP="0.2")
        first, last = min(c["start"] for c in self.calls()), max(c["end"] for c in self.calls())
        for c in self.plugin_calls():
            self.assertTrue(c["time"] < first if c["argv"][0] == "install" else c["time"] > last, c)

    def test_a_failed_install_fails_the_run_without_a_session(self):
        r = self.run_py("run", "--prompt", "short", STUB_PLUGIN_FAIL="i-have-adhd@i-have-adhd")
        self.assertEqual(r.returncode, 1)
        self.assertIn("herdr-pr-emoji/short/i-have-adhd: could not install i-have-adhd@i-have-adhd", r.stdout)
        self.assertNotIn("bakeoff-i-have-adhd-short", [c["argv"][-1] for c in self.calls()])
        self.assertEqual(len(self.outputs()), 9)

    def test_cleanup_uninstalls_what_a_killed_runner_left(self):
        proc = subprocess.Popen([sys.executable, str(self.eval / "run.py"), "run", "--prompt", "short"],
                                env={**self.env, "STUB_SLEEP": "30"}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.time() + 20
        while time.time() < deadline and len(list((self.tmp / "tmp").glob("tmp*/*/side-effect-*"))) < 10:
            time.sleep(0.1)
        proc.kill()
        proc.wait()
        subprocess.run(["pkill", "-f", str(self.tmp / "bin" / "claude")])
        left = json.loads((self.eval / ".cache" / "installed.json").read_text())
        self.assertEqual(len(left), 5)
        shutil.rmtree(Path(left[0][0]).parent)

        r = self.run_py("cleanup")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        uninstalls = [[c["cwd"], c["argv"][1]] for c in self.plugin_calls() if c["argv"][0] == "uninstall"]
        self.assertEqual(sorted(uninstalls), sorted(left))
        self.assertFalse((self.eval / ".cache" / "installed.json").exists())
        self.assertEqual(list((self.tmp / "tmp").glob("tmp*")), [p for p in (self.tmp / "tmp").glob("tmp*") if not any(p == Path(w).parent for w, _ in left)])

    def test_setup_registers_the_marketplaces(self):
        self.run_py("setup")
        self.assertEqual([c["argv"] for c in self.plugin_calls()], [
            ["marketplace", "add", "bonkey/agents-output-styles"], ["marketplace", "add", "JuliusBrussee/caveman"],
            ["marketplace", "add", "ayghri/i-have-adhd"]])

    TOKENS = ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN",
              "HOMEBREW_GITHUB_API_TOKEN", "_GITHUB_ACCESS_TOKEN"]

    def test_a_session_has_no_github_credentials(self):
        self.run_py("run", "--prompt", "short", "--arm", "default", "--arm", "concise", **{t: "secret" for t in self.TOKENS})
        calls = self.calls()
        for c in calls:
            self.assertEqual([t for t in self.TOKENS if t in c["all_env"]], [])
            self.assertEqual(c["gh_dir_listing"], [], "GH_CONFIG_DIR is an empty directory")
            self.assertNotIn(str(self.eval), c["all_env"]["GH_CONFIG_DIR"])
            self.assertFalse(c["all_env"]["GH_CONFIG_DIR"].startswith(c["cwd"]))
            self.assertFalse(Path(c["all_env"]["GH_CONFIG_DIR"]).exists(), "removed after the run")
        self.assertEqual(len({c["all_env"]["GH_CONFIG_DIR"] for c in calls}), 2)

    @unittest.skipUnless(real_gh(), "needs the gh CLI")
    def test_gh_is_logged_out_inside_a_session(self):
        hosts = self.home / ".config" / "gh" / "hosts.yml"
        hosts.parent.mkdir(parents=True)
        hosts.write_text("github.com:\n    oauth_token: fake-token\n    user: someone\n")
        gh = real_gh()
        logged_in = subprocess.run([gh, "auth", "token"], env=self.env, capture_output=True, text=True)
        self.assertEqual(logged_in.stdout.strip(), "fake-token", "the machine outside a session is logged in")
        self.run_py("run", "--prompt", "short", "--arm", "default", STUB_GUARDS="1", STUB_GH=gh)
        rc, output = self.calls()[0]["gh_token"]
        self.assertNotEqual(rc, 0)
        self.assertNotIn("fake-token", output)

    def test_git_push_from_a_copy_fails_locally(self):
        self.run_py("run", "--prompt", "short", "--arm", "default", STUB_GUARDS="1")
        for rc, output in self.calls()[0]["pushes"]:
            self.assertNotEqual(rc, 0, output)
            self.assertIn("no-push", output)

    def test_the_session_environment_differs_only_by_the_documented_guards(self):
        self.run_py("run", "--prompt", "short", "--arm", "caveman-full", GH_TOKEN="secret", KEEP_ME="1")
        got = self.calls()[0]["all_env"]
        parent = {**self.env, "GH_TOKEN": "secret", "KEEP_ME": "1"}
        added = {k for k in got if k not in parent} - {"PWD", "OLDPWD", "SHLVL", "_", "__CF_USER_TEXT_ENCODING", "LC_CTYPE"}
        git_guard = {"GIT_CONFIG_COUNT"} | {f"GIT_CONFIG_{kind}_{i}" for kind in ("KEY", "VALUE") for i in range(int(got["GIT_CONFIG_COUNT"]))}
        self.assertEqual(added, {"CAVEMAN_DEFAULT_MODE", "GH_CONFIG_DIR"} | git_guard)
        self.assertEqual({k for k in parent if k not in got}, {"CLAUDECODE", "CLAUDE_EFFORT", "GH_TOKEN"})
        self.assertEqual({k for k in parent if k in got and got[k] != parent[k]}, set())

    def test_jobs_limits_concurrency(self):
        self.run_py("run", "--prompt", "short", "--jobs", "1", STUB_SLEEP="0.2")
        spans = sorted((c["start"], c["end"]) for c in self.calls())
        for (_, end), (start, _) in zip(spans, spans[1:]):
            self.assertLessEqual(end, start)

    def test_a_failed_run_leaves_no_json_and_the_rest_continues(self):
        r = self.run_py("run", "--prompt", "short", STUB_FAIL="bakeoff-concise-short")
        self.assertEqual(r.returncode, 1)
        self.assertEqual(len(self.outputs()), 9)
        self.assertFalse((self.out / "short" / "built-in" / "concise.json").exists())
        self.assertIn("9 done, 0 skipped, 1 failed", r.stdout)
        self.assertIn("failed       herdr-pr-emoji/short/concise: rc=1: Credit balance is too low", r.stdout)
        self.assertIn("Credit balance", (self.out / "short" / "built-in" / "concise.failed.log").read_text())

        r = self.run_py("run", "--prompt", "short")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("1 done, 9 skipped, 0 failed", r.stdout)
        self.assertFalse((self.out / "short" / "built-in" / "concise.failed.log").exists())

    def test_an_error_result_with_exit_code_zero_is_a_failure(self):
        r = self.run_py("run", "--prompt", "short", STUB_IS_ERROR="bakeoff-default-short")
        self.assertEqual(r.returncode, 1)
        self.assertFalse((self.out / "short" / "built-in" / "default.json").exists())
        self.assertIn("API Error: 529", r.stdout)

    def test_no_new_run_starts_after_max_failures(self):
        r = self.run_py("run", "--jobs", "1", "--max-failures", "2", STUB_FAIL="all")
        self.assertEqual(r.returncode, 1)
        self.assertEqual(len(self.calls()), 2)
        self.assertIn("0 done, 0 skipped, 2 failed, 18 not started", r.stdout)

    def test_a_session_over_the_timeout_is_killed(self):
        start = time.time()
        r = self.run_py("run", "--prompt", "short", "--timeout", "1", STUB_SLEEP="30", STUB_SLEEP_NAMES="bakeoff-learning-short")
        self.assertLess(time.time() - start, 20)
        self.assertEqual(r.returncode, 1)
        self.assertIn("herdr-pr-emoji/short/learning: timeout after 1s", r.stdout)
        self.assertEqual(len(self.outputs()), 9)

    def test_sigterm_kills_the_sessions(self):
        proc = subprocess.Popen([sys.executable, str(self.eval / "run.py"), "run", "--prompt", "short"],
                                env={**self.env, "STUB_SLEEP": "30"}, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        deadline = time.time() + 20
        while time.time() < deadline and len(list((self.tmp / "tmp").glob("tmp*/*/side-effect-*"))) < 10:
            time.sleep(0.1)
        proc.terminate()
        proc.communicate(timeout=20)
        self.assertEqual(proc.returncode, 130)
        ps = subprocess.run(["ps", "-axo", "command"], capture_output=True, text=True).stdout
        self.assertNotIn(str(self.tmp / "bin" / "claude"), ps)
        self.assertEqual(self.outputs(), [])

    def test_the_machine_wide_caveman_flag_is_put_back(self):
        flag = self.home / ".claude" / ".caveman-active"
        flag.write_text("full")
        self.run_py("run", "--prompt", "short")
        self.assertEqual(flag.read_text(), "full")

    def test_table_lists_the_arms_per_prompt(self):
        self.run_py("run", "--prompt", "short")
        r = self.run_py("table")
        self.assertIn("### short\n\n| arm | words | output tokens | cost USD | wall s | turns |", r.stdout)
        self.assertIn("| caveman-ultra | 4 | 3 | 0.25 | 0 | 1 |", r.stdout)
        self.assertEqual(r.stdout.count("\n| "), 1 + 10)
        self.assertNotIn("### review", r.stdout)

    def test_probe_asks_every_arm_and_keeps_out_of_the_prompts(self):
        r = self.run_py("probe")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(len(self.outputs()), 10)
        self.assertTrue(all(p.startswith("probe/") for p in self.outputs()))
        self.assertIn("i-have-adhd    stub answer one two", r.stdout)


if __name__ == "__main__":
    unittest.main()
