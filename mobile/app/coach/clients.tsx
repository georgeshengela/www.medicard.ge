import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, CalendarClock, Check, ChevronRight, Flame, ScanLine, Search, Share2, Scale, UsersRound, X } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { coachLink, relativeStart, type RosterClient, type RosterInvite, type RosterRequest } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { Avatar, Button, Card, EmptyNote, Input, Loading, coachStyles } from '@/components/coach/CoachUI';
import { FadeIn, Ring, Segmented, StatusPill, haptic, scoreColor } from '@/components/coach/CoachKit';
import { hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

type Filter = 'all' | 'attention' | 'waiting';

/** Share of the finished days of the last week that were on plan (days without a log count as off). */
function weekScore(x: RosterClient): number | null {
  const days = (x.week ?? []).filter((d) => d.status !== 'PENDING'); // today is still open
  if (!days.length) return null;
  return Math.round((days.filter((d) => d.status === 'ON').length / days.length) * 100);
}

export default function CoachClientsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [clients, setClients] = useState<RosterClient[] | null>(null);
  const [requests, setRequests] = useState<RosterRequest[]>([]);
  const [invited, setInvited] = useState<RosterInvite[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const [r, me] = await Promise.all([api.coach.clients(), api.coach.me()]);
      if (localAccountId() !== owner) return;
      setClients(r.clients);
      setRequests(r.requests);
      setInvited(r.invited ?? []);
      setCode(me.trainerProfile?.code ?? null);
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const attention = useMemo(() => (clients ?? []).filter((x) => x.alerts.some((a) => a.tone === 'warn')), [clients]);
  const waiting = requests.length + invited.length;
  const shown = useMemo(() => {
    const base = filter === 'attention' ? attention : clients ?? [];
    const needle = q.trim().toLowerCase();
    return needle ? base.filter((x) => x.name.toLowerCase().includes(needle)) : base;
  }, [clients, attention, filter, q]);

  const invite = () => code && void Share.share({ message: tx(`ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${code}: ${coachLink(code)}`, `Workouts, meal plan and progress in one place — on MEDICARD. Join me with my code ${code}: ${coachLink(code)}`) });
  const answer = async (id: string, accept: boolean) => {
    try {
      await api.coach.answerRequest(id, accept);
      if (accept) haptic.success();
      await load();
    } catch (e) {
      Alert.alert(tx('ვერ მოხერხდა', 'Something went wrong'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    }
  };
  const decline = (id: string, name: string) =>
    Alert.alert(tx('მოთხოვნის უარყოფა', 'Decline request'), tx(`${name}-ის მოთხოვნა უარყოფილი იქნება.`, `${name}’s request will be declined.`), [
      { text: tx('არა', 'No'), style: 'cancel' },
      { text: tx('უარყოფა', 'Decline'), style: 'destructive', onPress: () => void answer(id, false) },
    ]);
  const cancelInvite = (id: string, name: string) =>
    Alert.alert(tx('მოწვევის გაუქმება', 'Cancel invite'), tx(`${name} მოწვევას ვეღარ მიიღებს.`, `${name} won’t be able to accept the invite.`), [
      { text: tx('არა', 'No'), style: 'cancel' },
      { text: tx('გაუქმება', 'Cancel invite'), style: 'destructive', onPress: () => void api.coach.cancelInvite(id).then(load).catch((e) => Alert.alert(tx('ვერ მოხერხდა', 'Something went wrong'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'))) },
    ]);

  return (
    <CoachShell
      title={tx('კლიენტები', 'Clients')}
      subtitle={clients ? tx(`${clients.length} აქტიური${waiting ? ` · ${waiting} ელოდება` : ''}`, `${clients.length} active${waiting ? ` · ${waiting} waiting` : ''}`) : undefined}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {code ? (
            <Pressable accessibilityRole="button" accessibilityLabel={tx('კოდის გაზიარება', 'Share code')} onPress={invite} style={[st.headBtn, { backgroundColor: c.surface }]}>
              <Share2 size={20} color={c.text100} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={tx('კლიენტის QR-ის სკანირება', 'Scan client QR')} onPress={() => router.push('/coach/scan' as never)} style={[st.headBtn, { backgroundColor: '#0D9488' }]}>
            <ScanLine size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      }
    >
      <CoachGate error={error} />
      {!clients && !error ? <Loading rows={4} /> : null}
      {clients ? (
        <>
          <Segmented
            style={{ marginTop: 16 }}
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: tx('ყველა', 'All'), count: clients.length || undefined },
              { key: 'attention', label: tx('ყურადღება', 'Attention'), count: attention.length || undefined },
              { key: 'waiting', label: tx('ელოდება', 'Waiting'), count: waiting || undefined },
            ]}
          />
          {filter !== 'waiting' && clients.length > 3 ? (
            <View style={{ marginTop: 12 }}>
              <Input value={q} onChangeText={setQ} placeholder={tx('სახელით ძებნა', 'Search by name')} returnKeyType="search" style={{ paddingLeft: 44 }} />
              <Search size={18} color={c.text300} style={{ position: 'absolute', left: 15, top: 16 }} />
            </View>
          ) : null}

          {filter === 'waiting' ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              {requests.map((r) => (
                <Card key={r.linkId} style={{ gap: 12 }}>
                  <View style={coachStyles.row}>
                    <Avatar avatarId={r.avatarId} photoUrl={r.avatarUrl} name={r.name} size={48} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{r.name}</Text>
                      <StatusPill label={tx('გთხოვს ტრენერობას', 'Wants you as trainer')} tone="brand" />
                    </View>
                  </View>
                  {r.note ? <Text style={[hubText.body, { color: c.text200 }]}>„{r.note}“</Text> : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    <Button label={tx('მიღება', 'Accept')} icon={Check} style={{ flex: 1, minHeight: 48 }} onPress={() => void answer(r.linkId, true)} />
                    <Button label={tx('უარი', 'Decline')} icon={X} kind="secondary" style={{ flex: 1, minHeight: 48 }} onPress={() => decline(r.linkId, r.name)} />
                  </View>
                </Card>
              ))}
              {invited.map((r) => (
                <Card key={r.linkId} style={[coachStyles.row, { paddingVertical: 14 }]}>
                  <Avatar avatarId={r.avatarId} photoUrl={r.avatarUrl} name={r.name} size={44} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[hubText.cardTitle, { color: c.text100 }]} numberOfLines={1}>{r.name}</Text>
                    <StatusPill label={tx('მოწვეულია · დასტურს ელოდება', 'Invited · awaiting reply')} tone="neutral" />
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx(`${r.name}-ის მოწვევის გაუქმება`, `Cancel invite for ${r.name}`)} onPress={() => cancelInvite(r.id, r.name)} hitSlop={8} style={[st.iconBtn, { backgroundColor: c.bg200 }]}>
                    <X size={18} color={c.text200} />
                  </Pressable>
                </Card>
              ))}
              {!waiting ? (
                <Card>
                  <EmptyNote icon={UsersRound} title={tx('მოლოდინში არავინაა', 'No one waiting')} body={tx('როცა კლიენტი მოგწერს ან შენს მოწვევას ჯერ არ უპასუხებს, აქ გამოჩნდება.', 'When a client sends a request, or hasn’t answered your invite yet, they’ll show up here.')} />
                </Card>
              ) : null}
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>
              {shown.map((x, i) => (
                <FadeIn key={x.id} delay={Math.min(i, 6) * 40}>
                  <ClientRow client={x} onPress={() => router.push(`/coach/client/${x.id}` as never)} />
                </FadeIn>
              ))}
              {!shown.length ? (
                clients.length ? (
                  <Card>
                    <EmptyNote icon={filter === 'attention' ? Check : Search} title={filter === 'attention' ? tx('ყურადღება არავის სჭირდება', 'No one needs attention') : tx('ვერ მოიძებნა', 'No results')} body={filter === 'attention' ? tx('ყველა კლიენტი გეგმაშია — კარგი ნამუშევარია.', 'All clients are on plan — great work.') : tx('სცადე სხვა სახელი.', 'Try another name.')} />
                  </Card>
                ) : (
                  <Card style={{ gap: 12 }}>
                    <EmptyNote icon={UsersRound} title={tx('კლიენტები ჯერ არ გყავს', 'No clients yet')} body={tx('დარბაზში დაასკანერე კლიენტის QR (მის აპში: პროფილი → ჩემი QR) — მოწვევა მაშინვე მიუვა. ან გაუზიარე შენი კოდი.', 'At the gym, scan the client’s QR (in their app: Profile → My QR) — they get the invite right away. Or share your code.')} />
                    <Button label={tx('კლიენტის QR-ის სკანირება', 'Scan client QR')} icon={ScanLine} onPress={() => router.push('/coach/scan' as never)} />
                    {code ? <Button label={tx(`კოდის გაზიარება · ${code}`, `Share code · ${code}`)} icon={Share2} kind="secondary" onPress={invite} /> : null}
                  </Card>
                )
              ) : null}
            </View>
          )}
        </>
      ) : null}
    </CoachShell>
  );
}

const ClientRow = React.memo(function ClientRow({ client: x, onPress }: { client: RosterClient; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const score = weekScore(x);
  const warn = x.alerts.find((a) => a.tone === 'warn');
  return (
    <Card onPress={onPress} style={{ gap: 12 }} accessibilityLabel={tx(`${x.name}${score != null ? `, კვების დაცვა ${score}%` : ''}${warn ? ', სჭირდება ყურადღება' : ''}`, `${x.name}${score != null ? `, meal plan adherence ${score}%` : ''}${warn ? ', needs attention' : ''}`)}>
      <View style={coachStyles.row}>
        <Ring value={score == null ? null : score / 100} size={60} stroke={4} color={scoreColor(score, dark)}>
          <Avatar avatarId={x.avatarId} photoUrl={x.avatarUrl} name={x.name} size={46} />
        </Ring>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 16 }]}>{x.name}</Text>
          <View style={[coachStyles.row, { gap: 6 }]}>
            <CalendarClock size={13} color={x.nextSession ? c.primary200 : c.text300} />
            <Text numberOfLines={1} style={[hubText.caption, { color: x.nextSession ? c.text200 : c.text300 }]}>{x.nextSession ? relativeStart(x.nextSession) : tx('ვარჯიში არ არის დაგეგმილი', 'No workout scheduled')}</Text>
          </View>
        </View>
        {score != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.score, { color: scoreColor(score, dark) }]}>{score}%</Text>
            <Text style={[hubText.small, { color: c.text300 }]}>{tx('7 დღე', '7 days')}</Text>
          </View>
        ) : (
          <ChevronRight size={18} color={c.text300} />
        )}
      </View>
      {x.kcalToday || x.weight?.currentKg ? (
        <View style={[coachStyles.row, { gap: 8, flexWrap: 'wrap' }]}>
          {x.kcalToday ? (
            <View style={[st.chip, { backgroundColor: c.bg200 }]}>
              <Flame size={13} color={c.text200} />
              <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                {x.kcalToday.eaten}
                {x.kcalToday.target ? ` / ${x.kcalToday.target}` : ''} {tx('კკალ', 'kcal')}
              </Text>
            </View>
          ) : null}
          {x.weight?.currentKg ? (
            <View style={[st.chip, { backgroundColor: c.bg200 }]}>
              <Scale size={13} color={c.text200} />
              <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                {x.weight.currentKg}
                {x.weight.goalKg ? ` → ${x.weight.goalKg}` : ''} {tx('კგ', 'kg')}
              </Text>
            </View>
          ) : null}
          {x.weight?.percent != null ? (
            <View style={{ flex: 1, minWidth: 90, gap: 4 }}>
              <Text style={[hubText.small, { color: c.text300 }]}>{tx('მიზანი', 'Goal')} {x.weight.percent}%</Text>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: c.bg200 }}>
                <View style={{ height: 6, borderRadius: 3, width: `${Math.max(3, Math.min(100, x.weight.percent))}%`, backgroundColor: '#14B8A6' }} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {warn ? (
        <View style={[coachStyles.row, { gap: 8, backgroundColor: c.warningBg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }]}>
          <AlertTriangle size={16} color={c.warning} />
          <Text style={[hubText.caption, { color: c.text100, flex: 1 }]}>{warn.text.replace(/^[^:]+:\s*/, '')}</Text>
        </View>
      ) : null}
    </Card>
  );
});

const st = StyleSheet.create({
  headBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  score: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 24 },
});
