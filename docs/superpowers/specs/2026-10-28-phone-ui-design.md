# Phone UI: board + quick create, works on the subway (task 17)

## Why

Andrew keeps personal things (shopping, daily todos) in Apple Reminders and
wants sparrow to stay the place for work. When a work idea comes up, he wants
to open sparrow on his phone, type it, and create it as fast as adding a
reminder. He is often on the subway with weak or no signal, so the phone app
must work there. Low-data use is the main focus.

Users: Andrew plus agents. No multi-user features.

## Success and anti-goal

- Success: from tapping the home-screen icon to a saved task is as fast as
  Reminders, with or without signal.
- Anti-goal: if putting the idea in Reminders and moving it later is easier,
  he will not use this. Anything that makes him wait for the network before
  he can see the board or type (spinners, blank screens, failed saves) is a
  failure even if it technically works.

## Goals

- Installable from Safari ("Add to Home Screen"): name, icon, opens without
  browser bars.
- Opens with no signal: the app shell is cached on the phone.
- Shows the last known board immediately, then updates in the background
  when a signal is available (stale-while-revalidate).
- Low data use when online (see "Data loading").
- Tasks created offline are saved on the phone and sent automatically the
  next time the app is open (or comes back to the foreground) with a signal.
  Photos wait with their task. iOS web apps cannot send in the background, so
  a task created and then closed stays on the phone until sparrow is opened
  again; Andrew accepted this. Pending tasks must be clearly visible.
- A create that is retried (lost response, flaky network) never makes a
  duplicate task.

## Non-goals

- Full offline sync (a complete local copy kept in sync, editing existing
  tasks offline, conflict resolution).
- Siri, widgets, share sheet, Apple Shortcuts, home-screen icon shortcuts.
  Andrew's real flow is: tap the icon, type.
- A separate native app or a separate mobile codebase.
- Hosting on a subdomain (task 25). The PWA must work at the current URL
  `https://andrewsserver.tail39014e.ts.net:8443`; task 25 may move it later.
- Sign-in. The tailnet is the auth boundary.

## Decisions (Andrew's)

- **Board first.** The phone opens on the kanban board, like Reminders/Jira
  open on the list, not on a capture box.
- **Board layout ("C"):** one column at a time. Column tabs across the top
  with task counts (Backlog, To do, In progress, In review, Done). A wide
  "+ New task" bar fixed at the bottom of the screen.
- **New task screen ("B"):** full screen. Top bar: "Cancel", title "New task",
  black "Create" button (the word is "Create", not "Post"). Cursor starts in
  the title. Below it: notes, a "Photo" button, a column dropdown. A "More"
  row expands parent, due, assignee, and links (the extra fields from the
  desktop QuickCreate).
- **Same theme as desktop.** Reuse the existing components and Tailwind
  classes (gray palette, white cards, `bg-gray-900` primary button) so style
  changes on desktop show on mobile with no extra work. Phone layout is a
  responsive variant of the same app, not a fork.
- **Reading cached tasks offline is in scope**; offline editing of existing
  tasks is not.
- **Efficient loading + local caching** following the usual pattern (cached
  app shell, cached last data, background revalidate, write outbox).
- **No background sending.** Sending on open/foreground is enough; a native
  app for background delivery is out of scope.
- **Search and filters on phone:** behind one "Filter" button at the top
  (search, assignee, due, hide subtasks, show done). Tab counts reflect the
  active filters. The "All tasks" list page stays desktop-only: no phone
  layout and no offline requirement for it.

## Behaviour details

### Desktop vs phone (builder's call, made in design)

- One code path for every browser: the service worker, cached board, and
  outbox apply on desktop too, so the phone is not a fork.
- When online, "Create" behaves as today on both: it waits for the server
  and shows errors as it does now. The outbox and "Waiting to send" only
  apply when the device is offline (or the request fails on the network).

### Offline / stale state

- When offline, a thin bar under the top edge says so and how old the shown
  data is, e.g. "Offline · tasks from 10 min ago" (amber, small text).
- A task created offline appears in its column with a dashed border and the
  label "Waiting to send" until the server confirms it, then becomes a normal
  card with its real id.
- If a queued create fails for a reason that is not the network (e.g. a 4xx
  validation error), it must not be silently dropped: keep it visible with an
  error and a way to retry or discard.

### Data loading

Measured today: `GET /api/tasks` is ~18 KB, uncompressed, no ETag. The
board itself loads through the SSE stream `/api/events`, which sends the
full index as a `snapshot` on every connect, so every reconnect on a flaky
connection re-downloads everything.

Required:
- Compress JSON responses (gzip or brotli).
- A reconnect or revalidate when nothing changed costs a tiny response, not
  the full index (e.g. ETag/304 on the index, or a version the client sends
  on SSE reconnect so the server skips an unchanged snapshot).
- Full delta sync ("send only changed tasks") is not required at this data
  size.

### Photos

- "Photo" lets Andrew take a photo or pick one from the library
  (screenshots included).
- The phone downsizes and re-encodes images before upload so a typical photo
  is a few hundred KB, not several MB.
- Uploads use the existing attachments API after the task exists; the 25 MB
  limit stays.

### Opening and moving tasks on the phone

- Tapping a card opens the existing task detail view, full screen on phone
  widths. The column is changed there (status dropdown). No drag-and-drop
  between tabs on phone.
- The new-task column defaults to the tab Andrew was on.
- "Cancel" after typing asks before discarding, like the desktop
  QuickCreate.

## Constraints

- Next.js 16 app router, React 19, zustand store (`src/client/store.ts`),
  Tailwind v4. Live updates come from SSE `/api/events` (`snapshot`,
  `upsert`, `remove` events).
- Task ids are assigned by the server, so offline-created tasks need a
  temporary client id until confirmed.
- iOS Safari only (Andrew's phone is an iPhone). Service workers need HTTPS;
  the current tailnet URL has a valid cert. iOS may evict PWA storage after
  long disuse; the app must still work (just slower) if the cache is gone.
- The phone reaches the server only through the Tailscale app. With no
  signal, Tailscale is down too, so the phone must hold everything it needs.
- Deploys restart the server and change the app's code; the service worker
  must not keep serving an old app shell forever after a deploy.
- Desktop behaviour must not regress.

## Left to the builder

- Service worker approach (hand-written vs a library such as Serwist) and
  caching strategy per route.
- Local storage technology for cached data and the outbox (IndexedDB is the
  expected choice).
- Mechanism for duplicate-free retries (client-generated idempotency key,
  where it is stored).
- How "nothing changed" is detected (ETag, index version, Last-Event-ID).
- Image size/quality targets and encoder.
- Breakpoint for the phone layout, icon artwork, manifest details.
- Whether the "Waiting to send" outbox also shows somewhere besides the
  board.
