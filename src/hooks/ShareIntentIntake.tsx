console.log('[DIAG 9] ShareIntentIntake loading');
import { useEffect, useRef } from 'react';

import { extractSupportedLink } from '../downloaderClient';
import { toast } from '../components/Toast';

/**
 * expo-share-intent needs its native module, which only exists in a
 * development build (npx expo run:android / EAS). In Expo Go the require
 * throws — we catch it and the feature simply stays off.
 */
let shareIntentModule: {
  useShareIntent: (options?: unknown) => {
    hasShareIntent: boolean;
    shareIntent: { text?: string | null; webUrl?: string | null };
    resetShareIntent: () => void;
  };
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-share-intent');
  // `ShareIntentModule` is the native module — null in Expo Go (it uses
  // requireOptionalNativeModule). Gate on it, not on the JS hook (which
  // always exists), so we never mount a dead hook in Expo Go.
  if (mod && mod.ShareIntentModule && typeof mod.useShareIntent === 'function') {
    shareIntentModule = { useShareIntent: mod.useShareIntent };
  }
} catch {
  shareIntentModule = null;
}

export const shareIntentAvailable = shareIntentModule != null;

type Props = {
  onLink: (url: string) => void;
};

/**
 * Render-once component (conditionally mounted only when the native module
 * exists) that funnels shared text/URLs into the download queue.
 */
export function ShareIntentIntake({ onLink }: Props) {
  // Safe: this component is only mounted when shareIntentModule exists.
  const { hasShareIntent, shareIntent, resetShareIntent } =
    shareIntentModule!.useShareIntent();
  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;

  useEffect(() => {
    if (!hasShareIntent) return;
    const raw = shareIntent.webUrl || shareIntent.text || '';
    const link = extractSupportedLink(raw);
    if (link) {
      onLinkRef.current(link);
    } else if (raw) {
      toast('Shared content has no YouTube/Spotify link', 'info');
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}
