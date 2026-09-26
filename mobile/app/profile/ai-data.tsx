import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ShieldCheck, ShieldOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiPrivacySummary } from '@/components/privacy/AiPrivacySummary';
import { ApiError, api } from '@/lib/api';
import type { AiConsentStatus } from '@/lib/aiSharingConsent';
import { deviceLanguageTag, disclosureCopy, isGeorgianLocale } from '@/lib/aiDisclosureCopy';
import { formatRelative } from '@/lib/format';
import { useThemeColors } from '@/theme/colors';

/** Profile → Privacy & Data → AI data processing. Revoking stops later provider calls. */
export default function AiDataProcessingScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<AiConsentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const english = !isGeorgianLocale(deviceLanguageTag());

  const load = useCallback(() => {
    setBusy(true);
    setError(null);
    void api.aiConsent
      .read()
      .then(setStatus)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : english ? 'Could not load' : 'ვერ ჩაიტვირთა'),
      )
      .finally(() => setBusy(false));
  }, [english]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = status ? disclosureCopy(status.manifest) : null;
  const enabled = status?.accepted === true;

  const save = (decision: 'accepted' | 'revoked') => {
    if (!status || busy) return;
    setBusy(true);
    setError(null);
    void api.aiConsent
      .save(decision, status.version)
      .then(setStatus)
      .catch(async (err: unknown) => {
        // The disclosure changed underneath us: reload the new text and let the person decide again.
        if (err instanceof ApiError && err.status === 409) {
          const next = await api.aiConsent.read().catch(() => null);
          if (next) setStatus(next);
          setError(err.message);
          return;
        }
        if (err instanceof ApiError && err.fields?.length) {
          setError(
            english
              ? 'The consent request was rejected by the server. Update the app and try again.'
              : 'თანხმობის მოთხოვნა სერვერმა არ მიიღო. განაახლე აპი და სცადე ხელახლა.',
          );
          return;
        }
        setError(err instanceof ApiError ? err.message : english ? 'Could not save your choice' : 'არჩევანი ვერ შეინახა');
      })
      .finally(() => setBusy(false));
  };

  const statusTitle = enabled
    ? english ? 'AI processing is allowed' : 'AI დამუშავება ნებადართულია'
    : english ? 'AI processing is off' : 'AI დამუშავება გამორთულია';
  const statusBody = enabled
    ? copy?.introAccepted
    : status?.decision
      ? english
        ? 'Nothing is sent to third-party AI. Allow it below when you want Medi, analysis and voice features.'
        : 'გარე AI-ს არაფერი ეგზავნება. ნებართვა ქვემოთ ჩართე, როცა მედი, ანალიზი ან ხმოვანი ფუნქციები დაგჭირდება.'
      : copy?.intro;
  const updatedLine = status?.updatedAt
    ? english
      ? `Last changed ${new Date(status.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : `ბოლო ცვლილება: ${formatRelative(status.updatedAt)}`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 48 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={english ? 'Back' : 'უკან'}
          onPress={() => router.back()}
          style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft size={24} color={colors.text100} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, color: colors.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18 }}
        >
          {copy?.screenTitle ?? (english ? 'AI & Privacy' : 'AI და კონფიდენციალურობა')}
        </Text>
      </View>
      {status == null && busy ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary100} />
        </View>
      ) : status && copy ? (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
            <View
              accessibilityRole="summary"
              style={{
                padding: 16,
                borderRadius: 20,
                backgroundColor: enabled ? colors.accent100 : colors.surface,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              {enabled ? (
                <ShieldCheck size={24} color={colors.primary100} strokeWidth={2} />
              ) : (
                <ShieldOff size={24} color={colors.text200} strokeWidth={2} />
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    color: enabled ? colors.primary100 : colors.text100,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 16,
                    lineHeight: 22,
                  }}
                >
                  {statusTitle}
                </Text>
                {statusBody ? (
                  <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20 }}>
                    {statusBody}
                  </Text>
                ) : null}
                {updatedLine ? (
                  <Text style={{ color: colors.text300, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 }}>
                    {updatedLine}
                  </Text>
                ) : null}
              </View>
            </View>
            <AiPrivacySummary manifest={status.manifest} hideTitle />
          </ScrollView>
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 16),
              gap: 8,
              borderTopWidth: 1,
              borderColor: colors.bg300,
            }}
          >
            {error ? (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.danger, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19 }}
              >
                {error}
              </Text>
            ) : null}
            {enabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => save('revoked')}
                style={{
                  minHeight: 52,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy ? 0.65 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.text100} />
                ) : (
                  <Text style={{ color: colors.text100, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16 }}>{copy.revoke}</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                disabled={busy}
                onPress={() => save('accepted')}
                style={{
                  minHeight: 52,
                  borderRadius: 16,
                  backgroundColor: '#0F766E',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy ? 0.65 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16 }}>{copy.agree}</Text>
                )}
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <View style={{ padding: 24, gap: 12 }}>
          <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={load}
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.primary100, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
              {english ? 'Try again' : 'თავიდან ცდა'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
