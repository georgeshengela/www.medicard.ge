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

  const invite = () => code && void Share.share({ message: `ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${code}: ${coachLink(code)}` });
  const answer = async (id: string, accept: boolean) => {
    try {
      await api.coach.answerRequest(id, accept);
      if (accept) haptic.success();
      await load();
    } catch (e) {
      Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    }
  };
  const decline = (id: string, name: string) =>
    Alert.alert('მოთხოვნის უარყოფა', `${name}-ს მოთხოვნა უარყოფილი იქნება.`, [
      { text: 'არა', style: 'cancel' },
      { text: 'უარყოფა', style: 'destructive', onPress: () => void answer(id, false) },
    ]);
  const cancelInvite = (id: string, name: string) =>
    Alert.alert('მოწვევის გაუქმება', `${name} მოწვევას ვეღარ მიიღებს.`, [
      { text: 'არა', style: 'cancel' },
      { text: 'გაუქმება', style: 'destructive', onPress: () => void api.coach.cancelInvite(id).then(load).catch((e) => Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.')) },
    ]);

  return (
    <CoachShell
      title="კლიენტები"
      subtitle={clients ? `${clients.length} აქტიური${waiting ? ` · ${waiting} ელოდება` : ''}` : undefined}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {code ? (
            <Pressable accessibilityRole="button" accessibilityLabel="კოდის გაზიარება" onPress={invite} style={[st.headBtn, { backgroundColor: c.surface }]}>
              <Share2 size={20} color={c.text100} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="კლიენტის QR-ის სკანირება" onPress={() => router.push('/coach/scan' as never)} style={[st.headBtn, { backgroundColor: '#0D9488' }]}>
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
              { key: 'all', label: 'ყველა', count: clients.length || undefined },
              { key: 'attention', label: 'ყურადღება', count: attention.length || undefined },
              { key: 'waiting', label: 'ელოდება', count: waiting || undefined },
            ]}
          />
          {filter !== 'waiting' && clients.length > 3 ? (
            <View style={{ marginTop: 12 }}>
              <Input value={q} onChangeText={setQ} placeholder="სახელით ძებნა" returnKeyType="search" style={{ paddingLeft: 44 }} />
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
                      <StatusPill label="გთხოვს ტრენერობას" tone="brand" />
                    </View>
                  </View>
                  {r.note ? <Text style={[hubText.body, { color: c.text200 }]}>„{r.note}“</Text> : null}
                  <View style={[coachStyles.row, { gap: 10 }]}>
                    <Button label="მიღება" icon={Check} style={{ flex: 1, minHeight: 48 }} onPress={() => void answer(r.linkId, true)} />
                    <Button label="უარი" icon={X} kind="secondary" style={{ flex: 1, minHeight: 48 }} onPress={() => decline(r.linkId, r.name)} />
                  </View>
                </Card>
              ))}
              {invited.map((r) => (
                <Card key={r.linkId} style={[coachStyles.row, { paddingVertical: 14 }]}>
                  <Avatar avatarId={r.avatarId} photoUrl={r.avatarUrl} name={r.name} size={44} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[hubText.cardTitle, { color: c.text100 }]} numberOfLines={1}>{r.name}</Text>
                    <StatusPill label="მოწვეულია · დასტურს ელოდება" tone="neutral" />
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${r.name}-ის მოწვევის გაუქმება`} onPress={() => cancelInvite(r.id, r.name)} hitSlop={8} style={[st.iconBtn, { backgroundColor: c.bg200 }]}>
                    <X size={18} color={c.text200} />
                  </Pressable>
                </Card>
              ))}
              {!waiting ? (
                <Card>
                  <EmptyNote icon={UsersRound} title="მოლოდინში არავინაა" body="როცა კლიენტი მოგწერს ან შენს მოწვევას ჯერ არ უპასუხებს, აქ გამოჩნდება." />
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
                    <EmptyNote icon={filter === 'attention' ? Check : Search} title={filter === 'attention' ? 'ყურადღება არავის სჭირდება' : 'ვერ მოიძებნა'} body={filter === 'attention' ? 'ყველა კლიენტი გეგმაშია — კარგი ნამუშევარია.' : 'სცადე სხვა სახელი.'} />
                  </Card>
                ) : (
                  <Card style={{ gap: 12 }}>
                    <EmptyNote icon={UsersRound} title="კლიენტები ჯერ არ გყავს" body="დარბაზში დაასკანერე კლიენტის QR (მის აპში: პროფილი → ჩემი QR) — მოწვევა მაშინვე მიუვა. ან გაუზიარე შენი კოდი." />
                    <Button label="კლიენტის QR-ის სკანირება" icon={ScanLine} onPress={() => router.push('/coach/scan' as never)} />
                    {code ? <Button label={`კოდის გაზიარება · ${code}`} icon={Share2} kind="secondary" onPress={invite} /> : null}
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
    <Card onPress={onPress} style={{ gap: 12 }} accessibilityLabel={`${x.name}${score != null ? `, კვების დაცვა ${score}%` : ''}${warn ? ', სჭირდება ყურადღება' : ''}`}>
      <View style={coachStyles.row}>
        <Ring value={score == null ? null : score / 100} size={60} stroke={4} color={scoreColor(score, dark)}>
          <Avatar avatarId={x.avatarId} photoUrl={x.avatarUrl} name={x.name} size={46} />
        </Ring>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 16 }]}>{x.name}</Text>
          <View style={[coachStyles.row, { gap: 6 }]}>
            <CalendarClock size={13} color={x.nextSession ? c.primary200 : c.text300} />
            <Text numberOfLines={1} style={[hubText.caption, { color: x.nextSession ? c.text200 : c.text300 }]}>{x.nextSession ? relativeStart(x.nextSession) : 'ვარჯიში არ არის დაგეგმილი'}</Text>
          </View>
        </View>
        {score != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[st.score, { color: scoreColor(score, dark) }]}>{score}%</Text>
            <Text style={[hubText.small, { color: c.text300 }]}>7 დღე</Text>
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
                {x.kcalToday.target ? ` / ${x.kcalToday.target}` : ''} კკალ
              </Text>
            </View>
          ) : null}
          {x.weight?.currentKg ? (
            <View style={[st.chip, { backgroundColor: c.bg200 }]}>
              <Scale size={13} color={c.text200} />
              <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
                {x.weight.currentKg}
                {x.weight.goalKg ? ` → ${x.weight.goalKg}` : ''} კგ
              </Text>
            </View>
          ) : null}
          {x.weight?.percent != null ? (
            <View style={{ flex: 1, minWidth: 90, gap: 4 }}>
              <Text style={[hubText.small, { color: c.text300 }]}>მიზანი {x.weight.percent}%</Text>
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
