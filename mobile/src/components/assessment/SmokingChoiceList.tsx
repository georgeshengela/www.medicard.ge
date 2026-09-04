import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useAssessment } from '@/constants/assessmentLayout';
import { ka } from '@/i18n/ka';

const ICON = 32;
const CHECK = 20;
const CHECK_MARK = 12;

const OPTIONS = [
  { key: 'CURRENT', Icon: CigaretteIcon },
  { key: 'FORMER', Icon: CalendarIcon },
  { key: 'NEVER', Icon: CloseXIcon },
] as const;

type SmokingKey = (typeof OPTIONS)[number]['key'];

type Props = {
  value: string | null;
  onChange: (value: SmokingKey) => void;
  titleFor: (key: SmokingKey) => string;
};

function CigaretteIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 32 32" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M26.6667 18.9999C28.6917 18.9999 30.3333 20.6415 30.3333 22.6666C30.3333 24.6916 28.6917 26.3333 26.6667 26.3333H5.33333C3.30832 26.3333 1.66671 24.6916 1.66667 22.6666C1.66667 20.6415 3.30829 18.9999 5.33333 18.9999H26.6667ZM5.33333 20.9999C4.41286 20.9999 3.66667 21.7461 3.66667 22.6666C3.66671 23.587 4.41288 24.3333 5.33333 24.3333H9.66667V20.9999H5.33333ZM11.6667 24.3333H26.6667C27.5871 24.3333 28.3333 23.587 28.3333 22.6666C28.3333 21.7461 27.5871 20.9999 26.6667 20.9999H11.6667V24.3333Z"
        fill={color}
      />
      <Path
        d="M19.293 4.62623C19.6835 4.2357 20.3165 4.2357 20.707 4.62623C22.5703 6.48951 22.5703 9.51035 20.707 11.3736C19.6248 12.4559 19.6248 14.2107 20.707 15.2929C21.0975 15.6834 21.0975 16.3164 20.707 16.707C20.3165 17.0974 19.6835 17.0974 19.293 16.707C17.4297 14.8437 17.4297 11.8228 19.293 9.95956C20.3752 8.87734 20.3752 7.12253 19.293 6.04029C18.9025 5.64978 18.9025 5.01675 19.293 4.62623Z"
        fill={color}
      />
      <Path
        d="M24.6263 4.62623C25.0168 4.2357 25.6498 4.2357 26.0404 4.62623C27.9036 6.48951 27.9036 9.51035 26.0404 11.3736C24.9582 12.4559 24.9581 14.2107 26.0404 15.2929C26.4309 15.6834 26.4309 16.3164 26.0404 16.707C25.6499 17.0974 25.0168 17.0974 24.6263 16.707C22.763 14.8437 22.7631 11.8228 24.6263 9.95956C25.7085 8.87734 25.7085 7.12253 24.6263 6.04029C24.2358 5.64978 24.2358 5.01675 24.6263 4.62623Z"
        fill={color}
      />
    </Svg>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 32 32" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22.6667 1.66667C23.219 1.66667 23.6667 2.11438 23.6667 2.66667V5.66667H24C26.025 5.66667 27.6667 7.30829 27.6667 9.33333V25.3333C27.6667 27.3584 26.025 29 24 29H8C5.97496 29 4.33333 27.3584 4.33333 25.3333V9.33333C4.33333 7.30829 5.97496 5.66667 8 5.66667H8.33333V2.66667C8.33333 2.11438 8.78105 1.66667 9.33333 1.66667C9.88562 1.66667 10.3333 2.11438 10.3333 2.66667V5.66667H21.6667V2.66667C21.6667 2.11438 22.1144 1.66667 22.6667 1.66667ZM6.33333 25.3333C6.33333 26.2538 7.07953 27 8 27H24C24.9205 27 25.6667 26.2538 25.6667 25.3333V13H6.33333V25.3333ZM8 7.66667C7.07953 7.66667 6.33333 8.41286 6.33333 9.33333V11H25.6667V9.33333C25.6667 8.41286 24.9205 7.66667 24 7.66667H8Z"
        fill={color}
      />
    </Svg>
  );
}

function CloseXIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 32 32" fill="none">
      <Path
        d="M24.6262 5.95956C25.0168 5.56904 25.6498 5.56904 26.0403 5.95956C26.4307 6.35009 26.4308 6.98312 26.0403 7.37362L17.414 15.9999L26.0403 24.6262C26.4307 25.0168 26.4308 25.6498 26.0403 26.0403C25.6498 26.4308 25.0168 26.4307 24.6262 26.0403L15.9999 17.414L7.37362 26.0403C6.98312 26.4308 6.35009 26.4307 5.95956 26.0403C5.56904 25.6498 5.56904 25.0168 5.95956 24.6262L14.5859 15.9999L5.95956 7.37362C5.56904 6.9831 5.56904 6.35008 5.95956 5.95956C6.35008 5.56904 6.9831 5.56904 7.37362 5.95956L15.9999 14.5859L24.6262 5.95956Z"
        fill={color}
      />
    </Svg>
  );
}

function CheckMark() {
  return (
    <Svg width={CHECK_MARK} height={CHECK_MARK} viewBox="0 0 12 12" fill="none">
      <Path
        d="M1.875 6.75L4.5 9.375L10.5 3.375"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Figma 11332:64167 — 32pt icons, 14pt list rows, 20pt teal checkbox. */
export function SmokingChoiceList({ value, onChange, titleFor }: Props) {
  const ASSESSMENT = useAssessment();
  return (
    <View style={{ width: '100%', gap: 8 }}>
      {OPTIONS.map(({ key, Icon }) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (key !== value) pickerSelectionTick();
              onChange(key);
            }}
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: ASSESSMENT.surfaceMuted,
              borderWidth: 1,
              borderColor: ASSESSMENT.border,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 12,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <View style={{ width: ICON, height: ICON }}>
              <Icon color={ASSESSMENT.textSecondary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 14,
                  lineHeight: 20,
                  color: ASSESSMENT.textPrimary,
                }}
              >
                {titleFor(key)}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: ASSESSMENT.textSecondary,
                }}
              >
                {ka.assessment.smokingSub[key]}
              </Text>
            </View>
            <View
              style={{
                width: CHECK,
                height: CHECK,
                borderRadius: 4,
                backgroundColor: active ? ASSESSMENT.brand : ASSESSMENT.surface,
                borderWidth: active ? 0 : 1,
                borderColor: ASSESSMENT.hairline,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {active ? <CheckMark /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
