import React, { useEffect, useRef, useState } from 'react';

import { Animated, Easing, Text, View } from 'react-native';

import { useRouter } from 'expo-router';

import { LinearGradient } from 'expo-linear-gradient';

import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';

import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';

import { bodyPartById, DURATION_OPTIONS, organById } from '@/constants/symptomCatalog';

import { ka } from '@/i18n/ka';

import { api, ApiError } from '@/lib/api';

import { saveSymptomSession } from '@/lib/symptomResultStorage';

import type { SymptomCheckPayload } from '@/types/symptoms';

import { updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';



export default function SymptomAnalyzingScreen() {

  const router = useRouter();

  const state = useSymptomChecker();

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



    const durationKa = DURATION_OPTIONS.find((d) => d.id === state.durationId)?.labelKa;

    const part = bodyPartById(state.selectedPartId);

    const organ = organById(state.selectedOrganId);

    const snapshot: SymptomCheckPayload = {

      symptoms: state.symptoms,

      method: state.method ?? 'manual',

      mode: state.mode === 'organ' ? 'organ' : state.method === 'anatomy' ? 'muscle' : 'search',

      bodyPartId: part?.id,

      bodyPartKa: part?.labelKa,

      organId: organ?.id,

      organKa: organ?.labelKa,

      durationKa,

      painLevel: state.painLevel ?? undefined,

      notes: [state.pastConditions.trim() && `${ka.symptoms.pastConditions}: ${state.pastConditions.trim()}`, state.notes.trim()]
        .filter(Boolean)
        .join('\n') || undefined,

    };



    void (async () => {

      try {

        const res = await api.ai.symptomCheck(snapshot);

        updateSymptomChecker({

          result: res.result,

          recordId: res.recordId,

          interactionId: res.interactionId,

        });

        await saveSymptomSession({

          recordId: res.recordId,

          createdAt: new Date().toISOString(),

          symptoms: state.symptoms,

          primarySymptom: state.primarySymptom,

          durationId: state.durationId,

          painLevel: state.painLevel,

          bodyPartKa: part?.labelKa,

          organKa: organ?.labelKa,

          result: res.result,

        });

        router.replace('/symptoms/results?ready=1' as never);

      } catch (err) {
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

  }, [router, state]);



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


