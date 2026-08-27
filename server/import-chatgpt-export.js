// ChatAsset — one-time import of ChatGPT's official data export.
//
// The Chrome extension only sees the conversation currently open in the
// browser, so it can't backfill everything you've asked before you
// started using ChatAsset. Scraping every past conversation's DOM would
// be fragile and wouldn't have real timestamps anyway. Instead, this uses
// OpenAI's own "Export data" feature (Settings -> Data controls ->
// Export), which ships a conversations.json containing every message
// with its real original timestamp — far more reliable than scraping.
//
// This script reads that file and imports ONLY the user's own messages
// (role "user") into ChatAsset. It never reads or stores the AI's
// answers, matching this project's principle of recording questions, not
// AI-generated content — even though the export file itself does contain
// full answers on your disk; this script simply never looks at them.
//
// Usage (with the ChatAsset server already running in another terminal):
//   node import-chatgpt-export.js /path/to/conversations.json
//
// Safe to run more than once: it fetches what's already saved first and
// skips anything that matches on conversation + timestamp + text.
const fs = require("fs");
const path = require("path");

const SERVER_URL = process.env.CHATASSET_SERVER || "http://localhost:8787";

function extractUserMessages(conversation) {
  const conversationId = conversation.conversation_id || conversation.id;
  const conversationUrl = conversationId ? `https://chatgpt.com/c/${conversationId}` : "";
  const mapping = conversation.mapping || {};
  const records = [];

  for (const node of Object.values(mapping)) {
    const message = node && node.message;
    if (!message || !message.author || message.author.role !== "user") continue;
    if (message.metadata && message.metadata.is_visually_hidden_from_conversation) continue;

    const content = message.content;
    if (!content || content.content_type !== "text" || !Array.isArray(content.parts)) continue;
    if (!content.parts.every((part) => typeof part === "string")) continue;

    const text = content.parts.join("").trim();
    if (!text) continue;

    const createTime = message.create_time ?? conversation.create_time;
    const timestamp = createTime
      ? new Date(createTime * 1000).toISOString()
      : new Date().toISOString();

    records.push({ provider: "ChatGPT", question: text, timestamp, conversationUrl });
  }

  return records;
}

async function fetchExistingKeys() {
  let res;
  try {
    res = await fetch(`${SERVER_URL}/api/questions`);
  } catch (err) {
    throw new Error(
      `Could not reach the ChatAsset server at ${SERVER_URL}. ` +
        "Make sure 'node server.js' is running in another terminal, then try again."
    );
  }
  if (!res.ok) throw new Error(`ChatAsset server returned HTTP ${res.status}`);
  const existing = await res.json();
  return new Set(existing.map((q) => `${q.conversationUrl}|${q.timestamp}|${q.question}`));
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node import-chatgpt-export.js /path/to/conversations.json");
    process.exit(1);
  }

  const conversations = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
  if (!Array.isArray(conversations)) {
    console.error("Expected conversations.json to contain a JSON array of conversations.");
    process.exit(1);
  }

  console.log(`[import] found ${conversations.length} conversations, extracting your questions...`);
  const records = conversations.flatMap(extractUserMessages);
  console.log(`[import] extracted ${records.length} of your messages.`);

  console.log("[import] checking what's already saved, to skip duplicates...");
  const existingKeys = await fetchExistingKeys();

  let imported = 0;
  let skipped = 0;
  for (const record of records) {
    const key = `${record.conversationUrl}|${record.timestamp}|${record.question}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const res = await fetch(`${SERVER_URL}/api/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      console.warn(`[import] failed to save one question (HTTP ${res.status}): ${record.question.slice(0, 40)}...`);
      continue;
    }
    existingKeys.add(key);
    imported++;
    if (imported % 50 === 0) console.log(`[import] ${imported} saved so far...`);
  }

  console.log(`[import] done. Imported ${imported} new question(s), skipped ${skipped} already-saved duplicate(s).`);
}

main().catch((err) => {
  console.error("[import] failed:", err.message);
  process.exit(1);
});
