# chatasset-v2 — なぞなぞ抽出ツール

日本のなぞなぞを英語で解くアプリ、のための素材収集ツールです。
YouTube動画のURLを渡すと、動画中で出題されているなぞなぞ(問題・答え)を字幕から抽出し、
英語学習者向けに**直訳ではなく意味・驚きの構造を保った英訳**を付けて一覧化します。

アプリ本体の開発方針(直訳禁止、UIはシンプルに、著作権への配慮など)は、このツールの
抽出プロンプトにも反映されています。詳細は `src/riddles.ts` のプロンプトを参照してください。

## 前提条件

- Node.js 20以上
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) がインストール済みでPATHが通っていること
  ```
  pip install -U yt-dlp
  # または
  brew install yt-dlp
  ```
- Anthropic APIキー(`ANTHROPIC_API_KEY`)

## セットアップ

```bash
npm install
cp .env.example .env
# .env を編集して ANTHROPIC_API_KEY を設定
```

## 使い方

```bash
npm run extract -- "https://www.youtube.com/watch?v=XXXXXXXXXXX"
```

動画IDだけを渡すことも可能です。

実行すると以下が行われます。

1. `yt-dlp` で動画の日本語字幕(手動があればそれを、なければ自動生成字幕)を取得
2. 字幕テキストをClaudeに渡し、なぞなぞ(問題・答え)だけを抽出
3. なぞなぞごとに、直訳ではなく英語話者にとって同じように成立する形へ再構成した英訳と、
   簡潔な解説を生成
4. 結果を `output/<動画ID>.json` と `output/<動画ID>.md` に保存し、コンソールにも一覧表示

## 出力データの各項目

| フィールド | 内容 |
| --- | --- |
| `japaneseQuestion` / `japaneseAnswer` | 字幕に登場した原文のなぞなぞ |
| `englishQuestion` / `englishAnswer` | 英語学習者向けに再構成した問題・答え(直訳ではない) |
| `explanation` | なぜその答えになるかの簡潔な解説(1〜2文) |
| `notRecommendedForEnglish` / `notRecommendedReason` | 日本語の言葉遊びに強く依存していて英語化に不向きと判断された場合のフラグと理由 |
| `originGuess` | `traditional`(昔からある定番なぞなぞの可能性) / `possibly_original`(その動画・チャンネル独自の創作の可能性) / `unknown` のAIによる暫定判定 |
| `approxTimestampSeconds` | 動画内でのおおよその出題タイミング(秒) |

`originGuess` はあくまでAIによる目安です。特定のチャンネル・作者が独自に創作したと思われる
なぞなぞ(`possibly_original`)は、アプリへの収録前に人間が確認し、無断利用にならないよう
出典の記録や利用許諾の確認を行ってください。

## 既知の制約

- 字幕(手動または自動生成)が存在しない動画には対応していません。
- 非常に長い動画は文字起こしが一定文字数を超えると後半が切り詰められます(実行時に警告表示)。
- YouTube側のBot対策により、ネットワーク環境によっては `yt-dlp` が字幕取得に失敗することがあります。
  その場合は `yt-dlp -U` で最新版に更新するか、`.env` の `EXTRA_YTDLP_ARGS` で
  `--cookies-from-browser <ブラウザ名>` などを追加してみてください。
