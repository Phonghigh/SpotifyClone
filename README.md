# Spotaclone 🎧

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
tiny **companion server** that runs on your computer (in [`server/`](server/)).
It uses `yt-dlp` + `ffmpeg` (both fetched automatically on install).

> **Spotify note:** Spotify audio is DRM-protected and is *not* downloaded
> directly. For a Spotify link the server reads only the public track
> **metadata** (title + artist) and then finds and downloads the matching song
> from YouTube — the same approach the open-source `spotdl` tool uses.

### Start the server

```bash
cd server
npm install      # first time — also downloads yt-dlp + ffmpeg
npm start        # serves on http://0.0.0.0:4000
```

### Use it from the app

1. Tap the **🔗 link** button (top-right) or "Paste a link instead".
2. Paste a YouTube or Spotify **song** link and tap **Download**.
3. Watch the progress; when done the song is saved into your library.

The app is pre-configured to reach the server at the LAN address detected during
setup. If your computer's IP changes, update it under **Server settings** in the
"Add from link" sheet (or in [`src/config.ts`](src/config.ts)).

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

- ▶️ Play / pause, next / previous, seek
- 🔀 Shuffle and 🔁 repeat (off / all / one), auto-advance on track end
- 📱 Mini-player + full-screen player
- 🔗 Download from YouTube / Spotify links (via companion server)
- 💾 Library persists across restarts

## Notes / limitations

- **Expo Go** runs the full UI + foreground playback. **Background playback and
  lock-screen controls** need a *development build* (`npx expo run:android`).
- Album art embedded in files isn't read; the app shows generated gradient art.
- Spotify support covers single **track** links (not playlists/albums).

## Project structure

```
App.tsx                     App entry: StatusBar + PlayerProvider + LibraryScreen
src/
  PlayerContext.tsx         Global audio state: queue, shuffle, repeat, controls
  LibraryScreen.tsx         Main screen: header, list, empty state, modal hosts
  library.ts                Import / persist / list / delete songs + remote import
  settings.ts               Persisted settings (downloader server URL)
  config.ts                 Default server URL
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
