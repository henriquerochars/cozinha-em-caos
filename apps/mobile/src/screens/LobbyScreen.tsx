import { PLAYER_COLORS, type PlayerView } from '@cozinha/shared';
import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { session, useSession } from '../multiplayer/session';
import { colors, fonts, radii } from '../theme';
import { Button } from '../ui/Button';
import { Body, Card, ErrorText, Screen, Subtitle } from '../ui/Screen';

export function LobbyScreen(): React.JSX.Element {
  const snap = useSession();
  const players: PlayerView[] = [];
  session.state?.players.forEach((p) => players.push(p));
  players.sort((a, b) => a.slot - b.slot);
  const me = players.find((p) => p.id === snap.myId);
  const full = players.length >= 2;

  const share = async (): Promise<void> => {
    try {
      await Share.share({ message: `Bora cozinhar? Entra no Cozinha em Caos com o código ${snap.roomCode}` });
    } catch {
      // sharing is optional
    }
  };

  return (
    <Screen center>
      <Subtitle>Sala de espera</Subtitle>
      <Card style={styles.codeCard}>
        <Body muted>Código da sala</Body>
        <Text style={styles.code} selectable>
          {snap.roomCode}
        </Text>
        <Body muted>Peça para o outro chef digitar este código.</Body>
        <Button title="Compartilhar código" variant="ghost" onPress={() => void share()} />
      </Card>

      <Card>
        {[0, 1].map((slot) => {
          const p = players.find((pl) => pl.slot === slot);
          return <PlayerRow key={slot} slot={slot} player={p} isMe={p?.id === snap.myId} />;
        })}
      </Card>

      {snap.status === 'reconnecting' && <ErrorText>Reconectando…</ErrorText>}
      <ErrorText>{snap.error}</ErrorText>

      {me?.ready ? (
        <>
          <Body muted>{full ? 'Esperando o outro chef ficar pronto…' : 'Esperando o segundo chef entrar…'}</Body>
          <Button title="Cancelar" variant="ghost" onPress={() => session.setReady(false)} />
        </>
      ) : (
        <Button title="Estou pronto!" onPress={() => session.setReady(true)} />
      )}
      <Button title="Sair da sala" variant="ghost" onPress={() => void session.leave()} />
    </Screen>
  );
}

function PlayerRow({ slot, player, isMe }: { slot: number; player: PlayerView | undefined; isMe: boolean }): React.JSX.Element {
  const color = PLAYER_COLORS[slot] ?? PLAYER_COLORS[0];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: player ? color : colors.bgDeep }]} />
      <Text style={[styles.name, !player && styles.nameEmpty]} numberOfLines={1}>
        {player ? `${player.name}${isMe ? ' (você)' : ''}` : 'Vaga livre'}
      </Text>
      <Text style={[styles.status, player?.ready && { color: colors.mintDark }]}>{player ? (player.connected ? (player.ready ? 'pronto ✓' : 'esperando') : 'caiu…') : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'center' },
  code: { fontFamily: fonts.display, fontSize: 48, letterSpacing: 8, color: colors.ink, backgroundColor: colors.white, paddingHorizontal: 18, paddingVertical: 6, borderRadius: radii.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.white },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  nameEmpty: { color: colors.inkSoft, opacity: 0.7 },
  status: { fontFamily: fonts.display, fontSize: 14, color: colors.inkSoft },
});
