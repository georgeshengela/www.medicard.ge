import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { List } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ORGAN_SHEET, ORGAN_SHEET_SIZE, SYMPTOM_ORGAN_PNG, organSheetCrop } from '@/constants/symptomAssets';
import { bodyPartById, organsForGender, organsForView, symptomsForSelection, type OrganDef } from '@/constants/symptomCatalog';
import { SymptomSprite } from './SymptomSprite';
import { SymptomChip } from './SymptomChip';
import { SymptomCta } from './SymptomCta';
import { SymptomAnatomyCanvas } from './SymptomAnatomyCanvas';
import type { AnatomyMode, BodyPartId, BodySide, OrganId, SymptomGender } from '@/types/symptoms';

type Props = {
  gender: SymptomGender;
  side: BodySide;
  mode: AnatomyMode;
  selectedPartId: BodyPartId | null;
  selectedOrganId: OrganId | null;
  symptoms: string[];
  onToggleSide: () => void;
  onSelectPart: (id: BodyPartId) => void;
  onSelectOrgan: (id: OrganId) => void;
  /** Adds or removes one of the picked place's symptoms (right in the panel). */
  onToggleSymptom: (label: string) => void;
  onOpenList: () => void;
  onRemoveSymptom: (label: string) => void;
  onContinue?: () => void;
};

/**
 * The anatomy canvas and one panel under it (owner 2026-10-04): the picked place's name, its
 * symptoms as chips to tick right here, her picks so far in one scrolling row, and „გაგრძელება“.
 */
export function SymptomBodyMap({
  gender,
  side,
  mode,
  selectedPartId,
  selectedOrganId,
  symptoms,
  onToggleSide,
  onSelectPart,
  onSelectOrgan,
  onToggleSymptom,
  onOpenList,
  onRemoveSymptom,
  onContinue,
}: Props) {
  const T = useFigmaSymptoms();
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const organs = useMemo(() => organsForView(gender, side), [gender, side]);
  // Organs mode is a tidy grid of every organ (owner 2026-10-04: pins on the body looked messy).
  const allOrgans = useMemo(() => organsForGender(gender), [gender]);
  const selectedOrgan = allOrgans.find((o) => o.id === selectedOrganId) ?? null;
  const picked = mode === 'organ' ? Boolean(selectedOrganId) : Boolean(selectedPartId);
  const areaSymptoms = picked ? symptomsForSelection(mode, selectedPartId, selectedOrganId) : [];
  const title =
    mode === 'organ'
      ? selectedOrgan?.labelKa ?? ka.symptoms.pickOrgan
      : selectedPartId
        ? (bodyPartById(selectedPartId)?.labelKa ?? ka.symptoms.tapBody)
        : ka.symptoms.tapBody;
  const has = (label: string) => symptoms.some((s) => s.toLowerCase() === label.toLowerCase());

  return (
    <View style={{ flex: 1 }}>
      {mode === 'organ' ? (
        <OrganGrid organs={allOrgans} gender={gender} selectedId={selectedOrganId} onSelect={onSelectOrgan} />
      ) : (
        <SymptomAnatomyCanvas
          gender={gender}
          side={side}
          mode={mode}
          selectedPartId={selectedPartId}
          selectedOrganId={selectedOrganId}
          organs={organs}
          onToggleSide={onToggleSide}
          onSelectPart={onSelectPart}
          onSelectOrgan={onSelectOrgan}
          renderOrganPin={(organ, selected) => <OrganPin organ={organ} gender={gender} selected={selected} />}
        />
      )}

      <View
        style={{
          backgroundColor: T.white,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          paddingHorizontal: 16,
          paddingTop: compact ? 12 : 16,
          paddingBottom: 12,
          gap: compact ? 10 : 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25, color: T.textPrimary }}>
              {title}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: T.textSecondary }}>
              {picked ? tx('მონიშნე, რაც გაწუხებს', 'Tick what bothers you') : mode === 'organ' ? ka.symptoms.organModeHint : ka.symptoms.tapBodyHint}
            </Text>
          </View>
          {mode === 'organ' ? null : <Pressable
            onPress={onOpenList}
            accessibilityRole="button"
            accessibilityLabel={ka.symptoms.browseBodyAreas}
            style={{ minHeight: 38, borderRadius: 19, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.brandSoft }}
          >
            <List size={16} color={T.brand} strokeWidth={2.2} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: T.brand }}>{tx('სია', 'List')}</Text>
          </Pressable>}
        </View>

        {picked ? (
          <ScrollView style={{ maxHeight: compact ? 88 : 128 }} nestedScrollEnabled contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {areaSymptoms.map((label) => (
              <SymptomChip key={label} label={label} selected={has(label)} onPress={() => onToggleSymptom(label)} />
            ))}
          </ScrollView>
        ) : null}

        <View style={{ height: 1, backgroundColor: T.border }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: T.textPrimary }}>
            {symptoms.length ? `${ka.symptoms.mySymptoms} · ${symptoms.length}` : ka.symptoms.mySymptoms}
          </Text>
        </View>
        {symptoms.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={{ gap: 8 }}>
            {symptoms.map((label) => (
              <SymptomChip key={label} label={label} selected onRemove={() => onRemoveSymptom(label)} />
            ))}
          </ScrollView>
        ) : (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textMuted }}>{ka.symptoms.emptySymptoms}</Text>
        )}
        {onContinue ? (
          <SymptomCta
            label={symptoms.length ? `${ka.common.continue} · ${symptoms.length}` : ka.common.continue}
            disabled={symptoms.length === 0}
            onPress={onContinue}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Every organ as a card with its picture and name, three to a row; the picked one is outlined. */
function OrganGrid({
  organs,
  gender,
  selectedId,
  onSelect,
}: {
  organs: OrganDef[];
  gender: SymptomGender;
  selectedId: OrganId | null;
  onSelect: (id: OrganId) => void;
}) {
  const T = useFigmaSymptoms();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {organs.map((organ) => {
        const on = organ.id === selectedId;
        const png = SYMPTOM_ORGAN_PNG[organ.id];
        return (
          <Pressable
            key={organ.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={organ.labelKa}
            onPress={() => onSelect(organ.id)}
            style={{
              width: '31.2%',
              minHeight: 112,
              borderRadius: 20,
              paddingVertical: 12,
              paddingHorizontal: 6,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              // White under every picture (some organ PNGs carry a white square); the pick is the outline.
              backgroundColor: T.white,
              borderWidth: 2,
              borderColor: on ? T.brandDark : 'transparent',
            }}
          >
            {png ? (
              <Image source={png} style={{ width: 52, height: 52 }} resizeMode="contain" />
            ) : (
              <SymptomSprite source={ORGAN_SHEET} sheet={ORGAN_SHEET_SIZE} crop={organSheetCrop(organ.id, gender)} width={52} height={52} />
            )}
            <Text
              numberOfLines={2}
              style={{
                fontFamily: on ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium',
                fontSize: 12.5,
                lineHeight: 17,
                textAlign: 'center',
                color: on ? T.brandDark : T.textPrimary,
              }}
            >
              {organ.labelKa}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function OrganPin({
  organ,
  gender,
  selected,
}: {
  organ: OrganDef;
  gender: SymptomGender;
  selected: boolean;
}) {
  const T = useFigmaSymptoms();
  const png = SYMPTOM_ORGAN_PNG[organ.id];
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: selected ? T.brandSoft : 'rgba(255,255,255,0.96)',
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? T.brand : T.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...T.shadowXs,
      }}
    >
      {png ? (
        <Image source={png} style={{ width: 26, height: 26 }} resizeMode="contain" />
      ) : (
        <SymptomSprite
          source={ORGAN_SHEET}
          sheet={ORGAN_SHEET_SIZE}
          crop={organSheetCrop(organ.id, gender)}
          width={26}
          height={26}
        />
      )}
    </View>
  );
}
