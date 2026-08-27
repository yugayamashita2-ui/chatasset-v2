# ChatAsset — Phase 1 + 2 + 7 technical spike

Goal: confirm that a Chrome extension can detect a question a user submits on
an AI's web UI, and send it to a local ChatAsset server for storage. No
capture of the AI's answer, ever.

Both ChatGPT (`content.js`) and Claude (`content-claude.js`) are confirmed
working through real testing — see "Claude support" below for what testing
found and fixed.

## How it works

Each content script listens for the moment a question is actually
submitted — pressing Enter in the prompt box, clicking the send button, or
the surrounding form's `submit` event — and reads the prompt text at that
instant. When it fires, it:

1. Logs a `[ChatAsset]` block to the console (`Provider`, `Question`,
   `Timestamp`, `Conversation URL`).
2. Sends the same four fields as JSON to `http://localhost:8787/api/questions`
   (the ChatAsset server — see `../server/`).

If the server isn't running, the `fetch` fails and a `console.warn` is
printed; nothing else breaks. The console log always happens regardless of
whether the server is reachable.

An earlier version of `content.js` watched the rendered conversation DOM
instead (`MutationObserver` on `[data-message-author-role="user"]`). That
approach also fired when a page reload re-rendered old messages already in
the conversation, logging them with the current time as if they had just
been asked. Capturing at the moment of submission avoids that: reloading a
page doesn't "submit" anything, so old messages are never re-logged.

## Run it end to end

1. Start the server (see `../server/README.md` — short version:
   `node server.js` from the `server/` folder, leave it running).
2. Open `chrome://extensions`, enable "Developer mode", click "Load
   unpacked", and select this `extension/` folder. If you already had a
   version loaded, remove it first rather than loading a second copy —
   two active copies means every question gets logged/sent twice.
3. Open https://chatgpt.com (or https://claude.ai) and open the DevTools
   console (F12).
4. Send a message, e.g. "Hello, how can I improve my IELTS speaking?".
5. Confirm the console prints a `[ChatAsset]` block followed by
   `[ChatAsset] saved to server.`.
6. Open http://localhost:8787/ — the question should appear in the list.

## Claude support

`content-claude.js` follows the exact same strategy as `content.js`.
Unlike ChatGPT's, its selectors (`PROMPT_SELECTORS`, the `aria-label`/
`data-testid` guesses in `isSendButton`) were written without being able
to inspect the real claude.ai page first — they turned out to work on the
first real test (a plain `[contenteditable="true"]` message with English
"send" in its `aria-label` was enough), but that was confirmed by testing
on the actual page, not assumed in advance. That same test also surfaced
the "new conversation URL" issue documented in the caveats below.

If detection ever stops firing (claude.ai's DOM isn't a stable target any
more than ChatGPT's is), inspecting the actual composer/button elements in
DevTools and adjusting `PROMPT_SELECTORS` / `isSendButton` in
`content-claude.js` is the next step, not guessing further.

## Scope / permissions

- `matches` is limited to `chatgpt.com`, `chat.openai.com`, and
  `claude.ai` — no broad host permissions. Each provider's script only
  runs on that provider's own domain.
- `host_permissions` is limited to `http://localhost:8787/*` — just enough
  to let the content scripts' `fetch` reach the local ChatAsset server.
- No background service worker. The only network call either script makes
  is the one `POST` per submitted question.

## Known caveats to verify while testing

- A provider's DOM structure is not a public API and can change without
  notice. If detection stops firing, this is the first thing to check.
- Enter, click, and the form's `submit` event can all fire for the same
  submission; a short dedupe window (same text within ~1s) collapses these
  into a single log entry. If you see a real double-submit missed because
  of this, the window may need tuning.
- If `chrome://extensions` ever shows the same extension loaded more than
  once (two "content script loaded" lines in the console for one page),
  every submission gets logged and sent twice. Remove the duplicate rather
  than debugging around it.
- IME input (Japanese, Chinese, Korean, ...): confirming a conversion
  candidate also presses Enter, but it isn't a real submission. Found via
  manual testing with Japanese input on ChatGPT — a single sentence was
  logged and sent to the server several times, once per conversion-confirm
  Enter. Fixed by skipping Enter presses where `event.isComposing` is true
  (Safari fallback: `event.keyCode === 229`); both content scripts do this.
- A brand-new conversation's URL isn't permanent yet at the instant of the
  first message — found via manual testing on claude.ai, where the very
  first message of a new chat recorded `conversationUrl` as
  `https://claude.ai/new` instead of a real conversation link, because the
  page hadn't finished routing to the permanent URL yet. Both content
  scripts now wait 800ms after detecting a submission before reading
  `location.href` (the question text and timestamp are still captured
  immediately, at the real moment of submission — only the URL read is
  delayed). If this still occasionally races on a slow connection, the
  delay may need to be longer.
