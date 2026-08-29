import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BookmarkCheck, Droplets, Moon, RefreshCw, ShieldAlert, Sparkles, Sun } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { ChatAiAvatar } from '@/components/chat/ChatAiAvatar';
import { Disclaimer } from '@/components/Disclaimer';
import { Markdown } from '@/components/ui/Markdown';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { formatDateTime } from '@/lib/format';
import { splitSkincareSections, type SavedSkincareRoutine } from '@/lib/skincareStorage';

type Props = {
  routine: SavedSkincareRoutine;
  onNew: () => void;
  onOpenRecord: () => void;
};

export function SkincareResultCard({ routine, onNew, onOpenRecord }: Props) {
  const FIGMA = useFigmaChat();
  const sections = useMemo(() => splitSkincareSections(routine.analysis), [routine.analysis]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          backgroundColor: FIGMA.white,
          borderWidth: 1,
          borderColor: FIGMA.border,
          borderRadius: 24,
          padding: 16,
          gap: 16,
          ...FIGMA.shadowXs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ChatAiAvatar icon={Sparkles} size="lg" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 20,
                lineHeight: 28,
                color: FIGMA.textPrimary,
              }}
            >
              {ka.modules.skincare.resultTitle}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 13,
                lineHeight: 18,
                color: FIGMA.textSecondary,
              }}
            >
              {formatDateTime(routine.createdAt)}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            backgroundColor: FIGMA.successBg,
            borderWidth: 1,
            borderColor: FIGMA.successBorder,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <BookmarkCheck size={16} color={FIGMA.success} strokeWidth={2.2} />
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 12,
              lineHeight: 16,
              color: FIGMA.success,
            }}
          >
            {ka.modules.skincare.savedBadge}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <MetaChip label={routine.skinType} brand />
          {routine.concerns.map((concern) => (
            <MetaChip key={concern} label={concern} />
          ))}
        </View>
      </View>

      {sections.length > 0 ? (
        sections.map((section) => (
          <RoutineSection key={section.title} title={section.title} body={section.body} />
        ))
      ) : (
        <View
          style={{
            backgroundColor: FIGMA.white,
            borderWidth: 1,
            borderColor: FIGMA.border,
            borderRadius: 24,
            padding: 16,
            ...FIGMA.shadowXs,
          }}
        >
          <Markdown content={routine.analysis} />
        </View>
      )}

      <AuthPrimaryButton label={ka.modules.skincare.viewRecord} onPress={onOpenRecord} />

      <Pressable
        accessibilityRole="button"
        onPress={onNew}
        style={{
          minHeight: 48,
          borderRadius: 16,
          backgroundColor: FIGMA.white,
          borderWidth: 1,
          borderColor: FIGMA.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 20,
        }}
      >
        <RefreshCw size={18} color={FIGMA.brand} strokeWidth={2.2} />
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            lineHeight: 22,
            color: FIGMA.textPrimary,
          }}
        >
          {ka.modules.skincare.newRoutine}
        </Text>
      </Pressable>

      <Disclaimer />
    </ScrollView>
  );
}

function RoutineSection({ title, body }: { title: string; body: string }) {
  const FIGMA = useFigmaChat();
  const Icon = iconForSection(title);

  return (
    <View
      style={{
        backgroundColor: FIGMA.white,
        borderWidth: 1,
        borderColor: FIGMA.border,
        borderRadius: 24,
        padding: 16,
        gap: 12,
        ...FIGMA.shadowXs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: FIGMA.brandQuaternary,
            borderWidth: 1,
            borderColor: FIGMA.brandBorderLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={FIGMA.brand} strokeWidth={2.2} />
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 16,
            lineHeight: 22,
            color: FIGMA.textPrimary,
          }}
        >
          {title}
        </Text>
      </View>
      {body ? <Markdown content={body} /> : null}
    </View>
  );
}

function iconForSection(title: string): LucideIcon {
  if (title.includes('დილ')) return Sun;
  if (title.includes('საღამ')) return Moon;
  if (title.includes('კვირ')) return Sparkles;
  if (title.includes('მოერიდ') || title.includes('არათავს')) return ShieldAlert;
  return Droplets;
}

function MetaChip({ label, brand }: { label: string; brand?: boolean }) {
  const FIGMA = useFigmaChat();
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: brand ? FIGMA.brandQuaternary : FIGMA.cardBg,
        borderWidth: 1,
        borderColor: brand ? FIGMA.brandBorderLight : FIGMA.border,
      }}
    >
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          lineHeight: 16,
          color: brand ? FIGMA.brand : FIGMA.textSecondary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
