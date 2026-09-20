import React from 'react';
import { Redirect } from 'expo-router';

/** Preserve saved links while keeping one Quest home. */
export default function CompanionRedirect() {
  return <Redirect href={{ pathname: '/medi-quest', params: { tab: 'progress' } }} />;
}
