import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { NowPlayingWidgetView } from './NowPlayingWidgetView';
import { NOW_PLAYING_WIDGET_NAME } from './widgetTaskHandler';
import { saveNowPlayingSnapshot, type NowPlayingSnapshot } from './nowPlayingSnapshot';

/**
 * Push the current playback state to the real home-screen widget (if any is
 * added) and persist it so the widget's headless task handler can redraw it
 * later even if the app isn't running. Safe to call on every platform/build:
 * `requestWidgetUpdate` throws when no native widget module is linked (e.g.
 * Expo Go, or an Android build without the config plugin applied yet), so
 * that failure is swallowed rather than crashing playback.
 */
export async function pushNowPlayingWidgetUpdate(snapshot: NowPlayingSnapshot | null): Promise<void> {
  await saveNowPlayingSnapshot(snapshot);
  try {
    await requestWidgetUpdate({
      widgetName: NOW_PLAYING_WIDGET_NAME,
      renderWidget: () => React.createElement(NowPlayingWidgetView, { snapshot }),
    });
  } catch {
    // No native widget module in this runtime — nothing to update.
  }
}
