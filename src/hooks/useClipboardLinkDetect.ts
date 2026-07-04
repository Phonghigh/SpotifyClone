import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { extractSupportedLink } from '../downloaderClient';
import { getLastOfferedClipboardUrl } from '../settings';

/**
 * Watches the clipboard whenever the app becomes active. If it holds a new
 * YouTube/Spotify link, `offer` is set so the UI can show a download banner.
 *
 * iOS: gated behind hasUrlAsync() so the system "pasted from…" banner only
 * appears when a URL is actually present.
 */
export function useClipboardLinkDetect(): {
  offer: string | null;
  /** Hide the banner without permanently suppressing the URL. */
  dismiss: () => void;
} {
  const [offer, setOffer] = useState<string | null>(null);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      let text: string | null = null;
      if (Platform.OS === 'ios') {
        if (await Clipboard.hasUrlAsync()) {
          text = await Clipboard.getUrlAsync();
        }
      } else {
        text = await Clipboard.getStringAsync();
      }
      if (!text) return;

      const link = extractSupportedLink(text);
      if (!link) return;
      if (link === getLastOfferedClipboardUrl()) return;
      setOffer(link);
    } catch {
      // Clipboard unavailable — never block the app on this.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    void check(); // cold start
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const dismiss = useCallback(() => {
    setOffer(null);
  }, []);

  return { offer, dismiss };
}
