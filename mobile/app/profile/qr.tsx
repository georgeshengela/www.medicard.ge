import { brandHex } from '@/theme/brandTone';
import React, { useCallback, useState } from 'react';
import { Alert, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { RefreshCcw, ShieldCheck } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { useMyAvatarUrl } from '@/lib/myAvatar';
import { useAuth } from '@/store/AuthContext';
import { Avatar, Button, Card, CoachHeader, ErrorBox, Loading, Screen, coachStyles } from '@/components/coach/CoachUI';
import { StyledQr } from '@/components/coach/StyledQr';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

/** The person's own QR: a trainer scans it in MEDICARD and invites them; nothing is shared without consent. */
export default function MyQrScreen() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const { user, healthProfile } = useAuth();
  const photo = useMyAvatarUrl();
  const params = useLocalSearchParams<{ note?: string }>();
  const [qr, setQr] = useState<{ token: string; link: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatarId = (healthProfile?.extraAnswers as { avatarId?: string } | undefined)?.avatarId ?? null;

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const r = await api.identity.qr();
      if (localAccountId() === owner) setQr(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tx('QR ვერ ჩაიტვირთა.', "Couldn't load the QR code."));
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const rotate = () =>
    Alert.alert(tx('ახალი QR კოდი', 'New QR code'), tx('ძველი კოდი (მაგ. სქრინშოტი) მაშინვე აღარ იმუშავებს. არსებულ ტრენერთან კავშირი არ იცვლება.', 'The old code (for example, a screenshot) stops working right away. Your link with your current trainer stays the same.'), [
      { text: tx('გაუქმება', 'Cancel'), style: 'cancel' },
      {
        text: tx('განახლება', 'Renew'),
        onPress: async () => {
          setBusy(true);
          try {
            setQr(await api.identity.rotateQr());
          } catch (e) {
            Alert.alert(tx('ვერ განახლდა', "Couldn't renew"), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);

  const cardW = Math.min(width - HUB.gutter * 2, 420);
  const qrSize = Math.round(cardW - 72);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title={tx('ჩემი QR', 'My QR')} subtitle={tx('ტრენერი დაასკანერებს MEDICARD-ში', 'Your trainer scans it in MEDICARD')} />
      <Screen>
        {error ? <ErrorBox message={error} onRetry={load} /> : null}
        {!qr && !error ? <Loading /> : null}
        {qr ? (
          <>
            {params.note ? (
              <Card style={{ marginTop: 8, backgroundColor: c.warningBg }}>
                <Text style={[hubText.body, { color: c.text100 }]}>{params.note}</Text>
              </Card>
            ) : null}
            <View style={{ alignSelf: 'center', width: cardW, marginTop: 12, borderRadius: 30, overflow: 'hidden' }}>
              <Svg width={cardW} height={cardW + 150} style={{ position: 'absolute' }}>
                <Defs>
                  <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={brandHex('#0F766E')} />
                    <Stop offset="0.55" stopColor="#102C35" />
                    <Stop offset="1" stopColor="#030712" />
                  </LinearGradient>
                </Defs>
                <Rect x={0} y={0} width={cardW} height={cardW + 150} fill="url(#bg)" />
              </Svg>
              <View style={{ alignItems: 'center', paddingTop: 22, paddingBottom: 24, gap: 14 }}>
                <View style={[coachStyles.row, { gap: 10 }]}>
                  <View style={{ borderRadius: 30, borderWidth: 3, borderColor: brandHex('#99F6E4') }}>
                    <Avatar avatarId={avatarId} photoUrl={photo} name={user?.fullName ?? '?'} size={50} />
                  </View>
                  <View>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: '#FFFFFF' }}>{user?.fullName}</Text>
                    <Text style={[hubText.caption, { color: brandHex('#99F6E4') }]}>{tx('MEDICARD პროფილი', 'MEDICARD profile')}</Text>
                  </View>
                </View>
                <View style={{ padding: 12, backgroundColor: '#FFFFFF', borderRadius: 26 }}>
                  <StyledQr value={qr.link} size={qrSize - 24} />
                </View>
                <Text style={[hubText.body, { color: '#C5DADA', textAlign: 'center', paddingHorizontal: 24 }]}>{tx('აჩვენე ტრენერს — ის დაასკანერებს MEDICARD-ში და მოგიწვევს. რას გაუზიარებ, შენ ირჩევ.', 'Show it to your trainer — they scan it in MEDICARD and invite you. You choose what to share.')}</Text>
              </View>
            </View>
            <Card style={{ marginTop: 16, gap: 8 }}>
              <View style={coachStyles.row}>
                <ShieldCheck size={18} color={c.primary100} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  {tx('კოდი ტრენერს აჩვენებს მხოლოდ სახელს, ფოტოს, ასაკს და სქესს. ჯანმრთელობის მონაცემი ჩანს მხოლოდ შენი თანხმობის შემდეგ. თუ კოდი სხვასთან მოხვდა, განაახლე.', 'The code shows a trainer only your name, photo, age and sex. Health data is visible only after you agree. If someone else got the code, renew it.')}
                </Text>
              </View>
            </Card>
            <Button label={tx('კოდის განახლება', 'Renew code')} icon={RefreshCcw} kind="secondary" busy={busy} onPress={rotate} style={{ marginTop: 12 }} />
          </>
        ) : null}
      </Screen>
    </View>
  );
}
