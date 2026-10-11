import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Star } from 'lucide-react-native';
import { MediMascot } from '@/components/medi/mascot/MediMascot';
import { useTabChromeHidden } from '@/components/navigation/tabChrome';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { tx } from '@/i18n/locale';
import { answerRatingPrompt, openStoreReviewPage, ratingPromptSupported, requestStoreReview, takeRatingPromptTurn } from '@/lib/ratingPrompt';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubTint } from '@/theme/hub';

/** Medi (full crop: room for the jump) stands on the card: the card starts this far down Medi's box. */
const MEDI_SIZE = 128;
const CARD_TOP = 84;
/** Apple's sheet makes the app inactive; no such sign within this time = it did not appear. */
const SHEET_WAIT_MS = 2500;
/** After the sheet closes, the thank-you stays this long before the card closes itself. */
const THANKS_MS = 1600;

/**
 * Home: after a good moment (ratingPrompt.ts) the next Home visit may open the rating card. Waits for
 * Home to settle and never opens over another sheet, the permission gate or a closing modal.
 */
export function HomeRatingPrompt({ blocked }: { blocked: boolean }) {
  const { user } = useAuth();
  const chromeHidden = useTabChromeHidden();
  const [open, setOpen] = useState(false);
  const busy = useRef(false);
  busy.current = blocked || chromeHidden;
  const createdAt = user?.createdAt;

  useFocusEffect(
    useCallback(() => {
      if (!ratingPromptSupported()) return undefined;
      let left = false;
      const timer = setTimeout(() => {
        if (left || busy.current || AppState.currentState !== 'active') return;
        void takeRatingPromptTurn(createdAt).then((due) => {
          if (due && !left) setOpen(true);
        });
      }, 1200);
      return () => {
        left = true;
        clearTimeout(timer);
      };
    }, [createdAt]),
  );

  return <RatingPromptCard visible={open} onClose={() => setOpen(false)} />;
}

/**
 * „MEDICARD შენთვის უფასოა“ — Medi asks once, kindly (owner-approved variant A, 2026-10-11). „შეაფასე“
 * opens Apple's rating sheet; the card then says thank you, and offers the App Store page only if the
 * sheet did not appear. `preview` (dev gallery) never calls Apple and never writes the prompt state.
 */
export function RatingPromptCard({ visible, onClose, preview = false }: { visible: boolean; onClose: () => void; preview?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const [phase, setPhase] = useState<'ask' | 'thanks'>('ask');
  const [noSheet, setNoSheet] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  const ink = hubInk('teal', dark);
  // The dark-theme ink is a light tint: its button text is dark, the light theme's is white.
  const onInk = dark ? '#042F2E' : '#FFFFFF';

  useEffect(() => {
    if (!visible) return;
    setPhase('ask');
    setNoSheet(false);
  }, [visible]);
  useEffect(() => () => cleanup.current?.(), []);

  const close = () => {
    cleanup.current?.();
    cleanup.current = null;
    onClose();
  };
  const later = () => {
    if (phase === 'ask' && !preview) answerRatingPrompt('later');
    close();
  };

  const rate = async () => {
    setPhase('thanks');
    if (preview) {
      const t = setTimeout(() => setNoSheet(true), SHEET_WAIT_MS);
      cleanup.current = () => clearTimeout(t);
      return;
    }
    answerRatingPrompt('rate');
    // Listen before asking: the sheet can appear at once.
    let sheetSeen = false;
    let thanksTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') sheetSeen = true;
      else if (sheetSeen && !thanksTimer) thanksTimer = setTimeout(close, THANKS_MS);
    });
    const waitTimer = setTimeout(() => {
      if (!sheetSeen) setNoSheet(true);
    }, SHEET_WAIT_MS);
    cleanup.current = () => {
      sub.remove();
      clearTimeout(waitTimer);
      if (thanksTimer) clearTimeout(thanksTimer);
    };
    if ((await requestStoreReview()) === 'link') close();
  };

  const openPage = () => {
    if (!preview) void openStoreReviewPage();
    close();
  };

  const asking = phase === 'ask';
  const button = (label: string, onPress: () => void, icon = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ marginTop: 18, alignSelf: 'stretch', height: 50, borderRadius: 25, backgroundColor: ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
      {icon ? <Star size={18} color={onInk} fill={onInk} strokeWidth={2} /> : null}
      <Text style={{ color: onInk, fontSize: 15, fontFamily: 'NotoSansGeorgian_700Bold' }}>{label}</Text>
    </Pressable>
  );
  const quiet = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ marginTop: 4, alignSelf: 'stretch', height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.text300, fontSize: 14, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={later}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={asking ? tx('მოგვიანებით', 'Later') : tx('დახურვა', 'Close')}
          onPress={later}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
        />
        <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center', paddingTop: CARD_TOP }}>
          <View
            accessibilityViewIsModal
            style={{ alignItems: 'center', backgroundColor: c.surface, borderRadius: 26, paddingTop: MEDI_SIZE - CARD_TOP + 14, paddingHorizontal: 22, paddingBottom: 12 }}
          >
            {asking ? (
              <>
                <View style={{ paddingHorizontal: 11, paddingVertical: 3, borderRadius: 11, backgroundColor: hubTint(ink, dark) }}>
                  <Text style={{ color: ink, fontSize: 12, lineHeight: 18, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('სრულიად უფასო', 'Completely free')}</Text>
                </View>
                <Text accessibilityRole="header" style={{ marginTop: 10, textAlign: 'center', color: c.text100, fontSize: 19, lineHeight: 27, fontFamily: 'NotoSansGeorgian_700Bold' }}>
                  {tx('MEDICARD შენთვის უფასოა', 'MEDICARD is free for you')}
                </Text>
                <Text style={{ marginTop: 6, textAlign: 'center', color: c.text200, fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>
                  {tx(
                    'არც გამოწერა, არც ფასიანი ფუნქცია. თუ მოგწონს, ერთი შეფასება App Store-ში ძალიან დაგვეხმარება.',
                    'No subscription, no paid features. If you like it, one App Store rating helps us a lot.',
                  )}
                </Text>
                {button(tx('შეაფასე', 'Rate'), () => void rate(), true)}
                {quiet(tx('მოგვიანებით', 'Later'), later)}
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={{ textAlign: 'center', color: c.text100, fontSize: 19, lineHeight: 27, fontFamily: 'NotoSansGeorgian_700Bold' }}>
                  {tx('მადლობა!', 'Thank you!')}
                </Text>
                <Text style={{ marginTop: 6, textAlign: 'center', color: c.text200, fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>
                  {noSheet
                    ? tx('ვარსკვლავები არ გამოჩნდა? შეფასება App Store-შიც შეიძლება.', "Stars didn't show up? You can rate in the App Store too.")
                    : tx('შენი შეფასება სხვებსაც დაეხმარება MEDICARD-ის პოვნაში.', 'Your rating helps others find MEDICARD.')}
                </Text>
                {noSheet ? (
                  <>
                    {button(tx('App Store-ში გახსნა', 'Open the App Store'), openPage, true)}
                    {quiet(tx('დახურვა', 'Close'), close)}
                  </>
                ) : (
                  button(tx('დახურვა', 'Close'), close)
                )}
              </>
            )}
          </View>
          {/* decoration: Medi waves, then holds the heart; jumps for the thank-you */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            <MediMascot mood={asking ? 'hello' : 'jump'} then="love" playKey={phase} size={MEDI_SIZE} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
