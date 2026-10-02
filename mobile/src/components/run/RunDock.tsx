import React from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {Flag, Gauge, Pause, Play, Route, Timer, type LucideIcon} from 'lucide-react-native';
import {formatClock, formatDistanceShort, formatPace} from '@/lib/run/geo';
import type {RunState} from '@/lib/run/store';
import {BOLD, SEMIBOLD} from './PulseUi';
import {tx} from '@/i18n/locale';

/**
 * The session console at the bottom of the MEDIRUN map, compact and symmetric: one row — finish on the left,
 * three equal metric columns (distance, time, pace) in the middle, play/pause on the right, both round buttons
 * the same size. Tapping the metrics opens the details. A distance goal is a thin line along the top.
 * Solid night navy like the map and the lock-screen Live Activity.
 */
const INK = {
  surface: '#0F172A',
  line: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.5)',
  teal: '#2DD4BF',
  amber: '#FBBF24',
  cta: '#0D9488',
  danger: '#FB7185',
};

/** "3.2 კმ" → number and unit, so the unit sits smaller next to the figure. */
function splitValue(text: string): [string, string] {
  const at = text.lastIndexOf(' ');
  return at > 0 ? [text.slice(0, at), text.slice(at + 1)] : [text, ''];
}

/** One of three identical columns: the figure, then icon and label, centred. */
function Stat({icon: Icon, label, value, hold = false}: {icon: LucideIcon; label: string; value: string; hold?: boolean}) {
  const [num, unit] = splitValue(value);
  return (
    <View style={{flex: 1, alignItems: 'center', minWidth: 0}}>
      <View style={{flexDirection: 'row', alignItems: 'baseline', gap: 2}}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{fontFamily: BOLD, fontSize: 20, lineHeight: 25, color: hold ? INK.amber : INK.text, fontVariant: ['tabular-nums'], letterSpacing: -0.4}}>{num}</Text>
        {unit ? <Text numberOfLines={1} style={{fontFamily: SEMIBOLD, fontSize: 11, color: INK.muted}}>{unit}</Text> : null}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 3}}>
        <Icon size={11} color={hold ? INK.amber : INK.muted} strokeWidth={2.2} />
        <Text numberOfLines={1} style={{fontFamily: SEMIBOLD, fontSize: 10.5, lineHeight: 14, color: INK.muted}}>{label}</Text>
      </View>
    </View>
  );
}

const Divider = () => <View style={{width: 1, alignSelf: 'stretch', marginVertical: 5, backgroundColor: INK.line}} />;

const ROUND = 46;

export function RunDock({run, pace, progress, busy, onPrimary, onFinish, onDetails}: {
  run: RunState;
  pace: number | null;
  progress: number;
  busy: boolean;
  onPrimary: () => void;
  onFinish: () => void;
  onDetails: () => void;
}) {
  const running = run.phase === 'running', active = running || run.phase === 'paused';
  const hold = running && run.transportWarning; // in a vehicle: distance and time are on hold
  const pct = Math.round(Math.min(1, progress) * 100);
  const primaryLabel = running ? tx('პაუზა', 'Pause') : run.phase === 'paused' ? tx('გავაგრძელოთ გზა', 'Keep going') : tx('დავიწყოთ აღმოჩენა', 'Start exploring');
  const disabled = busy || run.phase === 'preparing';
  if (!active) {
    // Before the first start: one clear call to action instead of an unlabeled round button.
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={primaryLabel} accessibilityState={{disabled, busy}} disabled={disabled} onPress={onPrimary} style={{height: 52, borderRadius: 26, backgroundColor: INK.cta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: run.phase === 'preparing' ? 0.6 : 1, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 10}}>
        {busy ? <ActivityIndicator color={INK.text} /> : <Play size={17} color={INK.text} fill={INK.text} />}
        <Text style={{fontFamily: BOLD, fontSize: 15, color: INK.text}}>{primaryLabel}</Text>
      </Pressable>
    );
  }
  return (
    <View style={{backgroundColor: INK.surface, borderRadius: 26, borderWidth: 1, borderColor: INK.line, padding: 10, gap: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 10}}>
      {run.targetMeters > 0 ? (
        <View accessibilityRole="progressbar" accessibilityLabel={tx('მიზნის პროგრესი', 'Goal progress')} accessibilityValue={{min: 0, max: 100, now: pct}} style={{height: 3, marginHorizontal: 56, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden'}}>
          <View style={{height: 3, width: `${pct}%`, borderRadius: 2, backgroundColor: INK.teal}} />
        </View>
      ) : null}
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        {(
          <Pressable accessibilityRole="button" accessibilityLabel={tx('სესიის დასრულება', 'End session')} onPress={onFinish} hitSlop={4} style={{width: ROUND, height: ROUND, borderRadius: ROUND / 2, backgroundColor: 'rgba(251,113,133,0.14)', alignItems: 'center', justifyContent: 'center'}}>
            <Flag size={18} color={INK.danger} />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={tx('გასეირნების დეტალები', 'Walk details')} onPress={onDetails} style={{flex: 1, flexDirection: 'row', minHeight: ROUND, alignItems: 'center'}}>
          <Stat icon={Route} label={tx('მანძილი', 'Distance')} value={formatDistanceShort(run.distanceM)} hold={hold} />
          <Divider />
          <Stat icon={Timer} label={tx('დრო', 'Time')} value={formatClock(run.movingMs)} hold={hold} />
          <Divider />
          <Stat icon={Gauge} label={tx('ტემპი', 'Pace')} value={formatPace(pace)} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={primaryLabel} accessibilityState={{disabled, busy}} disabled={disabled} onPress={onPrimary} hitSlop={4} style={{width: ROUND, height: ROUND, borderRadius: ROUND / 2, backgroundColor: running ? INK.text : INK.cta, alignItems: 'center', justifyContent: 'center', opacity: run.phase === 'preparing' ? 0.6 : 1}}>
          {busy ? <ActivityIndicator color={running ? INK.surface : INK.text} /> : running ? <Pause size={18} color={INK.surface} fill={INK.surface} /> : <Play size={18} color={INK.text} fill={INK.text} style={{marginLeft: 2}} />}
        </Pressable>
      </View>
    </View>
  );
}
