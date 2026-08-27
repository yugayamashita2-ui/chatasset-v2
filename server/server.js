// ChatAsset MVP server — Phase 2 + 3 + 5 technical spike.
//
// Accepts questions captured by the Chrome extension and appends them to a
// local JSON file, serves a list/search page, and (Phase 5) can generate a
// short summary of a long question on demand via the Claude API. No
// database, no auth: this only proves each path works end to end.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");

const PORT = process.env.PORT || 8787;
// Deliberately outside this project folder: re-downloading/re-extracting a
// new copy of ChatAsset (e.g. to pick up an update) must never orphan
// previously captured questions. ~/.chatasset survives that.
const DATA_FILE = path.join(os.homedir(), ".chatasset", "questions.json");
const INDEX_FILE = path.join(__dirname, "public", "index.html");
const ENV_FILE = path.join(__dirname, ".env");
const MAX_BODY_BYTES = 100_000; // a single question should never be this long
const SUMMARY_MODEL = "claude-haiku-4-5"; // cheapest current model; plenty for a one-line summary

loadEnvFile();

function loadEnvFile() {
  let raw;
  try {
    raw = fs.readFileSync(ENV_FILE, "utf8");
  } catch {
    return; // no .env file — that's fine, ANTHROPIC_API_KEY may be set another way
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

function readQuestions() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function writeQuestions(questions) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(questions, null, 2));
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function summarizeQuestion(questionText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error(
      "ANTHROPIC_API_KEY is not set. Add it to server/.env (see server/README.md)."
    );
    err.statusCode = 500;
    throw err;
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: SUMMARY_MODEL,
    max_tokens: 100,
    system:
      "あなたは、長い質問文を検索・一覧表示用に短く要約するアシスタントです。" +
      "質問者が何を尋ねているかを20〜30文字程度の日本語の一文でまとめてください。" +
      "質問者の意図や心理を解釈したり、感想や評価を加えたりしないでください。" +
      "前置きや説明は一切不要です。要約の一文だけを出力してください。",
    messages: [{ role: "user", content: questionText }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const summary = textBlock ? textBlock.text.trim() : "";
  if (!summary) {
    const err = new Error("Claude returned an empty summary");
    err.statusCode = 502;
    throw err;
  }
  return summary;
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/questions") {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const provider = typeof payload.provider === "string" ? payload.provider.trim() : "";
    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    const conversationUrl =
      typeof payload.conversationUrl === "string" ? payload.conversationUrl.trim() : "";
    const timestamp =
      typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString();

    if (!provider || !question) {
      sendJson(res, 400, { error: "provider and question are required" });
      return;
    }

    const record = {
      id: crypto.randomUUID(),
      provider,
      question,
      questionSummary: null,
      conversationUrl,
      timestamp,
      receivedAt: new Date().toISOString(),
    };

    const questions = readQuestions();
    questions.push(record);
    writeQuestions(questions);

    console.log("[ChatAsset] saved question from", provider, "-", question.slice(0, 60));
    sendJson(res, 201, record);
    return;
  }

  if (req.method === "GET" && req.url === "/api/questions") {
    sendJson(res, 200, readQuestions());
    return;
  }

  const summarizeMatch =
    req.method === "POST" && req.url.match(/^\/api\/questions\/([^/]+)\/summarize$/);
  if (summarizeMatch) {
    const id = decodeURIComponent(summarizeMatch[1]);
    const questions = readQuestions();
    const record = questions.find((q) => q.id === id);
    if (!record) {
      sendJson(res, 404, { error: "Question not found" });
      return;
    }

    try {
      record.questionSummary = await summarizeQuestion(record.question);
      writeQuestions(questions);
      console.log("[ChatAsset] summarized", id, "->", record.questionSummary);
      sendJson(res, 200, record);
    } catch (err) {
      console.error("[ChatAsset] summarize failed:", err.message);
      sendJson(res, err.statusCode || 500, { error: err.message });
    }
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(INDEX_FILE));
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[ChatAsset] server listening on http://localhost:${PORT}`);
  console.log(`[ChatAsset] data file: ${DATA_FILE}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "[ChatAsset] note: ANTHROPIC_API_KEY is not set — question capture and browsing still work, but the 要約する (summarize) button will fail until it's configured (see server/README.md)."
    );
  }
});
