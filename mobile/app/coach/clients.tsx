import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, Check, ChevronRight, ScanLine, Search, Share2, X } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { coachLink, relativeStart, type RosterClient, type RosterInvite, type RosterRequest } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { Avatar, Button, Card, DayStrip, EmptyNote, Input, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

export default function CoachClientsScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const [clients, setClients] = useState<RosterClient[] | null>(null);
  const [requests, setRequests] = useState<RosterRequest[]>([]);
  const [invited, setInvited] = useState<RosterInvite[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [q, setQ] = useState('');
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

  const shown = useMemo(() => (clients ?? []).filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())), [clients, q]);
  const invite = () => code && void Share.share({ message: `ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${code}: ${coachLink(code)}` });
  const answer = async (id: string, accept: boolean) => {
    try {
      await api.coach.answerRequest(id, accept);
      await load();
    } catch (e) {
      Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    }
  };

  return (
    <CoachShell
      title="კლიენტები"
      subtitle={clients ? `${clients.length} აქტიური${requests.length ? ` · ${requests.length} მოთხოვნა` : ''}` : undefined}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {code ? (
            <Pressable accessibilityRole="button" accessibilityLabel="კოდის გაზიარება" onPress={invite} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Share2 size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="კლიენტის QR-ის სკანირება" onPress={() => router.push('/coach/scan' as never)} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#14B8A6', alignItems: 'center', justifyContent: 'center' }}>
            <ScanLine size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      }
    >
      <CoachGate error={error} />
      {!clients && !error ? <Loading /> : null}
      {requests.length ? (
        <Section title="მოთხოვნები">
          {requests.map((r) => (
            <Card key={r.linkId} style={{ marginBottom: 10, gap: 10 }}>
              <View style={coachStyles.row}>
                <Avatar avatarId={r.avatarId} photoUrl={r.avatarUrl} name={r.name} />
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{r.name}</Text>
                  {r.note ? <Text style={[hubText.caption, { color: c.text200 }]}>„{r.note}“</Text> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="მიღება" onPress={() => void answer(r.linkId, true)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={20} color="#FFFFFF" />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="უარი" onPress={() => void answer(r.linkId, false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.bg200, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} color={c.text100} />
                </Pressable>
              </View>
            </Card>
          ))}
        </Section>
      ) : null}

      {invited.length ? (
        <Section title="მოწვეული · ელოდება დასტურს">
          {invited.map((r) => (
            <Card key={r.linkId} style={{ marginBottom: 10, paddingVertical: 12 }}>
              <View style={coachStyles.row}>
                <Avatar avatarId={r.avatarId} photoUrl={r.avatarUrl} name={r.name} size={40} />
                <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="მოწვევის გაუქმება"
                  onPress={() => void api.coach.cancelInvite(r.id).then(load).catch((e) => Alert.alert('ვერ მოხერხდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.'))}
                  hitSlop={8}
                >
                  <X size={18} color={c.text300} />
                </Pressable>
              </View>
            </Card>
          ))}
        </Section>
      ) : null}

      {clients && clients.length > 5 ? (
        <View style={{ marginTop: 16 }}>
          <Input value={q} onChangeText={setQ} placeholder="კლიენტის ძებნა" style={{ paddingLeft: 42 }} />
          <Search size={18} color={c.text300} style={{ position: 'absolute', left: 14, top: 16 }} />
        </View>
      ) : null}

      {clients ? (
        <Section title="აქტიური კლიენტები">
          {shown.length ? (
            shown.map((x) => {
              const warn = x.alerts.find((a) => a.tone === 'warn');
              return (
                <Card key={x.id} onPress={() => router.push(`/coach/client/${x.id}` as never)} style={{ marginBottom: 10, gap: 12 }} accessibilityLabel={`${x.name}, კლიენტი`}>
                  <View style={coachStyles.row}>
                    <Avatar avatarId={x.avatarId} photoUrl={x.avatarUrl} name={x.name} size={48} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 16 }]}>{x.name}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>
                        {x.nextSession ? `შემდეგი: ${relativeStart(x.nextSession)}` : 'ვარჯიში არ არის დაგეგმილი'}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={c.text300} />
                  </View>
                  <View style={[coachStyles.row, { gap: 14 }]}>
                    {x.week ? (
                      <View style={{ gap: 4 }}>
                        <Text style={[hubText.small, { color: c.text300 }]}>კვება · 7 დღე</Text>
                        <DayStrip days={x.week} size={11} />
                      </View>
                    ) : null}
                    {x.kcalToday ? (
                      <View style={{ gap: 2 }}>
                        <Text style={[hubText.small, { color: c.text300 }]}>დღეს</Text>
                        <Text style={[hubText.value, { color: c.text100 }]}>
                          {x.kcalToday.eaten}
                          {x.kcalToday.target ? <Text style={[hubText.caption, { color: c.text300 }]}> / {x.kcalToday.target}</Text> : null}
                        </Text>
                      </View>
                    ) : null}
                    {x.weight?.currentKg ? (
                      <View style={{ gap: 2 }}>
                        <Text style={[hubText.small, { color: c.text300 }]}>წონა</Text>
                        <Text style={[hubText.value, { color: c.text100 }]}>
                          {x.weight.currentKg}
                          {x.weight.goalKg ? <Text style={[hubText.caption, { color: c.text300 }]}> → {x.weight.goalKg}</Text> : null}
                        </Text>
                      </View>
                    ) : null}
                    {x.weight?.percent != null ? (
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[hubText.small, { color: c.text300 }]}>მიზანი {x.weight.percent}%</Text>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.bg200 }}>
                          <View style={{ height: 6, borderRadius: 3, width: `${x.weight.percent}%`, backgroundColor: '#14B8A6' }} />
                        </View>
                      </View>
                    ) : null}
                  </View>
                  {warn ? (
                    <View style={[coachStyles.row, { gap: 8, backgroundColor: c.warningBg, borderRadius: 12, padding: 10 }]}>
                      <AlertTriangle size={16} color={c.warning} />
                      <Text style={[hubText.caption, { color: c.text100, flex: 1 }]}>{warn.text.replace(/^[^:]+:\s*/, '')}</Text>
                    </View>
                  ) : null}
                </Card>
              );
            })
          ) : (
            <Card style={{ gap: 12 }}>
              <EmptyNote title="კლიენტები ჯერ არ გყავს" body="დარბაზში დაასკანერე კლიენტის QR (მის აპში: პროფილი → ჩემი QR) — მოწვევა მაშინვე მიუვა. ან გაუზიარე შენი კოდი." />
              <Button label="კლიენტის QR-ის სკანირება" icon={ScanLine} onPress={() => router.push('/coach/scan' as never)} />
              {code ? <Button label={`კოდის გაზიარება · ${code}`} icon={Share2} kind="secondary" onPress={invite} /> : null}
            </Card>
          )}
        </Section>
      ) : null}
    </CoachShell>
  );
}
