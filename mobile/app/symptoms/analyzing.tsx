import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Animated, Easing, Text, View } from 'react-native';

import { useFocusEffect, useRouter } from 'expo-router';

import { LinearGradient } from 'expo-linear-gradient';

import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';

import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';

import { buildSymptomRequest } from '@/lib/symptomRequest';

import { ka } from '@/i18n/ka';

import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';

import { saveSymptomSession } from '@/lib/symptomResultStorage';

import { useAuth } from '@/store/AuthContext';



import { updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';

export default function SymptomAnalyzingScreen() {
  const T = useFigmaSymptoms();

  const router = useRouter();

  const { user, applyUsage } = useAuth();

  const state = useSymptomChecker();
  const input = useRef(state).current;
  const alive = useRef(true);
  useFocusEffect(useCallback(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []));

  const started = useRef(false);

  const [step, setStep] = useState(0);

  const steps = [ka.symptoms.stepDatabase, ka.symptoms.stepLlm, ka.symptoms.stepCompile];

  useEffect(() => {

    const timers = [

      setTimeout(() => setStep(1), 1200),

      setTimeout(() => setStep(2), 2800),

    ];

    return () => timers.forEach(clearTimeout);

  }, []);

  useEffect(() => {

    if (started.current) return;

    started.current = true;
    const owner = user?.id;
    const current = () => alive.current && !!owner && owner === localAccountId();
    if (!owner || !input.symptoms.length) { router.replace('/symptoms/search' as never); return; }

    const snapshot = buildSymptomRequest(input);
    updateSymptomChecker({ lastError: null, result: null, recordId: null, interactionId: null });

    void (async () => {

      try {

        const res = await api.ai.symptomCheck(snapshot);
        if (!current()) return;
        applyUsage(res.usage);

        updateSymptomChecker({

          result: res.result,

          recordId: res.recordId,

          interactionId: res.interactionId,

        });

        await saveSymptomSession({

          recordId: res.recordId,

          createdAt: new Date().toISOString(),

          symptoms: input.symptoms,

          primarySymptom: input.primarySymptom,

          durationId: input.durationId,

          painLevel: input.painLevel,

          bodyPartKa: snapshot.bodyPartKa,

          organKa: snapshot.organKa,
          draft: { gender: input.gender, method: input.method, mode: input.mode, side: input.side,
            selectedPartId: input.selectedPartId, selectedOrganId: input.selectedOrganId,
            pastConditions: input.pastConditions, notes: input.notes, shareToNightingale: input.shareToNightingale },

          result: res.result,

        }, owner).catch(() => {
          if (current()) updateSymptomChecker({ lastError: 'შედეგი მზადაა, თუმცა ამ მოწყობილობაზე ისტორიის შენახვა ვერ მოხერხდა.' });
        });

        if (current()) router.replace('/symptoms/results?ready=1' as never);

      } catch (err) {
        if (!current()) return;
        if (err instanceof ApiError && err.isQuotaExceeded && err.usage) applyUsage(err.usage);
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : ka.common.error;
        updateSymptomChecker({ lastError: message });
        router.replace('/symptoms/analyzing-error' as never);
      }

    })();

  }, [router, input, applyUsage, user?.id]);

  return (

    <View style={{ flex: 1, backgroundColor: T.white, alignItems: 'center', justifyContent: 'center' }}>

      <LinearGradient

        colors={['rgba(20,184,166,0)', 'rgba(20,184,166,0.22)', 'rgba(20,184,166,0.45)']}

        style={{ position: 'absolute', left: -120, right: -120, bottom: -200, height: 420, borderRadius: 420 }}

        pointerEvents="none"

      />

      <View style={{ paddingHorizontal: 16, gap: 24, alignItems: 'center' }}>

        {steps.map((label, i) => (

          <AnalyzingLine key={label} label={label} active={i === step} done={i < step} />

        ))}

      </View>

      <View style={{ position: 'absolute', bottom: 48 }}>

        <MedicardLogoMark size={48} />

      </View>

    </View>

  );

}

function AnalyzingLine({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  const T = useFigmaSymptoms();

  const fade = useRef(new Animated.Value(active ? 1 : done ? 0.55 : 0.28)).current;

  useEffect(() => {

    Animated.timing(fade, {

      toValue: active ? 1 : done ? 0.55 : 0.28,

      duration: 400,

      easing: Easing.out(Easing.quad),

      useNativeDriver: true,

    }).start();

  }, [active, done, fade]);

  return (

    <Animated.Text

      style={{

        fontSize: 24,

        lineHeight: 32,

        fontWeight: '400',

        color: active ? T.textPrimary : T.textMuted,

        textAlign: 'center',

        letterSpacing: -0.25,

        opacity: fade,

      }}

    >

      {label}

    </Animated.Text>

  );

}
