import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { NowPlayingWidgetView } from './NowPlayingWidgetView';
import { loadNowPlayingSnapshot } from './nowPlayingSnapshot';

export const NOW_PLAYING_WIDGET_NAME = 'NowPlaying';

/**
 * Runs in a fresh headless JS context (not the app's running React tree) when
 * Android needs to (re)draw the widget — e.g. it was just added, resized, or
 * periodically refreshed. Play/pause/next/prev taps don't come through here:
 * they use the library's native `OPEN_URI` click action to deep-link into the
 * running app instead (see NowPlayingWidgetView), since real playback control
 * needs the live `expo-audio` player instance in the app's JS.
 */
export async function nowPlayingWidgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetInfo.widgetName !== NOW_PLAYING_WIDGET_NAME) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const snapshot = await loadNowPlayingSnapshot();
      props.renderWidget(React.createElement(NowPlayingWidgetView, { snapshot }));
      break;
    }
    default:
      break;
  }
}
