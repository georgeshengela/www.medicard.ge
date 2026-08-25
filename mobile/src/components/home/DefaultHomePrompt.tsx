import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { CalendarHeart, House } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { setCyclePromptSeen, setHomeLanding, type HomeLanding } from '@/lib/homeScreenPrefs';
import { useThemeColors } from '@/theme/colors';

type Props = {
  visible: boolean;
  onClose: (landing: HomeLanding) => void;
};

const PILL = 999;
const BTN_GAP = 12;

const SHELL = {
  borderRadius: PILL,
  minHeight: 56,
  paddingVertical: 14,
  paddingHorizontal: 16,
  justifyContent: 'center' as const,
};

function PillButton({
  onPress,
  variant,
  title,
  hint,
  icon: Icon,
}: {
  onPress: () => void;
  variant: 'primary' | 'secondary';
  title: string;
  hint: string;
  icon: typeof CalendarHeart;
}) {
  const isPrimary = variant === 'primary';

  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: PILL,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPrimary ? 'rgba(255,255,255,0.22)' : 'rgba(42,26,34,0.08)',
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={isPrimary ? '#fff' : '#5C4550'} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, marginLeft: 12, paddingRight: 4 }}>
        <Text
          style={{
            color: isPrimary ? '#fff' : '#2A1A22',
            fontSize: 15,
            fontWeight: '800',
            lineHeight: 20,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: isPrimary ? 'rgba(255,255,255,0.9)' : '#6E5560',
            fontSize: 12,
            lineHeight: 16,
            marginTop: 2,
          }}
        >
          {hint}
        </Text>
      </View>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        borderRadius: PILL,
        overflow: 'hidden',
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {isPrimary ? (
        <View style={{ ...SHELL, backgroundColor: '#D4738A' }}>{inner}</View>
      ) : (
        <View style={{ ...SHELL, backgroundColor: '#EBE4E7' }}>{inner}</View>
      )}
    </Pressable>
  );
}

export function DefaultHomePrompt({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const choose = async (landing: HomeLanding) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await setHomeLanding(landing);
    await setCyclePromptSeen(true);
    onClose(landing);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(8, 16, 20, 0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFBFC',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 12,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: PILL,
              backgroundColor: '#E8C4CE',
              marginBottom: 18,
            }}
          />

          <View style={{ alignItems: 'center', marginBottom: 14 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: '#FCE8EE',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CalendarHeart size={28} color="#D4738A" strokeWidth={2.1} />
            </View>
          </View>

          <Text
            style={{
              textAlign: 'center',
              fontSize: 20,
              lineHeight: 26,
              fontWeight: '800',
              color: '#2A1A22',
              marginBottom: 6,
            }}
          >
            {ka.home.cyclePromptTitle}
          </Text>
          <Text
            style={{
              textAlign: 'center',
              fontSize: 14,
              lineHeight: 20,
              color: '#6E5560',
              marginBottom: 20,
            }}
          >
            {ka.home.cyclePromptBody}
          </Text>

          <PillButton
            variant="primary"
            icon={CalendarHeart}
            title={ka.home.cyclePromptPrimary}
            hint={ka.home.cyclePromptPrimaryHint}
            onPress={() => choose('cycle')}
          />
          <View style={{ marginTop: BTN_GAP }}>
            <PillButton
              variant="secondary"
              icon={House}
              title={ka.home.cyclePromptSecondary}
              hint={ka.home.cyclePromptSecondaryHint}
              onPress={() => choose('hub')}
            />
          </View>

          <Text
            style={{
              textAlign: 'center',
              fontSize: 11,
              lineHeight: 15,
              color: colors.text300,
              marginTop: 16,
            }}
          >
            {ka.home.cyclePromptFooter}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
