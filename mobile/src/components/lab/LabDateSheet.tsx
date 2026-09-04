import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { ka } from '@/i18n/ka';
import { todayYmd } from '@/lib/hydration';

type Props = {
  visible: boolean;
  value?: string;
  onConfirm: (ymd: string) => void;
  onClose: () => void;
};

export function LabDateSheet({ visible, value, onConfirm, onClose }: Props) {
  const T = useFigmaLab();
  const insets = useSafeAreaInsets();
  const today = todayYmd();
  const initial = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
  const [cursor, setCursor] = useState(initial.slice(0, 7));
  const [picked, setPicked] = useState(initial);

  useEffect(() => {
    if (!visible) return;
    const next = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
    setCursor(next.slice(0, 7));
    setPicked(next);
  }, [today, value, visible]);

  const [year, month] = cursor.split('-').map(Number);
  const label = useMemo(
    () => new Date(year, month - 1, 1).toLocaleDateString('ka-GE', { month: 'long', year: 'numeric' }),
    [month, year],
  );
  const cells = useMemo(() => monthCells(year, month - 1), [month, year]);

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ ...absoluteFill, backgroundColor: APP_MODAL_OVERLAY }} onPress={onClose} />
        <View
          style={{
            backgroundColor: T.pageBg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 16,
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: T.textPrimary }}>
            {ka.lab.dateTitle}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 22, color: T.textSecondary }}>
            {ka.lab.dateBody}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={() => setCursor(shiftMonth(cursor, -1))}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={22} color={T.textPrimary} />
            </Pressable>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>{label}</Text>
            <Pressable
              onPress={() => setCursor(shiftMonth(cursor, 1))}
              style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={22} color={T.textPrimary} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {ka.hydration.weekdaySun.map((d) => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: T.textMuted, fontFamily: 'NotoSansGeorgian_500Medium' }}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((cell) => {
              const selected = cell.ymd === picked;
              const disabled = cell.ymd > today || !cell.inMonth;
              return (
                <Pressable
                  key={cell.ymd + cell.day}
                  disabled={disabled}
                  onPress={() => setPicked(cell.ymd)}
                  style={{
                    width: '14.28%',
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    backgroundColor: selected ? T.brand : 'transparent',
                    opacity: disabled ? 0.28 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 14,
                      color: selected ? '#FFFFFF' : T.textPrimary,
                    }}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => onConfirm(picked)}
            style={{
              backgroundColor: T.brand,
              minHeight: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>{ka.lab.dateSave}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const absoluteFill = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

function shiftMonth(cursor: string, delta: number): string {
  const [y, m] = cursor.split('-').map(Number);
  const next = new Date(y, m - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function monthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { ymd: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i += 1) {
    const date = new Date(year, monthIndex, i - startPad + 1);
    cells.push({ ymd: ymd(date), day: date.getDate(), inMonth: false });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({ ymd: ymd(new Date(year, monthIndex, day)), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const date = new Date(last.ymd + 'T12:00:00');
    date.setDate(date.getDate() + 1);
    cells.push({ ymd: ymd(date), day: date.getDate(), inMonth: false });
  }
  return cells;
}

function ymd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
