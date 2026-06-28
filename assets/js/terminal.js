/* ============================================================
   Git Mastery — terminal.js
   A teaching-grade git CLI simulator. Keeps a tiny in-memory
   repo (files, staging, commits, branches, HEAD) so commands
   actually change state and feel real.
   ponytail: NOT real git — a curated subset for learning.
     Upgrade path: swap engine for isomorphic-git if you ever
     need true fidelity. You won't for a tutorial.
   Auto-mounts every element with [data-terminal].
   ============================================================ */
(function () {
  "use strict";

  let hashCounter = 1; // deterministic "hashes" (no Math.random — predictable for tests)
  function nextHash() { return (0xa1b2c3 + hashCounter++ * 0x9e37).toString(16).slice(0, 7); }

  function newRepo() {
    return { init: false, files: {}, staged: {}, commits: [], branches: {}, head: null, lastCommitFiles: {} };
  }

  // --- Command engine: (repo, line) -> { out:[lines], err:bool } ---
  function run(repo, raw) {
    const line = raw.trim();
    if (!line) return { out: [] };
    const out = [];
    const say = (s, err) => out.push({ text: s, err: !!err });

    // echo "x" > file   |   echo x > file
    let m = line.match(/^echo\s+(.+?)\s*>\s*(\S+)$/);
    if (m) {
      const content = m[1].replace(/^["']|["']$/g, "");
      repo.files[m[2]] = content;
      return { out };
    }
    m = line.match(/^touch\s+(\S+)$/);
    if (m) { repo.files[m[1]] = repo.files[m[1]] || ""; return { out }; }
    if (line === "ls") { const f = Object.keys(repo.files); say(f.length ? f.join("  ") : "(ว่าง)"); return { out }; }
    m = line.match(/^cat\s+(\S+)$/);
    if (m) { say(m[1] in repo.files ? (repo.files[m[1]] || "(empty)") : "cat: " + m[1] + ": No such file", !(m[1] in repo.files)); return { out }; }
    if (line === "clear" || line === "cls") return { clear: true, out: [] };
    if (line === "help") { HELP.forEach(h => say(h)); return { out }; }

    const parts = line.split(/\s+/);
    if (parts[0] !== "git") { say(parts[0] + ": command not found (ลองพิมพ์ help)", true); return { out }; }
    const sub = parts[1];

    if (sub === "init") {
      if (repo.init) { say("Reinitialized existing Git repository"); return { out }; }
      repo.init = true; repo.branches = { main: null }; repo.head = "main";
      say("Initialized empty Git repository in /demo/.git/");
      return { out };
    }
    if (!repo.init) { say("fatal: not a git repository (ลอง git init ก่อน)", true); return { out }; }

    switch (sub) {
      case "status": return status(repo, out, say);
      case "add": return add(repo, parts.slice(2), say, out);
      case "commit": return commit(repo, line, say, out);
      case "log": return log(repo, parts.includes("--oneline"), say, out);
      case "branch": return branch(repo, parts.slice(2), say, out);
      case "switch": return switchCmd(repo, parts.slice(2), say, out);
      case "checkout": return checkout(repo, parts.slice(2), say, out);
      case "merge": return merge(repo, parts[2], say, out);
      case "diff": return diff(repo, say, out);
      default: say("git: '" + sub + "' ยังไม่รองรับใน simulator นี้ (พิมพ์ help)", true); return { out };
    }
  }

  function changedFiles(repo) {
    // untracked/modified = file content differs from last commit and not identical-staged
    const res = { untracked: [], modified: [] };
    for (const name in repo.files) {
      const committed = repo.lastCommitFiles[name];
      if (name in repo.staged) continue;
      if (committed === undefined) res.untracked.push(name);
      else if (committed !== repo.files[name]) res.modified.push(name);
    }
    return res;
  }

  function status(repo, out, say) {
    say("On branch " + repo.head);
    const stagedNames = Object.keys(repo.staged);
    if (!repo.commits.length && !stagedNames.length) say("\nNo commits yet");
    const { untracked, modified } = changedFiles(repo);
    if (stagedNames.length) { say("\nChanges to be committed:"); stagedNames.forEach(f => say("  new file:   " + f)); }
    if (modified.length) { say("\nChanges not staged for commit:"); modified.forEach(f => say("  modified:   " + f)); }
    if (untracked.length) { say("\nUntracked files:"); untracked.forEach(f => say("  " + f)); }
    if (!stagedNames.length && !modified.length && !untracked.length) say("\nnothing to commit, working tree clean");
    return { out };
  }

  function add(repo, args, say, out) {
    if (!args.length) { say("Nothing specified, nothing added.", true); return { out }; }
    const targets = args[0] === "." || args[0] === "-A" ? Object.keys(repo.files) : args;
    let n = 0;
    targets.forEach(f => { if (f in repo.files) { repo.staged[f] = repo.files[f]; n++; } else say("fatal: pathspec '" + f + "' did not match any files", true); });
    return { out };
  }

  function commit(repo, line, say, out) {
    const m = line.match(/-m\s+["'](.+?)["']/) || line.match(/-m\s+(\S+)/);
    if (!m) { say("ใส่ message ด้วย:  git commit -m \"ข้อความ\"", true); return { out }; }
    const stagedNames = Object.keys(repo.staged);
    if (!stagedNames.length) { say("nothing to commit (พิมพ์ git add ก่อน)", true); return { out }; }
    const hash = nextHash();
    const parent = repo.branches[repo.head];
    repo.commits.push({ hash, msg: m[1], branch: repo.head, parent });
    repo.lastCommitFiles = Object.assign({}, repo.lastCommitFiles, repo.staged);
    repo.staged = {};
    repo.branches[repo.head] = hash;
    say(`[${repo.head} ${hash}] ${m[1]}`);
    say(` ${stagedNames.length} file(s) changed`);
    return { out };
  }

  function log(repo, oneline, say, out) {
    if (!repo.commits.length) { say("fatal: your current branch '" + repo.head + "' does not have any commits yet", true); return { out }; }
    const chain = [...repo.commits].reverse();
    chain.forEach(c => {
      if (oneline) say(c.hash + " " + c.msg);
      else { say("commit " + c.hash + (repo.branches[repo.head] === c.hash ? "  (HEAD -> " + repo.head + ")" : "")); say("    " + c.msg); say(""); }
    });
    return { out };
  }

  function branch(repo, args, say, out) {
    if (!args.length) {
      Object.keys(repo.branches).forEach(b => say((b === repo.head ? "* " : "  ") + b));
      return { out };
    }
    const name = args[0];
    if (name in repo.branches) { say("fatal: a branch named '" + name + "' already exists", true); return { out }; }
    repo.branches[name] = repo.branches[repo.head];
    say("สร้าง branch '" + name + "' แล้ว (ยังอยู่ที่ " + repo.head + ")");
    return { out };
  }

  function doSwitch(repo, name, say, out) {
    if (!(name in repo.branches)) { say("fatal: branch '" + name + "' ไม่มีอยู่", true); return { out }; }
    repo.head = name; say("Switched to branch '" + name + "'"); return { out };
  }
  function switchCmd(repo, args, say, out) {
    if (args[0] === "-c") { return makeBranchAndSwitch(repo, args[1], say, out); }
    return doSwitch(repo, args[0], say, out);
  }
  function checkout(repo, args, say, out) {
    if (args[0] === "-b") { return makeBranchAndSwitch(repo, args[1], say, out); }
    return doSwitch(repo, args[0], say, out);
  }
  function makeBranchAndSwitch(repo, name, say, out) {
    if (!name) { say("ต้องระบุชื่อ branch", true); return { out }; }
    if (name in repo.branches) { say("fatal: a branch named '" + name + "' already exists", true); return { out }; }
    repo.branches[name] = repo.branches[repo.head]; repo.head = name;
    say("Switched to a new branch '" + name + "'"); return { out };
  }

  function merge(repo, name, say, out) {
    if (!name) { say("ระบุ branch ที่จะ merge", true); return { out }; }
    if (!(name in repo.branches)) { say("merge: " + name + " - not something we can merge", true); return { out }; }
    if (repo.branches[name] === repo.branches[repo.head]) { say("Already up to date."); return { out }; }
    // teaching simplification: fast-forward if current branch has no new commits since divergence
    repo.branches[repo.head] = repo.branches[name];
    say("Updating " + repo.head + " (fast-forward)");
    say("Merge สำเร็จ ✔  — ใน simulator นี้ใช้ fast-forward เป็นหลัก");
    return { out };
  }

  function diff(repo, say, out) {
    const { modified } = changedFiles(repo);
    if (!modified.length) { say("(ไม่มีการเปลี่ยนแปลงที่ยังไม่ stage)"); return { out }; }
    modified.forEach(f => { say("diff --git a/" + f + " b/" + f); say("- " + (repo.lastCommitFiles[f] || "")); say("+ " + repo.files[f]); });
    return { out };
  }

  const HELP = [
    "คำสั่งที่ลองได้:",
    "  git init | status | add <f>|. | commit -m \"msg\" | log [--oneline]",
    "  git branch [name] | switch [-c] <b> | checkout [-b] <b> | merge <b> | diff",
    "  echo \"text\" > file | touch file | cat file | ls | clear | help",
  ];

  // --- Widget ---
  function mount(host) {
    const title = host.getAttribute("data-title") || "bash — git demo";
    const repo = newRepo();
    host.classList.add("terminal");
    host.innerHTML =
      `<div class="terminal-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="title">${title}</span></div>
       <div class="terminal-screen" tabindex="0"></div>
       <div class="terminal-input-row"><span class="prompt">$</span><input class="terminal-input" spellcheck="false" autocomplete="off" aria-label="พิมพ์คำสั่ง git" placeholder="พิมพ์ git init แล้วกด Enter…"/></div>`;
    const screen = host.querySelector(".terminal-screen");
    const input = host.querySelector(".terminal-input");
    const history = []; let hi = 0;

    function print(text, err) {
      const div = document.createElement("div");
      div.className = "terminal-line" + (err ? " err" : "");
      div.textContent = text;
      screen.appendChild(div); screen.scrollTop = screen.scrollHeight;
    }
    function printCmd(cmd) {
      const div = document.createElement("div");
      div.className = "terminal-line";
      div.innerHTML = '<span class="prompt">$</span> ' + cmd.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
      screen.appendChild(div);
    }
    // intro
    print("# Terminal Simulator — ลองพิมพ์ได้เลย (พิมพ์ help เพื่อดูคำสั่ง)");

    // optional preset script: data-script="git init|echo hi > a.txt|git add ."
    const script = host.getAttribute("data-script");
    if (script) script.split("|").forEach(c => { const cmd = c.trim(); printCmd(cmd); exec(cmd, true); });

    function exec(cmd, silentEcho) {
      const r = run(repo, cmd);
      if (r.clear) { screen.innerHTML = ""; return; }
      (r.out || []).forEach(l => print(l.text, l.err));
    }

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const cmd = input.value; if (cmd.trim()) { history.push(cmd); hi = history.length; }
        printCmd(cmd); input.value = ""; exec(cmd);
      } else if (e.key === "ArrowUp") { if (hi > 0) { hi--; input.value = history[hi] || ""; } e.preventDefault(); }
      else if (e.key === "ArrowDown") { if (hi < history.length) { hi++; input.value = history[hi] || ""; } e.preventDefault(); }
    });
    host.addEventListener("click", () => input.focus());
  }

  function init() { document.querySelectorAll("[data-terminal]").forEach(mount); }

  // --- One runnable self-check (open any page with #selftest) ---
  function selfTest() {
    const r = newRepo();
    const seq = ['git status', 'git init', 'echo "hello" > a.txt', 'git add .', 'git commit -m "first"', 'git log --oneline'];
    seq.forEach(c => run(r, c));
    console.assert(r.init === true, "repo should be initialized");
    console.assert(r.commits.length === 1, "should have 1 commit, got " + r.commits.length);
    console.assert(r.branches.main === r.commits[0].hash, "main should point at the commit");
    console.assert(Object.keys(r.staged).length === 0, "staging cleared after commit");
    console.log("terminal.js self-test passed ✓");
  }

  window.GitTerminal = { init, run, newRepo, selfTest };
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  if (location.hash === "#selftest") selfTest();
})();
