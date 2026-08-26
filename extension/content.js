// ChatAsset — Phase 1 technical spike.
//
// Goal: confirm that a Chrome extension can detect the question a user
// submits on the ChatGPT web UI. This script does nothing but log to the
// console — no network calls, no storage, no reading of AI answers.
(function () {
  const PROVIDER = "ChatGPT";

  // ChatGPT re-renders messages during streaming, so a node is only ever
  // logged once (on first appearance) to avoid duplicate console spam.
  const loggedNodes = new WeakSet();

  function handleUserMessageNode(node) {
    if (loggedNodes.has(node)) return;

    const text = node.textContent.trim();
    if (!text) return;

    loggedNodes.add(node);

    console.log("[ChatAsset]");
    console.log("Provider:", PROVIDER);
    console.log("Question:", text);
    console.log("Timestamp:", new Date().toISOString());
    console.log("Conversation URL:", window.location.href);
  }

  function scanNode(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;

    if (root.matches?.('[data-message-author-role="user"]')) {
      handleUserMessageNode(root);
    }

    root
      .querySelectorAll?.('[data-message-author-role="user"]')
      .forEach(handleUserMessageNode);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(scanNode);
    }
  });

  function start() {
    scanNode(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
    console.log(
      "[ChatAsset] content script loaded on",
      window.location.hostname,
      "— watching for submitted questions."
    );
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
