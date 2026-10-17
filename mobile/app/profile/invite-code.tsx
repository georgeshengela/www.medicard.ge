import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CircleAlert, Coins, KeyRound, Share2, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { InviteTicket, type TicketInviter } from '@/components/referral/InviteTicket';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { API_BASE_URL, ApiError, api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { localAccountId } from '@/lib/localAccount';
import { petCareInstallId } from '@/lib/petCareReminderPrefs';
import { hasVerifiedPhone, isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { FRESH } from '@/lib/queryClient';
import { publishMediCoinBalance } from '@/lib/quest/cache';
import { clearPendingReferralCode, normalizeReferralCode, readPendingReferralCode, type ReferralClaimResult } from '@/lib/referral';
import { useAuth } from '@/store/AuthContext';
import { useVelvet, velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

const DAY = 86_400_000;
const daysLeft = (iso?: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / DAY) : null);
const dayText = (n: number) => tx(`${n} დღე`, `${n} ${n === 1 ? 'day' : 'days'}`);
const MONTHS_KA_DAT = ['იანვარს', 'თებერვალს', 'მარტს', 'აპრილს', 'მაისს', 'ივნისს', 'ივლისს', 'აგვისტოს', 'სექტემბერს', 'ოქტომბერს', 'ნოემბერს', 'დეკემბერს'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** „17 ოქტომბერს“ / „October 17“ in Tbilisi time (UTC+4, no DST); Intl's Georgian months are missing on some engines. */
function onDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 4 * 3_600_000);
  return tx(`${d.getUTCDate()} ${MONTHS_KA_DAT[d.getUTCMonth()]}`, `${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCDate()}`);
}

function Fact({ palette: p, icon: Icon, title, body }: { palette: VelvetPalette; icon: LucideIcon; title: string; body: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: p.field, boxShadow: velvetField(p) }}>
        <Icon size={19} color={p.pulse} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, gap: 2, paddingTop: 1 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: p.text }}>{title}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: p.ink2 }}>{body}</Text>
      </View>
    </View>
  );
}

/**
 * Profile → „ვინ მოგიწვია?“ (owner 2026-10-17: „გაალამაზე, გახადე უფრო ინფორმატიული“). One velvet ticket carries the
 * state: six code wells with the coin reward and the time left; who invited you once a code is in (photo of an
 * approved influencer, date, coins); a quiet „ვადა გავიდა“ when the window closed. Under it, in plain words: where
 * codes come from, that a code is entered once, what you get, and what the inviter sees. Influencer codes need a
 * verified phone: the velvet phone page opens with the reason, and the typed code goes in by itself on the way back.
 * Prefilled from an invite link when there is one.
 */
export default function InviteCodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette: p } = useVelvet();
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(normalizeReferralCode(params.code) ?? '');
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const retryAfterPhone = useRef(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ReferralClaimResult | null>(null);
  const lock = useRef(false);
  const summary = useAccountQuery({ key: ['referrals', 'me'], fetch: () => api.referrals.me(), staleTime: FRESH.SHORT });
  const s = summary.data;

  useEffect(() => {
    if (code) return;
    void readPendingReferralCode().then((pending) => {
      if (pending) setCode((current) => current || pending);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.dismissTo('/profile' as never));

  const inviter: TicketInviter | null = done
    ? { name: done.inviter ?? '', kind: done.kind === 'influencer' ? 'influencer' : 'friend', coins: done.coins ?? 0, at: new Date().toISOString() }
    : s?.invitedBy
      ? {
        name: s.invitedBy.name ?? '',
        kind: s.invitedBy.kind === 'influencer' ? 'influencer' : 'friend',
        at: s.invitedBy.at ?? null,
        coins: s.invitedBy.coins ?? 0,
        photoUri: s.invitedBy.photoPath ? `${API_BASE_URL}${s.invitedBy.photoPath}` : null,
      }
      : null;
  const mode: 'ask' | 'invited' | 'late' = inviter ? 'invited' : s && !s.canClaim ? 'late' : 'ask';
  // The reward chip: what you got (answered), what you get (asking), nothing once the window closed.
  const coins = mode === 'invited' ? inviter?.coins ?? 0 : s?.coinsPerSide ?? 25;
  const chipCoins = mode === 'late' ? 0 : coins;
  const influencerDays = daysLeft(s?.enterUntil);
  const friendDays = daysLeft(s?.friendUntil);
  const windowDays = s?.influencerWindowDays ?? 7;

  let footnote: string | null = null;
  if (mode === 'invited') {
    footnote = inviter?.at ? tx(`კოდი შეყვანილია ${onDate(inviter.at)}`, `Code entered on ${onDate(inviter.at)}`) : tx('კოდი შეყვანილია და აღარ იცვლება', 'The code is in and can’t be changed');
  } else if (mode === 'late') {
    footnote = tx(`კოდის შეყვანა რეგისტრაციიდან ${windowDays} დღის განმავლობაში შეიძლებოდა.`, `A code could be entered within ${windowDays} days of signing up.`);
  } else if (influencerDays != null && influencerDays > 1) {
    footnote = tx(`კოდის შეყვანა შეგიძლია კიდევ ${dayText(influencerDays)}`, `You can enter a code for ${dayText(influencerDays)} more`);
  } else if (influencerDays === 1) {
    footnote = tx('დღეს ბოლო დღეა კოდის შესაყვანად', 'Today is the last day to enter a code');
  } else if (friendDays != null && friendDays > 0) {
    footnote = tx(`ინფლუენსერის კოდის ვადა გავიდა; მეგობრის კოდს კიდევ ${dayText(friendDays)} შეიყვან`, `Influencer codes have closed; a friend’s code still works for ${dayText(friendDays)}`);
  } else {
    footnote = tx('კოდი ერთხელ შეიყვანება და მერე აღარ იცვლება', 'A code can be entered once and never changes');
  }

  const submit = async () => {
    if (mode !== 'ask') return leave();
    const normalized = normalizeReferralCode(code);
    if (!normalized) return setError(ka.referral.enterInvalid);
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const owner = localAccountId();
    try {
      const result = await api.referrals.claim(normalized, await petCareInstallId().catch(() => undefined));
      if (owner !== localAccountId()) return;
      if (typeof result.balance === 'number') publishMediCoinBalance(result.balance);
      await clearPendingReferralCode();
      setDone(result);
      void summary.refetch?.();
    } catch (e) {
      if (isPhoneRequiredError(e)) {
        retryAfterPhone.current = true;
        offerPhoneVerification(router, ka.referral.enterPhone);
      } else if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
        if (e.code === 'REFERRAL_ALREADY_CLAIMED' || e.code === 'REFERRAL_TOO_LATE') void clearPendingReferralCode();
      } else setError(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  // Back from the phone page with a verified number: the code the person typed goes in without a second tap.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useFocusEffect(
    useCallback(() => {
      if (!retryAfterPhone.current || !hasVerifiedPhone(user)) return;
      retryAfterPhone.current = false;
      void submitRef.current();
    }, [user]),
  );

  const title = done ? tx('მადლობა!', 'Thank you!') : ka.referral.enterTitle;
  const lead = done
    ? done.coins
      ? tx(`კოდი მიღებულია — ${done.coins} Medi მონეტა უკვე შენს საფულეშია.`, `Code accepted — ${done.coins} Medi Coins are already in your wallet.`)
      : tx('კოდი მიღებულია.', 'Code accepted.')
    : mode === 'invited'
      ? tx('ამ ანგარიშზე მოწვევის კოდი უკვე შეყვანილია — ერთი ანგარიში, ერთი კოდი.', 'An invite code is already on this account — one account, one code.')
      : mode === 'late'
        ? tx('ამ ანგარიშზე კოდის შეყვანის ვადა გავიდა. ახალ ანგარიშებს რეგისტრაციის შემდეგ ვეკითხებით.', 'The time to enter a code on this account has passed. New accounts are asked right after sign-up.')
        : tx(`შეიყვანე 6-ნიშნა კოდი, რომელიც ინფლუენსერმა ან მეგობარმა გაგიზიარა — მაშინვე მიიღებ ${coins} Medi მონეტას.`, `Enter the 6-character code an influencer or a friend shared with you — you get ${coins} Medi Coins right away.`);

  const header = (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('უკან', 'Back')}
        onPress={leave}
        hitSlop={10}
        style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: p.raised, boxShadow: velvetLift(p) }}
      >
        <ChevronLeft size={22} color={p.ink} strokeWidth={2.2} />
      </Pressable>
    </View>
  );

  const facts =
    mode === 'invited'
      ? [
        inviter?.kind === 'influencer'
          ? { icon: ShieldCheck, title: tx('შენი სახელი არ ჩანს', 'Your name stays private'), body: tx('ინფლუენსერი ხედავს მხოლოდ რამდენი ადამიანი მოიყვანა — არა სახელს, კონტაქტს ან ჯანმრთელობის მონაცემს.', 'The influencer only sees how many people joined — never your name, contact or health data.') }
          : { icon: ShieldCheck, title: tx('რას ხედავს მეგობარი', 'What your friend sees'), body: tx('შენს სახელს და გვარის პირველ ასოს — სხვას არაფერს.', 'Your first name and last initial — nothing else.') },
        { icon: Coins, title: tx('მონეტები საფულეშია', 'Coins are in your wallet'), body: tx('Medi მონეტები MEDIQUEST-ის მაღაზიაში გამოიყენე. ფულადი ღირებულება არ აქვს.', 'Use Medi Coins in the MEDIQUEST store. They have no cash value.') },
      ]
      : [
        { icon: Share2, title: tx('კოდს გაგიზიარებენ', 'Someone shares a code'), body: tx('ინფლუენსერი სთორიში, პოსტში ან ბმულით medicard.ge/i/…, მეგობარი — მესიჯით.', 'An influencer in a story, a post or a medicard.ge/i/… link; a friend in a message.') },
        { icon: KeyRound, title: tx('ერთხელ შეიყვან', 'You enter it once'), body: tx('ერთ ანგარიშზე ერთი კოდი — მერე აღარ იცვლება.', 'One code per account — it never changes afterwards.') },
        { icon: Coins, title: tx(`მიიღებ ${coins} Medi მონეტას`, `You get ${coins} Medi Coins`), body: tx('მაშინვე, MEDIQUEST-ის საფულეში. ფულადი ღირებულება არ აქვს.', 'Right away, in your MEDIQUEST wallet. They have no cash value.') },
        { icon: ShieldCheck, title: tx('სახელი დაცულია', 'Your name stays private'), body: tx('ინფლუენსერი მხოლოდ რაოდენობას ხედავს; მეგობარი — სახელს და გვარის პირველ ასოს.', 'An influencer only sees a count; a friend sees your first name and last initial.') },
      ];

  return (
    <KeyboardFormShell
      background={p.surface}
      header={header}
      contentStyle={{ paddingHorizontal: 20, paddingTop: 10, gap: 22 }}
      footer={
        <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 10 }}>
          <VelvetButton
            palette={p}
            label={mode === 'ask' ? ka.referral.enterCta : tx('გასაგებია', 'Got it')}
            busy={busy}
            disabled={mode === 'ask' && code.length < 6}
            onPress={() => void submit()}
          />
        </View>
      }
    >
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, lineHeight: 37, color: p.text }}>{title}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 23, color: p.ink2 }}>{lead}</Text>
      </View>

      <View style={{ paddingVertical: 4 }}>
        <InviteTicket
          palette={p}
          mode={mode}
          code={code}
          onChangeCode={(next) => {
            setCode(next);
            setError(null);
          }}
          onSubmit={() => void submit()}
          error={error}
          coins={chipCoins}
          footnote={footnote}
          inviter={inviter}
          fresh={Boolean(done)}
        />
        {error ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 14, paddingHorizontal: 4 }}>
            <CircleAlert size={17} color={p.danger} strokeWidth={2.2} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: p.danger }}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17, color: p.text }}>
          {mode === 'invited' ? tx('კარგია იცოდე', 'Good to know') : tx('როგორ მუშაობს', 'How it works')}
        </Text>
        {facts.map((f) => (
          <Fact key={f.title} palette={p} icon={f.icon} title={f.title} body={f.body} />
        ))}
      </View>
    </KeyboardFormShell>
  );
}
