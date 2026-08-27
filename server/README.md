# ChatAsset server — Phase 2 + 3 + 5 technical spike

Goal: confirm the Chrome extension can send a captured question to a server
and have it saved (Phase 2), that the saved questions can be browsed and
searched in a simple list (Phase 3 + 4), that a long question can be
summarized on demand via the Claude API (Phase 5), and that questions asked
*before* you started using ChatAsset can be backfilled from ChatGPT's own
data export (see "Importing past ChatGPT history" below). No database, no
auth.

## Setup (one-time)

```
npm install
```

This installs the one dependency this phase adds: `@anthropic-ai/sdk`
(needed only for the "要約する" / summarize button — everything else in
this project has zero dependencies).

### API key (only needed for the summarize button)

Question capture, browsing, and search all work with **no API key at
all**. The key is only needed if you click "要約する" on a long question.

1. Go to https://console.anthropic.com/ and sign in (or create an
   account).
2. You'll need billing set up (a payment method + a small amount of
   credit) before an API key can actually be used — this is Anthropic's
   account, not something ChatAsset sets up.
3. Go to "API Keys" and create a new key. It starts with `sk-ant-...`.
4. In this `server/` folder, copy `.env.example` to a new file named
   `.env`, and paste your key in:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   `.env` is gitignored — it's never committed.

Summaries use Claude Haiku 4.5, the cheapest current model — a single
summary costs a small fraction of a cent. Nothing is summarized
automatically; it only happens when you click the button, so you're always
in control of when it's used.

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

If `ANTHROPIC_API_KEY` isn't set, you'll also see a note that the
summarize button won't work yet — everything else is unaffected.

Leave it running while you use the Chrome extension. Then open
http://localhost:8787/ in a browser to see the question list.

## What it does

- `POST /api/questions` — body: `{ provider, question, timestamp,
  conversationUrl }`. Requires `provider` and `question` to be non-empty
  strings; the other two are optional. Appends a record (with a generated
  `id`, `questionSummary: null`, and `receivedAt`) to `~/.chatasset/questions.json`
  and returns it.
- `GET /api/questions` — returns everything saved so far, as a JSON array.
  Used by the list page below; also handy directly
  (`curl http://localhost:8787/api/questions`).
- `POST /api/questions/:id/summarize` — calls Claude to generate a short
  (~20-30 character) Japanese summary of that question's full text, saves
  it as `questionSummary` on the record, and returns the updated record.
  The original `question` text is never modified or discarded — the
  summary is stored alongside it, purely for display/search. Fails with a
  clear error if `ANTHROPIC_API_KEY` isn't set.
- `GET /` — serves `public/index.html`, a plain HTML/CSS/JS page (no
  framework, no build step) with:
  - the question list, newest-first: provider, date/time, question text,
    link to the original conversation
  - a search box that filters by question text, summary, and provider
    name (client-side, over what's already loaded)
  - for any question over ~40 characters with no summary yet, a "要約する"
    button; once summarized, the list shows the summary in bold with a
    "全文を見る" toggle to expand the original text

## Data

Every captured question is stored at **`~/.chatasset/questions.json`** — in
your home folder, *not* inside this project folder. This is deliberate:
this whole `server/` folder gets replaced every time you download a new
ZIP to pick up an update, but `~/.chatasset` doesn't, so your question
history survives updates instead of silently starting over each time.

(To find it in Finder: `Cmd+Shift+G`, type `~/.chatasset`, press Enter —
it's a hidden folder since its name starts with a dot.)

This is real personal data (what you asked an AI, when, and a link to the
conversation) — it lives only on your machine and is never part of this
git repository. Delete the file any time to reset; the server recreates it
on the next successful `POST`.

`.env` (your API key) still lives inside this `server/` folder, so it does
need to be recreated after downloading a fresh copy — seeded from
`.env.example`, this only takes a moment (see above).

## Importing past ChatGPT history

The Chrome extension only sees the conversation you have open right now —
it can't retroactively capture questions you asked before installing it.
For that, ChatGPT has its own official export feature, which is more
reliable than trying to scrape old conversations out of the page (no real
timestamps to scrape, and the DOM structure isn't a stable target).

1. In ChatGPT: Settings → Data controls → Export data → confirm. Within a
   few minutes you'll get an email from OpenAI with a download link (the
   link expires after a while, so download it soon).
2. Download and unzip it. Find **`conversations.json`** inside — that's
   the one this script reads.
3. Make sure the ChatAsset server is running (`node server.js`, in its own
   terminal window/tab).
4. In another terminal, in this `server/` folder, run:
   ```
   node import-chatgpt-export.js /path/to/conversations.json
   ```
   (Drag the `conversations.json` file into the terminal after typing the
   command and a space, same as with other file paths in this project, to
   fill in the path without typing it by hand.)

It prints how many of your own messages it found and imported. It only
ever reads messages where the author role is "user" — it never looks at
the AI's answers, even though the export file contains them. It's safe to
run again on the same file (e.g. after exporting again later): it checks
what's already saved first and skips exact duplicates.

The export file itself is a complete copy of your ChatGPT history,
including the AI's answers — unlike anything ChatAsset stores, so once
you've imported what you want, it's worth deleting that download if you
don't need it lying around.

## Known caveats

- No auth, no HTTPS: this only makes sense bound to `localhost` while
  developing. It is not meant to be exposed to the network as-is.
- No de-duplication server-side. If the extension sends the same question
  twice (e.g. because it's loaded twice — see `../extension/README.md`),
  both get saved as separate records.
- The summarize prompt explicitly asks Claude to describe what's being
  asked, not to interpret the asker's intent or state of mind — matching
  this project's principle of recording facts, not AI-generated
  interpretation. Still, any model-generated text can occasionally be
  off; the original question is always shown via "全文を見る" so you can
  check it.
