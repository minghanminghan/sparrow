# Fully open-source kanban / task trackers: research (2026-10-21)

Requirements: (1) nested tasks with due dates, (2) bidirectional and typed links, (3) Markdown, (4) GitHub PR linking, (5) AI (built-in LLM features, MCP server, or an API).
"Fully open" means none of these five features is behind a paid, closed or enterprise-only tier in the self-hosted edition.
Sources are primary only: repos via `gh`, official docs and official pricing pages.
Repo metadata was pulled 2026-10-20/21.

## Summary: top picks

1. **Vikunja** (AGPL-3.0)
   - Has multi-level subtasks that are full tasks with their own due dates.
   - Has 10 typed relations, and the inverse is created automatically on the other task.
   - Has an **official MCP server** (v2.7.0, 2026-10-02) that no license gates.
   - Weak spots: WYSIWYG editor with Markdown shortcuts (not raw Markdown), and GitHub PRs are plain links only.
   - Its Pro license key gates only admin panel, time tracking, audit logs and user invites, none of the five features. ([license.go](https://github.com/go-vikunja/vikunja/blob/main/pkg/license/license.go), [task_relation.go](https://github.com/go-vikunja/vikunja/blob/main/pkg/models/task_relation.go), [2.7.0 changelog](https://vikunja.io/changelog/vikunja-2.7.0-was-released/))
2. **Huly** (EPL-2.0)
   - The only fully open tool here with **real two-way GitHub PR sync** (PR status, reviews, comments), and it is free when self-hosted.
   - Has multi-level sub-issues with due date and deadline fields.
   - No feature paywall: cloud tiers differ only by storage and video traffic.
   - Weak spots: no official MCP server, a thinly documented API, and a heavy self-host stack. ([pricing](https://huly.io/pricing), [GitHub docs](https://docs.huly.io/integrations/github/), [pullrequests.ts](https://github.com/hcengineering/platform/blob/develop/services/github/pod-github/src/sync/pullrequests.ts))
3. **Backlog.md** (MIT): the pick for agent-driven, git-native work.
   - Tasks are Markdown files in your repo.
   - Has multi-level subtasks, due dates, and dependencies whose inverse is shown on the other task.
   - Has a built-in MCP server and a kanban board in the terminal or web.
   - Weak spots: only one relation type, PRs as plain links, and the web UI is localhost-only. ([README](https://github.com/MrLesk/Backlog.md/blob/main/README.md), [CLI-INSTRUCTIONS.md](https://github.com/MrLesk/Backlog.md/blob/main/CLI-INSTRUCTIONS.md))

Honorable mentions:
- **Redmine** (GPL-2.0+): unlimited nesting, rich auto-inverse relations, CommonMark. It needs plugins for kanban and GitHub, and its MCP servers are community-built.
- **Tududi** (MIT): built-in AI plus an official MCP server, typed relations. It is a personal-scale tool, and its relations only landed in 2026-09.

## Comparison table

| Tool | License | Fully open? | Nested + deadlines | Bidirectional links | Markdown | GitHub PRs | AI | Last commit | Notes |
|---|---|---|---|---|---|---|---|---|---|
| **Vikunja** | AGPL-3.0 | Yes (Pro gates 4 non-required features) | Yes, multi-level, due dates on subtasks | Yes, 10 typed, auto-inverse | Partial (WYSIWYG + MD shortcuts) | Plain link | **Official MCP (free)**, OpenAPI | 2026-10-21 | Strongest all-rounder |
| **Huly** | EPL-2.0 | Yes | Yes, multi-level, due date + deadline | Partial (related, blocks/blocked by) | Partial (rich text, MD syntax) | **Real 2-way sync (free)** | AI bot (BYO OpenAI key); no official MCP | 2026-10-19 | Heavy self-host |
| **Backlog.md** | MIT | Yes | Yes, multi-level, date-only due | Partial (1 type: deps, inverse shown) | Yes | Plain link (`--ref`) | **MCP**, `--json` CLI | 2026-10-20 | Git-native, local |
| **Redmine** | GPL-2.0+ | Yes (core) | Yes, unlimited depth | Yes, 6 typed, auto-inverse | Yes (CommonMark/GFM) | Partial (commit keywords; plugin) | REST API; community MCP | 2026-10-20 | Kanban via plugin |
| **Tududi** | MIT | Yes | Yes (depth in UI unverified) | Yes, 3 typed, auto-inverse | Yes | Plain link | **Built-in AI + official MCP** | 2026-10-20 | Personal-scale; relations new |
| **Beads** | MIT | Yes | Yes, 3 levels default, `due_at` | **Yes, richest typed set** | Terminal only | No (syncs GH *issues*) | MCP, CLI, LLM compaction | 2026-10-21 | No built-in kanban |
| Kanboard | MIT | Yes | Partial (1 level, no subtask due date without plugin) | Yes, typed, auto-inverse | Yes | Plugin (merged event only) | Community MCP | 2026-10-21 | Maintenance mode |
| WeKan | MIT | Yes | Yes (subtask boards, checklist due dates) | Partial (typed, one-sided, same board) | Yes | No (issues only) | Community MCP (tiny) | 2026-10-20 | |
| Logseq | AGPL-3.0 | Yes (Sync/Publish paid) | Yes, outliner + Deadline | Yes (backlinks); typed via custom props | Yes | Plain link / plugin | **Official MCP (free)** | 2026-10-20 | No native kanban; DB beta |
| Super Productivity | MIT | Yes | Partial (1 level in UI) | No | Yes | **Real (import issues/PRs)** | Community MCP; official MCP unreleased | 2026-10-20 | Single-user |
| Taiga | MPL-2.0 / AGPL-3.0 | Yes | Partial (Epic > Story > Task) | No | Yes | Weak (commit webhooks; no PRs) | REST API; community MCP | 2026-09-28 | Maintenance mode |
| Kan | AGPL-3.0 | Yes (self-host) | No (checklists, no due) | No | Yes | No | Official MCP (local free; hosted paid) | 2026-10-20 | |
| Worklenz | AGPL-3.0 | Mostly (paid self-host plans; 5 features not gated) | Yes, 3 levels | Partial (blocked_by) | No (TinyMCE) | No ("Coming Soon") | None | 2026-10-19 | No public API |
| Tracks | GPL-2.0 | Yes | No | Partial (predecessor/successor) | No (Textile) | Plain link | XML REST | 2026-08-03 | Last release 2024-07 |
| Plane | AGPL-3.0 CE | **No** | Yes | Yes (4 types free) | Partial | **Paid** | Plane AI paid; MCP MIT (stdio only on CE) | 2026-10-19 | Commercial Edition closed |
| OpenProject | GPL-3.0 | **No** | Yes | Yes, richest | Yes (CommonMark) | Real, free | **MCP Professional+ only** | 2026-10-21 | CLA |
| Leantime | AGPL-3.0 | **No** | Yes | Partial | WYSIWYG | Plain link | **MCP paid plugin; AI Cloud Pro** | 2026-10-20 | CLA |
| AppFlowy | AGPL-3.0 (client) | **No** | No | Yes (2-way relation field) | WYSIWYG | Plain link | AI paid; MCP in closed server | 2026-06-26 | Server closed; binaries ≠ source |
| PLANKA | Fair Use (source-available) | **No** | Partial | **Pro only** | Yes | Plain link | Community MCP | 2026-09-17 | License changed 2025-05 |
| Taskmaster AI | MIT + Commons Clause | **No** | 1 level, **no due dates** | One-way deps | Partial | Hamster paid | Built-in LLM, MCP | 2026-04-23 | Stalled |
| Vibe Kanban | Apache-2.0 | n/a | (was cloud-only) | (was typed) | Rich text | Real | Agent orchestration, MCP | 2026-09-19 | **Sunset 2026-04** |
| Focalboard | AGPL-3.0 / Mattermost | n/a | No | No | Yes | URL prop | REST API | 2025-06-11 | **Unmaintained** |

## Per-tool findings

### Vikunja ([go-vikunja/vikunja](https://github.com/go-vikunja/vikunja)): AGPL-3.0, v2.7.1 (2026-10-20)
- **Open-core:**
  - A license-key system (added 2026-03) gates admin panel, time tracking, audit logs and user invites ([license.go](https://github.com/go-vikunja/vikunja/blob/main/pkg/license/license.go), [license doc](https://github.com/go-vikunja/vikunja/blob/main/.agents/docs/license.md)).
  - Pricing calls the Pro add-on "self-hosted only, private beta"; Cloud has the same features as self-hosted ([pricing](https://vikunja.io/pricing/)).
  - No CLA mention in [CONTRIBUTING.md](https://github.com/go-vikunja/vikunja/blob/main/CONTRIBUTING.md).
- **Nested:** Subtasks are full tasks linked by `subtask`/`parenttask`. A cycle check allows any depth; how deep the UI shows nesting is unverified ([task_relation.go](https://github.com/go-vikunja/vikunja/blob/main/pkg/models/task_relation.go)).
- **Links:**
  - Types: related, duplicateof/duplicates, blocking/blocked, precedes/follows, copiedfrom/copiedto.
  - "The inverse relation is created automatically" (same file).
- **Markdown:** TipTap WYSIWYG with Markdown input shortcuts and paste conversion ([editor](https://github.com/go-vikunja/vikunja/tree/main/frontend/src/components/input/editor)).
- **GitHub:** Plain links plus generic [webhooks](https://vikunja.io/docs/webhooks/). Community syncs are tiny ([vikunja-github-sync](https://github.com/primeapple/vikunja-github-sync)).
- **AI:**
  - Official MCP server built from the OpenAPI spec, with scoped API tokens ([pkg/modules/mcp](https://github.com/go-vikunja/vikunja/tree/main/pkg/modules/mcp), [help](https://vikunja.io/help/mcp)).
  - [API docs](https://vikunja.io/docs/api-documentation/).
  - No built-in LLM features found.

### Huly ([hcengineering/platform](https://github.com/hcengineering/platform)): EPL-2.0, v0.7.426 (2026-07-05)
- **Open-core:**
  - None. Cloud plans differ by storage and video traffic; "AI features TBD" ([pricing](https://huly.io/pricing)).
  - The GitHub and AI services are in the open repo ([services/](https://github.com/hcengineering/platform/tree/develop/services)).
  - No CLA found (unverified).
- **Nested:** `subIssues`, `parents[]`, `dueDate` and `deadline` ([types.ts](https://github.com/hcengineering/platform/blob/develop/models/tracker/src/types.ts), [docs](https://docs.huly.io/task-tracking/creating-issues/)).
- **Links:** "Related to" and "Blocked by"/"Blocking"; no duplicate type documented ([docs](https://docs.huly.io/task-tracking/related-issues/)).
- **Markdown:** Rich-text editor that accepts Markdown syntax ([docs](https://docs.huly.io/controlled-documents/editing-formatting/)).
- **GitHub:**
  - Two-way sync via a GitHub App: issues, PRs, comments and reviews, with PR draft/merged/review status ([docs](https://docs.huly.io/integrations/github/), [huly-selfhost](https://github.com/hcengineering/huly-selfhost)).
  - Auto-linking a PR to an existing issue by key: unverified.
- **AI:**
  - AI bot (chat, translation, summaries) with your own OpenAI key ([huly-selfhost](https://github.com/hcengineering/huly-selfhost)).
  - No official MCP server; community [huly-mcp](https://github.com/dearlordylord/huly-mcp) (MIT).
  - The API is a TypeScript client ([api-client](https://github.com/hcengineering/huly.core/tree/main/packages/api-client)).

### Backlog.md ([MrLesk/Backlog.md](https://github.com/MrLesk/Backlog.md)): MIT, v1.55.0 (2026-10-20)
- **Open-core:** None; no hosted tier ([README](https://github.com/MrLesk/Backlog.md/blob/main/README.md)).
- **Nested:**
  - `-p <parent>` creates subtasks, and dotted IDs nest further (`task-1.1.1`).
  - `--due-date YYYY-MM-DD` sets a date-only due date ([CLI-INSTRUCTIONS.md](https://github.com/MrLesk/Backlog.md/blob/main/CLI-INSTRUCTIONS.md)).
- **Links:** `--dep` only; the other task shows the inverse as read-only "Dependents". `--ref`/`--doc` are untyped (same doc).
- **Markdown:** Web UI uses @uiw/react-md-editor plus Mermaid ([package.json](https://github.com/MrLesk/Backlog.md/blob/main/package.json)).
- **GitHub:** Plain link only; full integration was only brainstormed ([#231](https://github.com/MrLesk/Backlog.md/issues/231)).
- **AI:** `backlog mcp start`, plus `--plain`/`--json` CLI output (README).
- **Kanban:** `backlog board` (terminal) and `backlog browser` (web, 127.0.0.1 only).

### Redmine ([redmine/redmine](https://github.com/redmine/redmine)): GPL-2.0-or-later
- **Open-core:** The core is GPL ([COPYING](https://github.com/redmine/redmine/blob/master/doc/COPYING)). Paid add-ons are third-party, e.g. RedmineUP Agile PRO at $499+; Agile Light is free ([redmineup](https://www.redmineup.com/pages/plugins/agile)).
- **Nested:** Unlimited subtask depth; parent dates can be derived from children ([RedmineIssues](https://www.redmine.org/projects/redmine/wiki/RedmineIssues)).
- **Links:** relates, duplicates, blocks, precedes/follows, copied to/from; each relation shows on both issues ([issue_relation.rb](https://github.com/redmine/redmine/blob/master/app/models/issue_relation.rb)).
- **Markdown:** CommonMark/GFM formatter ([wiki_formatting](https://github.com/redmine/redmine/tree/master/lib/redmine/wiki_formatting)).
- **GitHub:**
  - Commit keywords link issues through a local repo mirror.
  - PRs are plain links; webhook sync needs the [redmine_github_hook](https://github.com/koppen/redmine_github_hook) plugin.
- **AI:**
  - [REST API](https://www.redmine.org/projects/redmine/wiki/Rest_api).
  - Community MCP servers: [onozaty/redmine-mcp-server](https://github.com/onozaty/redmine-mcp-server), [yonaka15/mcp-server-redmine](https://github.com/yonaka15/mcp-server-redmine).
  - No built-in AI.

### Tududi ([chrisvel/tududi](https://github.com/chrisvel/tududi)): MIT, v1.9.5 (2026-10-20)
- **Open-core:** None. Paid cloud hosting includes AI credits; self-host has the same features ([tududi.com](https://tududi.com/)).
  - Gotcha: `package.json` says ISC while LICENSE says MIT.
- **Nested:** Subtasks are full tasks with due dates via `parent_task_id`; UI depth is unverified ([PR #1346](https://github.com/chrisvel/tududi/pull/1346)).
- **Links:** blocks, related_to, duplicates, with an auto-inverse "Blocked by"/"Duplicated by" ([task_relation.js](https://github.com/chrisvel/tududi/blob/main/backend/models/task_relation.js), [service.js](https://github.com/chrisvel/tududi/blob/main/backend/modules/tasks/relations/service.js)).
- **Markdown:** react-markdown with GFM and Mermaid ([MarkdownRenderer.tsx](https://github.com/chrisvel/tududi/blob/main/frontend/components/Shared/MarkdownRenderer.tsx)). Comments are unverified.
- **GitHub:** Plain links.
- **AI:**
  - Built-in assistant using any OpenAI-compatible provider ([ai-assistant](https://github.com/chrisvel/tududi/blob/main/backend/modules/ai-assistant/service.js)).
  - Official MCP server ([modules/mcp](https://github.com/chrisvel/tududi/tree/main/backend/modules/mcp)).
  - Swagger REST API.

### Beads ([gastownhall/beads](https://github.com/gastownhall/beads), formerly steveyegge/beads): MIT, v1.3.1 (2026-09-30)
- **Open-core:** None ([LICENSE](https://github.com/gastownhall/beads/blob/main/LICENSE), [docs](https://beads.gascity.com/)).
- **Nested:** Hierarchical IDs, max depth 3 by default (configurable). Has `due_at`/`defer_until` and `--due` flags ([types.go](https://github.com/gastownhall/beads/blob/main/internal/types/types.go)).
- **Links:**
  - Types include blocks, related, duplicates, supersedes, caused-by, waits-for and more.
  - `bd relate` is bidirectional, and `bd show` lists dependents ([relate.go](https://github.com/gastownhall/beads/blob/main/cmd/bd/relate.go)).
- **Markdown:** Rendered in the terminal only.
- **GitHub:** `bd github sync` syncs GitHub *Issues* both ways; no PR support ([github.go](https://github.com/gastownhall/beads/blob/main/cmd/bd/github.go)).
- **AI:**
  - CLI `--json`, plus the [beads-mcp](https://github.com/gastownhall/beads/blob/main/docs/integrations/mcp-server.md) MCP server.
  - LLM compaction via Claude Haiku.
  - Kanban is third-party UIs only ([community-tools](https://github.com/gastownhall/beads/blob/main/docs/community-tools.md)).

### Kanboard ([kanboard/kanboard](https://github.com/kanboard/kanboard)): MIT, v1.2.55
- **Status:** No paid edition. The README says "in maintenance mode" ([README](https://github.com/kanboard/kanboard/blob/main/README.md)).
- **Nested:** One subtask level with no due date ([schema](https://github.com/kanboard/kanboard/blob/main/app/Schema/Sqlite.php)). Due dates need the [Subtaskdate plugin](https://github.com/eSkiSo/Subtaskdate) (last updated 2023). Parent/child internal links give multiple levels.
- **Links:** Typed (relates, blocks, duplicates, fixes, parent/child, milestone), and the opposite link is written in the same transaction ([TaskLinkModel.php](https://github.com/kanboard/kanboard/blob/main/app/Model/TaskLinkModel.php)).
- **Markdown:** Parsedown ([docs](https://docs.kanboard.org/v1/user/markdown_syntax/)).
- **GitHub:** The official webhook plugin is archived ([repo](https://github.com/kanboard/plugin-github-webhook)). The [fork](https://github.com/y9938/plugin-github-webhook-plus) adds a "PR merged" event.
- **AI:** Community MCP servers: [bivex/kanboard-mcp](https://github.com/bivex/kanboard-mcp) (MIT) and [ChristianJStarr/kanboard-mcp](https://github.com/ChristianJStarr/kanboard-mcp) (no LICENSE file). Also a [JSON-RPC API](https://docs.kanboard.org/v1/api/).

### WeKan ([wekan/wekan](https://github.com/wekan/wekan)): MIT, v12.57
- **Open-core:** None: "There is no proprietary code"; paid offers are SaaS and support only ([wekan.fi](https://wekan.fi/commercial-support/)).
- **Nested:** Subtasks are cards on a linked board; checklist items have `dueAt` ([Subtasks.md](https://github.com/wekan/wekan/blob/main/docs/Features/Cards/Subtasks.md), [checklistItems.js](https://github.com/wekan/wekan/blob/main/models/checklistItems.js)).
- **Links:** "Red Strings" are typed but same-board only. The link is stored on the source card, and the inverse display on the target is unverified ([RedStrings.md](https://github.com/wekan/wekan/blob/main/docs/Features/General/Editor/RedStrings/RedStrings.md)).
- **Markdown:** True Markdown with preview ([Markdown-Editor.md](https://github.com/wekan/wekan/blob/main/docs/Features/General/Editor/Markdown-Editor.md)).
- **GitHub:** Imports and syncs issues but explicitly skips PRs ([GitHub.md](https://github.com/wekan/wekan/blob/main/docs/Features/Board-Sidebar/Board-Settings/Import-Export/GitHub/GitHub.md)).
- **AI:** No official MCP server ([REST API](https://github.com/wekan/wekan/blob/main/docs/API/REST-API.md)).

### Logseq ([logseq/logseq](https://github.com/logseq/logseq)): AGPL-3.0, 2.0.2 (2026-10-07)
- **Open-core:** Sync/RTC and Publish are paid and invite-only, but self-hostable. None of the five features is paywalled ([db-version.md](https://github.com/logseq/docs/blob/master/db-version.md#sync)).
  - **CLA required** ([CONTRIBUTING](https://github.com/logseq/logseq/blob/master/CONTRIBUTING.md)).
- **Nested:** `#Task` blocks with Deadline/Scheduled fields, nestable ([tasks](https://github.com/logseq/docs/blob/master/db-version.md#tasks)).
- **Links:** Backlinks are bidirectional by design. Typed relations are possible only via custom Node properties.
- **Markdown:** Yes.
- **GitHub:** Plain links or community plugins ([marketplace](https://github.com/logseq/marketplace/tree/master/packages)).
- **AI:** Official built-in MCP server, free ([MCP](https://github.com/logseq/docs/blob/master/db-version.md#mcp-server)).
- **Kanban:** Plugin only. The DB version is beta ("data loss is possible") ([README](https://github.com/logseq/logseq#-database-version)).

### Super Productivity ([super-productivity/super-productivity](https://github.com/super-productivity/super-productivity)): MIT, v19.2.0
- **Open-core:** None: "No trials, no premium tiers" ([pricing](https://super-productivity.com/pricing/)).
- **Nested:** One level in the UI ([#4816](https://github.com/super-productivity/super-productivity/issues/4816)).
- **Links:** None; dependencies are still an open request ([#2173](https://github.com/super-productivity/super-productivity/issues/2173)).
- **Markdown:** Yes, in task notes.
- **GitHub:** Real issue and PR import ([comparison](https://github.com/super-productivity/super-productivity/blob/master/docs/wiki/3.07-Issue-Integration-Comparison.md)).
- **AI:**
  - Official MCP is on master but not yet in a release ([electron/mcp](https://github.com/super-productivity/super-productivity/tree/master/electron/mcp)).
  - Community MCP: [b0x42/Super-Productivity-MCP](https://github.com/b0x42/Super-Productivity-MCP).
- **Kanban:** Native board view.

### Taiga ([taigaio/taiga-back](https://github.com/taigaio/taiga-back)): MPL-2.0 backend, AGPL-3.0 frontend
- **Open-core:** None. Cloud is priced per instance ([pricing](https://taiga.io/deployment-pricing-options/)). Contributions are under a DCO, not a CLA ([CONTRIBUTING](https://github.com/taigaio/taiga-back/blob/main/CONTRIBUTING.md)).
- **Status:**
  - Maintenance mode; Kaleidos moved its focus to Penpot ([announcement](https://community.taiga.io/t/important-announcement-taiga-will-be-run-by-taiga-cloud-services/3112)).
  - The successor is **Tenzu** (AGPL, kanban only for now) ([announcement](https://community.taiga.io/t/launching-tenzu-taiganext-new-identity/3940)).
- **Features:**
  - Fixed Epic > Story > Task hierarchy with due dates ([tasks/models.py](https://github.com/taigaio/taiga-back/blob/main/taiga/projects/tasks/models.py)).
  - No typed relations ([epics/models.py](https://github.com/taigaio/taiga-back/blob/main/taiga/projects/epics/models.py)).
  - Markdown supported.
  - Staff say "You cannot link a PR directly" ([forum](https://community.taiga.io/t/can-i-link-a-github-pr-to-a-story-in-taiga/3229)).
  - [REST API](https://docs.taiga.io/api.html).

### Kan ([kanbn/kan](https://github.com/kanbn/kan)): AGPL-3.0
- **Open-core:**
  - Cloud tiers exist ([pricing](https://kan.bn/pricing)), but plan checks only run when `NEXT_PUBLIC_KAN_ENV === "cloud"` ([member.ts](https://github.com/kanbn/kan/blob/main/packages/api/src/routers/member.ts)).
  - The hosted MCP needs a paid plan; the local `npx` MCP is free ([mcp-server.mdx](https://github.com/kanbn/kan/blob/main/apps/docs/integrations/mcp-server.mdx)).
- **Features:** No subtasks (checklists without due dates) and no links ([cards.ts](https://github.com/kanbn/kan/blob/main/packages/db/src/schema/cards.ts)). Markdown via TipTap. GitHub integration only imports Projects v2.

### Worklenz ([Worklenz/worklenz](https://github.com/Worklenz/worklenz)): AGPL-3.0, v3.2.1
- **Open-core:**
  - Paid cloud plans, plus paid self-host Business and Enterprise plans (SSO, white-label) ([pricing](https://worklenz.com/pricing)).
  - The `ee/` code is AGPL, and self-hosted mode grants Business privileges ([ee README](https://github.com/Worklenz/worklenz/blob/main/worklenz-backend/src/ee/README.md)).
  - **CLA required**, granting the company a sublicensable license ([CONTRIBUTING](https://github.com/Worklenz/worklenz/blob/main/CONTRIBUTING.md)).
- **Nested:** Three levels, with due dates ([docs](https://docs.worklenz.com/en/project-and-task/create-subtask/)).
- **Links:** `blocked_by` only.
- **Markdown:** No; TinyMCE WYSIWYG.
- **GitHub:** "Coming Soon".
- **AI:** No public API and no MCP ([#378](https://github.com/Worklenz/worklenz/issues/378)).

### Tracks ([TracksApp/tracks](https://github.com/TracksApp/tracks)): GPL-2.0
- No subtasks ([#2952](https://github.com/TracksApp/tracks/issues/2952)).
- Predecessor/successor dependencies only ([dependency.rb](https://github.com/TracksApp/tracks/blob/master/app/models/dependency.rb)).
- Textile, not Markdown ([#1226](https://github.com/TracksApp/tracks/issues/1226)).
- XML REST API, no kanban. Last release v2.7.1 (2024-07-25).

## Disqualified / open-core

- **Plane:** open-core, and the paid tier is closed source.
  - "The Commercial Edition remains closed-source"; the Community Edition only matches the Free cloud tier ([editions](https://developers.plane.so/self-hosting/editions-and-versions)).
  - The **GitHub integration is Pro and up** ([pricing](https://plane.so/pricing), [docs](https://docs.plane.so/integrations/github)), and **Plane AI is Pro and up** ([docs](https://docs.plane.so/ai/plane-ai)).
  - On CE, the MIT [MCP server](https://github.com/makeplane/plane-mcp-server) works only over stdio, because OAuth app registration is Commercial-only.
  - Nesting and four relation types are free.
- **OpenProject:** the AI requirement is paywalled.
  - The **MCP server needs Professional or higher**: `EnterpriseToken.allows_to?(:mcp_server)` ([mcp.rb](https://github.com/opf/openproject/blob/dev/lib/api/mcp.rb), [docs](https://www.openproject.org/docs/system-admin-guide/integrations/mcp-server/)).
  - The LLM module is planned for Professional ([modules/llm](https://github.com/opf/openproject/tree/dev/modules/llm)).
  - Everything else is free and best-in-class: unlimited hierarchy, the richest relations, CommonMark storage, and a free real GitHub PR integration ([GitHub integration](https://www.openproject.org/docs/system-admin-guide/integrations/github-integration/), [relations](https://www.openproject.org/docs/user-guide/work-packages/work-package-relations-hierarchies/)).
  - **CLA required** ([CLA](https://www.openproject.org/legal/contributor-license-agreement/)).
  - If you can use its free APIv3 with a community MCP, it is the strongest feature fit overall.
- **Leantime:** MCP is a paid self-host plugin ($29, proprietary), and AI is Cloud Pro only ([marketplace](https://marketplace.leantime.io/product/mcp-server/), [pricing](https://leantime.io/pricing/)). Personal API tokens need the paid Advanced Auth plugin. **CLA required.**
- **AppFlowy:** no longer fully open.
  - [AppFlowy-Cloud](https://github.com/AppFlowy-IO/AppFlowy-Cloud) is archived. Its README says AppFlowy runs an "open-core model" with a closed-source server.
  - The free self-host tier is 1 seat, and AI needs a commercial license ([SelfHost-Commercial](https://github.com/AppFlowy-IO/AppFlowy-SelfHost-Commercial)).
  - All desktop tags from 0.13.0 through 0.14.8 point to the same 2026-06-26 public commit, so the shipped binaries include unpublished code ([releases](https://github.com/AppFlowy-IO/AppFlowy/releases)).
  - It also has no nested rows ([#7564](https://github.com/AppFlowy-IO/AppFlowy/issues/7564)).
- **PLANKA:** source-available, not OSI open source.
  - Relicensed from AGPL to a "Fair Use License" based on n8n's Sustainable Use License on 2025-05-10 ([LICENSE.md](https://github.com/plankanban/planka/blob/master/LICENSE.md), [history](https://github.com/plankanban/planka/commits/master/LICENSE.md)).
  - **Card-to-card linking is Pro only** ([features](https://planka.app/features)).
  - Its CLA allows relicensing ([CLA](https://github.com/plankanban/planka/blob/master/CONTRIBUTOR_LICENSE_AGREEMENT.md)).
  - v1.26.3 is the last AGPL release.
- **Taskmaster AI:** not open source and stalled.
  - The license is MIT plus the **Commons Clause** ([LICENSE](https://github.com/eyaltoledano/claude-task-master/blob/main/LICENSE)).
  - Team mode and PR delivery are on paid Hamster ([pricing](https://tryhamster.com/pricing)).
  - The task schema has no due-date field and only one subtask level ([types](https://github.com/eyaltoledano/claude-task-master/blob/main/packages/tm-core/src/common/types/index.ts)).
  - No commits since 2026-04-23, and security issues are open with no response ([#1714](https://github.com/eyaltoledano/claude-task-master/issues/1714)).
- **Vibe Kanban:** sunset.
  - Shutdown announced 2026-04-10; cloud issues, comments and projects were removed about 30 days later; local workspaces keep working ([shutdown post](https://www.vibekanban.com/blog/shutdown)).
  - Issue features were cloud-only ([docs](https://vibekanban.com/docs/cloud/index.md)).
  - v0.1.44 replaced the board with an export page ([PR #3387](https://github.com/BloopAI/vibe-kanban/pull/3387)).
  - The code is Apache-2.0, but issue tracking is gone unless you self-host the remote server or fork an older version.
- **Focalboard:** the README says "This repository is currently not maintained" ([README](https://github.com/mattermost-community/focalboard)). It also has no subtasks or links.
- **Tegon** ([RedPlanetHQ/tegon](https://github.com/RedPlanetHQ/tegon)): archived 2025-03-30.

Not evaluated: Taskwarrior (MIT, CLI only, not a kanban tool).

## Sources

Repo metadata comes from `gh repo view` and `gh api repos/<repo>/{license,commits}`, pulled 2026-10-20/21.
- Vikunja: https://github.com/go-vikunja/vikunja/blob/main/pkg/license/license.go, https://github.com/go-vikunja/vikunja/blob/main/pkg/models/task_relation.go, https://vikunja.io/pricing/, https://vikunja.io/changelog/vikunja-2.7.0-was-released/, https://vikunja.io/help/mcp
- Huly: https://huly.io/pricing, https://docs.huly.io/integrations/github/, https://github.com/hcengineering/platform/blob/develop/models/tracker/src/types.ts, https://github.com/hcengineering/huly-selfhost
- Backlog.md: https://github.com/MrLesk/Backlog.md/blob/main/README.md, https://github.com/MrLesk/Backlog.md/blob/main/CLI-INSTRUCTIONS.md
- Redmine: https://www.redmine.org/projects/redmine/wiki/RedmineIssues, https://github.com/redmine/redmine/blob/master/app/models/issue_relation.rb, https://www.redmine.org/projects/redmine/wiki/Rest_api, https://www.redmineup.com/pages/plugins/agile
- Tududi: https://tududi.com/, https://github.com/chrisvel/tududi/tree/main/backend/modules/mcp
- Beads: https://github.com/gastownhall/beads, https://beads.gascity.com/
- Kanboard: https://github.com/kanboard/kanboard/blob/main/README.md, https://github.com/kanboard/kanboard/blob/main/app/Model/TaskLinkModel.php, https://kanboard.org/plugins.html
- WeKan: https://wekan.fi/commercial-support/, https://github.com/wekan/wekan/tree/main/docs
- Logseq: https://github.com/logseq/docs/blob/master/db-version.md
- Super Productivity: https://super-productivity.com/pricing/
- Taiga: https://taiga.io/deployment-pricing-options/, https://docs.taiga.io/integrations-github.html, https://community.taiga.io/t/launching-tenzu-taiganext-new-identity/3940
- Kan: https://kan.bn/pricing
- Worklenz: https://worklenz.com/pricing
- Tracks: https://github.com/TracksApp/tracks
- Plane: https://developers.plane.so/self-hosting/editions-and-versions, https://plane.so/pricing, https://docs.plane.so/integrations/github, https://docs.plane.so/ai/plane-ai, https://github.com/makeplane/plane-mcp-server
- OpenProject: https://www.openproject.org/pricing/, https://www.openproject.org/docs/system-admin-guide/integrations/mcp-server/, https://www.openproject.org/docs/system-admin-guide/integrations/github-integration/, https://www.openproject.org/legal/contributor-license-agreement/
- Leantime: https://leantime.io/pricing/, https://marketplace.leantime.io/product-category/plugins/
- AppFlowy: https://github.com/AppFlowy-IO/AppFlowy-Cloud, https://github.com/AppFlowy-IO/AppFlowy-SelfHost-Commercial, https://appflowy.com/pricing
- PLANKA: https://github.com/plankanban/planka/blob/master/LICENSE.md, https://planka.app/pricing, https://planka.app/features
- Taskmaster: https://github.com/eyaltoledano/claude-task-master/blob/main/LICENSE, https://tryhamster.com/pricing
- Vibe Kanban: https://www.vibekanban.com/blog/shutdown, https://github.com/BloopAI/vibe-kanban/pull/3387
- Focalboard: https://github.com/mattermost-community/focalboard
