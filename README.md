# Music F 🎧

A Spotify-style music player built with **Expo / React Native** that plays music
files stored on your phone — and can **download songs from YouTube / Spotify
links** via a small companion server. Dark Spotify-inspired UI, full-screen
player with a draggable seek bar, mini-player, shuffle, repeat, auto-advance.

## Run it on your phone (easiest)

1. Install **Expo Go** on your phone:
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iPhone: App Store → "Expo Go"
2. On your computer, in this folder:
   ```bash
   npm install      # first time only
   npx expo start
   ```
3. Make sure your phone and computer are on the **same Wi-Fi**.
4. Scan the QR code in the terminal (Expo Go on Android, Camera app on iPhone).

Tap **Add** to import songs from your phone, or the **🔗 link button** to paste a
YouTube/Spotify link. Tap a song to play. 🎵

## 🎵 Download from a YouTube / Spotify link

A phone app can't run YouTube extractors itself, so downloading is handled by a
tiny **companion server** (in [`server/`](server/)) using `yt-dlp` + `ffmpeg`
(both fetched automatically on install). It can run on your own computer for
local dev, or be hosted (e.g. on [Render](https://render.com)) so the app works
without your computer running.

> **Spotify note:** Spotify audio is DRM-protected and is *not* downloaded
> directly. For a Spotify link the server reads only the public track
> **metadata** (title + artist) and then finds and downloads the matching song
> from YouTube — the same approach the open-source `spotdl` tool uses.

### Start the server locally

```bash
cd server
npm install      # first time — also downloads yt-dlp + ffmpeg
API_KEY=<any-random-string> npm start   # serves on http://0.0.0.0:4000
```

### Deploy the server on Render

The repo root has a ready-to-use `render.yaml` blueprint:

1. Push this repo to GitHub, then in the [Render dashboard](https://dashboard.render.com):
   **New +** → **Blueprint** → connect the repo. Render auto-detects
   `render.yaml` (`rootDir: server`, health check on `/health`).
2. When prompted for the `API_KEY` environment variable, paste a freshly
   generated random value — e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   This is **never** committed to git; Render stores it as a secret.
3. Once deployed, confirm `https://<your-service>.onrender.com/health` returns
   `{ "ok": true, "ytdlp": true }`.

> **Free-tier notes:** the instance spins down after ~15 min idle (first
> request after that can take 30-60s to wake up), and the in-memory job list /
> downloaded files are wiped on every restart — fine for personal use, just
> not persistent storage.

### Configure the app to use your server

The app needs a matching server URL and API key. These live in
[`src/config.ts`](src/config.ts), which reads them from `EXPO_PUBLIC_*` env
vars — Expo inlines any `EXPO_PUBLIC_*` var into the JS bundle at build time.

1. Copy the template: `cp .env.example .env` (Windows: `copy .env.example .env`)
2. Edit `.env` and set `EXPO_PUBLIC_API_KEY` to the **same value** you set as
   the `API_KEY` env var on your server (Render or local).
3. Update `DEFAULT_SERVER_URL` in `src/config.ts` to your deployed Render URL
   (or override it at runtime under **Server settings** in the "Add from
   link" sheet — handy for pointing at a local server during dev).

`.env` is gitignored, same as before — but unlike a gitignored TS module, EAS
Build's cloud builder can also read these vars if you set them there too:
`npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_KEY --value <key> --visibility sensitive`
(repeat per environment/profile you build with).

### Use it from the app

1. Tap the **🔗 link** button (top-right) or "Paste a link instead".
2. Paste a YouTube or Spotify **song** link and tap **Download**.
3. Watch the progress; when done the song is saved into your library.

> ⚠️ Only download content you own or have the right to use. Respect YouTube's
> and Spotify's Terms of Service and local copyright law.

### Audio quality

Pick a format in the **Quality** selector before downloading:

| Option | What it does | Notes |
|---|---|---|
| **MP3** (default) | Best audio → MP3 V0 (~245 kbps VBR) | Universal, great quality |
| **M4A** | Keeps the native AAC stream | Best fidelity vs the source; plays iOS + Android |
| **MP3 320** | MP3 320 kbps CBR | Biggest file; rarely better than MP3 |

The server always pulls the **best available** audio. Note that online audio is
already compressed (~128–160 kbps for most songs), so you can't get true
320 kbps / lossless if the source doesn't have it. After each download the app
shows the **actual** result — format, bitrate, sample rate, size, and the source
codec — so you can see exactly what you got.

## How local music loading works

- **Add** opens your phone's file browser (audio only, multi-select). Picked
  songs are copied into the app's private storage, so your library **persists**.
- Title and artist are parsed from the file name (`Artist - Title.mp3`).
- Each song gets a deterministic colorful gradient as stand-in album art.

## Features

- ▶️ Play / pause, next / previous, seek; auto-advance on track end
- 🔀 Shuffle and 🔁 repeat (off / all / one)
- 🗂️ **Playlists** — create, reorder, add/remove; play or shuffle a whole playlist
- ⏭️ **Up Next queue** — play next, add to queue, reorder, jump
- 📥 **Download queue** — add many links; they process one by one with progress,
  a toast + **local notification** when each finishes, and retry on failure
- 📋 **Clipboard auto-detect** — copy a YouTube/Spotify link anywhere, open the
  app, and a banner offers to download it (no paste needed)
- 📤 **Share-sheet target** (dev build) — share a link straight from the
  YouTube/Spotify app to Music F via `expo-share-intent`
- 🔗 Deep link: `spotaclone://add?url=…` queues a download
- 🎤 **Synced lyrics** (LRCLIB) — karaoke-style highlight, tap a line to seek
- 📈 **Sound map** — server-computed waveform you can drag to seek, plus an
  experimental **melodic contour** (pitch line)
- 🧊 **Liquid Glass UI** — frosted-glass sheets, mini-player, tabs, banners
- 📱 Mini-player + full-screen player with swipeable Artwork / Lyrics / Sound-map pages
- 💾 Library, playlists, queue, and session persist across restarts

## Notes / limitations

- **Expo Go** runs the full UI + foreground playback. **Background playback,
  lock-screen controls, the share-sheet target, and full blur fidelity** need a
  *development build* (`npx expo run:android`).
- The download queue processes while the app's JS is running (foreground, or
  background while music plays). It resumes queued items on next launch.
- Lyrics come from [LRCLIB](https://lrclib.net) (free) — coverage varies; files
  named `Artist - Title` match best. The pitch contour is experimental and is
  clearest on melody-forward tracks.
- Analysis (waveform/pitch) happens automatically for link downloads; for
  file-picker imports use **Analyze on server** on the Sound-map page.
- Album art embedded in files isn't read; the app shows generated gradient art.
- Spotify/YouTube playlist and album links download every track and auto-create
  a local playlist named after the source. Very long Spotify playlists/albums
  may be truncated (the public embed page only exposes a bounded track list —
  there's no pagination without registering real Spotify API credentials).
  Tracks that fail to resolve/download are skipped rather than failing the
  whole batch.

## Project structure

```
App.tsx                     App entry: StatusBar + PlayerProvider + LibraryScreen
src/
  PlayerContext.tsx         Global audio state: queue, shuffle, repeat, controls
  LibraryScreen.tsx         Main screen: header, list, empty state, modal hosts
  library.ts                Import / persist / list / delete songs + remote import
  settings.ts               Persisted settings (downloader server URL)
  config.ts                 Default server URL + API key (from EXPO_PUBLIC_* env vars, see .env.example)
  theme.ts / types.ts / utils.ts
  components/
    Artwork, TrackRow, EqualizerBars, MiniPlayer, FullPlayer, AddFromLink
server/                     Companion downloader (Node + yt-dlp + ffmpeg)
  src/index.js              Express API: /api/download, /api/jobs/:id, /api/file/:id
  src/downloader.js         yt-dlp + Spotify-metadata logic
  scripts/setup.mjs         Downloads the yt-dlp binary
```

## Make a standalone APK (optional)

For full background playback without Expo Go:
```bash
npx expo run:android        # needs Android Studio + a device/emulator
```
