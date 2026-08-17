import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarClock, MapPin, Stethoscope, Trash2 } from 'lucide-react-native';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { doctorTypeLabel } from '@/constants/visits';
import { ka } from '@/i18n/ka';
import type { DoctorVisit } from '@/lib/api';
import { doctorDisplayName, isVisitPast } from '@/lib/visitReminders';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { useThemeColors } from '@/theme/colors';

type Props = {
  visit: DoctorVisit;
  onPress: () => void;
  onDelete: () => void;
};

export function VisitCard({ visit, onPress, onDelete }: Props) {
  const colors = useThemeColors();
  const past = isVisitPast(visit);
  const typeLabel = doctorTypeLabel(visit.doctorType);
  const title = doctorDisplayName(visit, typeLabel);
  const place = visit.addressLabel || visit.address;

  return (
    <Card className="mb-2.5" onPress={onPress}>
      <View className="flex-row items-start">
        <View
          className={`h-11 w-11 items-center justify-center rounded-2xl ${past ? 'bg-bg-200' : 'bg-[#D4E8E6]'}`}
        >
          <Stethoscope size={20} color={past ? colors.text300 : colors.primary200} strokeWidth={2.1} />
        </View>

        <View className="ml-3 flex-1">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-base font-bold text-text-100">{title}</Text>
              <Text className="mt-0.5 text-sm text-text-300">{typeLabel}</Text>
            </View>
            <Badge label={past ? ka.visits.past : ka.visits.upcoming} tone={past ? 'neutral' : 'brand'} />
          </View>

          <View className="mt-2.5 flex-row items-center">
            <CalendarClock size={14} color={colors.text300} strokeWidth={2} />
            <Text className="ml-1.5 text-sm font-semibold text-text-200">
              {formatCycleDateKa(visit.visitDate)} · {visit.visitTime}
            </Text>
          </View>

          {place ? (
            <View className="mt-1.5 flex-row items-start">
              <MapPin size={14} color={colors.text300} strokeWidth={2} style={{ marginTop: 2 }} />
              <Text numberOfLines={2} className="ml-1.5 flex-1 text-sm leading-5 text-text-300">
                {place}
              </Text>
            </View>
          ) : null}

          {visit.notes ? (
            <Text numberOfLines={2} className="mt-1.5 text-sm italic text-text-300">
              {visit.notes}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.delete}
          hitSlop={10}
          onPress={(e) => {
            e.stopPropagation?.();
            onDelete();
          }}
          className="ml-1 p-1"
        >
          <Trash2 size={17} color={colors.text300} strokeWidth={2} />
        </Pressable>
      </View>
    </Card>
  );
}
