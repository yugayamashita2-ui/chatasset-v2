# ChatAsset server — Phase 2 technical spike

Goal: confirm the Chrome extension can send a captured question to a server
and have it saved. No database, no auth, no external npm dependencies —
just Node's built-in `http` module and a JSON file on disk.

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

Leave it running while you use the Chrome extension.

## What it does

- `POST /api/questions` — body: `{ provider, question, timestamp,
  conversationUrl }`. Requires `provider` and `question` to be non-empty
  strings; the other two are optional. Appends a record (with a generated
  `id` and `receivedAt`) to `data/questions.json` and returns it.
- `GET /api/questions` — returns everything saved so far, as a JSON array.
  Not used by the extension yet; useful for checking what got saved
  (`curl http://localhost:8787/api/questions`).

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
