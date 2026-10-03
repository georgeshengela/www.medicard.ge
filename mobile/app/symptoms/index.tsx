import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, History, PenLine, PersonStanding, type LucideIcon } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomIntroHero } from '@/components/symptoms/SymptomIntroHero';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { resetSymptomChecker, updateSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';
import type { SymptomMethod } from '@/types/symptoms';

/**
 * The symptom check's one start screen (owner 2026-10-04: the intro and the method choice were two
 * screens and a „დაწყება“ in between). The night reel on top, one line of what it does, then the two
 * ways in as cards — the body map first (the owner's favourite), words second. History stays top right.
 */
export default function SymptomIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      resetSymptomChecker(user?.gender);
    }, [user?.gender]),
  );

  const start = (method: SymptomMethod) => {
    updateSymptomChecker({ method });
    router.push((method === 'anatomy' ? '/symptoms/body' : '/symptoms/search') as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#030712', paddingBottom: Math.max(insets.bottom, 16) }}>
      <StatusBar style="light" />
      <SymptomNavHeader
        navy
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => router.push('/symptoms/history' as never)} hitSlop={12} accessibilityRole="button" accessibilityLabel={ka.symptoms.viewHistory}>
            <History size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        }
      />
      <View style={{ flex: 1 }}>
        <SymptomIntroHero />
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 6 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34, color: '#FFFFFF', letterSpacing: -0.3 }}>
          {tx('სად და რა გაწუხებს?', 'Where and what bothers you?')}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14.5, lineHeight: 22, color: '#D1D5DB' }}>{ka.symptoms.introSubtitle}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 10 }}>
        <StartCard
          primary
          icon={PersonStanding}
          title={tx('მონიშნე სხეულზე', 'Point on the body')}
          detail={tx('შეეხე ადგილს — სიმპტომებს იქვე აირჩევ', 'Tap the place and pick the symptoms right there')}
          onPress={() => start('anatomy')}
        />
        <StartCard
          icon={PenLine}
          title={tx('აღწერე სიტყვებით', 'Describe in words')}
          detail={ka.symptoms.methodManualHint}
          onPress={() => start('manual')}
        />
      </View>
    </View>
  );
}

function StartCard({
  icon: Icon,
  title,
  detail,
  primary = false,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 76,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 22,
        backgroundColor: primary ? '#0D9488' : '#111827',
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? 'rgba(255,255,255,0.16)' : 'rgba(94,234,212,0.12)',
        }}
      >
        <Icon size={22} color={primary ? '#FFFFFF' : '#5EEAD4'} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15.5, lineHeight: 21, color: '#FFFFFF' }}>{title}</Text>
        <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 17, color: primary ? '#CCFBF1' : '#9CA3AF' }}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} color={primary ? '#FFFFFF' : '#6B7280'} />
    </Pressable>
  );
}
