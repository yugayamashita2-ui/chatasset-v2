import type { ExtractionResult, Riddle } from "./types.js";

function formatTimestamp(seconds: number | null): string {
  if (seconds === null) return "??:??";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ORIGIN_LABEL: Record<Riddle["originGuess"], string> = {
  traditional: "定番なぞなぞの可能性",
  possibly_original: "動画独自の創作の可能性",
  unknown: "出典不明",
};

export function formatConsole(result: ExtractionResult): string {
  const lines: string[] = [];
  lines.push(`動画: ${result.videoTitle ?? "(タイトル不明)"}`);
  lines.push(`URL : ${result.videoUrl}`);
  lines.push(`抽出されたなぞなぞ: ${result.riddles.length}件`);
  lines.push("");

  for (const r of result.riddles) {
    const flag = r.notRecommendedForEnglish ? " ⚠️英語化に不向き" : "";
    lines.push(
      `[${formatTimestamp(r.approxTimestampSeconds)}] #${r.index} (${ORIGIN_LABEL[r.originGuess]})${flag}`,
    );
    lines.push(`  JA: ${r.japaneseQuestion} / ${r.japaneseAnswer}`);
    lines.push(`  EN: ${r.englishQuestion} / ${r.englishAnswer}`);
    if (r.explanation) lines.push(`  解説: ${r.explanation}`);
    if (r.notRecommendedForEnglish && r.notRecommendedReason) {
      lines.push(`  理由: ${r.notRecommendedReason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatMarkdown(result: ExtractionResult): string {
  const lines: string[] = [];
  lines.push(`# なぞなぞ抽出結果: ${result.videoTitle ?? result.videoId}`);
  lines.push("");
  lines.push(`- 動画URL: ${result.videoUrl}`);
  lines.push(`- 抽出日時: ${result.extractedAt}`);
  lines.push(`- 字幕言語: ${result.sourceLanguage}`);
  lines.push(`- 件数: ${result.riddles.length}`);
  lines.push("");
  lines.push(
    "> ⚠️ `originGuess` はAIによる暫定判定です。アプリへ実際に収録する前に、" +
      "定番のなぞなぞか特定チャンネル独自の創作かを人間が確認し、出典を記録してください。",
  );
  lines.push("");

  for (const r of result.riddles) {
    lines.push(`## ${r.index}. ${r.englishQuestion}`);
    lines.push("");
    lines.push(`- タイムスタンプ: ${formatTimestamp(r.approxTimestampSeconds)}`);
    lines.push(`- 出典判定: ${ORIGIN_LABEL[r.originGuess]}`);
    if (r.notRecommendedForEnglish) {
      lines.push(`- ⚠️ 英語化に不向き: ${r.notRecommendedReason}`);
    }
    lines.push("");
    lines.push(`**日本語原文**: ${r.japaneseQuestion} / ${r.japaneseAnswer}`);
    lines.push("");
    lines.push("<details><summary>Answer</summary>");
    lines.push("");
    lines.push(`**EN**: ${r.englishAnswer}`);
    if (r.explanation) {
      lines.push("");
      lines.push(r.explanation);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines.join("\n");
}
