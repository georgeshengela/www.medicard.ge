import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { UnitSegment } from '@/components/assessment/UnitSegment';
import { isLatinUnitLabel, unitLabelFontFamily } from '@/components/assessment/unitLabelFont';
import { useAssessment } from '@/constants/assessmentLayout';
import { ka } from '@/i18n/ka';

const GROUPS = ['A', 'B', 'AB', 'O'] as const;
const RH = ['+', '-'] as const;
const GEO_FOR: Record<(typeof GROUPS)[number], string> = {
  O: 'I',
  A: 'II',
  B: 'III',
  AB: 'IV',
};

const PLUS_24 =
  'M12 2.25C12.4142 2.25 12.75 2.58579 12.75 3V11.25H21C21.4142 11.25 21.75 11.5858 21.75 12C21.75 12.4142 21.4142 12.75 21 12.75H12.75V21C12.75 21.4142 12.4142 21.75 12 21.75C11.5858 21.75 11.25 21.4142 11.25 21V12.75H3C2.58579 12.75 2.25 12.4142 2.25 12C2.25 11.5858 2.58579 11.25 3 11.25H11.25V3C11.25 2.58579 11.5858 2.25 12 2.25Z';
const MINUS_24 =
  'M21 11.25C21.4142 11.25 21.75 11.5858 21.75 12C21.75 12.4142 21.4142 12.75 21 12.75H3C2.58579 12.75 2.25 12.4142 2.25 12C2.25 11.5858 2.58579 11.25 3 11.25H21Z';
const MINUS_40 =
  'M35 18.75C35.6904 18.75 36.25 19.3096 36.25 20C36.25 20.6904 35.6904 21.25 35 21.25H5C4.30964 21.25 3.75 20.6904 3.75 20C3.75 19.3096 4.30964 18.75 5 18.75H35Z';

type Props = {
  value: string | null;
  onChange: (bloodType: string) => void;
};

function parseBloodType(value: string | null) {
  if (!value) return { group: 'A' as const, rh: '-' as const };
  const group = value.replace(/[+-]/, '') as (typeof GROUPS)[number];
  const rh = value.includes('-') ? ('-' as const) : ('+' as const);
  return { group: GROUPS.includes(group) ? group : 'A', rh };
}

function PlusIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PLUS_24} fill={color} />
    </Svg>
  );
}

function MinusIcon({ size, color }: { size: number; color: string }) {
  if (size === 40) {
    return (
      <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
        <Path d={MINUS_40} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={MINUS_24} fill={color} />
    </Svg>
  );
}

/** Figma 9217:164607 — ABO tab, hero letter + Rh badge, +/- pills, Georgian explainer. */
export function BloodTypeSelector({ value, onChange }: Props) {
  const ASSESSMENT = useAssessment();
  const { group, rh } = parseBloodType(value);
  const setGroup = (g: string) => onChange(`${g}${rh}`);
  const setRh = (r: string) => onChange(`${group}${r}`);
  const geo = GEO_FOR[group];
  const help = ka.assessment.bloodTypeHelp;
  const rhWord = rh === '+' ? help.rhPositive : help.rhNegative;

  return (
    <View style={{ width: '100%', gap: 8 }}>
      <View style={{ paddingVertical: 8 }}>
        <UnitSegment
          value={group}
          options={GROUPS.map((g) => ({ value: g, label: g }))}
          onChange={setGroup}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          minHeight: 188,
        }}
      >
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: unitLabelFontFamily(group, true),
            fontWeight: '600',
            fontSize: group === 'AB' ? 120 : 160,
            includeFontPadding: false,
            letterSpacing: group === 'AB' ? -4 : -8,
            color: ASSESSMENT.textPrimary,
            textAlign: 'center',
          }}
        >
          {group}
        </Text>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: rh === '-' ? '#F43F5E' : ASSESSMENT.brand,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        >
          {rh === '-' ? (
            <MinusIcon size={40} color="#FFFFFF" />
          ) : (
            <PlusIcon size={40} color="#FFFFFF" />
          )}
        </View>
      </View>

      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 15,
          lineHeight: 22,
          color: ASSESSMENT.brandInk,
          textAlign: 'center',
          marginBottom: 8,
        }}
      >
        {help.groupLabel(geo)} · {rhWord} ({group}
        {rh})
      </Text>

      <View style={{ flexDirection: 'row', gap: 16, paddingVertical: 8 }}>
        {RH.map((r) => {
          const active = rh === r;
          const color = active ? ASSESSMENT.brand : ASSESSMENT.textSecondary;
          return (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setRh(r)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? ASSESSMENT.brand : ASSESSMENT.hairline,
                backgroundColor: active ? ASSESSMENT.tint : ASSESSMENT.surfaceMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ width: 24, height: 24 }}>
                {r === '+' ? <PlusIcon size={24} color={color} /> : <MinusIcon size={24} color={color} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <BloodTypeExplainer />
    </View>
  );
}

function BloodTypeExplainer() {
  const ASSESSMENT = useAssessment();
  const help = ka.assessment.bloodTypeHelp;

  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 16,
        backgroundColor: ASSESSMENT.tint,
        borderWidth: 1,
        borderColor: ASSESSMENT.tintBorder,
        padding: 16,
        gap: 14,
      }}
    >
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          lineHeight: 22,
          color: ASSESSMENT.brandInk,
        }}
      >
        {help.title}
      </Text>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 13,
          lineHeight: 20,
          color: ASSESSMENT.textSecondary,
        }}
      >
        {help.intro}
      </Text>

      <View style={{ gap: 8 }}>
        {help.maps.map((row) => (
          <View
            key={row.geo}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: ASSESSMENT.surface,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <View
              style={{
                minWidth: 44,
                height: 32,
                borderRadius: 8,
                backgroundColor: ASSESSMENT.tintStrong,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: isLatinUnitLabel(row.geo) ? unitLabelFontFamily(row.geo, true) : 'NotoSansGeorgian_700Bold',
                  fontSize: 14,
                  color: ASSESSMENT.brandInk,
                }}
              >
                {row.geo}
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                marginHorizontal: 10,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 13,
                color: ASSESSMENT.muted,
              }}
            >
              →
            </Text>
            <Text
              style={{
                fontFamily: unitLabelFontFamily(row.abo, true),
                fontWeight: '700',
                fontSize: 16,
                color: ASSESSMENT.textPrimary,
              }}
            >
              {row.abo}
            </Text>
          </View>
        ))}
      </View>

      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 13,
          lineHeight: 20,
          color: ASSESSMENT.textSecondary,
        }}
      >
        {help.rh}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {help.examples.map((ex) => (
          <View
            key={ex.abo}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: ASSESSMENT.surface,
              borderRadius: 999,
              paddingVertical: 8,
              paddingHorizontal: 12,
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 12,
                color: ASSESSMENT.textSecondary,
              }}
            >
              {ex.geo}
            </Text>
            <Text style={{ color: ASSESSMENT.brand, fontSize: 12 }}>=</Text>
            <Text
              style={{
                fontFamily: unitLabelFontFamily(ex.abo, true),
                fontWeight: '700',
                fontSize: 13,
                color: ASSESSMENT.brandInk,
              }}
            >
              {ex.abo}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          backgroundColor: ASSESSMENT.brand,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 13,
            lineHeight: 20,
            color: '#FFFFFF',
          }}
        >
          {help.takeaway}
        </Text>
      </View>
    </View>
  );
}

export { GROUPS as BLOOD_GROUPS, RH as BLOOD_RH };
