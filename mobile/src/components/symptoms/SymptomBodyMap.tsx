import React, { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { List, Minus, Plus, RotateCcw } from 'lucide-react-native';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { SYMPTOM_BODY_SOURCES, SYMPTOM_ORGAN_PNG, organSheetCrop, ORGAN_SHEET, ORGAN_SHEET_SIZE } from '@/constants/symptomAssets';
import { organsForView, partsForSide, type BodyPartDef, type OrganDef } from '@/constants/symptomCatalog';
import { SymptomSprite } from './SymptomSprite';
import { SymptomChip } from './SymptomChip';
import { SymptomCta } from './SymptomCta';
import { SymptomHotspot } from './SymptomHotspot';
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

function flipped(hit: BodyPartDef['hit']): BodyPartDef['hit'] {
  return { ...hit, x: 1 - hit.x - hit.w };
}

const CENTERED: BodyPartId[] = ['head', 'neck', 'abs', 'chest', 'back', 'trap', 'glute'];

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
  const [zoom, setZoom] = useState(1);
  const source = SYMPTOM_BODY_SOURCES[gender][side];
  const parts = useMemo(() => partsForSide(side), [side]);
  const organs = useMemo(() => organsForView(gender, side), [gender, side]);

  const selectedPart = parts.find((p) => p.id === selectedPartId) ?? null;
  const selectedOrgan = organs.find((o) => o.id === selectedOrganId) ?? null;
  const title =
    mode === 'organ'
      ? selectedOrgan?.labelKa ?? ka.symptoms.pickOrgan
      : selectedPart?.labelKa ?? ka.symptoms.pickArea;
  const count =
    mode === 'organ' ? selectedOrgan?.conditions ?? organs.length : selectedPart?.conditions ?? parts.length;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: T.canvas, overflow: 'hidden' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
          <View
            style={{
              width: 300 * zoom,
              height: 520 * zoom,
              maxWidth: '94%',
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: T.white,
              ...T.shadowCard,
            }}
          >
            <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="contain" />

            {mode === 'muscle'
              ? parts.flatMap((part) => {
                  const hits = CENTERED.includes(part.id) ? [part.hit] : [part.hit, flipped(part.hit)];
                  return hits.map((hit, i) => (
                    <SymptomHotspot
                      key={`${part.id}-${i}`}
                      selected={selectedPartId === part.id}
                      label={part.labelKa}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onSelectPart(part.id);
                      }}
                      style={{
                        left: `${hit.x * 100}%`,
                        top: `${hit.y * 100}%`,
                        width: `${hit.w * 100}%`,
                        height: `${hit.h * 100}%`,
                      }}
                    />
                  ));
                })
              : organs.flatMap((organ) => {
                  const points =
                    organ.id === 'kidney' || organ.id === 'lung'
                      ? [organ.overlay, { x: 1 - organ.overlay.x, y: organ.overlay.y }]
                      : [organ.overlay];
                  return points.map((point, i) => (
                    <OrganPin
                      key={`${organ.id}-${i}`}
                      organ={organ}
                      gender={gender}
                      point={point}
                      selected={selectedOrganId === organ.id}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        onSelectOrgan(organ.id);
                      }}
                    />
                  ));
                })}
          </View>
        </View>

        <View style={{ position: 'absolute', left: 16, top: 12 }}>
          <Pressable
            onPress={onToggleSide}
            hitSlop={8}
            accessibilityLabel={ka.symptoms.rotateBody}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: T.white,
              borderWidth: 1,
              borderColor: T.border,
              alignItems: 'center',
              justifyContent: 'center',
              ...T.shadowXs,
            }}
          >
            <RotateCcw size={22} color={T.textPrimary} strokeWidth={2} />
          </Pressable>
        </View>

        <View
          style={{
            position: 'absolute',
            right: 16,
            top: 8,
            width: 52,
            height: 78,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: T.white,
            borderWidth: 1,
            borderColor: T.border,
            ...T.shadowXs,
          }}
        >
          <Image source={source} style={{ width: 52, height: 78 }} resizeMode="contain" />
        </View>

        <View style={{ position: 'absolute', right: 16, top: '42%', gap: 10 }}>
          <ZoomBtn icon={Plus} onPress={() => setZoom((z) => Math.min(1.35, z + 0.1))} />
          <ZoomBtn icon={Minus} onPress={() => setZoom((z) => Math.max(0.9, z - 0.1))} />
        </View>

        <LinearGradient
          colors={['rgba(249,250,251,0)', T.canvas, T.white]}
          locations={[0, 0.5, 1]}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 }}
          pointerEvents="none"
        />
      </View>

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
              <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
                {ka.symptoms.conditionsCount(count)}
              </Text>
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
              }}
            >
              <List size={22} color={T.brand} strokeWidth={2.1} />
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

function ZoomBtn({ icon: Icon, onPress }: { icon: typeof Plus; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: T.inverse,
        alignItems: 'center',
        justifyContent: 'center',
        ...T.shadowXs,
      }}
    >
      <Icon size={20} color={T.white} strokeWidth={2.2} />
    </Pressable>
  );
}

function OrganPin({
  organ,
  gender,
  point,
  selected,
  onPress,
}: {
  organ: OrganDef;
  gender: SymptomGender;
  point: { x: number; y: number };
  selected: boolean;
  onPress: () => void;
}) {
  const png = SYMPTOM_ORGAN_PNG[organ.id];
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        left: `${point.x * 100}%`,
        top: `${point.y * 100}%`,
        marginLeft: -20,
        marginTop: -20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? (
        <View style={{ alignItems: 'center', position: 'absolute', top: -36, zIndex: 2 }}>
          <View
            style={{
              backgroundColor: T.white,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 6,
              ...T.shadowCard,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: T.textPrimary }}>{organ.labelKa}</Text>
          </View>
        </View>
      ) : null}
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: selected ? T.brandSoft : 'rgba(255,255,255,0.95)',
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? T.brand : T.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          ...T.shadowXs,
        }}
      >
        {png ? (
          <Image source={png} style={{ width: 28, height: 28 }} resizeMode="contain" />
        ) : (
          <SymptomSprite
            source={ORGAN_SHEET}
            sheet={ORGAN_SHEET_SIZE}
            crop={organSheetCrop(organ.id, gender)}
            width={28}
            height={28}
          />
        )}
      </View>
    </Pressable>
  );
}
