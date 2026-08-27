// ChatAsset — Phase 7 technical spike: Claude (claude.ai).
//
// Same detection strategy as the ChatGPT content script (content.js):
// capture the prompt text at the moment of submission — Enter, a send
// button click, or a form's submit event — rather than watching the
// rendered conversation DOM, and skip Enter presses that are really an
// IME composition confirm.
//
// UNVERIFIED: unlike content.js, this has not yet been confirmed against
// the real claude.ai page. Its composer has no fixed id to key off like
// ChatGPT's "#prompt-textarea", and claude.ai's UI may not dispatch a
// native 'submit' DOM event at all — this project's rule is to test
// against the real page rather than assume, so treat this file as a
// first attempt until that's done (see extension/README.md).
(function () {
  const PROVIDER = "Claude";
  const SERVER_URL = "http://localhost:8787/api/questions";
  const PROMPT_SELECTORS = [
    '[contenteditable="true"].ProseMirror',
    '[contenteditable="true"][data-testid="chat-input"]',
    'div[contenteditable="true"]',
  ];
  const DEDUPE_WINDOW_MS = 1000;

  let lastLoggedText = "";
  let lastLoggedAt = 0;

  function getPromptText() {
    for (const selector of PROMPT_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = (el.innerText ?? "").trim();
      if (text) return text;
    }
    return "";
  }

  function sendToServer(record) {
    fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        console.log("[ChatAsset] saved to server.");
      })
      .catch((err) => {
        console.warn(
          "[ChatAsset] could not reach ChatAsset server (is it running on localhost:8787?)",
          err
        );
      });
  }

  function logQuestion() {
    const text = getPromptText();
    if (!text) return;

    // Enter-key, click, and submit listeners can all fire for the same
    // submission; skip if we just logged this exact text.
    const now = Date.now();
    if (text === lastLoggedText && now - lastLoggedAt < DEDUPE_WINDOW_MS) {
      return;
    }
    lastLoggedText = text;
    lastLoggedAt = now;

    const record = {
      provider: PROVIDER,
      question: text,
      timestamp: new Date(now).toISOString(),
      conversationUrl: window.location.href,
    };

    console.log("[ChatAsset]");
    console.log("Provider:", record.provider);
    console.log("Question:", record.question);
    console.log("Timestamp:", record.timestamp);
    console.log("Conversation URL:", record.conversationUrl);

    sendToServer(record);
  }

  function isSendButton(target) {
    const btn = target.closest?.("button");
    if (!btn) return false;
    if (btn.getAttribute("data-testid") === "send-message-button") return true;
    const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
    return ariaLabel.includes("send");
  }

  document.addEventListener("submit", logQuestion, true);

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.isComposing || event.keyCode === 229) return;
      if (document.activeElement?.getAttribute("contenteditable") !== "true") return;
      logQuestion();
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!isSendButton(event.target)) return;
      logQuestion();
    },
    true
  );

  console.log(
    "[ChatAsset] content script loaded on",
    window.location.hostname,
    "— watching for submitted questions. (Claude support is unverified — please test and report what happens.)"
  );
})();
