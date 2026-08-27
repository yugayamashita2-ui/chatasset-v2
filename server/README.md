# ChatAsset server — Phase 2 + 3 technical spike

Goal: confirm the Chrome extension can send a captured question to a server
and have it saved (Phase 2), and that the saved questions can be browsed in
a simple list (Phase 3). No database, no auth, no external npm dependencies
— just Node's built-in `http` module, a JSON file on disk, and a static
HTML page.

## Run it

```
node server.js
```

or, from this directory:

```
npm start
```

You should see:

```
[ChatAsset] server listening on http://localhost:8787
```

Leave it running while you use the Chrome extension. Then open
http://localhost:8787/ in a browser to see the question list.

## What it does

- `POST /api/questions` — body: `{ provider, question, timestamp,
  conversationUrl }`. Requires `provider` and `question` to be non-empty
  strings; the other two are optional. Appends a record (with a generated
  `id` and `receivedAt`) to `data/questions.json` and returns it.
- `GET /api/questions` — returns everything saved so far, as a JSON array.
  Used by the list page below; also handy directly
  (`curl http://localhost:8787/api/questions`).
- `GET /` — serves `public/index.html`, a plain HTML/CSS/JS page (no
  framework, no build step) that fetches `/api/questions` and renders each
  question newest-first: provider, date/time, the question text, and a
  link to the original conversation. Click "更新" to refetch.

## Data

`data/questions.json` holds every captured question — this is real personal
data (what you asked an AI, when, and a link to the conversation). It's
listed in `.gitignore` so it's never committed. Delete the file any time to
reset; the server recreates it on the next successful `POST`.

## Known caveats

- No auth, no HTTPS: this only makes sense bound to `localhost` while
  developing. It is not meant to be exposed to the network as-is.
- No de-duplication server-side. If the extension sends the same question
  twice (e.g. because it's loaded twice — see `../extension/README.md`),
  both get saved as separate records.
