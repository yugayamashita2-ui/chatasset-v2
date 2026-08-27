// ChatAsset — Phase 1 + Phase 2 technical spike.
//
// Goal: confirm that a Chrome extension can detect the question a user
// submits on the ChatGPT web UI, with an accurate submission timestamp, and
// send it to a local ChatAsset server. Still no capture of AI answers, and
// nothing beyond the question text, provider, timestamp, and conversation
// URL is sent.
//
// Detection strategy: capture the prompt text at the moment of submission
// (Enter key, send button click, or the form's submit event), rather than
// watching the rendered conversation DOM. Watching the DOM also fires when
// a page reload re-renders the entire message history, which would log old
// questions as if they were just asked — reading it from the live user
// action avoids that.
(function () {
  const PROVIDER = "ChatGPT";
  const SERVER_URL = "http://localhost:8787/api/questions";
  const PROMPT_SELECTORS = [
    "#prompt-textarea",
    'form [contenteditable="true"]',
    "form textarea",
  ];
  const DEDUPE_WINDOW_MS = 1000;

  let lastLoggedText = "";
  let lastLoggedAt = 0;

  function getPromptText() {
    for (const selector of PROMPT_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = (el.innerText ?? el.value ?? "").trim();
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
    if (btn.getAttribute("data-testid") === "send-button") return true;
    const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
    return ariaLabel.includes("send");
  }

  document.addEventListener("submit", logQuestion, true);

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      // Skip Enter presses used to confirm an IME conversion (e.g. Japanese
      // kanji candidates) — those aren't a real submission, and treating
      // them as one logs the sentence over and over as it's being typed.
      if (event.isComposing || event.keyCode === 229) return;
      if (document.activeElement?.id !== "prompt-textarea") return;
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
    "— watching for submitted questions."
  );
})();
