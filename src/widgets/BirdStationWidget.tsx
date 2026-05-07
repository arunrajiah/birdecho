/**
 * BirdStationWidget
 *
 * Home-screen widget rendered by react-native-android-widget.
 * The component tree is serialised to an Android RemoteViews description —
 * it is NOT rendered in a normal React Native view.  As a result only the
 * primitive widget components exported by react-native-android-widget are
 * supported here; standard RN components (View, Text, Image…) will silently
 * produce an empty widget.
 *
 * Styling uses plain style objects — NativeWind className props are not
 * available in this context.
 */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface BirdStationWidgetProps {
  stationName: string;
  lastSpecies: string;
  lastTimestamp: string;
  detectionCount: number;
}

export function BirdStationWidget({
  stationName,
  lastSpecies,
  lastTimestamp,
  detectionCount,
}: BirdStationWidgetProps) {
  const subtitleText = lastTimestamp
    ? `Last seen ${lastTimestamp}`
    : 'No recent detections';

  const countText =
    detectionCount === 1
      ? '1 detection today'
      : `${detectionCount} detections today`;

  return (
    <FlexWidget
      // Tapping anywhere on the widget opens the app at the feed tab.
      // `birdecho` is the Expo Router URL scheme declared in app.config.ts.
      // OPEN_URI is used instead of OPEN_APP so we deep-link straight to the
      // feed rather than landing on the splash screen redirect.
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'birdecho:///(tabs)' }}
      accessibilityLabel={`BirdEcho: ${lastSpecies} at ${stationName}`}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: '#1A3226',
        borderRadius: 20,
        padding: 16,
      }}
    >
      {/* Station label */}
      <TextWidget
        text={stationName.toUpperCase()}
        style={{
          fontSize: 10,
          color: '#C8A94C',
          fontWeight: 'bold',
          marginBottom: 6,
        }}
      />

      {/* Latest species */}
      <TextWidget
        text={lastSpecies}
        style={{
          fontSize: 18,
          color: '#F5F0E8',
          fontWeight: 'bold',
          marginBottom: 4,
        }}
      />

      {/* Timestamp */}
      <TextWidget
        text={subtitleText}
        style={{
          fontSize: 11,
          color: '#A8A29E',
          marginBottom: 10,
        }}
      />

      {/* Divider spacer + count */}
      <TextWidget
        text={countText}
        style={{
          fontSize: 12,
          color: '#C8A94C',
        }}
      />
    </FlexWidget>
  );
}
