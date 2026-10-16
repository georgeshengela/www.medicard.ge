import React from 'react';
import HydrationHomeScreen from './index';

/** Figma 8851:187189 — the month calendar is the 1m tab (1w is this week's bars). */
export default function HydrationCalendarScreen() {
  return <HydrationHomeScreen initialPeriod="1m" />;
}
