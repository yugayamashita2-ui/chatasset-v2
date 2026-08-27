# ChatAsset — Phase 1 + 2 technical spike

Goal: confirm that a Chrome extension can detect a question a user submits on
ChatGPT's web UI, and send it to a local ChatAsset server for storage. No
capture of the AI's answer, ever.

## How it works

`content.js` listens for the moment a question is actually submitted —
pressing Enter in the prompt box, clicking the send button, or the
surrounding form's `submit` event — and reads the prompt text at that
instant. When it fires, it:

1. Logs a `[ChatAsset]` block to the console (`Provider`, `Question`,
   `Timestamp`, `Conversation URL`).
2. Sends the same four fields as JSON to `http://localhost:8787/api/questions`
   (the ChatAsset server — see `../server/`).

If the server isn't running, the `fetch` fails and a `console.warn` is
printed; nothing else breaks. The console log always happens regardless of
whether the server is reachable.

An earlier version watched the rendered conversation DOM instead
(`MutationObserver` on `[data-message-author-role="user"]`). That approach
also fired when a page reload re-rendered old messages already in the
conversation, logging them with the current time as if they had just been
asked. Capturing at the moment of submission avoids that: reloading a page
doesn't "submit" anything, so old messages are never re-logged.

## Run it end to end

1. Start the server (see `../server/README.md` — short version:
   `node ../server/server.js`, leave it running).
2. Open `chrome://extensions`, enable "Developer mode", click "Load
   unpacked", and select this `extension/` folder. If you already had a
   version loaded, remove it first rather than loading a second copy —
   two active copies means every question gets logged/sent twice.
3. Open https://chatgpt.com and open the DevTools console (F12).
4. Send a message, e.g. "Hello, how can I improve my IELTS speaking?".
5. Confirm the console prints a `[ChatAsset]` block followed by
   `[ChatAsset] saved to server.`.
6. Check `../server/data/questions.json` — the record should be appended
   there.

## Scope / permissions

- `matches` is limited to `chatgpt.com` and `chat.openai.com` — no broad
  host permissions.
- `host_permissions` is limited to `http://localhost:8787/*` — just enough
  to let the content script's `fetch` reach the local ChatAsset server.
- No background service worker. The only network call this extension makes
  is the one `POST` per submitted question.

## Known caveats to verify while testing

- ChatGPT's DOM structure (the `#prompt-textarea` id, `data-testid` on the
  send button) is not a public API and can change without notice. If
  detection stops firing, this is the first thing to check.
- Enter, click, and the form's `submit` event can all fire for the same
  submission; a short dedupe window (same text within ~1s) collapses these
  into a single log entry. If you see a real double-submit missed because
  of this, the window may need tuning.
- If `chrome://extensions` ever shows the same extension loaded more than
  once (two "content script loaded" lines in the console for one page),
  every submission gets logged and sent twice. Remove the duplicate rather
  than debugging around it.
