'use no memo';
import React from 'react';
import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';

import { gradientFor } from '../theme';
import type { NowPlayingSnapshot } from './nowPlayingSnapshot';

// Keep in sync with src/theme.ts `colors` — the widget renders as native
// Android RemoteViews, outside the app's React tree, so it can't import
// theme.ts's non-const string values directly (they don't satisfy the
// widget library's HexColor literal type).
const BG: ColorProp = '#121212';
const TEXT: ColorProp = '#FFFFFF';
const TEXT_SECONDARY: ColorProp = '#B3B3B3';
const PRIMARY: ColorProp = '#1DB954';

const APP_SCHEME = 'spotaclone';

function widgetLink(action: 'toggle' | 'next' | 'prev'): string {
  return `${APP_SCHEME}://widget?action=${action}`;
}

type Props = {
  snapshot: NowPlayingSnapshot | null;
};

export function NowPlayingWidgetView({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: BG,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TextWidget text="MUSIC F" style={{ color: PRIMARY, fontSize: 13, fontWeight: '800' }} />
        <TextWidget
          text="Tap to open"
          style={{ color: TEXT_SECONDARY, fontSize: 12, marginTop: 4 }}
        />
      </FlexWidget>
    );
  }

  const [from, to] = gradientFor(snapshot.trackId);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <FlexWidget
        style={{
          width: 60,
          height: 60,
          borderRadius: 12,
          backgroundGradient: { from: from as ColorProp, to: to as ColorProp, orientation: 'TL_BR' },
        }}
      />

      <FlexWidget style={{ flex: 1, height: 'wrap_content', marginLeft: 12, flexDirection: 'column' }}>
        <TextWidget
          text={snapshot.title}
          truncate="END"
          maxLines={1}
          style={{ color: TEXT, fontSize: 15, fontWeight: '700' }}
        />
        <TextWidget
          text={snapshot.artist}
          truncate="END"
          maxLines={1}
          style={{ color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 }}
        />
      </FlexWidget>

      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget
          text="⏮"
          clickAction="OPEN_URI"
          clickActionData={{ uri: widgetLink('prev') }}
          style={{ color: TEXT, fontSize: 20, paddingHorizontal: 8 }}
        />
        <TextWidget
          text={snapshot.isPlaying ? '⏸' : '▶'}
          clickAction="OPEN_URI"
          clickActionData={{ uri: widgetLink('toggle') }}
          style={{ color: PRIMARY, fontSize: 22, paddingHorizontal: 8 }}
        />
        <TextWidget
          text="⏭"
          clickAction="OPEN_URI"
          clickActionData={{ uri: widgetLink('next') }}
          style={{ color: TEXT, fontSize: 20, paddingHorizontal: 8 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
