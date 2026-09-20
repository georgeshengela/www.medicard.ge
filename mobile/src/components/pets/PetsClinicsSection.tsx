import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronDown, MapPin, Phone, Stethoscope } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { api, type PetClinic } from '@/lib/api';
import { clinicOpenState } from '@/lib/petsClinicsHours';
import { useIsDark, useThemeColors } from '@/theme/colors';

const fallbackClinics = require('@/lib/petsClinicsFallback.json') as PetClinic[];

const FLAT = {
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const GEO = {
  title: 'NotoSansGeorgian_700Bold',
  semibold: 'NotoSansGeorgian_600SemiBold',
  regular: 'NotoSansGeorgian_400Regular',
} as const;

const DAYS = [
  ['monday', 'ორშ'],
  ['tuesday', 'სამ'],
  ['wednesday', 'ოთხ'],
  ['thursday', 'ხუთ'],
  ['friday', 'პარ'],
  ['saturday', 'შაბ'],
  ['sunday', 'კვი'],
] as const;

function telHref(value: string) {
  const tel = String(value || '').replace(/[^\d+]/g, '');
  return tel ? `tel:${tel}` : null;
}

function mapsHref(value: string) {
  const q = String(value || '').trim();
  return q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : null;
}

function statusOf(clinic: PetClinic, now: Date) {
  const live = clinicOpenState(clinic, now);
  if (live.known) return live;
  if (clinic.openNow == null) return { open: false, known: false, weekday: live.weekday };
  return { open: clinic.openNow, known: clinic.hoursKnown, weekday: live.weekday };
}

function hourLabel(slot: PetClinic['hours'][string]) {
  if (!slot || slot.closed) return ka.pets.clinicsHoursClosed;
  if (slot.allDay) return ka.pets.clinicsHoursAllDay;
  return slot.label || ka.pets.clinicsUnknownHours;
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        ...FLAT,
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.primary200 : colors.bg300,
        backgroundColor: selected ? colors.accent100 : dark ? colors.surfaceRaised : colors.bg100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: GEO.semibold, fontSize: 13, color: selected ? colors.primary200 : colors.text200 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ClinicRow({
  clinic,
  expanded,
  now,
  onToggle,
}: {
  clinic: PetClinic;
  expanded: boolean;
  now: Date;
  onToggle: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const status = statusOf(clinic, now);
  const badgeBg = !status.known ? colors.bg200 : status.open ? colors.successBg : colors.bg200;
  const badgeFg = !status.known ? colors.text300 : status.open ? colors.success : colors.text300;
  const badge = !status.known ? ka.pets.clinicsUnknownHours : status.open ? ka.pets.clinicsOpen : ka.pets.clinicsClosed;

  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.bg300,
        backgroundColor: colors.surface,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${clinic.name}. ${badge}`}
        onPress={onToggle}
        className="active:opacity-90"
        style={{ ...FLAT, padding: 12, gap: 8 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: colors.accent100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Stethoscope size={18} color={colors.primary200} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={1} style={{ fontFamily: GEO.title, fontSize: 15, color: colors.text100 }}>
              {clinic.name}
            </Text>
            {clinic.location ? (
              <Text numberOfLines={1} style={{ fontFamily: GEO.regular, fontSize: 12, color: colors.text300 }}>
                {clinic.location}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: badgeBg,
            }}
          >
            <Text style={{ fontFamily: GEO.semibold, fontSize: 11, color: badgeFg }}>{badge}</Text>
          </View>
          <ChevronDown
            size={16}
            color={colors.text300}
            strokeWidth={2.2}
            style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
          {clinic.description ? (
            <Text numberOfLines={5} style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text200 }}>
              {clinic.description}
            </Text>
          ) : null}

          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: dark ? colors.surfaceRaised : colors.bg100,
              paddingHorizontal: 10,
              paddingVertical: 8,
              gap: 4,
            }}
          >
            {DAYS.map(([id, label]) => {
              const slot = clinic.hours?.[id];
              const today = status.weekday === id;
              return (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 22 }}>
                  <Text
                    style={{
                      width: 36,
                      fontFamily: today ? GEO.semibold : GEO.regular,
                      fontSize: 12,
                      color: today ? colors.primary200 : colors.text300,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: today ? GEO.semibold : GEO.regular,
                      fontSize: 12,
                      color: today ? colors.text100 : colors.text200,
                    }}
                  >
                    {hourLabel(slot)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {clinic.phones.map((phone) => (
              <Pressable
                key={phone.tel}
                accessibilityRole="button"
                accessibilityLabel={ka.pets.clinicsCall}
                onPress={() => {
                  const href = telHref(phone.tel);
                  if (href) void Linking.openURL(href);
                }}
                className="active:opacity-80"
                style={{
                  ...FLAT,
                  flexGrow: 1,
                  minHeight: 44,
                  borderRadius: 14,
                  backgroundColor: dark ? '#0D9488' : colors.primary200,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Phone size={16} color="#FFFFFF" strokeWidth={2.2} />
                <Text numberOfLines={1} style={{ fontFamily: GEO.title, fontSize: 14, color: '#FFFFFF' }}>
                  {phone.display}
                </Text>
              </Pressable>
            ))}
            {clinic.location ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={clinic.location}
                onPress={() => {
                  const href = mapsHref(clinic.location || '');
                  if (href) void Linking.openURL(href);
                }}
                className="active:opacity-80"
                style={{
                  ...FLAT,
                  minHeight: 44,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  paddingHorizontal: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapPin size={18} color={colors.primary200} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>
          {clinic.email ? (
            <Text style={{ fontFamily: GEO.regular, fontSize: 12, color: colors.text300 }}>{clinic.email}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PetsClinicsSection() {
  const colors = useThemeColors();
  const [clinics, setClinics] = useState<PetClinic[]>(() => fallbackClinics);
  const [sourceUrl, setSourceUrl] = useState('https://dogdog.ge/index.php?m=315');
  const [openOnly, setOpenOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const directory = await api.pets.clinics();
      if (directory.clinics?.length) {
        setClinics(directory.clinics);
        setSourceUrl(directory.source?.url || 'https://dogdog.ge/index.php?m=315');
      }
    } catch {
      setClinics(fallbackClinics);
    } finally {
      setNow(new Date());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void load();
    }, [load]),
  );

  const rows = useMemo(() => {
    const ranked = clinics
      .map((clinic) => ({ clinic, status: statusOf(clinic, now) }))
      .sort((a, b) => {
        const score = (row: typeof a) => (row.status.known ? (row.status.open ? 0 : 2) : 1);
        return score(a) - score(b) || a.clinic.name.localeCompare(b.clinic.name, 'ka');
      });
    return openOnly ? ranked.filter((row) => row.status.known && row.status.open) : ranked;
  }, [clinics, now, openOnly]);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: GEO.title, fontSize: 14, lineHeight: 20, color: colors.text100 }}>
        {ka.pets.clinicsTitle}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <FilterChip label={ka.pets.clinicsAll} selected={!openOnly} onPress={() => setOpenOnly(false)} />
        <FilterChip label={ka.pets.clinicsOpenNow} selected={openOnly} onPress={() => setOpenOnly(true)} />
      </View>

      {rows.length === 0 ? (
        <Text style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 18, color: colors.text300 }}>
          {ka.pets.clinicsEmpty}
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map(({ clinic }) => (
            <ClinicRow
              key={clinic.id}
              clinic={clinic}
              expanded={expandedId === clinic.id}
              now={now}
              onToggle={() => setExpandedId((current) => (current === clinic.id ? null : clinic.id))}
            />
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={ka.pets.clinicsSource}
        onPress={() => void Linking.openURL(sourceUrl)}
        className="active:opacity-80"
      >
        <Text style={{ fontFamily: GEO.regular, fontSize: 12, color: colors.primary200 }}>{ka.pets.clinicsSource}</Text>
      </Pressable>
    </View>
  );
}
