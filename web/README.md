# OncoProtocol Assist — web UI

One-page Next.js 16 app for the UC1 protocol assistant: Sources (left), Chat (centre), Source viewer (right),
plus an Admin tab. Own theme tokens in `app/globals.css`, shadcn/ui primitives in `components/ui`.

## Run

```bash
cd web
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm build
```

The Python server (ADK `api_server` plus the protocol, PDF, upload and feedback endpoints) must run at `ADK_URL`
(default `http://localhost:8000`). Without it the UI still works on a built-in sample list, a mock answer and a
mock PDF, so it can be developed on its own.

| Variable | Default | Meaning |
|---|---|---|
| `ADK_URL` | `http://localhost:8000` | The Python server. |
| `ADK_APP_NAME` / `ADK_USER_ID` | `app` / `demo` | ADK app and user ids used for sessions. |

## Routes (thin proxies over the Python server)

- `GET /api/protocols` → `{ hospitals: string[], protocols: Protocol[], mock: boolean }` from `GET {ADK_URL}/protocols`.
  `Protocol = { id, short_title, full_title, kind: "master"|"sub", version, hospitals: string[], pages? }`. The UI
  filters by hospital client-side.
- `POST /api/chat` body `{ message, session_id?, hospital, protocol_ids: string[], include_subprotocols: boolean,
  history? }` → SSE. Creates/reuses `POST {ADK_URL}/apps/{app}/users/{user}/sessions/{session_id}` with
  `{ state: { hospital, protocol_ids, include_subprotocols } }`, then `POST {ADK_URL}/run_sse` with
  `{ app_name, user_id, session_id, new_message: { role: "user", parts: [{ text }] }, streaming: true }`.
  The browser starts a new session id whenever the selection changes (history stays on screen).
  Events, one per `data:` line: `{type:"session", session_id, mock}` · `{type:"status", text}` ·
  `{type:"delta", text}` · `{type:"done"}` · `{type:"error", message}`.
- `GET /api/pdf-url?id=` → `{ url: "/api/pdf/<id>", short_title, version }`.
- `GET /api/pdf/<id>` → the PDF bytes from `GET {ADK_URL}/pdf/<id>` (`application/pdf`); the viewer iframe uses
  `/api/pdf/<id>#page=<n>`.
- `POST /api/feedback` `{ question, answer, vote: "up"|"down", session_id }` → `{ ok, stored: "backend"|"local" }`
  via `POST {ADK_URL}/feedback` (local `web/.feedback.jsonl` when the server is down).
- `POST /api/admin/upload` multipart `{ file, short_title, kind, hospitals[] }` → `{ ok, id, pages }` via
  `POST {ADK_URL}/admin/upload` (hospitals joined with commas). The server extracts the page text and lists the
  protocol at once.

## Citations

The agent writes `[Short title vX, p. N, §Section]` (the version and the § part are optional). `lib/citations.ts`
parses that, the chat renders chips, and a click resolves the label to a protocol by short title (version
stripped) and opens the viewer at `#page=N`.
