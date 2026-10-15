import React from 'react';
import { Redirect } from 'expo-router';

/**
 * „ექიმთან ვიზიტები“ became part of MEDIBOOK (owner 2026-10-15): the hub lists bookings and the visits
 * entered by hand together. Old pushes, Medi's `visit_open` and bookmarks that land here open the hub;
 * the editor (/visits/editor) stays for a visit typed in by hand.
 */
export default function VisitsRedirect() {
  return <Redirect href={'/book' as never} />;
}
