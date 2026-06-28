/* ============================================================
   Git Mastery — gitgraph.js
   Renders commit/branch graphs as SVG from a small JSON spec.
   Theme-aware (uses CSS vars via .diagram classes + inline).
   Two modes:
     - single object spec  -> static graph
     - array of specs      -> step-through with prev/next
   Mount: <div data-gitgraph><script type="application/json">…</script></div>
   Spec: { commits:[{id, branch, parents:[id], msg, tag?}], head?:"branch", caption?:"" }
   ============================================================ */
(function () {
  "use strict";

  const LANE_COLORS = ["#635bff", "#f05033", "#14a44d", "#d97706", "#0ea5e9", "#a855f7"];
  const PAD = 28, COL = 70, LANE = 48, R = 9;

  function laneMap(commits) {
    const m = {}; let i = 0;
    commits.forEach(c => { if (!(c.branch in m)) m[c.branch] = i++; });
    return m;
  }
  function color(lane) { return LANE_COLORS[lane % LANE_COLORS.length]; }

  function render(spec) {
    const commits = spec.commits || [];
    const lanes = laneMap(commits);
    const laneCount = Math.max(1, Object.keys(lanes).length);
    const pos = {}; // id -> {x,y,lane}
    commits.forEach((c, idx) => {
      const lane = lanes[c.branch];
      pos[c.id] = { x: PAD + idx * COL, y: PAD + lane * LANE, lane, c };
    });
    const w = PAD * 2 + Math.max(0, commits.length - 1) * COL + 90; // room for labels
    const h = PAD * 2 + (laneCount - 1) * LANE + 20;

    const edges = [];
    commits.forEach(c => (c.parents || []).forEach(pid => {
      const a = pos[pid], b = pos[c.id]; if (!a || !b) return;
      if (a.y === b.y) edges.push(`<path class="gg-edge" d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="${color(b.lane)}" />`);
      else edges.push(`<path class="gg-edge" d="M${a.x} ${a.y} C${a.x + COL / 2} ${a.y}, ${b.x - COL / 2} ${b.y}, ${b.x} ${b.y}" stroke="${color(b.lane)}" />`);
    }));

    // branch tip labels (last commit per branch)
    const tips = {};
    commits.forEach(c => { tips[c.branch] = c.id; });
    const labels = Object.keys(tips).map(branch => {
      const p = pos[tips[branch]];
      const isHead = spec.head === branch;
      const txt = (isHead ? "HEAD → " : "") + branch;
      const wpx = txt.length * 7.2 + 16;
      return `<g transform="translate(${p.x + R + 8}, ${p.y})">
        <rect x="0" y="-11" rx="6" width="${wpx}" height="22" fill="${color(p.lane)}" opacity="${isHead ? 1 : .85}"/>
        <text x="${wpx / 2}" y="4" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">${esc(txt)}</text>
      </g>`;
    }).join("");

    const nodes = commits.map(c => {
      const p = pos[c.id];
      const tag = c.tag ? `<text x="${p.x}" y="${p.y - R - 8}" text-anchor="middle" font-size="11" fill="var(--accent)" font-weight="600">${esc(c.tag)}</text>` : "";
      const msg = c.msg ? `<text x="${p.x}" y="${p.y + R + 16}" text-anchor="middle" font-size="11" class="gg-msg">${esc(c.msg)}</text>` : "";
      return `${tag}<circle cx="${p.x}" cy="${p.y}" r="${R}" fill="${color(p.lane)}" stroke="var(--surface)" stroke-width="2"><title>${esc(c.id + (c.msg ? " — " + c.msg : ""))}</title></circle>
        <text x="${p.x}" y="${p.y + 3.5}" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">${esc(String(c.id).slice(0, 2))}</text>${msg}`;
    }).join("");

    return `<svg viewBox="0 0 ${w} ${h + 24}" width="${w}" height="${h + 24}" role="img" aria-label="Git graph">
      <style>.gg-edge{fill:none;stroke-width:2.5}.gg-msg{fill:var(--text-muted)}</style>
      ${edges.join("")}${nodes}${labels}</svg>`;
  }

  function esc(s) { return String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); }

  function mount(host) {
    let data;
    const tag = host.querySelector('script[type="application/json"]');
    try { data = JSON.parse(tag ? tag.textContent : host.getAttribute("data-spec")); }
    catch (e) { host.innerHTML = '<p class="muted">graph spec ไม่ถูกต้อง</p>'; return; }
    host.classList.add("gitgraph");

    if (Array.isArray(data)) {
      let i = 0;
      const draw = () => {
        const step = data[i];
        host.innerHTML =
          `<div class="gg-controls">
             <button class="btn btn-ghost btn-sm" data-gg="prev" ${i === 0 ? "disabled" : ""}>← ก่อนหน้า</button>
             <span class="badge primary">ขั้นที่ ${i + 1}/${data.length}</span>
             <button class="btn btn-ghost btn-sm" data-gg="next" ${i === data.length - 1 ? "disabled" : ""}>ถัดไป →</button>
           </div>
           ${step.caption ? `<p class="muted" style="margin:.25rem 0 .5rem">${esc(step.caption)}</p>` : ""}
           <div class="gg-canvas">${render(step)}</div>`;
        host.querySelector('[data-gg="prev"]').onclick = () => { if (i > 0) { i--; draw(); } };
        host.querySelector('[data-gg="next"]').onclick = () => { if (i < data.length - 1) { i++; draw(); } };
      };
      draw();
    } else {
      host.innerHTML = (data.caption ? `<p class="muted" style="margin:0 0 .5rem">${esc(data.caption)}</p>` : "") + render(data);
    }
  }

  function init() { document.querySelectorAll("[data-gitgraph]").forEach(mount); }

  function selfTest() {
    const svg = render({ commits: [{ id: "c1", branch: "main", parents: [] }, { id: "c2", branch: "main", parents: ["c1"] }, { id: "c3", branch: "feat", parents: ["c2"] }], head: "feat" });
    console.assert(svg.indexOf("<svg") === 0, "should produce svg");
    console.assert((svg.match(/<circle/g) || []).length === 3, "should draw 3 nodes");
    console.assert(svg.indexOf("HEAD → feat") > -1, "should label HEAD");
    console.log("gitgraph.js self-test passed ✓");
  }

  window.Gitgraph = { init, render, selfTest };
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
  if (location.hash === "#selftest") selfTest();
})();
