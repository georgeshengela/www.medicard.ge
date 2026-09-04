import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useAssessment } from '@/constants/assessmentLayout';
import { ka } from '@/i18n/ka';

const ICON = 32;

export const DIET_KEYS = ['BALANCED', 'VEGETARIAN', 'PROTEIN', 'GLUTEN_FREE'] as const;
export type DietKey = (typeof DIET_KEYS)[number];

type Props = {
  value: string | null;
  onChange: (value: DietKey) => void;
  titleFor: (key: DietKey) => string;
};

function ForkKnifeIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 32 32" fill="none">
      <Path
        d="M14.6667 1.66667C15.219 1.66667 15.6667 2.11438 15.6667 2.66667V13.3333C15.6667 15.7523 13.9489 17.7698 11.6667 18.2331V29.3333C11.6667 29.8856 11.219 30.3333 10.6667 30.3333C10.1144 30.3333 9.66667 29.8856 9.66667 29.3333V18.2331C7.38445 17.7698 5.66667 15.7523 5.66667 13.3333V2.66667C5.66667 2.11438 6.11438 1.66667 6.66667 1.66667C7.21895 1.66667 7.66667 2.11438 7.66667 2.66667V13.3333C7.66667 14.9902 9.00981 16.3333 10.6667 16.3333C12.3235 16.3333 13.6667 14.9902 13.6667 13.3333V2.66667C13.6667 2.11438 14.1144 1.66667 14.6667 1.66667Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M26.3333 29.3333C26.3333 29.8856 25.8856 30.3333 25.3333 30.3333C24.781 30.3333 24.3333 29.8856 24.3333 29.3333V18.3333H19V9.33333C19 5.83553 21.8355 3 25.3333 3H26.3333V29.3333ZM24.3333 5.11719C22.4223 5.56873 21 7.28438 21 9.33333V16.3333H24.3333V5.11719Z"
        fill={color}
      />
      <Path
        d="M10.6667 1.66667C11.219 1.66667 11.6667 2.11438 11.6667 2.66667V12C11.6667 12.5523 11.219 13 10.6667 13C10.1144 13 9.66667 12.5523 9.66667 12V2.66667C9.66667 2.11438 10.1144 1.66667 10.6667 1.66667Z"
        fill={color}
      />
    </Svg>
  );
}

function LeavesIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 32 32" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.66667 3C11.6372 3 15.6667 7.02944 15.6667 12V13.4648C17.7643 10.3682 21.3114 8.33333 25.3333 8.33333H28C28.5523 8.33333 29 8.78105 29 9.33333V12C29 18.4433 23.7767 23.6667 17.3333 23.6667H16.2943C15.885 24.749 15.6667 25.9052 15.6667 27.0846V29.3333C15.6667 29.3681 15.6649 29.4024 15.6615 29.4362C15.61 29.9402 15.1842 30.3333 14.6667 30.3333C14.1144 30.3333 13.6667 29.8856 13.6667 29.3333V16.8763C13.6667 16.4633 13.6068 16.0564 13.4935 15.6667H12C7.02944 15.6667 3 11.6372 3 6.66667V4C3 3.44772 3.44772 3 4 3H6.66667ZM25.3333 10.3333C19.9946 10.3333 15.6667 14.6612 15.6667 20V20.5547C16.0803 19.9424 16.5533 19.366 17.0833 18.8359L20.6263 15.293C21.0168 14.9024 21.6498 14.9024 22.0404 15.293C22.4309 15.6835 22.4309 16.3165 22.0404 16.707L18.4974 20.25C18.0605 20.687 17.6709 21.1622 17.3294 21.6667H17.3333C22.6721 21.6667 27 17.3388 27 12V10.3333H25.3333ZM5 6.66667C5 10.5327 8.13401 13.6667 12 13.6667H12.2526L8.6263 10.0404C8.23578 9.64984 8.23578 9.01683 8.6263 8.6263C9.01683 8.23578 9.64984 8.23578 10.0404 8.6263L13.6667 12.2526V12C13.6667 8.13401 10.5327 5 6.66667 5H5V6.66667Z"
        fill={color}
      />
    </Svg>
  );
}

function DrumstickIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 32 32" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.7786 1.66667C26.5033 1.6667 30.3333 5.49675 30.3333 10.2214C30.3333 13.328 28.6491 16.1903 25.9336 17.6992L17.819 22.207C17.4287 22.4239 16.942 22.3561 16.6263 22.0404L15.332 20.7461L13.2969 22.7813C13.9372 23.4407 14.3333 24.3397 14.3333 25.3333C14.3333 27.3584 12.6917 29 10.6667 29C9.08641 29 7.74257 28.0003 7.22656 26.6029C6.98741 25.955 6.86256 25.61 6.6263 25.3737C6.39004 25.1374 6.04498 25.0126 5.39714 24.7734C3.99968 24.2574 3 22.9136 3 21.3333C3 19.3083 4.64162 17.6667 6.66667 17.6667C7.65921 17.6667 8.55723 18.0617 9.21615 18.7005L11.2513 16.6654L9.95964 15.3737C9.64393 15.058 9.57614 14.5713 9.79297 14.181L14.3008 6.06641C15.8097 3.35088 18.672 1.66667 21.7786 1.66667ZM9.80339 20.9427C9.57124 21.1748 9.23959 21.2789 8.91667 21.2201C8.59394 21.1611 8.32023 20.9473 8.1849 20.6484C7.92199 20.0674 7.34014 19.6667 6.66667 19.6667C5.74619 19.6667 5 20.4129 5 21.3333C5 22.0492 5.45221 22.663 6.08984 22.8984C6.57445 23.0773 7.42319 23.3425 8.04036 23.9596C8.65754 24.5768 8.92268 25.4255 9.10156 25.9102C9.33696 26.5478 9.9508 27 10.6667 27C11.5871 27 12.3333 26.2538 12.3333 25.3333C12.3333 24.6591 11.9326 24.0764 11.3516 23.8138C11.0523 23.6786 10.8376 23.4051 10.7786 23.082C10.7197 22.759 10.8238 22.4275 11.056 22.1953L13.918 19.332L12.6654 18.0794L9.80339 20.9427ZM21.7786 3.66667C19.3982 3.66667 17.2042 4.9569 16.0482 7.03776L11.9063 14.4922L17.5065 20.0924L24.9622 15.9518C27.0431 14.7958 28.3333 12.6018 28.3333 10.2214C28.3333 6.60132 25.3987 3.6667 21.7786 3.66667Z"
        fill={color}
      />
    </Svg>
  );
}

function BreadToastIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 32 32" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.3685 12.5573C15.7613 12.2369 16.3409 12.2602 16.707 12.6263L20.707 16.6263C21.0976 17.0168 21.0976 17.6498 20.707 18.0404L16.707 22.0404C16.3165 22.4309 15.6835 22.4309 15.293 22.0404L11.293 18.0404C10.9024 17.6498 10.9024 17.0168 11.293 16.6263L15.293 12.6263L15.3685 12.5573ZM13.4141 17.3333L16 19.9193L18.5859 17.3333L16 14.7474L13.4141 17.3333Z"
        fill={color}
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M26.6667 4.33333C28.6917 4.33333 30.3333 5.97496 30.3333 8V10.5729L30.3268 10.8021C30.2557 11.9404 29.6567 12.9862 28.7005 13.6237L26.3333 15.2018V27.6667H5.66667V15.2018L3.29948 13.6237C2.34329 12.9862 1.74434 11.9404 1.67318 10.8021L1.66667 10.5729V8C1.66667 5.97496 3.30829 4.33333 5.33333 4.33333H26.6667ZM5.33333 6.33333C4.41286 6.33333 3.66667 7.07953 3.66667 8V10.5729L3.67969 10.7799C3.73939 11.257 4.0032 11.6892 4.40885 11.9596L7.66667 14.1315V25.6667H24.3333V14.1315L27.5911 11.9596C27.9968 11.6892 28.2606 11.257 28.3203 10.7799L28.3333 10.5729V8C28.3333 7.07953 27.5871 6.33333 26.6667 6.33333H5.33333Z"
        fill={color}
      />
    </Svg>
  );
}

const ICONS: Record<DietKey, (props: { color: string }) => React.JSX.Element> = {
  BALANCED: ForkKnifeIcon,
  VEGETARIAN: LeavesIcon,
  PROTEIN: DrumstickIcon,
  GLUTEN_FREE: BreadToastIcon,
};

const ROWS: DietKey[][] = [
  ['BALANCED', 'VEGETARIAN'],
  ['PROTEIN', 'GLUTEN_FREE'],
];

/** Figma 9217:164726 — 2×2 simple cards, 32pt icons, teal selected. */
export function DietChoiceGrid({ value, onChange, titleFor }: Props) {
  const ASSESSMENT = useAssessment();
  return (
    <View style={{ width: '100%', gap: 12, paddingVertical: 8 }}>
      {ROWS.map((row) => (
        <View key={row.join('-')} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((key) => {
            const active = value === key;
            const Icon = ICONS[key];
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
                  flex: 1,
                  minWidth: 0,
                  padding: 16,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? ASSESSMENT.brand : ASSESSMENT.border,
                  backgroundColor: active ? ASSESSMENT.tint : ASSESSMENT.surfaceMuted,
                  shadowColor: '#000',
                  shadowOpacity: active ? 0.05 : 0.05,
                  shadowRadius: active ? 6 : 2,
                  shadowOffset: { width: 0, height: active ? 4 : 1 },
                  elevation: active ? 3 : 1,
                }}
              >
                <View style={{ gap: 24 }}>
                  <View style={{ width: ICON, height: ICON }}>
                    <Icon color={active ? ASSESSMENT.brand : ASSESSMENT.textSecondary} />
                  </View>
                  <View style={{ gap: 4 }}>
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_600SemiBold',
                        fontSize: 16,
                        lineHeight: 22,
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
                      {ka.assessment.dietSub[key]}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
