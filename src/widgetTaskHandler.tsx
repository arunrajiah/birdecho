/**
 * widgetTaskHandler
 *
 * Called by react-native-android-widget whenever Android fires a widget
 * lifecycle event (add, periodic update, resize, delete).  This module is
 * intentionally free of Zustand / React Query / Expo Router — it must be
 * safe to execute as a headless JS task when the app is fully killed.
 *
 * Data flows:
 *   App running  → feed poll succeeds → saveWidgetData() → AsyncStorage
 *   Widget event → widgetTaskHandler() → reads AsyncStorage → calls renderWidget()
 *
 * For foreground updates the feed tab calls `requestWidgetUpdate` directly,
 * bypassing this handler entirely.  This handler covers background/killed-app
 * scenarios where Android fires the 30-minute periodic update on its own.
 */
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BirdStationWidget } from './widgets/BirdStationWidget';

// ─── Shared data key ────────────────────────────────────────────────────────

export const WIDGET_DATA_KEY = 'birdecho-widget-data';

// ─── Type ───────────────────────────────────────────────────────────────────

export interface WidgetData {
  /** Display name of the connected station. */
  stationName: string;
  /** Common name of the most recently detected species. */
  lastSpecies: string;
  /** Human-readable timestamp string, already formatted for the widget. */
  lastTimestamp: string;
  /** Total number of detections recorded today. */
  detectionCount: number;
}

const DEFAULT_WIDGET_DATA: WidgetData = {
  stationName: 'BirdEcho',
  lastSpecies: 'No detections yet',
  lastTimestamp: '',
  detectionCount: 0,
};

// ─── Widget name constant ────────────────────────────────────────────────────

/**
 * Must match the `name` field in the app.config.ts widget plugin config.
 * Expo prebuild generates a class called `BirdStationWidgetProvider`.
 */
export const WIDGET_NAME = 'BirdStation';

// ─── AsyncStorage helpers ────────────────────────────────────────────────────

/**
 * Persist widget data to AsyncStorage so the task handler can read it when
 * the app is killed or backgrounded.  Failures are swallowed — a stale widget
 * is preferable to an app crash.
 */
export async function saveWidgetData(data: WidgetData): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(data));
  } catch {
    // non-critical — widget shows last-known state
  }
}

export async function getWidgetData(): Promise<WidgetData> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (!raw) return DEFAULT_WIDGET_DATA;
    return { ...DEFAULT_WIDGET_DATA, ...(JSON.parse(raw) as Partial<WidgetData>) };
  } catch {
    return DEFAULT_WIDGET_DATA;
  }
}

// ─── Task handler ────────────────────────────────────────────────────────────

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, renderWidget } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await getWidgetData();
      // `renderWidget` is a callback provided by the library; calling it with
      // our JSX element instructs Android to draw the widget immediately.
      renderWidget(<BirdStationWidget {...data} />);
      break;
    }

    case 'WIDGET_DELETED':
      // No cleanup needed — AsyncStorage data stays (shared with app).
      break;

    default:
      break;
  }
}
