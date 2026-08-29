import React, { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { List } from 'lucide-react-native';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { ORGAN_SHEET, ORGAN_SHEET_SIZE, SYMPTOM_ORGAN_PNG, organSheetCrop } from '@/constants/symptomAssets';
import { bodyPartById, organsForView, symptomsForSelection, type OrganDef } from '@/constants/symptomCatalog';
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
  onOpenList: () => void;
  onRemoveSymptom: (label: string) => void;
  onContinue?: () => void;
};

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
  onOpenList,
  onRemoveSymptom,
  onContinue,
}: Props) {
  const T = useFigmaSymptoms();
  const organs = useMemo(() => organsForView(gender, side), [gender, side]);
  const selectedOrgan = organs.find((o) => o.id === selectedOrganId) ?? null;
  const areaSymptoms = symptomsForSelection(mode, selectedPartId, selectedOrganId);
  const title =
    mode === 'organ'
      ? selectedOrgan?.labelKa ?? ka.symptoms.pickOrgan
      : selectedPartId
        ? (bodyPartById(selectedPartId)?.labelKa ?? ka.symptoms.tapBody)
        : ka.symptoms.tapBody;
  const subtitle =
    selectedPartId || selectedOrganId ? ka.symptoms.symptomsInArea(areaSymptoms.length) : ka.symptoms.tapBodyHint;

  return (
    <View style={{ flex: 1 }}>
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

      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, backgroundColor: T.white }}>
        <View
          style={{
            backgroundColor: T.white,
            borderRadius: T.cardRadius,
            borderWidth: 1,
            borderColor: T.border,
            padding: 16,
            gap: 16,
            ...T.shadowCard,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, lineHeight: 28, fontWeight: '700', color: T.textPrimary, letterSpacing: -0.25 }}>
                {title}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: T.textSecondary }}>{subtitle}</Text>
            </View>
            <Pressable
              onPress={onOpenList}
              accessibilityRole="button"
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: T.brandSoft,
                borderWidth: 1,
                borderColor: T.brandBorder,
                alignItems: 'center',
                justifyContent: 'center',
                ...T.shadowXs,
              }}
            >
              <List size={24} color={T.brand} strokeWidth={2} />
            </Pressable>
          </View>
          <View style={{ height: 1, backgroundColor: T.border }} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary }}>{ka.symptoms.mySymptoms}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {symptoms.length ? (
              symptoms.map((s) => <SymptomChip key={s} label={s} onRemove={() => onRemoveSymptom(s)} />)
            ) : (
              <Text style={{ fontSize: 13, color: T.textMuted }}>{ka.symptoms.emptySymptoms}</Text>
            )}
          </View>
          {onContinue ? (
            <SymptomCta label={ka.common.continue} disabled={symptoms.length === 0} onPress={onContinue} />
          ) : null}
        </View>
      </View>
    </View>
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
