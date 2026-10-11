import React from 'react';
import { WelcomeScreen } from '@/components/welcome/WelcomeScreen';

/** Welcome without the launch intro (reached from QA shortcuts); the launch route plays the intro. */
export default function Welcome() {
  return <WelcomeScreen />;
}
