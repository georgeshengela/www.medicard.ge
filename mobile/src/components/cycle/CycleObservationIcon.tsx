import React from 'react';
import { View } from 'react-native';
import {
  Activity, Apple, Baby, BatteryLow, Brain, Check, Cloud, CloudRain, Droplet,
  Droplets, Flame, Frown, Heart, HeartPulse, Leaf, Moon, Pill, ShieldCheck,
  Smile, Snowflake, Sparkles, Sun, Thermometer, Waves, Wind, Zap, type LucideIcon,
} from 'lucide-react-native';
import { MOOD_OPTIONS, PHYSICAL_SYMPTOMS, PREGNANCY_CHECKLIST, SEXUAL_OPTIONS } from '@/constants/cycle';

const ICONS: Record<string, LucideIcon> = {
  energetic: Zap, calm: Leaf, happy: Smile, confident: ShieldCheck, sensitive: Heart,
  anxious: Cloud, irritable: Flame, angry: Flame, sad: Frown, tearful: CloudRain,
  mood_swings: Waves, focused: Brain, unfocused: Cloud, tired_mood: BatteryLow,
  apathetic: Moon, stressed: Activity, romantic: Heart, lonely: Cloud,
  cramps: Activity, headache: Brain, migraine: Brain, bloating: Wind, acne: Sparkles,
  fatigue: BatteryLow, back_pain: Activity, breast_tenderness: Heart, breast_swelling: Heart,
  nausea: Waves, vomiting: Waves, heartburn: Flame, dizziness: Wind, insomnia: Moon,
  oversleep: Moon, appetite_up: Apple, appetite_down: Apple, cravings: Apple,
  hot_flashes: Thermometer, night_sweats: CloudRain, chills: Snowflake, sweating: Droplets,
  constipation: Waves, diarrhea: Waves, gas: Wind, swelling: Droplets, water_retention: Droplets,
  dry_skin: Droplet, oily_skin: Droplet, itchy_skin: Sparkles, hair_loss: Leaf,
  palpitations: HeartPulse, short_breath: Wind, fever: Thermometer, cold_symptoms: Snowflake,
  vaginal_dryness: Droplet, discharge: Droplets, frequent_urination: Droplet,
  prenatal_vitamin: Pill, folic_acid: Pill, water_2l: Droplets, walk: Activity,
  doctor_appt: HeartPulse, ultrasound: Baby, blood_test: Droplet, rest: Moon,
  protected: ShieldCheck, unprotected: Heart, high_drive: Heart, low_drive: Heart,
  dry: Droplet, sticky: Droplet, creamy: Droplet, watery: Droplets, eggwhite: Droplets,
};
const BY_LABEL = new Map([...MOOD_OPTIONS, ...PHYSICAL_SYMPTOMS, ...PREGNANCY_CHECKLIST, ...SEXUAL_OPTIONS].map(item => [item.label, item.id]));

/** Icons supplement the adjacent Georgian label; they are never the only explanation. */
export function CycleObservationIcon({ id, label, color, size = 20, selected = false }: {
  id?: string; label?: string; color: string; size?: number; selected?: boolean;
}) {
  const key = id || (label ? BY_LABEL.get(label) : undefined);
  const Icon = selected ? Check : key ? ICONS[key] || Activity : Activity;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Icon size={size} color={color} strokeWidth={selected ? 2.6 : 1.8}/>
  </View>;
}
