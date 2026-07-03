import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';

import { extractSupportedLink } from '../downloaderClient';

/**
 * Handles `spotaclone://add?url=<link>` deep links (also works through
 * Expo Go's `exp://…/--/add?url=…` form). Fires `onLink` once per URL event.
 */
export function useDeepLinkIntake(onLink: (url: string) => void) {
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);
  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;

  useEffect(() => {
    if (!url || url === handled.current) return;
    handled.current = url;

    try {
      const parsed = Linking.parse(url);
      const isAdd =
        parsed.hostname === 'add' ||
        parsed.path === 'add' ||
        parsed.path?.endsWith('/add');
      const raw = typeof parsed.queryParams?.url === 'string' ? parsed.queryParams.url : null;
      if (!isAdd || !raw) return;

      const link = extractSupportedLink(raw) ?? raw;
      if (/^https?:\/\//i.test(link)) onLinkRef.current(link);
    } catch {
      // Malformed deep link — ignore.
    }
  }, [url]);
}
