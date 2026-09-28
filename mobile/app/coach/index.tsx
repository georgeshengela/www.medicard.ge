import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Info,
  MapPin,
  ScanLine,
  Share2,
  Sparkles,
  Target,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { SESSION_STATUS_LABEL, clockOf, coachLink, type CoachSession, type CoachToday } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { Avatar, Button, Card, IconTile, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { FadeIn, KpiTile, QuickAction, Ring, StatusPill, haptic, sessionTiming } from '@/components/coach/CoachKit';
import { hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

const WEEKDAY_LONG = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
const MONTH_LONG = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];

/** Re-render every 30 s so countdowns and the "now" line stay true while the screen is open. */
function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export default function CoachTodayScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const now = useNow();
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
      if (accept) haptic.success();
      await load();
    } catch (e) {
      Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    }
  };
  const confirmDecline = (linkId: string, name: string) =>
    Alert.alert('მოთხოვნის უარყოფა', `${name}-ს მოთხოვნა უარყოფილი იქნება.`, [
      { text: 'არა', style: 'cancel' },
      { text: 'უარყოფა', style: 'destructive', onPress: () => void answer(linkId, false) },
    ]);

  const invite = () => code && void Share.share({ message: `ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${code}: ${coachLink(code)}` });

  const t = new Date(now + 4 * 3600000);
  const dateLine = `${WEEKDAY_LONG[t.getUTCDay()]}, ${t.getUTCDate()} ${MONTH_LONG[t.getUTCMonth()]}`;
  const live = (data?.sessions ?? []).filter((s) => s.status !== 'CANCELLED').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const booked = live.filter((s) => s.clientId);
  const doneToday = booked.filter((s) => s.status === 'DONE').length;
  const toLog = booked.filter((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() + s.durationMin * 60000 < now);
  const next = booked.find((s) => s.status === 'SCHEDULED' && new Date(s.startsAt).getTime() + s.durationMin * 60000 > now) ?? null;
  const attended = data ? data.stats.done30 + data.stats.noShow30 : 0;

  return (
    <CoachShell
      title={data ? `გამარჯობა, ${data.trainer.displayName.split(' ')[0]}` : 'დღეს'}
      subtitle={dateLine}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <CoachGate error={error} />
      {!data && !error ? <Loading rows={3} /> : null}
      {data ? (
        <>
          <FadeIn>
            <NextUp session={next} now={now} toLog={toLog.length} onOpen={(id) => router.push(`/coach/session/${id}` as never)} onBook={() => router.push('/coach/session-new' as never)} />
          </FadeIn>

          <FadeIn delay={60} style={{ flexDirection: 'row', marginTop: 20 }}>
            <QuickAction icon={CalendarPlus} label="დანიშვნა" primary onPress={() => router.push('/coach/session-new' as never)} />
            <QuickAction icon={ScanLine} label="QR სკანი" onPress={() => router.push('/coach/scan' as never)} />
            <QuickAction icon={UsersRound} label="კლიენტები" badge={data.requests.length} onPress={() => router.replace('/coach/clients' as never)} />
            <QuickAction icon={Share2} label="მოწვევა" onPress={invite} />
          </FadeIn>

          {data.requests.length ? (
            <Section title={`ახალი მოთხოვნები · ${data.requests.length}`}>
              {data.requests.map((r) => (
                <Card key={r.linkId} style={{ gap: 12, marginBottom: 10 }}>
                  <View style={coachStyles.row}>
                    <Avatar avatarId={r.avatarId} photoUrl={r.avatarUrl} name={r.name} size={48} />
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{r.name}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>{[r.age ? `${r.age} წ.` : null, r.gender === 'FEMALE' ? 'ქალი' : r.gender === 'MALE' ? 'კაცი' : null].filter(Boolean).join(' · ') || 'ახალი კლიენტი'}</Text>
                    </View>
                  </View>
                  {r.note ? (
                    <View style={{ backgroundColor: c.bg200, borderRadius: 14, padding: 12 }}>
                      <Text style={[hubText.body, { color: c.text200 }]}>„{r.note}“</Text>
                    </View>
                  ) : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    <Button label="მიღება" icon={Check} style={{ flex: 1, minHeight: 48 }} onPress={() => void answer(r.linkId, true)} />
                    <Button label="უარი" icon={X} kind="secondary" style={{ flex: 1, minHeight: 48 }} onPress={() => confirmDecline(r.linkId, r.name)} />
                  </View>
                </Card>
              ))}
            </Section>
          ) : null}

          <Section title="დღის განრიგი" link="კალენდარი" onLink={() => router.replace('/coach/calendar' as never)}>
            {live.length ? (
              <Card style={{ paddingVertical: 8 }}>
                <View style={[coachStyles.row, { paddingVertical: 8 }]}>
                  <Ring value={booked.length ? doneToday / booked.length : 0} size={44} stroke={5}>
                    <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_700Bold' }]}>
                      {doneToday}/{booked.length}
                    </Text>
                  </Ring>
                  <View style={{ flex: 1 }}>
                    <Text style={[hubText.cardTitle, { color: c.text100 }]}>{booked.length ? `${booked.length} ვარჯიში დღეს` : 'დღეს მხოლოდ თავისუფალი სლოტებია'}</Text>
                    <Text style={[hubText.caption, { color: toLog.length ? c.warning : c.text300 }]}>
                      {toLog.length ? `${toLog.length} ჩასაწერია — მონიშნე, ჩატარდა თუ არა` : doneToday ? `${doneToday} უკვე ჩატარდა` : 'ყველაფერი წინ არის'}
                    </Text>
                  </View>
                </View>
                <Timeline sessions={live} now={now} onOpen={(id) => router.push(`/coach/session/${id}` as never)} />
              </Card>
            ) : (
              <Card style={{ gap: 12, alignItems: 'center', paddingVertical: 26 }}>
                <IconTile icon={CalendarDays} ink="teal" size={52} />
                <Text style={[hubText.cardTitle, { color: c.text100 }]}>დღეს ვარჯიში არ გაქვს</Text>
                <Text style={[hubText.body, { color: c.text300, textAlign: 'center' }]}>დანიშნე კლიენტთან ან გახსენი თავისუფალი სლოტი — კლიენტი თავად დაჯავშნის.</Text>
                <Button label="ვარჯიშის დანიშვნა" icon={CalendarPlus} style={{ alignSelf: 'stretch' }} onPress={() => router.push('/coach/session-new' as never)} />
              </Card>
            )}
          </Section>

          <Section title="შენი რიცხვები">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <KpiTile icon={UsersRound} ink="teal" value={String(data.stats.clients)} label="აქტიური კლიენტი" onPress={() => router.replace('/coach/clients' as never)} />
              <KpiTile icon={CalendarDays} ink="blue" value={String(data.stats.weekSessions)} label="ვარჯიში ამ კვირაში" onPress={() => router.replace('/coach/calendar' as never)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <KpiTile icon={CheckCircle2} ink="green" value={String(data.stats.done30)} label="ჩატარდა" hint="ბოლო 30 დღე" />
              <KpiTile icon={Target} ink="amber" value={attended ? `${Math.round((data.stats.done30 / attended) * 100)}%` : '—'} label="დასწრება" hint={attended ? `${data.stats.noShow30} გამოცდენა` : 'ჯერ მონაცემი არ არის'} />
            </View>
          </Section>

          <Section title="ყურადღება" link={data.alerts.length ? 'ყველა კლიენტი' : undefined} onLink={() => router.replace('/coach/clients' as never)}>
            {data.alerts.length ? (
              <Card style={{ paddingVertical: 6 }}>
                {data.alerts.slice(0, 8).map((a, i) => (
                  <Pressable
                    key={`${a.clientId}${a.kind}`}
                    accessibilityRole="button"
                    onPress={() => a.clientId && router.push(`/coach/client/${a.clientId}` as never)}
                    className="active:opacity-70"
                    style={[coachStyles.row, { paddingVertical: 12, minHeight: 48, borderBottomWidth: i < Math.min(8, data.alerts.length) - 1 ? StyleSheet.hairlineWidth : 0, borderColor: c.bg300 }]}
                  >
                    <IconTile icon={a.tone === 'warn' ? AlertTriangle : a.tone === 'good' ? Sparkles : Info} ink={a.tone === 'warn' ? 'amber' : a.tone === 'good' ? 'green' : 'neutral'} size={34} />
                    <Text style={[hubText.body, { color: c.text100, flex: 1 }]}>{a.text}</Text>
                    <ChevronRight size={16} color={c.text300} />
                  </Pressable>
                ))}
              </Card>
            ) : (
              <Card style={[coachStyles.row, { gap: 12 }]}>
                <IconTile icon={Sparkles} ink="green" size={38} />
                <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>
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
                <Button label="კოდის გაზიარება" icon={Share2} kind="secondary" onPress={invite} />
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}
    </CoachShell>
  );
}

/** The one thing that matters right now: the next booked workout, with a live countdown. */
function NextUp({ session, now, toLog, onOpen, onBook }: { session: CoachSession | null; now: number; toLog: number; onOpen: (id: string) => void; onBook: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  if (!session) {
    return (
      <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }} onPress={onBook} accessibilityLabel="ვარჯიშის დანიშვნა">
        <IconTile icon={Clock3} ink="teal" size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[hubText.cardTitle, { color: c.text100 }]}>{toLog ? 'დღის ვარჯიშები დასრულდა' : 'დღეს მეტი ვარჯიში არ გაქვს'}</Text>
          <Text style={[hubText.caption, { color: c.text300 }]}>{toLog ? `ჩაწერე შედეგები — ${toLog} ვარჯიში ელოდება` : 'დანიშნე შემდეგი ვარჯიში'}</Text>
        </View>
        <ChevronRight size={18} color={c.text300} />
      </Card>
    );
  }
  const timing = sessionTiming(session.startsAt, session.durationMin, now);
  const liveNow = timing.phase === 'live';
  const progress = liveNow ? (now - new Date(session.startsAt).getTime()) / (session.durationMin * 60000) : 0;
  return (
    <Card style={{ marginTop: 16, gap: 14 }} onPress={() => onOpen(session.id)} accessibilityLabel={`შემდეგი ვარჯიში ${clockOf(session.startsAt)}, ${session.clientName ?? ''}`}>
      <View style={coachStyles.rowBetween}>
        <StatusPill label={liveNow ? 'ახლა მიმდინარეობს' : 'შემდეგი ვარჯიში'} tone={liveNow ? 'live' : 'brand'} />
        <Text style={[hubText.caption, { color: liveNow ? c.success : c.text300, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{timing.text}</Text>
      </View>
      <View style={[coachStyles.row, { gap: 14 }]}>
        <View>
          <Text style={[st.bigTime, { color: c.text100 }]}>{clockOf(session.startsAt)}</Text>
          <Text style={[hubText.caption, { color: c.text300 }]}>{session.durationMin} წუთი</Text>
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: c.bg300 }} />
        <Avatar avatarId={session.clientAvatarId} photoUrl={session.clientAvatarUrl} name={session.clientName ?? '?'} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 16 }]}>{session.clientName}</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{session.kindLabel}</Text>
        </View>
      </View>
      {liveNow ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.bg200, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(Math.min(1, progress) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: dark ? '#34D399' : '#059669' }} />
        </View>
      ) : null}
      <View style={[coachStyles.row, { gap: 8, flexWrap: 'wrap' }]}>
        {session.gym ? (
          <View style={[st.meta, { backgroundColor: c.bg200 }]}>
            <MapPin size={13} color={c.text200} />
            <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{session.gym.brand} · {session.gym.name}</Text>
          </View>
        ) : null}
        <View style={[st.meta, { backgroundColor: session.clientConfirmedAt ? c.successBg : c.bg200 }]}>
          {session.clientConfirmedAt ? <CheckCircle2 size={13} color={c.success} /> : <Clock3 size={13} color={c.text200} />}
          <Text style={[hubText.small, { color: session.clientConfirmedAt ? c.success : c.text200 }]}>{session.clientConfirmedAt ? 'კლიენტმა დაადასტურა' : 'დასტურს ელოდება'}</Text>
        </View>
      </View>
    </Card>
  );
}

/** Vertical day timeline with a "now" marker between the past and the upcoming sessions. */
function Timeline({ sessions, now, onOpen }: { sessions: CoachSession[]; now: number; onOpen: (id: string) => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const nowIdx = sessions.findIndex((s) => new Date(s.startsAt).getTime() > now);
  const rows: React.ReactNode[] = [];
  sessions.forEach((s, i) => {
    if (i === nowIdx) rows.push(<NowLine key="now" now={now} />);
    const start = new Date(s.startsAt).getTime();
    const past = start + s.durationMin * 60000 < now;
    const running = start <= now && now < start + s.durationMin * 60000;
    const pending = past && s.status === 'SCHEDULED' && s.clientId;
    const dot = running ? (dark ? '#34D399' : '#059669') : s.status === 'DONE' ? c.success : pending ? c.warning : s.status === 'NO_SHOW' ? c.danger : past ? c.bg300 : '#14B8A6';
    rows.push(
      <Pressable
        key={s.id}
        accessibilityRole="button"
        accessibilityLabel={`${clockOf(s.startsAt)} ${s.clientName ?? 'თავისუფალი სლოტი'}`}
        onPress={() => onOpen(s.id)}
        className="active:opacity-70"
        style={[coachStyles.row, { minHeight: 60, paddingVertical: 6 }]}
      >
        <Text style={[st.time, { color: past && !running ? c.text300 : c.text100 }]}>{clockOf(s.startsAt)}</Text>
        <View style={{ alignItems: 'center', alignSelf: 'stretch', width: 14 }}>
          <View style={{ flex: 1, width: 2, backgroundColor: i ? c.bg200 : 'transparent' }} />
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot, borderWidth: running ? 3 : 0, borderColor: dark ? '#064E3B' : '#D1FAE5' }} />
          <View style={{ flex: 1, width: 2, backgroundColor: i < sessions.length - 1 ? c.bg200 : 'transparent' }} />
        </View>
        {s.clientId ? <Avatar avatarId={s.clientAvatarId} photoUrl={s.clientAvatarUrl} name={s.clientName ?? '?'} size={36} /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: past && !running ? c.text200 : c.text100 }]}>{s.clientName ?? 'თავისუფალი სლოტი'}</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>
            {s.durationMin} წთ · {s.kindLabel}
            {s.gym ? ` · ${s.gym.brand}` : ''}
          </Text>
        </View>
        {pending ? (
          <StatusPill label="ჩასაწერი" tone="warn" />
        ) : s.status === 'SCHEDULED' ? (
          s.clientConfirmedAt ? <CheckCircle2 size={20} color={c.success} /> : null
        ) : (
          <StatusPill label={SESSION_STATUS_LABEL[s.status]} tone={s.status === 'DONE' ? 'ok' : s.status === 'OPEN' ? 'brand' : 'bad'} />
        )}
      </Pressable>,
    );
  });
  if (nowIdx === -1 && sessions.length) rows.push(<NowLine key="now" now={now} />);
  return <View>{rows}</View>;
}

function NowLine({ now }: { now: number }) {
  const t = new Date(now + 4 * 3600000);
  const label = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
  return (
    <View accessibilityLabel={`ახლა ${label}`} style={[coachStyles.row, { gap: 8, marginVertical: 2 }]}>
      <View style={{ backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
        <Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11 }}>{label}</Text>
      </View>
      <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: '#EF4444' }} />
    </View>
  );
}

const st = StyleSheet.create({
  bigTime: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.5 },
  time: { width: 46, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '100%' },
});
