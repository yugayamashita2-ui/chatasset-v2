import Anthropic from "@anthropic-ai/sdk";
import type { Riddle } from "./types.js";

const MODEL = "claude-sonnet-5";

// 日本語のなぞなぞ動画は長くても字幕テキストはこの範囲に収まる想定。
// 超える場合は後半を切り詰め、呼び出し元に警告を出す(v1では複数回呼び出しの結合は未対応)。
const MAX_TRANSCRIPT_CHARS = 120_000;

const RECORD_RIDDLES_TOOL: Anthropic.Tool = {
  name: "record_riddles",
  description:
    "文字起こしの中で実際に出題・解説されている「なぞなぞ」だけを、登場順に記録する。",
  input_schema: {
    type: "object",
    properties: {
      riddles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            japaneseQuestion: {
              type: "string",
              description: "文字起こしに登場する、なぞなぞの日本語の問題文(原文ママ)",
            },
            japaneseAnswer: {
              type: "string",
              description: "文字起こしに登場する、なぞなぞの日本語の答え(原文ママ)",
            },
            englishQuestion: {
              type: "string",
              description:
                "直訳ではなく、英語話者が同じように最初は勘違いし、答えを聞いて意外性を感じる構造で再構成した英語の問題文。",
            },
            englishAnswer: {
              type: "string",
              description: "englishQuestion に対応する英語の答え",
            },
            explanation: {
              type: "string",
              description:
                "なぜその答えになるかの簡潔な解説(1〜2文)。日本語特有の言葉遊びが使われている場合は、元の日本語のダジャレの仕組みと、英語版でどう再構成したかを短く触れる。ゲームのテンポを壊す長文は禁止。",
            },
            notRecommendedForEnglish: {
              type: "boolean",
              description:
                "日本語の音・表記に強く依存していて英語では同等の面白さ・意外性を再現できないと判断した場合に true。",
            },
            notRecommendedReason: {
              type: "string",
              description:
                "notRecommendedForEnglish が true の場合、その理由を一言で。false の場合は空文字。",
            },
            originGuess: {
              type: "string",
              enum: ["traditional", "possibly_original", "unknown"],
              description:
                "traditional: 昔からある一般的な定番なぞなぞだと判断できる。possibly_original: この動画・チャンネル独自の創作の可能性が高い。unknown: 判断がつかない。",
            },
            approxTimestampSeconds: {
              type: ["number", "null"],
              description:
                "文字起こしの [mm:ss] 表記から分かる、このなぞなぞが出題され始めるおおよその秒数。不明なら null。",
            },
          },
          required: [
            "japaneseQuestion",
            "japaneseAnswer",
            "englishQuestion",
            "englishAnswer",
            "explanation",
            "notRecommendedForEnglish",
            "notRecommendedReason",
            "originGuess",
            "approxTimestampSeconds",
          ],
        },
      },
    },
    required: ["riddles"],
  },
};

const SYSTEM_PROMPT = `あなたは、日本のなぞなぞを英語学習者向けアプリに収録するための素材を作る担当者です。

このアプリの目的は「英語を勉強させること」ではなく、英語を使って日本のなぞなぞを解く楽しい体験を作ることです。
そのため、なぞなぞの英語化では次を最優先してください。

- 単純な直訳は禁止。日本語の音・表記に依存した言葉遊びを、そのまま英単語に置き換えない。
- 「日本語の文章を英語に変換する」のではなく、「英語を読んだ人が、元のなぞなぞと同じように最初は自然に勘違いし、
  答えを聞いて意外性を感じる」構造を英語で再構成する。
- 例: 「パンはパンでも、食べられないパンは?」を "What kind of pan can you never eat?" と直訳せず、
  "What kind of bread can you never eat?" のように、答え(フライパン等)まで自然に読めて驚きが生まれる形にする。
- 英語にすると面白さや意外性が完全に失われる場合は、無理に面白く見せかけず notRecommendedForEnglish を true にし、
  理由を書く。ただし japaneseQuestion/japaneseAnswer と、可能な範囲でのenglishQuestion/englishAnswerは埋める。
- 解説(explanation)はゲームのテンポを壊さない1〜2文の簡潔なものにする。長い教材的な説明は書かない。
- 著作権への配慮のため、それぞれのなぞなぞが「昔からある定番のなぞなぞ」か「この動画・チャンネル独自の創作である
  可能性が高いもの」かを originGuess で判断する。判断がつかない場合は unknown。

抽出時のルール:
- 文字起こしの中で実際に出題・解説されている「なぞなぞ」だけを対象にする。雑談やなぞなぞ以外のクイズ、
  ゲーム実況などは含めない。
- 存在しないなぞなぞを創作しない。文字起こしから読み取れる範囲でのみ記録する。
- 登場順に記録する。
- 文字起こしには [mm:ss] の形式でタイムスタンプが付いている。各なぞなぞの出題開始位置に最も近いタイムスタンプを
  秒数に変換して approxTimestampSeconds に入れる。分からない場合は null。

抽出できたら、必ず record_riddles ツールを呼び出して結果を記録してください。`;

export interface RiddleExtractionResult {
  riddles: Riddle[];
  transcriptTruncated: boolean;
}

export async function extractRiddles(
  transcript: string,
  client: Anthropic = new Anthropic(),
): Promise<RiddleExtractionResult> {
  const transcriptTruncated = transcript.length > MAX_TRANSCRIPT_CHARS;
  const truncatedTranscript = transcriptTruncated
    ? transcript.slice(0, MAX_TRANSCRIPT_CHARS)
    : transcript;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [RECORD_RIDDLES_TOOL],
    tool_choice: { type: "tool", name: "record_riddles" },
    messages: [
      {
        role: "user",
        content: `以下はYouTube動画の日本語の文字起こし(タイムスタンプ付き)です。この中に登場する
なぞなぞをすべて抽出してください。\n\n---\n${truncatedTranscript}\n---`,
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error("Claudeからなぞなぞの抽出結果を取得できませんでした。");
  }

  const parsed = toolUse.input as {
    riddles: Array<Omit<Riddle, "index">>;
  };

  const riddles: Riddle[] = parsed.riddles.map((r, i) => ({
    index: i + 1,
    ...r,
  }));

  return { riddles, transcriptTruncated };
}
