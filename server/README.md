# Spotaclone Downloader Server

A small local server that downloads audio from **YouTube** and **Spotify** links
for the Spotaclone app. It runs on your computer; your phone talks to it over the
local network.

## What it does

- **YouTube link** → downloads the audio and converts it to mp3 (`yt-dlp` + `ffmpeg`).
- **Spotify track link** → reads the **public metadata** (title + artist) only,
  then finds and downloads the matching song from YouTube. Spotify's protected
  (DRM) audio stream is never touched — same idea as the `spotdl` project.

## Setup

```bash
cd server
npm install      # also downloads the yt-dlp binary into ./bin
npm start
```

`ffmpeg` is provided by the `ffmpeg-static` npm package; `yt-dlp` is downloaded by
`scripts/setup.mjs`. If the yt-dlp download was skipped (no network at install
time), run `npm run setup` again.

The server listens on `http://0.0.0.0:4000` (override with `PORT`). Use your
computer's LAN IP from the phone, e.g. `http://192.168.1.233:4000`.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ ok, ytdlp }` |
| POST | `/api/download` | body `{ url, format? }` → `{ id }`. `format`: `mp3` (default), `mp3-320`, `m4a` |
| GET | `/api/jobs/:id` | job status: `{ status, progress, title, artist, ext, quality, error }` |
| GET | `/api/file/:id` | streams the finished audio (mp3 or m4a) |

`quality` reports the real result and the source ceiling:
`{ outputFormat, outputBitrateKbps, sampleRateHz, fileSizeBytes, sourceCodec, sourceAbrKbps }`.

`status` flows: `pending → resolving → downloading → done` (or `error`).

## Notes

- Downloaded files are written to `server/downloads/` (git-ignored).
- Jobs are kept in memory and reset when the server restarts.
- Only download content you own or have the right to use. Respect the source
  platforms' Terms of Service and local copyright law.
- Keep `yt-dlp` current (YouTube changes often): re-run `npm run setup` after
  deleting `bin/yt-dlp*`, or let it update via `bin/yt-dlp.exe -U`.
