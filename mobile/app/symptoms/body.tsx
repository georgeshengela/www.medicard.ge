import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, Search } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomBodyMap } from '@/components/symptoms/SymptomBodyMap';
import { SymptomBrowseSheet, SymptomBodyAreaTile, SymptomOrganBrowseRow } from '@/components/symptoms/SymptomBrowseSheet';
import { SymptomSheet } from '@/components/symptoms/SymptomSheet';
import { SymptomSprite } from '@/components/symptoms/SymptomSprite';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import {
  ANATOMY_SHEET,
  ANATOMY_SHEET_SIZE,
  anatomyPartCrop,
  ORGAN_SHEET,
  ORGAN_SHEET_SIZE,
  organSheetCrop,
  SYMPTOM_ORGAN_PNG,
} from '@/constants/symptomAssets';
import {
  BODY_PART_GRID,
  bodyPartById,
  organById,
  organsForGender,
  symptomsForSelection,
} from '@/constants/symptomCatalog';
import { ka } from '@/i18n/ka';
import { removeSymptom, toggleSymptom, updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';
import type { AnatomyMode, BodyPartId, OrganId } from '@/types/symptoms';

function sideFor(partId?: string | null, organId?: string | null) {
  const part = bodyPartById(partId);
  if (part && part.side !== 'both') return part.side;
  const organ = organById(organId);
  if (organ && organ.side !== 'both') return organ.side;
  return null;
}

export default function SymptomBodyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useSymptomChecker();
  const [modeSheet, setModeSheet] = useState(false);
  const [partsSheet, setPartsSheet] = useState(false);
  const [symptomSheet, setSymptomSheet] = useState(false);
  const [draftPartId, setDraftPartId] = useState<BodyPartId | null>(state.selectedPartId);
  const [draftOrganId, setDraftOrganId] = useState<OrganId | null>(state.selectedOrganId);

  const gender = state.gender;
  const organs = organsForGender(gender);
  const modeLabel = state.mode === 'organ' ? ka.symptoms.organMode : ka.symptoms.muscleMode;
  const total = state.mode === 'organ' ? organs.length : BODY_PART_GRID.length;

  const openBrowse = () => {
    setDraftPartId(state.selectedPartId);
    setDraftOrganId(state.selectedOrganId);
    setPartsSheet(true);
  };

  const applyBrowse = () => {
    if (state.mode === 'organ') {
      if (!draftOrganId) return;
      updateSymptomChecker({ selectedOrganId: draftOrganId, side: sideFor(null, draftOrganId) ?? state.side });
    } else if (draftPartId) {
      updateSymptomChecker({ selectedPartId: draftPartId, selectedOrganId: null, side: sideFor(draftPartId) ?? state.side });
    }
    setPartsSheet(false);
    setSymptomSheet(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas, paddingBottom: insets.bottom }}>
      <SymptomNavHeader title={ka.symptoms.browseTitle} onBack={() => router.back()} bordered />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: T.white,
          borderBottomWidth: 1,
          borderBottomColor: T.borderTertiary,
        }}
      >
        <Pressable onPress={() => setModeSheet(true)} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: T.textPrimary }}>{modeLabel}</Text>
            <ChevronDown size={20} color={T.textPrimary} />
          </View>
          <Text style={{ marginTop: 4, fontSize: 14, color: T.textSecondary }}>{ka.symptoms.totalCount(total)}</Text>
        </Pressable>
        <Pressable
          onPress={openBrowse}
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: T.cardBg,
            borderWidth: 1,
            borderColor: T.borderTertiary,
            alignItems: 'center',
            justifyContent: 'center',
            ...T.shadowXs,
          }}
        >
          <Search size={22} color={T.textPrimary} />
        </Pressable>
      </View>

      <SymptomBodyMap
        gender={gender}
        side={state.side}
        mode={state.mode}
        selectedPartId={state.selectedPartId}
        selectedOrganId={state.selectedOrganId}
        symptoms={state.symptoms}
        onToggleSide={() => updateSymptomChecker({ side: state.side === 'front' ? 'back' : 'front' })}
        onSelectPart={(id) => {
          updateSymptomChecker({ selectedPartId: id, selectedOrganId: null, side: sideFor(id) ?? state.side });
          setSymptomSheet(true);
        }}
        onSelectOrgan={(id) => {
          updateSymptomChecker({ selectedOrganId: id, side: sideFor(null, id) ?? state.side });
          setSymptomSheet(true);
        }}
        onOpenList={openBrowse}
        onRemoveSymptom={removeSymptom}
        onContinue={() => router.push('/symptoms/details' as never)}
      />

      <SymptomSheet
        visible={modeSheet}
        title={ka.symptoms.chooseMode}
        onClose={() => setModeSheet(false)}
        ctaLabel={ka.common.done}
        onCta={() => setModeSheet(false)}
      >
        {(['muscle', 'organ'] as AnatomyMode[]).map((mode) => {
          const on = state.mode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => updateSymptomChecker({ mode, selectedOrganId: null })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                marginBottom: 8,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: on ? T.brand : T.border,
                backgroundColor: on ? T.brandSoft : T.cardBg,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: T.textPrimary }}>
                  {mode === 'organ' ? ka.symptoms.organMode : ka.symptoms.muscleMode}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: T.textSecondary }}>
                  {mode === 'organ' ? ka.symptoms.organModeHint : ka.symptoms.muscleModeHint}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </SymptomSheet>

      <SymptomBrowseSheet
        visible={partsSheet}
        title={state.mode === 'organ' ? ka.symptoms.browseOrgans : ka.symptoms.browseBodyAreas}
        onClose={() => setPartsSheet(false)}
        onApply={applyBrowse}
        applyDisabled={state.mode === 'organ' ? !draftOrganId : !draftPartId}
      >
        {state.mode === 'organ' ? (
          organs.map((organ) => {
            const png = SYMPTOM_ORGAN_PNG[organ.id];
            return (
              <SymptomOrganBrowseRow
                key={organ.id}
                label={organ.labelKa}
                selected={draftOrganId === organ.id}
                onPress={() => setDraftOrganId(organ.id)}
                icon={
                  png ? (
                    <Image source={png} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  ) : (
                    <SymptomSprite
                      source={ORGAN_SHEET}
                      sheet={ORGAN_SHEET_SIZE}
                      crop={organSheetCrop(organ.id, gender)}
                      width={40}
                      height={40}
                    />
                  )
                }
              />
            );
          })
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {BODY_PART_GRID.map((id) => {
              const part = bodyPartById(id);
              const selected = draftPartId === id;
              return (
                <SymptomBodyAreaTile
                  key={id}
                  label={part?.labelKa ?? id}
                  selected={selected}
                  onPress={() => setDraftPartId(id)}
                >
                  <SymptomSprite
                    source={ANATOMY_SHEET}
                    sheet={ANATOMY_SHEET_SIZE}
                    crop={anatomyPartCrop(id, gender, selected)}
                    width={88}
                    height={128}
                  />
                </SymptomBodyAreaTile>
              );
            })}
          </View>
        )}
      </SymptomBrowseSheet>

      <SymptomSheet
        visible={symptomSheet}
        title={ka.symptoms.addForArea}
        subtitle={ka.symptoms.addForAreaHint}
        onClose={() => setSymptomSheet(false)}
        ctaLabel={ka.common.done}
        onCta={() => setSymptomSheet(false)}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {symptomsForSelection(state.mode, state.selectedPartId, state.selectedOrganId).map((s) => (
            <Pressable
              key={s}
              onPress={() => toggleSymptom(s)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: state.symptoms.includes(s) ? T.brand : T.borderTertiary,
                backgroundColor: state.symptoms.includes(s) ? T.brandSoft : T.cardBg,
              }}
            >
              <Text style={{ fontSize: 14, color: state.symptoms.includes(s) ? T.brand : T.textPrimary, fontWeight: '500' }}>
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
      </SymptomSheet>
    </View>
  );
}
