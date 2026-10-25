import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameScreen } from './src/game/GameScreen';
import { useGameFonts } from './src/game/fonts';
import { useSession } from './src/multiplayer/session';
import { HomeScreen } from './src/screens/HomeScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { colors } from './src/theme';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Root />
    </SafeAreaProvider>
  );
}

const IN_MATCH = new Set(['countdown', 'playing', 'paused', 'ended']);

/** Picks the screen from the multiplayer session state (no router needed for three screens). */
function Root(): React.JSX.Element {
  const { fonts, ready, error } = useGameFonts();
  const snap = useSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(id);
  }, []);

  if (!ready && !error && !timedOut) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.tomato} size="large" />
      </View>
    );
  }

  const online = snap.status === 'connected' || snap.status === 'reconnecting';
  if (online && IN_MATCH.has(snap.phase)) return <GameScreen fonts={fonts} />;
  if (online && snap.phase === 'lobby') return <LobbyScreen />;
  return <HomeScreen />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
