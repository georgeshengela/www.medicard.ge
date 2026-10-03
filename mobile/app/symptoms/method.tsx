import React from 'react';
import { Redirect } from 'expo-router';

/** The method choice now lives on the start screen (owner 2026-10-04); old links land there. */
export default function SymptomMethodScreen() {
  return <Redirect href="/symptoms" />;
}
