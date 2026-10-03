import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import type { CycleMediContext } from '@/lib/cycleMediContext';
import { useCycleColors } from '@/theme/cycle';

/**
 * „ციკლის კონტექსტი · დღე 12, სავარაუდოდ ფოლიკულური“ — what will travel with her first question when
 * Medi was opened from a cycle screen (W2-8). A tap opens the exact lines that go; ✕ removes it, and
 * then only the question is sent.
 */
export function MediContextChip({ context, onRemove }: { context: CycleMediContext; onRemove: () => void }) {
  const c = useCycleColors();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View style={{ marginBottom: 10, borderRadius: 16, backgroundColor: c.accentSoft, paddingLeft: 12, paddingRight: 4, paddingVertical: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={tx(
            `${context.chipLabel}. პირველ შეკითხვასთან ერთად გაიგზავნება. შეეხე, რომ ნახო რა.`,
            `${context.chipLabel}. Goes with your first question. Tap to see what.`,
          )}
          onPress={() => setOpen((v) => !v)}
          style={{ flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.brand }} />
          <Text style={{ flexShrink: 1, color: c.brand, fontSize: 13, lineHeight: 18, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
            {context.chipLabel}
          </Text>
          <Chevron size={16} color={c.brand} strokeWidth={2.2} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('ციკლის კონტექსტის მოშორება', 'Remove the cycle context')}
          hitSlop={4}
          onPress={onRemove}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={17} color={c.muted} strokeWidth={2.2} />
        </Pressable>
      </View>
      {open ? (
        <View style={{ paddingBottom: 10, paddingRight: 8, gap: 4 }}>
          {context.lines.map((line) => (
            <Text key={line} style={{ color: c.ink, fontSize: 13, lineHeight: 19, fontFamily: 'NotoSansGeorgian_400Regular' }}>
              {`· ${line}`}
            </Text>
          ))}
          <Text style={{ marginTop: 4, color: c.muted, fontSize: 12, lineHeight: 17, fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {tx(
              'მხოლოდ პირველ შეკითხვასთან ერთად გაიგზავნება, AI-ის თანხმობის შემდეგ. ინტიმური ჩანაწერები არასდროს.',
              'Sent only with your first question, after your AI consent. Never your intimate logs.',
            )}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
