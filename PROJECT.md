# Git Mastery

เป้าหมาย:
สร้างเว็บไซต์สอน Git ระดับ Professional
สำหรับ AI Coder และ Full-stack Developer

Design Style:
- Google Developers
- Material Design 3
- Stripe Docs
- Vercel Docs

Tech:
- HTML
- CSS
- JavaScript
- (ไม่มี framework, ไม่มี build step — เปิด `index.html` ได้เลย)

Requirements:
- Responsive (mobile-first)
- Dark Mode
- Search
- Progress Tracking

Sections:
1. Git Mental Model
2. Commit
3. Branch
4. Merge
5. GitHub
6. Remote
7. Conflict
8. Reset
9. Revert
10. Rebase
11. Reflog
12. Worktree
13. AI Coding Workflow

Features:
- Interactive Diagrams
- Git Graph Visualizer
- Terminal Simulator
- Quiz
- Workshop

---

## Architecture (เหตุผลของแต่ละไฟล์)

```
.
├── index.html              # Landing page (hero, roadmap, learning path, CTA)
├── PROJECT.md              # ไฟล์นี้ — single source of truth ของ spec
├── README.md               # วิธีรัน + แผนผังโปรเจกต์
├── assets/
│   ├── css/style.css       # Design system (tokens) + components + layout ในไฟล์เดียว
│   └── js/
│       ├── app.js          # ข้อมูลบทเรียน + sidebar nav + dark mode + progress + search + quiz
│       ├── terminal.js     # Terminal Simulator (เลียนแบบ git CLI)
│       └── gitgraph.js     # Git Graph Visualizer (วาด commit/branch ด้วย SVG)
└── chapters/
    ├── 01-mental-model.html
    ├── 02-commit.html
    └── ... 13-ai-workflow.html
```

ทำไมโครงสร้างนี้:
- **ไม่มี build step** — static files ล้วน เปิดด้วย browser หรือ live server ได้ทันที เรียน Git ได้โดยไม่ต้องสู้กับ toolchain ก่อน
- **CSS ไฟล์เดียว** — design system เล็กพอที่จะอยู่ไฟล์เดียว ไม่ต้อง split จนกว่าจะใหญ่จริง
- **`app.js` ถือ array ของบทเรียน** = single source of truth ของเมนู แก้ที่เดียว เมนูทุกหน้าอัปเดตตาม (ไม่ใช้ `fetch` เพราะ `file://` บล็อก — สร้าง nav จาก JS array ตรง ๆ)
- **แต่ละบท = 1 ไฟล์ HTML** — โหลดเฉพาะที่ต้องใช้, เป็น URL จริง, จด progress รายหน้าได้ง่าย
