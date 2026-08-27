# ChatAsset — Phase 1 technical spike

Goal: confirm that a Chrome extension can detect a question a user submits on
ChatGPT's web UI. Nothing else. No storage, no network calls, no capture of
the AI's answer.

## How it works

`content.js` listens for the moment a question is actually submitted —
pressing Enter in the prompt box, clicking the send button, or the
surrounding form's `submit` event — and reads the prompt text at that
instant. When it fires, the text is logged to the console along with the
current timestamp and conversation URL.

An earlier version watched the rendered conversation DOM instead
(`MutationObserver` on `[data-message-author-role="user"]`). That approach
also fired when a page reload re-rendered old messages already in the
conversation, logging them with the current time as if they had just been
asked. Capturing at the moment of submission avoids that: reloading a page
doesn't "submit" anything, so old messages are never re-logged.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this `extension/` folder.
4. Open https://chatgpt.com and open the DevTools console (F12).
5. Send a message, e.g. "Hello, how can I improve my IELTS speaking?".
6. Confirm the console prints a `[ChatAsset]` block with `Provider`,
   `Question`, `Timestamp`, and `Conversation URL`.

## Scope / permissions

- `matches` is limited to `chatgpt.com` and `chat.openai.com` — no
  broad host permissions.
- No `host_permissions`, no background service worker, no `fetch`/`XHR`.
  This build only proves detection is possible; sending data to a
  ChatAsset backend is a later phase.

## Known caveats to verify while testing

- ChatGPT's DOM structure (the `#prompt-textarea` id, `data-testid` on the
  send button) is not a public API and can change without notice. If
  detection stops firing, this is the first thing to check.
- Enter, click, and the form's `submit` event can all fire for the same
  submission; a short dedupe window (same text within ~1s) collapses these
  into a single log entry. If you see a real double-submit missed because
  of this, the window may need tuning.
