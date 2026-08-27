// ChatAsset — Phase 1 technical spike.
//
// Goal: confirm that a Chrome extension can detect the question a user
// submits on the ChatGPT web UI, with an accurate submission timestamp.
// This script does nothing but log to the console — no network calls, no
// storage, no reading of AI answers.
//
// Detection strategy: capture the prompt text at the moment of submission
// (Enter key, send button click, or the form's submit event), rather than
// watching the rendered conversation DOM. Watching the DOM also fires when
// a page reload re-renders the entire message history, which would log old
// questions as if they were just asked — reading it from the live user
// action avoids that.
(function () {
  const PROVIDER = "ChatGPT";
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

    console.log("[ChatAsset]");
    console.log("Provider:", PROVIDER);
    console.log("Question:", text);
    console.log("Timestamp:", new Date(now).toISOString());
    console.log("Conversation URL:", window.location.href);
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
