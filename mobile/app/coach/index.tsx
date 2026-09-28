import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, CalendarPlus, ScanLine, Check, CheckCircle2, ChevronRight, Info, Sparkles, UserPlus, X } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { SESSION_STATUS_LABEL, clockOf, coachLink, type CoachToday } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { Avatar, Badge, Button, Card, ErrorBox, IconTile, Loading, Section, Stat, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const WEEKDAY_LONG = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const MONTH_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

export default function CoachTodayScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [data, setData] = useState<CoachToday | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const [d, me] = await Promise.all([api.coach.today(), api.coach.me()]);
      if (localAccountId() !== owner) return;
      setData(d);
      setCode(me.trainerProfile?.code ?? null);
      setError(null);
    } catch (e) {
      if (localAccountId() === owner) setError(e as Error);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const answer = async (linkId: string, accept: boolean) => {
    try {
      await api.coach.answerRequest(linkId, accept);
      await load();
    } catch (e) {
      Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    }
  };

  const invite = () => code && void Share.share({ message: `ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${code}: ${coachLink(code)}` });

  const now = new Date();
  const t = new Date(now.getTime() + 4 * 3600000);
  const dateLine = `${WEEKDAY_LONG[t.getUTCDay()]}, ${t.getUTCDate()} ${MONTH_LONG[t.getUTCMonth()]}`;
  const live = data?.sessions.filter((s) => s.status !== 'CANCELLED') ?? [];
  const nextIdx = live.findIndex((s) => new Date(s.startsAt).getTime() + s.durationMin * 60000 > now.getTime());

  return (
    <CoachShell
      title={data ? `გამარჯობა, ${data.trainer.displayName.split(' ')[0]}` : 'დღეს'}
      subtitle={`${dateLine}${data ? ` · ${live.filter((s) => s.status === 'SCHEDULED').length} ვარჯიში` : ''}`}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="კლიენტის QR-ის სკანირება" onPress={() => router.push('/coach/scan' as never)} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <ScanLine size={21} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="ვარჯიშის დანიშვნა" onPress={() => router.push('/coach/session-new' as never)} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarPlus size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      }
    >
      <CoachGate error={error} />
      {!data && !error ? <Loading /> : null}
      {data ? (
        <>
          <Card style={{ marginTop: 16, flexDirection: 'row', gap: 6 }}>
            <Stat label="კლიენტი" value={String(data.stats.clients)} />
            <Stat label="ამ კვირაში" value={String(data.stats.weekSessions)} hint="ვარჯიში" />
            <Stat label="30 დღეში" value={String(data.stats.done30)} hint="ჩატარდა" />
            <Stat label="გამოცდენა" value={data.stats.done30 + data.stats.noShow30 ? `${Math.round((data.stats.noShow30 / (data.stats.done30 + data.stats.noShow30)) * 100)}%` : '—'} />
          </Card>

          {data.requests.length ? (
            <Section title={`ახალი მოთხოვნები · ${data.requests.length}`}>
              {data.requests.map((r) => (
                <Card key={r.linkId} style={{ gap: 10, marginBottom: 10 }}>
                  <View style={coachStyles.row}>
                    <Avatar avatarId={r.avatarId} photoUrl={r.avatarUrl} name={r.name} />
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{r.name}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>{[r.age ? `${r.age} წ.` : null, r.gender === 'FEMALE' ? 'ქალი' : r.gender === 'MALE' ? 'კაცი' : null].filter(Boolean).join(' · ') || 'ახალი კლიენტი'}</Text>
                    </View>
                  </View>
                  {r.note ? <Text style={[hubText.body, { color: c.text200 }]}>„{r.note}“</Text> : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    <Button label="მიღება" icon={Check} style={{ flex: 1, minHeight: 44 }} onPress={() => void answer(r.linkId, true)} />
                    <Button label="უარი" icon={X} kind="secondary" style={{ flex: 1, minHeight: 44 }} onPress={() => void answer(r.linkId, false)} />
                  </View>
                </Card>
              ))}
            </Section>
          ) : null}

          <Section title="დღის განრიგი" link="კალენდარი" onLink={() => router.replace('/coach/calendar' as never)}>
            {live.length ? (
              <Card style={{ paddingVertical: 6 }}>
                {live.map((s, i) => {
                  const past = new Date(s.startsAt).getTime() + s.durationMin * 60000 < now.getTime();
                  const isNext = i === nextIdx;
                  return (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${clockOf(s.startsAt)} ${s.clientName ?? 'თავისუფალი'}`}
                      onPress={() => router.push(`/coach/session/${s.id}` as never)}
                      style={[coachStyles.row, { paddingVertical: 12, borderBottomWidth: i < live.length - 1 ? 0.5 : 0, borderColor: c.bg300, opacity: past && s.status === 'SCHEDULED' ? 0.75 : 1 }]}
                    >
                      <View style={{ width: 52 }}>
                        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, color: isNext ? c.primary100 : c.text100 }}>{clockOf(s.startsAt)}</Text>
                        <Text style={[hubText.small, { color: c.text300 }]}>{s.durationMin} წთ</Text>
                      </View>
                      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: isNext ? '#14B8A6' : c.bg300 }} />
                      {s.clientId ? <Avatar avatarId={s.clientAvatarId} photoUrl={s.clientAvatarUrl} name={s.clientName ?? '?'} size={36} /> : null}
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{s.clientName ?? 'თავისუფალი სლოტი'}</Text>
                        <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>
                          {s.kindLabel}
                          {s.gym ? ` · ${s.gym.brand}` : ''}
                        </Text>
                      </View>
                      {s.status === 'SCHEDULED' ? (
                        past ? <Badge label="ჩასაწერი" tone="warn" /> : s.clientConfirmedAt ? <CheckCircle2 size={20} color={c.success} /> : <Badge label="ელოდება" />
                      ) : (
                        <Badge label={SESSION_STATUS_LABEL[s.status]} tone={s.status === 'DONE' ? 'ok' : s.status === 'OPEN' ? 'brand' : 'bad'} />
                      )}
                    </Pressable>
                  );
                })}
              </Card>
            ) : (
              <Card style={{ gap: 10 }}>
                <Text style={[hubText.body, { color: c.text200 }]}>დღეს ვარჯიში არ გაქვს.</Text>
                <Button label="ვარჯიშის დანიშვნა" icon={CalendarPlus} onPress={() => router.push('/coach/session-new' as never)} />
              </Card>
            )}
          </Section>

          <Section title="ყურადღება" link={data.alerts.length ? 'კლიენტები' : undefined} onLink={() => router.replace('/coach/clients' as never)}>
            {data.alerts.length ? (
              <Card style={{ paddingVertical: 6 }}>
                {data.alerts.slice(0, 8).map((a, i) => (
                  <Pressable
                    key={`${a.clientId}${a.kind}`}
                    accessibilityRole="button"
                    onPress={() => a.clientId && router.push(`/coach/client/${a.clientId}` as never)}
                    style={[coachStyles.row, { paddingVertical: 11, borderBottomWidth: i < Math.min(8, data.alerts.length) - 1 ? 0.5 : 0, borderColor: c.bg300 }]}
                  >
                    {a.tone === 'warn' ? <AlertTriangle size={18} color={c.warning} /> : a.tone === 'good' ? <Sparkles size={18} color={c.success} /> : <Info size={18} color={c.text300} />}
                    <Text style={[hubText.body, { color: c.text100, flex: 1 }]}>{a.text}</Text>
                    <ChevronRight size={16} color={c.text300} />
                  </Pressable>
                ))}
              </Card>
            ) : (
              <Card>
                <Text style={[hubText.body, { color: c.text200 }]}>
                  {data.stats.clients ? 'ყველაფერი რიგზეა — ახალი სიგნალი არ არის.' : 'როცა კლიენტები შემოგიერთდებიან, აქ დაინახავ, ვინ გადაუხვია კვებას, ვინ არ აწონილა ან ვინ გამოტოვა ვარჯიში.'}
                </Text>
              </Card>
            )}
          </Section>

          {!data.stats.clients && code ? (
            <Section title="პირველი კლიენტი">
              <Card style={{ gap: 12 }}>
                <View style={coachStyles.row}>
                  <IconTile icon={UserPlus} ink="teal" />
                  <View style={{ flex: 1 }}>
                    <Text style={[hubText.cardTitle, { color: c.text100 }]}>შენი კოდი: {code}</Text>
                    <Text style={[hubText.caption, { color: c.text300 }]}>ან დაასკანერე კლიენტის QR — მოწვევა მაშინვე მიუვა და თანხმობას თავად მოგცემს.</Text>
                  </View>
                </View>
                <Button label="კლიენტის QR-ის სკანირება" icon={ScanLine} onPress={() => router.push('/coach/scan' as never)} />
                <Button label="კოდის გაზიარება" kind="secondary" onPress={invite} />
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </CoachShell>
  );
}
