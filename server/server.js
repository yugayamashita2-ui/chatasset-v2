// ChatAsset MVP server — Phase 2 technical spike.
//
// Accepts questions captured by the Chrome extension and appends them to a
// local JSON file. No database, no auth, no external dependencies: this
// only proves the extension -> server -> storage path works end to end.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8787;
const DATA_FILE = path.join(__dirname, "data", "questions.json");
const MAX_BODY_BYTES = 100_000; // a single question should never be this long

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

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`[ChatAsset] server listening on http://localhost:${PORT}`);
});
