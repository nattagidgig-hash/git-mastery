/* ============================================================
   Git Mastery — app.js
   Single source of truth for chapters + shared UI:
   nav, dark mode, progress tracking, search, quiz, mobile menu.
   No framework, no fetch (works on file://). Pages call:
     GitMastery.init({ page: 'landing' })
     GitMastery.init({ page: 'chapter', slug: '01-mental-model' })
   ============================================================ */
(function () {
  "use strict";

  // --- Data: the chapter list. Edit here, every menu updates. ---
  const CHAPTERS = [
    { n: 1,  slug: "01-mental-model", title: "Git Mental Model", file: "01-mental-model.html", desc: "3 trees, the .git folder, ทำไม Git ถึงเร็วและกู้คืนได้", kw: "object blob tree commit hash sha working staging index head snapshot" },
    { n: 2,  slug: "02-commit",       title: "Commit",            file: "02-commit.html",       desc: "บันทึก snapshot — add, commit, amend, เขียน message ที่ดี", kw: "add stage commit message amend status diff log" },
    { n: 3,  slug: "03-branch",       title: "Branch",            file: "03-branch.html",       desc: "แตกสายงานราคาถูก — switch, checkout, HEAD pointer", kw: "branch switch checkout head pointer detached" },
    { n: 4,  slug: "04-merge",        title: "Merge",             file: "04-merge.html",        desc: "รวมสายงาน — fast-forward vs 3-way merge commit", kw: "merge fast-forward three-way no-ff merge commit" },
    { n: 5,  slug: "05-github",       title: "GitHub",            file: "05-github.html",       desc: "remote บนคลาวด์ — repo, push, Pull Request, review", kw: "github remote origin push pull request pr fork clone" },
    { n: 6,  slug: "06-remote",       title: "Remote",            file: "06-remote.html",       desc: "ทำงานกับ remote — fetch, pull, push, tracking branch", kw: "remote fetch pull push origin upstream tracking" },
    { n: 7,  slug: "07-conflict",     title: "Conflict",          file: "07-conflict.html",     desc: "อ่านและแก้ merge conflict อย่างมั่นใจ", kw: "conflict merge resolve markers ours theirs mergetool" },
    { n: 8,  slug: "08-reset",        title: "Reset",             file: "08-reset.html",        desc: "ย้าย HEAD — soft, mixed, hard และความต่าง", kw: "reset soft mixed hard head unstage undo" },
    { n: 9,  slug: "09-revert",       title: "Revert",            file: "09-revert.html",       desc: "ยกเลิกแบบปลอดภัยด้วย commit ใหม่ (history คงอยู่)", kw: "revert undo safe public history inverse commit" },
    { n: 10, slug: "10-rebase",       title: "Rebase",            file: "10-rebase.html",       desc: "เขียน history ใหม่ให้สะอาด — interactive, squash", kw: "rebase interactive squash fixup onto linear history" },
    { n: 11, slug: "11-reflog",       title: "Reflog",            file: "11-reflog.html",       desc: "ตาข่ายนิรภัย — กู้ commit ที่คิดว่าหายไปแล้ว", kw: "reflog recover lost commit head undo safety net" },
    { n: 12, slug: "12-worktree",     title: "Worktree",          file: "12-worktree.html",     desc: "หลาย working directory จาก repo เดียว", kw: "worktree multiple checkout parallel branch directory" },
    { n: 13, slug: "13-ai-workflow",  title: "AI Coding Workflow", file: "13-ai-workflow.html",  desc: "Git สำหรับยุค AI — spec, small commits, review, PR", kw: "ai workflow agent claude spec commit review pr full-stack" },
  ];

  const STORE_THEME = "gm-theme";
  const STORE_PROGRESS = "gm-progress";
  let ctx = { page: "landing", slug: null, base: "" };

  // --- localStorage helpers (fail-safe: file:// / private mode) ---
  function lsGet(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : v; } catch { return fallback; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

  // --- Progress ---
  function getDone() { try { return new Set(JSON.parse(lsGet(STORE_PROGRESS, "[]"))); } catch { return new Set(); } }
  function setDone(set) { lsSet(STORE_PROGRESS, JSON.stringify([...set])); }
  function isDone(slug) { return getDone().has(slug); }
  function toggleDone(slug) { const s = getDone(); s.has(slug) ? s.delete(slug) : s.add(slug); setDone(s); return s.has(slug); }
  function percent() { return Math.round((getDone().size / CHAPTERS.length) * 100); }

  // --- Theme ---
  function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); }
  function initTheme() {
    const saved = lsGet(STORE_THEME, null);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next); lsSet(STORE_THEME, next); syncThemeIcon();
  }
  function syncThemeIcon() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    document.querySelectorAll("[data-theme-icon]").forEach(el => el.textContent = dark ? "☀️" : "🌙");
  }

  // --- Link resolution (landing vs chapter dir) ---
  function linkTo(file) { return ctx.page === "landing" ? "chapters/" + file : file; }
  function homeHref() { return ctx.page === "landing" ? "index.html" : "../index.html"; }

  // --- Sidebar nav ---
  function renderSidebar() {
    const host = document.querySelector("[data-nav]");
    if (!host) return;
    const done = getDone();
    host.innerHTML =
      '<h5>บทเรียน</h5><ul class="nav-list">' +
      CHAPTERS.map(c => {
        const active = c.slug === ctx.slug ? " active" : "";
        const check = done.has(c.slug) ? '<span class="nav-done" aria-label="เรียนจบแล้ว">✓</span>' : "";
        return `<li><a class="${("" + active).trim()}" href="${linkTo(c.file)}"><span class="nav-num">${c.n}</span><span>${c.title}</span>${check}</a></li>`;
      }).join("") +
      "</ul>";
  }

  // --- Progress widget (sidebar footer) ---
  function renderProgressWidget() {
    const host = document.querySelector("[data-progress]");
    if (!host) return;
    const p = percent(), n = getDone().size;
    host.innerHTML =
      `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:6px">ความคืบหน้า ${n}/${CHAPTERS.length} บท</div>` +
      `<div class="progress-wrap"><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div><span style="font-size:var(--text-xs);color:var(--text-muted)">${p}%</span></div>`;
  }

  // --- Mark-complete button on chapter pages ---
  function renderCompleteButton() {
    const btn = document.querySelector("[data-complete]");
    if (!btn) return;
    const paint = () => {
      const d = isDone(ctx.slug);
      btn.textContent = d ? "✓ เรียนบทนี้จบแล้ว" : "ทำเครื่องหมายว่าเรียนจบ";
      btn.classList.toggle("btn-primary", !d);
      btn.classList.toggle("btn-ghost", d);
    };
    btn.addEventListener("click", () => { toggleDone(ctx.slug); paint(); renderSidebar(); renderProgressWidget(); });
    paint();
  }

  // --- Prev / next pager ---
  function renderPager() {
    const host = document.querySelector("[data-pager]");
    if (!host || ctx.page !== "chapter") return;
    const i = CHAPTERS.findIndex(c => c.slug === ctx.slug);
    const prev = CHAPTERS[i - 1], next = CHAPTERS[i + 1];
    const prevHtml = prev
      ? `<a href="${prev.file}"><div class="dir">← บทก่อนหน้า</div><div class="ttl">${prev.n}. ${prev.title}</div></a>`
      : `<a class="disabled" aria-hidden="true"></a>`;
    const nextHtml = next
      ? `<a class="next" href="${next.file}"><div class="dir">บทถัดไป →</div><div class="ttl">${next.n}. ${next.title}</div></a>`
      : `<a class="next" href="${homeHref()}"><div class="dir">จบหลักสูตร 🎉</div><div class="ttl">กลับหน้าแรก</div></a>`;
    host.innerHTML = prevHtml + nextHtml;
  }

  // --- Landing: roadmap cards + learning path + progress ---
  function renderLanding() {
    const grid = document.querySelector("[data-cards]");
    if (grid) {
      const done = getDone();
      grid.innerHTML = CHAPTERS.map(c => {
        const badge = done.has(c.slug) ? '<span class="badge ok">✓ จบแล้ว</span>' : `<span class="badge">บท ${c.n}</span>`;
        return `<a class="card card-link" href="${linkTo(c.file)}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">${badge}</div>
          <h3 style="margin:0 0 6px">${c.title}</h3>
          <p class="muted" style="margin:0;font-size:var(--text-sm)">${c.desc}</p>
        </a>`;
      }).join("");
    }
    const path = document.querySelector("[data-path]");
    if (path) {
      const done = getDone();
      path.innerHTML = CHAPTERS.map(c =>
        `<li class="${done.has(c.slug) ? "done" : ""}"><span class="dot">${done.has(c.slug) ? "✓" : c.n}</span>
         <div><a href="${linkTo(c.file)}" style="font-weight:600;color:var(--text)">${c.title}</a>
         <div class="muted" style="font-size:var(--text-sm)">${c.desc}</div></div></li>`
      ).join("");
    }
    const big = document.querySelector("[data-progress-big]");
    if (big) {
      const p = percent();
      big.innerHTML = `<div class="progress-wrap"><div class="progress-track"><div class="progress-fill" style="width:${p}%"></div></div>
        <strong>${p}%</strong></div><p class="muted" style="margin-top:8px">${getDone().size} จาก ${CHAPTERS.length} บท</p>`;
    }
  }

  // --- Search (Cmd/Ctrl+K) ---
  function buildSearch() {
    const overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.innerHTML =
      `<div class="search-box" role="dialog" aria-modal="true" aria-label="ค้นหาบทเรียน">
        <input type="text" placeholder="ค้นหาบทเรียน เช่น merge, rebase, conflict…" aria-label="ค้นหา" />
        <div class="search-results"></div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector("input");
    const results = overlay.querySelector(".search-results");
    let sel = 0, items = [];

    function render(q) {
      const query = q.trim().toLowerCase();
      items = CHAPTERS.filter(c =>
        !query || (c.title + " " + c.desc + " " + c.kw).toLowerCase().includes(query));
      sel = 0;
      results.innerHTML = items.length
        ? items.map((c, i) =>
            `<a href="${linkTo(c.file)}" class="${i === 0 ? "sel" : ""}" data-i="${i}">
              <span class="r-num">บท ${c.n}</span> · <strong>${c.title}</strong>
              <div class="r-desc">${c.desc}</div></a>`).join("")
        : '<div class="search-empty">ไม่พบบทเรียนที่ตรงกับ “' + q + '”</div>';
    }
    function move(d) {
      if (!items.length) return;
      sel = (sel + d + items.length) % items.length;
      results.querySelectorAll("a").forEach((a, i) => a.classList.toggle("sel", i === sel));
      const el = results.querySelector(".sel"); if (el) el.scrollIntoView({ block: "nearest" });
    }
    function open() { overlay.classList.add("open"); render(""); input.value = ""; input.focus(); }
    function close() { overlay.classList.remove("open"); }

    input.addEventListener("input", () => render(input.value));
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    overlay.addEventListener("keydown", e => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { const el = results.querySelector(".sel"); if (el) location.href = el.getAttribute("href"); }
    });
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); overlay.classList.contains("open") ? close() : open(); }
      else if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
    });
    document.querySelectorAll("[data-search-open]").forEach(b => b.addEventListener("click", open));
  }

  // --- Quiz: <div class="quiz" data-quiz data-answer="2"> ... ---
  function initQuizzes() {
    document.querySelectorAll("[data-quiz]").forEach(quiz => {
      const answer = parseInt(quiz.getAttribute("data-answer"), 10);
      const explain = quiz.getAttribute("data-explain") || "";
      const opts = [...quiz.querySelectorAll(".quiz-opt")];
      const fb = quiz.querySelector(".quiz-feedback");
      opts.forEach((opt, i) => opt.addEventListener("click", () => {
        if (opts.some(o => o.disabled)) return;
        opts.forEach(o => { o.disabled = true; });
        opts[answer].classList.add("correct");
        if (i === answer) { if (fb) { fb.textContent = "✅ ถูกต้อง! " + explain; fb.style.color = "var(--ok)"; } }
        else { opt.classList.add("wrong"); if (fb) { fb.textContent = "❌ ยังไม่ใช่ — " + explain; fb.style.color = "var(--danger)"; } }
      }));
    });
  }

  // --- Mobile menu ---
  function initMobileMenu() {
    const toggle = document.querySelector(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    if (!toggle || !sidebar) return;
    let scrim = document.querySelector(".scrim");
    if (!scrim) { scrim = document.createElement("div"); scrim.className = "scrim"; document.body.appendChild(scrim); }
    const set = open => { sidebar.classList.toggle("open", open); scrim.classList.toggle("open", open); };
    toggle.addEventListener("click", () => set(!sidebar.classList.contains("open")));
    scrim.addEventListener("click", () => set(false));
    sidebar.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
  }

  // --- Public init ---
  function init(opts) {
    opts = opts || {};
    ctx.page = opts.page || "landing";
    ctx.slug = opts.slug || null;
    initTheme();
    document.querySelectorAll("[data-theme-toggle]").forEach(b => b.addEventListener("click", toggleTheme));
    syncThemeIcon();
    document.querySelectorAll("[data-home]").forEach(a => a.setAttribute("href", homeHref()));
    renderSidebar();
    renderProgressWidget();
    renderCompleteButton();
    renderPager();
    renderLanding();
    buildSearch();
    initQuizzes();
    initMobileMenu();
  }

  window.GitMastery = { init, CHAPTERS, isDone, toggleDone, percent };
})();
