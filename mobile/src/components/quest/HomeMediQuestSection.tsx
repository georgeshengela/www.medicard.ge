import React from 'react';
import { useRouter } from 'expo-router';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { useOffline } from '@/hooks/useOffline';
import { QuestProfileCard } from './QuestProfileCard';

export function HomeMediQuestSection({ edgeInset = 16 }: { edgeInset?: number }) {
  const router = useRouter(), quest = useQuestDashboard(), offline = useOffline();
  return <QuestProfileCard dashboard={quest.dashboard} loading={quest.loading} error={quest.error} stale={quest.stale || offline} edgeInset={edgeInset} onOpen={() => router.push('/medi-quest')} onRetry={() => void quest.refresh()} />;
}
