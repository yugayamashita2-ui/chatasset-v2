// Minimal PoC: send a recorded audio file to the OpenAI transcription API
// and save the result to a text file. See README section in the task
// description for scope — this intentionally does nothing beyond that.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const OpenAI = require('openai');

// Formats the OpenAI transcription API currently accepts directly.
// (.aac is not in this list, so it is converted before upload — see below.)
const NATIVELY_SUPPORTED_EXTENSIONS = new Set([
  '.flac', '.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.ogg', '.wav', '.webm',
]);

const MODEL = 'whisper-1';

function fail(title, details) {
  console.error(`\n[エラー] ${title}`);
  if (details) console.error(details);
  process.exit(1);
}

function checkInputFile(inputPath) {
  if (!fs.existsSync(inputPath)) {
    fail(
      `音声ファイルが見つかりません: ${inputPath}`,
      '次に確認すること:\n' +
        `  - "${inputPath}" がこのディレクトリに置かれているか\n` +
        '  - ファイル名のスペルや拡張子が正しいか\n' +
        '  - 実行コマンド: node transcribe.js [ファイル名] （省略時は recording1.aac）'
    );
  }
}

function checkApiKey() {
  if (!process.env.OPENAI_API_KEY) {
    fail(
      'OPENAI_API_KEY が設定されていません。',
      '次に確認すること:\n' +
        '  - プロジェクト直下に .env ファイルがあるか\n' +
        '  - .env に OPENAI_API_KEY=sk-... の形式でキーが書かれているか\n' +
        '  - .env をコミットしていないか（.gitignore に .env があることを確認）'
    );
  }
}

// .aac is not accepted by the API. It is repackaged into a .m4a container
// with a plain stream copy (no re-encoding), so audio quality is unchanged
// and the original file is left untouched.
function convertAacIfNeeded(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();

  if (ext === '.aac') {
    const ffmpegCheck = spawnSync('ffmpeg', ['-version']);
    if (ffmpegCheck.error) {
      fail(
        'ffmpeg が見つかりません。.aac ファイルの変換に必要です。',
        '次に確認すること:\n' +
          '  - ffmpeg がインストールされているか（Mac: brew install ffmpeg）\n' +
          '  - インストール後、ターミナルを開き直してから再実行してください'
      );
    }

    const convertedPath = path.join(
      path.dirname(inputPath),
      `${path.basename(inputPath, ext)}_converted.m4a`
    );

    console.log(`Converting: ${inputPath} -> ${convertedPath} (ffmpeg, stream copy)`);
    const result = spawnSync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-c', 'copy',
      convertedPath,
    ]);

    if (result.status !== 0) {
      fail(
        '.aac ファイルの変換に失敗しました。',
        '次に確認すること:\n' +
          '  - ffmpeg のエラー出力（上に表示されています）\n' +
          '  - 録音ファイルが壊れていないか、他のプレイヤーで再生できるか\n' +
          '  - 元のファイル (' + inputPath + ') は変更されていません'
      );
    }

    return { uploadPath: convertedPath, isTemporary: true };
  }

  if (!NATIVELY_SUPPORTED_EXTENSIONS.has(ext)) {
    fail(
      `サポートされていない音声形式です: ${ext || '(拡張子なし)'}`,
      'OpenAI の音声認識APIが直接受け付ける形式:\n' +
        '  flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm\n' +
        '次に確認すること:\n' +
        '  - ffmpeg で上記いずれかの形式に変換してから再実行してください\n' +
        '    例: ffmpeg -i ' + inputPath + ' -c copy output.m4a'
    );
  }

  return { uploadPath: inputPath, isTemporary: false };
}

async function transcribe(uploadPath) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    return await client.audio.transcriptions.create({
      file: fs.createReadStream(uploadPath),
      model: MODEL,
      response_format: 'verbose_json',
      // Segment-level timestamps are requested (and saved to the .json
      // output below) so a future step can build on them, without this
      // PoC building any timeline UI itself.
      timestamp_granularities: ['segment'],
    });
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.cause) {
      fail(
        'OpenAI APIへの接続に失敗しました。',
        '次に確認すること:\n' +
          '  - インターネット接続が有効か\n' +
          '  - プロキシ/ファイアウォールがAPI通信をブロックしていないか\n' +
          `  - 詳細: ${err.message}`
      );
    }

    if (err.status) {
      fail(
        `OpenAI APIがエラーを返しました (HTTP ${err.status})。`,
        '次に確認すること:\n' +
          '  - APIキーが有効か、利用制限（クォータ）に達していないか\n' +
          '  - https://platform.openai.com/account でAPIキーの状態を確認\n' +
          `  - 詳細: ${err.message}`
      );
    }

    fail('文字起こし中に予期しないエラーが発生しました。', err.stack || String(err));
  }
}

async function main() {
  const inputPath = process.argv[2] || 'recording1.aac';

  checkInputFile(inputPath);
  checkApiKey();

  const { uploadPath, isTemporary } = convertAacIfNeeded(inputPath);

  console.log(`\nTranscribing: ${inputPath}`);

  let result;
  try {
    result = await transcribe(uploadPath);
  } finally {
    if (isTemporary) fs.rmSync(uploadPath, { force: true });
  }

  console.log('\n[transcription]\n');
  console.log(result.text);

  const base = path.basename(inputPath, path.extname(inputPath));
  const txtPath = `${base}_transcription.txt`;
  const jsonPath = `${base}_transcription.json`;

  fs.writeFileSync(txtPath, result.text, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`\nSaved to:\n${txtPath}\n${jsonPath} (segments/timestamps, for future use)`);
}

main();
