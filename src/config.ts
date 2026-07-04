/**
 * Default address of the companion downloader server (the Node app in
 * `server/`). Update this to your deployed server's URL, or override at
 * runtime in the app's "Add from link" screen (Server settings).
 */
export const DEFAULT_SERVER_URL = 'https://spotifyclone-uixh.onrender.com';

/**
 * Sent as the `x-api-key` header on every request to the server. Must match
 * the API_KEY environment variable set on the server host. Not a strong
 * secret (it ships inside the app bundle) — it only keeps the server from
 * being casually discovered and used by strangers, not a determined attacker.
 * Rotate this (and the Render env var) if it's ever suspected leaked.
 *
 * `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time by Expo
 * itself — set locally in a gitignored `.env` file, and on EAS via
 * `eas env:create` so cloud builds see it too (a gitignored `config.local.ts`
 * import would resolve locally but fail to bundle on EAS's fresh clone).
 */
export const API_KEY = process.env.EXPO_PUBLIC_API_KEY || '';

/**
 * Default address for "Local (Wi-Fi)" server mode (AddFromLink → Server
 * settings) — e.g. `http://10.0.0.5:4000`, matching `npm run dev` in
 * `server/`. Set via `EXPO_PUBLIC_LOCAL_SERVER_URL` in `.env` so it's
 * pre-filled without retyping your LAN IP every time; still overridable in
 * the app itself.
 */
export const LOCAL_SERVER_URL = process.env.EXPO_PUBLIC_LOCAL_SERVER_URL || '';
