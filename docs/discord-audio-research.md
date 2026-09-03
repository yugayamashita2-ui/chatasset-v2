# Discord Audio Research (Phase 1 / Step 2-3)

Date: 2026-09-03
Scope: Can we capture Discord voice audio per-participant, without relying on
the Mac's speaker output, using Discord's *current* (Sept 2026) API surface
and actively maintained libraries? This is the highest-risk technical
question in the master spec (section 6-7, 27) and is answered here before any
implementation.

## Requirement (from spec section 6)

Must capture Discord voice even when:
- Mac speaker volume = 0
- Mac system mute = ON
- Discord output volume = 0
- No earphones connected

Preferred path (spec section 6):
`Discord → Discord Voice Stream → Recorder` (not `Discord → Mac speaker →
Mac mic → Recorder`).

## Findings

### 1. Per-user voice receive is possible today, via a real Bot account

Discord's Voice Gateway lets a **bot account** that has joined a voice
channel receive the Opus audio packets other members send, associated with
the sending user's ID:

- Library: **`@discordjs/voice`** (Node.js, part of the `discord.js`
  ecosystem). npm shows the latest release (0.19.2) published a few months
  ago — actively maintained, not abandoned.
  - `voiceConnection.receiver.speaking.on('start', userId => ...)` /
    `.on('end', userId => ...)` — tells you who is currently talking.
  - `voiceConnection.receiver.subscribe(userId, { mode: 'opus' | 'pcm', end })`
    — returns a per-user readable stream of that user's audio, decodable to
    PCM by the library itself (it wraps Opus decoding).
  - This means: with speaker events + one subscribed stream per participant,
    we can produce **separate audio per Discord user ID with timestamps**,
    which directly satisfies the "ideal data structure" in spec section 8
    (`timestamp / speaker_id / discord_user_id / audio`) — speaker
    identification here is exact (Discord tells us the user ID), not a
    voice-similarity guess.
  - Because this reads from the Voice Gateway/UDP stream, it **never touches
    the Mac's audio output hardware** — Mac mute, speaker volume, and
    earphone state are all irrelevant. This fully satisfies section 6's hard
    requirement.

### 2. This is unofficial/undocumented on Discord's side

- Discord does not officially document the voice-receive protocol the way it
  documents sending audio. `@discordjs/voice`'s own docs say audio receive
  "is not documented by Discord, so stable support is not guaranteed."
- In practice this has been the basis of long-running, widely used
  recording bots (e.g. Craig) for years, so it's a well-trodden path — but
  it is the one piece of this architecture that could break on a Discord
  protocol change with no advance notice from Discord. This is the
  project's top technical risk and should be treated as such (monitored,
  not silently assumed to keep working).

### 3. Must be a registered Bot account, not a self-bot

- Discord's Developer Policy / Community Guidelines explicitly forbid
  automating a normal user account ("self-bot") outside the official
  bot/OAuth2 API — that risks account termination.
- The correct, compliant approach: create a **Bot application** in the
  Discord Developer Portal, invite it to the lesson server with the
  `Connect` voice permission (that's the only permission needed to join and
  receive audio in a channel), and authenticate it with its own bot token.
  This is a separate identity from the teacher's personal Discord account —
  it just needs to be present in the voice channel during the lesson.
- This requires an action only the project owner can take (creating the
  application + inviting the bot to the server + handing me the bot token
  via an untracked `.env` value, never hardcoded/committed). See "What I
  need from you" below.

### 4. macOS runtime considerations

- The bot is a plain Node.js process — it can run locally on the teacher's
  Mac like any other Node script; nothing here is macOS-specific by itself.
- Opus decoding needs a native binding (`@discordjs/opus` or a WASM
  fallback). These build/run fine on macOS including Apple Silicon, but the
  native build step should be verified once as part of the PoC (Step 6),
  not assumed.

### 5. Non-technical risk worth flagging (not a code problem)

- Recording other people's voice (students) raises consent/notice
  considerations independent of the technical approach. Not something to
  solve in code, but worth the teacher explicitly telling students the
  lesson is recorded, consistent with how any recorded lesson platform
  normally operates. Flagging per spec section 27's "record every risk"
  instruction; no action taken here since it's outside engineering scope.

## Requirement → Limitation → Alternatives → Trade-off

| | |
|---|---|
| **Requirement** | Capture each participant's Discord speech separately, with Mac speaker/mic muted, no earphones. |
| **Limitation** | Discord voice-receive is unofficial/undocumented; no SLA from Discord that it keeps working. |
| **Alternatives** | (a) `@discordjs/voice` bot receive [recommended]. (b) Mac speaker → BlackHole/loopback virtual audio device → single mixed-down mic capture (no per-speaker separation, and violates section 6's explicit "must work with speaker off" requirement). (c) Ask each participant to run local recording software (breaks "just works for the teacher" UX, requires cooperation from every student). |
| **Trade-off** | (a) gives exact per-user separation and satisfies every hard requirement in section 6, at the cost of depending on an undocumented Discord behavior that must be monitored lesson-to-lesson (verify recordings after each session, especially after any discord.js/Discord client update). (b)/(c) are more "officially safe" but fail the stated requirements, so they are not viable primary approaches — (b) could be kept as an emergency fallback if (a) ever breaks. |

## Recommendation

Proceed with **(a)**: a Node.js bot process using `@discordjs/voice`
(matches the existing Node.js PoC already in this repo — no new language
introduced, consistent with spec section 24's "don't add tech stacks
casually").

## Capture Device (Nintendo Switch → HDMI capture → Mac), brief note

- Standard USB UVC/UAC-class HDMI capture dongles (the common, inexpensive
  kind) show up to macOS as a normal camera + microphone device — no
  special driver needed on modern macOS.
- `ffmpeg -f avfoundation -list_devices true -i ""` lists available
  AVFoundation video/audio device indices; recording is then
  `ffmpeg -f avfoundation -i "<video_index>:<audio_index>" ...`.
- This path is low-risk and well-precedented (screen/webcam capture on
  macOS via ffmpeg is a mature, common use case) — the only real unknown is
  which exact device index/name the specific capture card the teacher owns
  reports, which can only be confirmed by plugging it in and listing
  devices. Verifying this is part of Step 2 in the recommended build order
  (spec section 25) and needs to happen on the actual Mac with the actual
  capture card attached.

## What I need from you to start the Discord PoC (Step 6)

I can't create Discord applications or bot tokens myself — this needs your
Discord account:

1. Create an application + bot at the Discord Developer Portal
   (discord.com/developers/applications), no special permissions beyond
   `bot` scope + `Connect` voice permission.
2. Invite it to a test server/voice channel (can be a private test server,
   doesn't need to be the real lesson server yet).
3. Give me the bot token as an environment variable (`DISCORD_BOT_TOKEN` in
   `.env`, never pasted into committed files) — happy to receive it in
   this chat since it only gets written to a local `.env` here, or you can
   set it up yourself if you'd rather not paste a token into chat.

Once that's available I'll build the minimal PoC per spec section 26:
bot joins a voice channel → detects who's speaking → saves one audio file
per speaker with timestamps — before touching anything else in v0.1.
