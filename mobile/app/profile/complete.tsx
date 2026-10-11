import React from 'react';
import { ProfileQuestionnaire } from '@/components/assessment/ProfileQuestionnaire';

/**
 * "დაასრულე პროფილი": the health-profile questions registration does not ask. Only the unanswered
 * ones are walked; then one summary page where each answer edits just itself.
 */
export default function ProfileCompleteScreen() {
  return <ProfileQuestionnaire />;
}
