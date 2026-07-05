import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';

import { usePlayer } from '../PlayerContext';

/**
 * Handles `spotaclone://widget?action=toggle|next|prev` deep links fired by
 * the play/pause/skip buttons on the real home-screen widget (see
 * src/widget/NowPlayingWidgetView.tsx). The widget can't control playback
 * directly — it has no access to the app's live `expo-audio` player — so a
 * tap opens the app via this deep link, which applies the action instead.
 */
export function useWidgetDeepLinks() {
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);
  const { togglePlay, playNext, playPrev } = usePlayer();

  useEffect(() => {
    if (!url || url === handled.current) return;
    handled.current = url;

    try {
      const parsed = Linking.parse(url);
      const isWidget =
        parsed.hostname === 'widget' || parsed.path === 'widget' || parsed.path?.endsWith('/widget');
      if (!isWidget) return;

      const action = parsed.queryParams?.action;
      if (action === 'toggle') togglePlay();
      else if (action === 'next') playNext();
      else if (action === 'prev') playPrev();
    } catch {
      // Malformed deep link — ignore.
    }
  }, [url, togglePlay, playNext, playPrev]);
}
