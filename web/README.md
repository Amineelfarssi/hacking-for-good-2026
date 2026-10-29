# OncoProtocol Assist — web UI

One-page Next.js 16 app for the UC1 protocol assistant: Sources (left), Chat (centre), Source viewer (right),
plus an Admin tab. Built from rx-note-web's calm dashboard theme and `components/ui` primitives.

## Run

```bash
cd web
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm build
```

Environment (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `MANIFEST_PATH` | `../data/uc1/manifest.jsonl` | Protocol list, one JSON object per line. Missing file → built-in mock (6 masters, 2 subs). |
| `ADK_URL` | `http://localhost:8000` | ADK `api_server`. Unreachable → a generic mock answer is streamed. |
| `ADK_APP_NAME` / `ADK_USER_ID` | `app` / `demo` | ADK app and user ids used for sessions. |
| `FEEDBACK_BUCKET` | unset | Thumbs feedback goes to `gs://$FEEDBACK_BUCKET/feedback/<date>.jsonl`; unset → `web/.feedback.jsonl`. |

Start the agent with `uv run adk api_server app` from the repo root, then `pnpm dev` here.

## Routes

- `GET /api/protocols` → `{ hospitals: string[], protocols: Protocol[] }`. `Protocol = { id, short_title, full_title,
  kind: "master"|"sub", version, hospitals: string[], gcs_uri, file?, pages? }`. Reads `MANIFEST_PATH` (plus
  `web/.uploads/manifest.jsonl` when the manifest is not writable), else the mock.
- `POST /api/chat` body `{ message, session_id?, hospital, protocol_ids: string[], include_subprotocols: boolean,
  history? }` → SSE. Creates/reuses `POST {ADK_URL}/apps/{app}/users/{user}/sessions/{session_id}` with
  `{ state: { hospital, protocol_ids, include_subprotocols } }`, then `POST {ADK_URL}/run_sse` with
  `{ app_name, user_id, session_id, new_message: { role: "user", parts: [{ text }] }, streaming: true, state_delta }`.
  The browser receives normalised events, one per `data:` line:
  `{type:"session", session_id, mock}` · `{type:"status", text}` · `{type:"delta", text}` · `{type:"done"}` ·
  `{type:"error", message}`.
- `GET /api/pdf-url?id=` → `{ url, short_title, version }`. `url` is `/api/pdf?id=…` when the PDF is on disk
  (manifest `file` relative to the manifest folder, or an admin upload), a V4 signed URL for a `gs://` `gcs_uri`
  (ADC), else `/mock.pdf`.
- `GET /api/pdf?id=` → the local PDF bytes.
- `POST /api/feedback` `{ question, answer, vote: "up"|"down", session_id }` → `{ ok, stored: "gcs"|"local" }`.
- `POST /api/admin/upload` multipart `{ file, short_title, kind, hospitals[] }` → `{ ok, id, stored_at, manifest,
  protocol }`. Saves to `web/.uploads/<id>.pdf` and appends a manifest row. GCS upload + Discovery Engine import:
  see the TODO in `app/api/admin/upload/route.ts` (lane D).

## Citations

The agent writes `[Short title vX, p. N, §Section]`. `lib/citations.ts` parses that, the chat renders chips, and a
click resolves the label to a protocol by short title (version stripped) and opens the viewer at `#page=N`.
