import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { History } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomBodyMap } from '@/components/symptoms/SymptomBodyMap';
import { SymptomBrowseSheet, SymptomBodyAreaTile, SymptomOrganBrowseRow } from '@/components/symptoms/SymptomBrowseSheet';
import { SymptomSprite } from '@/components/symptoms/SymptomSprite';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import {
  ANATOMY_SHEET,
  ANATOMY_SHEET_SIZE,
  anatomyPartCrop,
  ORGAN_SHEET,
  ORGAN_SHEET_SIZE,
  organSheetCrop,
  SYMPTOM_ORGAN_PNG,
} from '@/constants/symptomAssets';
import { BODY_PARTS, BODY_PART_GRID, bodyPartById, organById, organsForGender } from '@/constants/symptomCatalog';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { removeSymptom, resetSymptomChecker, toggleSymptom, updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';
import type { AnatomyMode, BodyPartId, OrganId } from '@/types/symptoms';

function sideFor(partId?: string | null, organId?: string | null) {
  const part = bodyPartById(partId);
  if (part && part.side !== 'both') return part.side;
  const organ = organById(organId);
  if (organ && organ.side !== 'both') return organ.side;
  return null;
}

/**
 * „სად გაწუხებს?“ — the body map (owner 2026-10-04: keep the body picking, make it smooth). A body /
 * organs switch on top, the anatomy canvas, and one panel under it: tap a place and its symptoms are
 * right there as chips (no sheet in between), her picks stay listed, „გაგრძელება“ moves on.
 * `?part=<id>` (Home chips) starts a fresh check with that place picked; `?start=1` starts fresh.
 */
export default function SymptomBodyScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ part?: string; start?: string }>();
  const state = useSymptomChecker();
  const [partsSheet, setPartsSheet] = useState(false);
  const [draftPartId, setDraftPartId] = useState<BodyPartId | null>(state.selectedPartId);
  const [draftOrganId, setDraftOrganId] = useState<OrganId | null>(state.selectedOrganId);
  const started = useRef(false);

  // Entered from Home: a fresh check (her last one may still sit in memory), the tapped place picked.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const part = BODY_PARTS.find((p) => p.id === params.part)?.id ?? null;
    if (!part && params.start !== '1') return;
    resetSymptomChecker(user?.gender);
    updateSymptomChecker({ method: 'anatomy', mode: 'muscle' });
    if (part) updateSymptomChecker({ selectedPartId: part, side: sideFor(part) ?? 'front' });
  }, [params.part, params.start, user?.gender]);

  const gender = state.gender;
  const organs = organsForGender(gender);

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
  };

  const modes: { id: AnatomyMode; label: string }[] = [
    { id: 'muscle', label: tx('სხეული', 'Body') },
    { id: 'organ', label: tx('ორგანოები', 'Organs') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas, paddingBottom: insets.bottom }}>
      <SymptomNavHeader
        title={tx('სად გაწუხებს?', 'Where does it bother you?')}
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push('/symptoms/history' as never)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={ka.symptoms.viewHistory}
          >
            <History size={21} color={T.textPrimary} strokeWidth={2} />
          </Pressable>
        }
      />
      {/* Body ↔ organs in one tap (was a dropdown and a sheet). */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: T.cardBg }}>
          {modes.map((m) => {
            const on = state.mode === m.id;
            return (
              <Pressable
                key={m.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => updateSymptomChecker({ mode: m.id, selectedOrganId: null })}
                style={{ flex: 1, minHeight: 38, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? T.brandDark : 'transparent' }}
              >
                <Text style={{ fontFamily: on ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium', fontSize: 14, color: on ? T.textOnBrand : T.textSecondary }}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SymptomBodyMap
        gender={gender}
        side={state.side}
        mode={state.mode}
        selectedPartId={state.selectedPartId}
        selectedOrganId={state.selectedOrganId}
        symptoms={state.symptoms}
        onToggleSide={() => updateSymptomChecker({ side: state.side === 'front' ? 'back' : 'front', selectedPartId: null, selectedOrganId: null })}
        onSelectPart={(id) => updateSymptomChecker({ selectedPartId: id, selectedOrganId: null, side: sideFor(id) ?? state.side })}
        onSelectOrgan={(id) => updateSymptomChecker({ selectedOrganId: id, side: sideFor(null, id) ?? state.side })}
        onToggleSymptom={toggleSymptom}
        onOpenList={openBrowse}
        onRemoveSymptom={removeSymptom}
        onContinue={() => router.push('/symptoms/details' as never)}
      />

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
                    <SymptomSprite source={ORGAN_SHEET} sheet={ORGAN_SHEET_SIZE} crop={organSheetCrop(organ.id, gender)} width={40} height={40} />
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
                <SymptomBodyAreaTile key={id} label={part?.labelKa ?? id} selected={selected} onPress={() => setDraftPartId(id)}>
                  <SymptomSprite source={ANATOMY_SHEET} sheet={ANATOMY_SHEET_SIZE} crop={anatomyPartCrop(id, gender, selected)} width={88} height={128} />
                </SymptomBodyAreaTile>
              );
            })}
          </View>
        )}
      </SymptomBrowseSheet>
    </View>
  );
}
