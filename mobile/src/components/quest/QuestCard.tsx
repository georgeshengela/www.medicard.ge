import React from 'react';
import { Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuestIcon } from '@/components/quest/QuestIcon';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestProgressBar } from '@/components/quest/QuestProgressBar';
import { QuestReward } from '@/components/quest/QuestReward';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import type { QuestItem } from '@/lib/quest/api';
import { formatQuestPercent, questKind } from '@/lib/quest/logic.js';
import { progressLabel, q, questHelper, questTitles } from '@/lib/quest/copy';

export function QuestCard({
  quest,
  locale = 'ka',
  weatherHint,
  weekly,
  offline,
  claiming,
  onClaim,
  onOpenMedi,
}: {
  quest: QuestItem;
  locale?: string;
  weatherHint?: string | null;
  weekly?: boolean;
  offline?: boolean;
  claiming?: boolean;
  onClaim?: () => void;
  onOpenMedi?: () => void;
}) {
  const colors = useThemeColors();
  const copy = q(locale);
  const { kind, title } = questTitles(quest, locale);
  const helper = questHelper(quest, locale);
  const percent = formatQuestPercent(quest.progressPercent);
  const near = quest.status === 'ACTIVE' && percent >= 80;
  const claimed = quest.status === 'CLAIMED';
  const claimable = quest.claimable;
  const showBar = quest.status === 'ACTIVE' || (claimable && !claimed);
  const a11y = copy.a11yQuest(title, quest.progress, quest.target, percent, quest.rewardCoins, quest.rewardXp);
  const accentKind = weekly || kind === 'weekly' ? 'weekly' : kind;
  const conversational = kind === 'medi' && quest.status === 'ACTIVE';

  return (
    <Card
      accessibilityLabel={a11y}
      className={weekly ? 'border-primary-200/50' : claimed ? 'opacity-90' : ''}
    >
      <View className="flex-row items-start">
        <QuestIcon kind={accentKind} done={claimed || claimable} />
        <View className="ml-3 min-w-0 flex-1">
          <Text className="font-sans-bold text-[16px] leading-6 text-text-100">{title}</Text>
          {weekly ? (
            <Text className="mt-0.5 font-sans text-xs text-text-300">{copy.untilSunday}</Text>
          ) : null}
        </View>
      </View>

      {showBar && !conversational ? (
        <View className="mt-3">
          <Text className="mb-1.5 font-sans-semibold text-sm text-text-100">
            {progressLabel(quest, locale)}
          </Text>
          {percent > 0 || claimable ? (
            <QuestProgressBar
              percent={claimable ? 100 : percent}
              height={weekly ? QUEST.barWeekly : QUEST.barDaily}
              color={QUEST.accent[accentKind]}
              near={near}
            />
          ) : (
            <View style={{ height: weekly ? QUEST.barWeekly : QUEST.barDaily }} />
          )}
        </View>
      ) : null}

      {weatherHint && kind === 'movement' && quest.status === 'ACTIVE' ? (
        <Text className="mt-2 font-sans text-xs text-text-300">{weatherHint}</Text>
      ) : null}

      <View className="mt-3">
        <QuestReward xp={quest.rewardXp} coins={quest.rewardCoins} locale={locale} muted={claimed} />
      </View>

      {claimed ? (
        <Text className="mt-2 font-sans-semibold text-sm" style={{ color: colors.success }}>
          {copy.claimed}
        </Text>
      ) : null}

      {claimable ? (
        <View className="mt-3">
          <Button
            label={copy.claimReward}
            size="md"
            loading={claiming}
            disabled={offline || claiming}
            onPress={onClaim}
            accessibilityLabel={copy.claimReward}
          />
          {offline ? (
            <Text className="mt-2 font-sans text-xs leading-4 text-text-300">{copy.connectToClaim}</Text>
          ) : null}
        </View>
      ) : null}

      {conversational ? (
        <View className="mt-3">
          <QuestMediLine text={helper} />
          <View className="mt-3">
            <Button label={copy.openMedi} size="md" variant="secondary" onPress={onOpenMedi} />
          </View>
        </View>
      ) : quest.status === 'ACTIVE' && helper ? (
        <View className="mt-3">
          <QuestMediLine text={helper} />
        </View>
      ) : null}
    </Card>
  );
}
