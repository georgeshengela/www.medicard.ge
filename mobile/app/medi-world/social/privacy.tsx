import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SocialButton, SocialShell, useSocialCopy } from '@/components/world/SocialChrome';
import { useSocial } from '@/hooks/useSocial';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { rememberSocial } from '@/lib/mediWorld/worldEconomyCache.js';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

function Toggle({ label, value, onPress, disabled }: { label: string; value: boolean; onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} className="active:opacity-75" style={{ marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.bg300, padding: 16, backgroundColor: colors.surface }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', color: colors.text100 }}>{label}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', color: colors.text300, marginTop: 4 }}>{value ? 'on' : 'off'}</Text>
    </Pressable>
  );
}

export default function SocialPrivacyScreen() {
  const colors = useThemeColors();
  const { copy } = useSocialCopy();
  const { payload, canMutate } = useSocial();
  const { user } = useAuth();
  const [showWorldLevel, setShowWorld] = useState(Boolean(payload?.privacy.showWorldLevel));
  const [showBondLevel, setShowBond] = useState(Boolean(payload?.privacy.showBondLevel));
  const [showGardenPreview, setShowGarden] = useState(Boolean(payload?.privacy.showGardenPreview));
  const [wavesMuted, setMute] = useState(Boolean(payload?.privacy.wavesMuted));
  const [saved, setSaved] = useState('');
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  return (
    <SocialShell titleKey="privacyTitle">
      <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 16, lineHeight: 24, color: colors.text200, marginTop: 12 }}>{copy.privacyBody}</Text>
      <Toggle label={copy.showWorld} value={showWorldLevel} disabled={!canMutate} onPress={() => setShowWorld((v) => !v)} />
      <Toggle label={copy.showBond} value={showBondLevel} disabled={!canMutate} onPress={() => setShowBond((v) => !v)} />
      <Toggle label={copy.showGarden} value={showGardenPreview} disabled={!canMutate} onPress={() => setShowGarden((v) => !v)} />
      <Toggle label={copy.muteWaves} value={wavesMuted} disabled={!canMutate} onPress={() => setMute((v) => !v)} />
      <SocialButton
        disabled={!canMutate}
        label={copy.save}
        onPress={() => {
          setSaved('');
          void mediWorldApi.socialPrivacy({ showWorldLevel, showBondLevel, showGardenPreview, wavesMuted }).then((me) => {
            rememberSocial(me, user?.id);
            setSaved(copy.privacySaved);
          }).catch(() => setSaved(copy.retry));
        }}
      />
      {saved ? <Text style={{ ...fontBody, color: colors.text100, marginTop: 12 }}>{saved}</Text> : null}
      <View />
    </SocialShell>
  );
}
