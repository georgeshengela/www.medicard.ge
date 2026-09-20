import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useState } from 'react';
import { Image, Text, useWindowDimensions, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { pregnancyDevelopmentAsset } from '@/lib/pregnancyDevelopmentAssets';
import { formatLengthCm, formatWeightGrams } from '@/lib/pregnancyWeekData.js';
import { useCycleColors } from '@/theme/cycle';
import { ArrowUpRight, Ruler, Sprout, Weight } from 'lucide-react-native';

export type WeekDevelopmentView = {
  week: number;
  kind?: string;
  comparisonKey?: string | null;
  lengthCm?: number | null;
  weightGrams?: number | null;
  measurementType?: 'CRL' | 'CHL' | null;
  illustrationKey?: string | null;
  beyondCatalog?: boolean;
} | null;

export function pregnancyLengthLabel(measurementType?: string | null) {
  if (measurementType === 'CRL') return ka.cycle.pregnancyLengthCrl;
  if (measurementType === 'CHL') return ka.cycle.pregnancyLengthChl;
  return ka.cycle.pregnancyLength;
}

export function pregnancyWeightText(grams?: number | null) {
  const formatted = formatWeightGrams(grams);
  if (!formatted) return null;
  if (formatted.unit === 'kg') return `${ka.cycle.pregnancyApprox} ${formatted.value} ${ka.cycle.pregnancyKg}`;
  return `${ka.cycle.pregnancyApprox} ${formatted.value} ${ka.cycle.pregnancyG}`;
}

export function pregnancyLengthText(cm?: number | null) {
  const value = formatLengthCm(cm);
  if (!value) return null;
  return `${ka.cycle.pregnancyApprox} ${value} ${ka.cycle.pregnancyCm}`;
}

export function PregnancySizeIllustration({
  comparisonKey,
  week,
  size = 168,
}: {
  comparisonKey?: string | null;
  week: number;
  size?: number;
}) {
  const c = useCycleColors();
  const [failed, setFailed] = useState(false);
  const art = pregnancyDevelopmentAsset(week);
  useEffect(() => { setFailed(false); }, [art?.stage]);
  if (!art || failed) return <View accessible accessibilityLabel="განვითარების ილუსტრაცია მიუწვდომელია"
    style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}><Sprout size={40} color={c.brand}/></View>;
  return <Image source={art.source} accessibilityLabel={`განვითარების ზოგადი ილუსტრაცია, დაახლოებით ${art.stage} კვირა. ეს არ არის შენი ბავშვის გამოსახულება.`}
    onError={() => setFailed(true)} resizeMode="contain" style={{width:size,height:size,alignSelf:'center'}}/>;
}

export function PregnancyWeekMetrics({
  development,
  compact = false,
}: {
  development: WeekDevelopmentView;
  compact?: boolean;
}) {
  const c = useCycleColors();
  const { width, fontScale } = useWindowDimensions();
  const stackMetrics = width < 360 || fontScale >= 1.25;
  if (!development) return null;
  const length = pregnancyLengthText(development.lengthCm);
  const weight = pregnancyWeightText(development.weightGrams);
  const illustration = pregnancyDevelopmentAsset(development.week);
  const comparison = illustration ? 'განვითარების ეტაპი' : null;
  const showArt = Boolean(illustration);
  const informational = development.kind === 'informational' || !showArt;

  if (compact) return (
    <View style={{borderRadius:24,backgroundColor:c.cardSoft,padding:16}}>
      <View style={{flexDirection:stackMetrics?'column':'row',alignItems:'center',gap:16}}>
        {showArt ? <View style={{width:104,height:128,alignItems:'center',justifyContent:'center'}}>
          <PregnancySizeIllustration comparisonKey={development.comparisonKey} week={development.week} size={128}/>
        </View> : null}
        <View style={{flex:stackMetrics?undefined:1,width:stackMetrics?'100%':undefined,minWidth:0,gap:12,alignItems:stackMetrics?'center':undefined}}>
          {comparison ? <Text style={{color:c.ink,fontFamily:'NotoSansGeorgian_600SemiBold',fontSize:16,lineHeight:24,textAlign:stackMetrics?'center':'left'}}>{comparison}</Text>
            : informational ? <Text style={{color:c.muted,fontSize:14,lineHeight:22}}>{ka.cycle.pregnancyWeekInformational}</Text> : null}
          {length ? <View style={{gap:4,alignSelf:'stretch'}}>
            <View style={{flexDirection:'row',gap:6,alignItems:'center'}}><Ruler size={14} color={c.mutedSoft}/><Text style={{flex:1,color:c.mutedSoft,fontSize:11,lineHeight:16,textAlign:stackMetrics?'center':'left'}}>{pregnancyLengthLabel(development.measurementType)}</Text></View>
            <Text style={{color:c.ink,fontFamily:'NotoSansGeorgian_700Bold',fontSize:16,lineHeight:24,textAlign:stackMetrics?'center':'left'}}>{length}</Text>
          </View> : null}
          {weight ? <View style={{gap:4,alignItems:stackMetrics?'center':undefined}}>
            <View style={{flexDirection:'row',gap:6,alignItems:'center'}}><Weight size={14} color={c.mutedSoft}/><Text style={{color:c.mutedSoft,fontSize:11,lineHeight:16}}>{ka.cycle.pregnancyWeight}</Text></View>
            <Text style={{color:c.ink,fontFamily:'NotoSansGeorgian_700Bold',fontSize:16,lineHeight:24}}>{weight}</Text>
          </View> : null}
        </View>
      </View>
      {illustration ? <Text style={{color:c.mutedSoft,fontSize:11,lineHeight:17,marginTop:12}}>{`ზოგადი ილუსტრაცია · დაახლოებით ${illustration.stage} კვირა. ზომები შეესაბამება არჩეულ კვირას.`}</Text> : null}
      {development.week === 19 && !length ? <Text style={{color:c.muted,fontSize:13,lineHeight:20,marginTop:8}}>{ka.cycle.pregnancyWeek19Length}</Text> : null}
    </View>
  );

  return (
    <View>
      {showArt ? (
        <PregnancySizeIllustration
          comparisonKey={development.comparisonKey}
          week={development.week}
          size={232}
        />
      ) : null}
      {comparison ? (
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: compact ? 15 : 17,
            lineHeight: compact ? 22 : 24,
            textAlign: 'center',
            marginTop: showArt ? 8 : 0,
          }}
        >
          {comparison}
        </Text>
      ) : informational ? (
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
          {ka.cycle.pregnancyWeekInformational}
        </Text>
      ) : null}
      {illustration ? <Text style={{color:c.mutedSoft,fontSize:12,lineHeight:18,textAlign:'center',marginTop:8}}>{`ზოგადი ილუსტრაცია · დაახლოებით ${illustration.stage} კვირა. ზომები შეესაბამება არჩეულ კვირას.`}</Text> : null}
      {development.week === 19 && !length ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>
          {ka.cycle.pregnancyWeek19Length}
        </Text>
      ) : null}
      {length || weight ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            marginTop: 12,
          }}
        >
          {length ? (
            <View style={{ alignItems: 'center', minWidth: 140, maxWidth: '100%', paddingHorizontal: 8 }}>
              <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, textAlign: 'center' }}>
                {pregnancyLengthLabel(development.measurementType)}
              </Text>
              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: compact ? 16 : 18,
                  lineHeight: 24,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {length}
              </Text>
            </View>
          ) : null}
          {weight ? (
            <View style={{ alignItems: 'center', minWidth: 140, maxWidth: '100%', paddingHorizontal: 8 }}>
              <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, textAlign: 'center' }}>{ka.cycle.pregnancyWeight}</Text>
              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: compact ? 16 : 18,
                  lineHeight: 24,
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                {weight}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PregnancyWeekOpenCta({ onPress }: { onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ka.cycle.pregnancyWeekCta}
      style={{
        minHeight: 44,
        marginTop: 8,
        borderRadius: 16,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ flexShrink:1,color: c.brand, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14,lineHeight:22 }}>
        {ka.cycle.pregnancyWeekCta}
      </Text>
      <ArrowUpRight size={18} color={c.brand}/>
    </Pressable>
  );
}
