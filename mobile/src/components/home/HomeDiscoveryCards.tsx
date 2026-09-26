import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { HeartHandshake } from 'lucide-react-native';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { getRunState } from '@/lib/run/store';

/** MEDIRUN — the page's single spotlight. Dark teal, the route map bleeding out of the bottom edge. */
export function HomeRunDiscovery() {
  const router = useRouter();
  return (
    <HubFeatureCard
      tone="spotlight"
      accessibilityLabel="MEDIRUN — გაისეირნე და აღმოაჩინე ქალაქი"
      lead={
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 19,
            lineHeight: 26,
            letterSpacing: -0.5,
            color: '#FFFFFF',
            paddingTop: 2,
          }}
        >
          MEDI<Text style={{ color: '#5EEAD4', fontStyle: 'italic' }}>RUN</Text>
        </Text>
      }
      title="შენი ქალაქი. ახალი პერსპექტივით."
      body="ყოველი გასეირნება რუკაზე ახალ უბანს ხსნის და შენი ისტორიის ნაწილი ხდება."
      cta="გახსენი რუკა"
      onPress={() => {
        const phase = getRunState().phase;
        router.push(['running', 'paused', 'ready', 'preparing'].includes(phase) ? '/run/active' : '/run');
      }}
      art={
        <Svg width="100%" height="64" viewBox="0 0 350 64" preserveAspectRatio="xMidYMid slice">
          <Path d="M0 14L350 14M0 50L350 50M46 0L82 64M152 0L174 64M279 0L259 64" stroke="#264650" strokeWidth="2" />
          <Rect x="187" y="20" width="60" height="22" rx="9" fill="#204E4E" />
          <Path d="M-10 52H86C107 52 105 24 126 24H213C239 24 230 48 256 48H354" fill="none" stroke="#163D43" strokeWidth="13" />
          <Path
            d="M-10 52H86C107 52 105 24 126 24H213C239 24 230 48 256 48H354"
            fill="none"
            stroke="#5EEAD4"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle cx="151" cy="24" r="11" fill="#5EEAD4" opacity="0.15" />
          <Circle cx="151" cy="24" r="5" fill="#FFFFFF" stroke="#5EEAD4" strokeWidth="2" />
        </Svg>
      }
    />
  );
}

/** Women's community — a quiet surface card in the hub language. */
export function HomeCommunityDiscovery() {
  const router = useRouter();
  return (
    <HubFeatureCard
      icon={HeartHandshake}
      ink="rose"
      accessibilityLabel="ქალების სივრცე — შეუერთდი საუბარს"
      title="ქალების სივრცე"
      body="ჰკითხე, გაუზიარე და იპოვე მხარდაჭერა — სახელით, მეტსახელით ან ანონიმურად."
      cta="შეუერთდი საუბარს"
      onPress={() => router.push('/community')}
    />
  );
}
