# ChatAsset — Phase 1 technical spike

Goal: confirm that a Chrome extension can detect a question a user submits on
ChatGPT's web UI. Nothing else. No storage, no network calls, no capture of
the AI's answer.

## How it works

`content.js` watches the ChatGPT conversation DOM with a `MutationObserver`
for elements matching `[data-message-author-role="user"]` — the container
ChatGPT renders for each message the user sends, regardless of whether it
was submitted by clicking the send button, pressing Enter, or on mobile.
When one appears, its text is logged to the console along with a timestamp
and the current conversation URL.

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

- ChatGPT's DOM structure (the `data-message-author-role` attribute) is not
  a public API and can change without notice. If detection breaks, this is
  the first thing to check.
- Edited/regenerated messages may re-render as new DOM nodes; this script
  logs each new node once, so an edit could produce a second log entry.
  That's fine for this spike — the goal is only "can we detect it".
