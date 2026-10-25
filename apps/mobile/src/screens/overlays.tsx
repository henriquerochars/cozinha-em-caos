import { RECONNECT_GRACE_SECONDS, ratingLabelPt, ratingStars } from '@cozinha/shared';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { session, useSession } from '../multiplayer/session';
import { colors, fonts, radii } from '../theme';
import { Button } from '../ui/Button';

function Dim({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.dim} pointerEvents="box-none">
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function PausedOverlay({ onLeave }: { onLeave: () => void }): React.JSX.Element {
  const snap = useSession();
  const reason = session.state?.pauseReason ?? '';
  return (
    <Dim>
      <Text style={styles.heading}>Pausa</Text>
      <Text style={styles.body}>{reason || 'Esperando o outro chef…'}</Text>
      <Text style={styles.muted}>
        {snap.status === 'reconnecting' ? 'Tentando reconectar você…' : `A partida continua quando ele voltar (até ${RECONNECT_GRACE_SECONDS}s).`}
      </Text>
      <Button title="Sair da sala" variant="ghost" onPress={onLeave} />
    </Dim>
  );
}

export function ResultsOverlay(): React.JSX.Element {
  const snap = useSession();
  const state = session.state;
  const score = state?.score ?? 0;
  const completed = state?.completed ?? 0;
  const failed = state?.failed ?? 0;
  const stars = ratingStars(score, completed);
  const me = state?.players.get(snap.myId);
  const players: Array<{ name: string; ready: boolean }> = [];
  state?.players.forEach((p) => players.push({ name: p.name, ready: p.ready }));
  const waitingFor = players.filter((p) => !p.ready).map((p) => p.name);

  return (
    <Dim>
      <Text style={styles.heading}>Tempo esgotado!</Text>
      <Text style={styles.stars}>
        {'★'.repeat(stars)}
        <Text style={styles.starsOff}>{'☆'.repeat(3 - stars)}</Text>
      </Text>
      <Text style={styles.rating}>{ratingLabelPt(stars)}</Text>
      <Text style={styles.score}>{score} pontos</Text>
      <View style={styles.row}>
        <Stat label="entregues" value={completed} color={colors.mint} />
        <Stat label="perdidos" value={failed} color={colors.tomato} />
      </View>
      {me?.ready ? (
        <Text style={styles.muted}>{waitingFor.length > 0 ? `Esperando ${waitingFor.join(' e ')}…` : 'Começando…'}</Text>
      ) : (
        <Button title="Jogar de novo" onPress={() => session.playAgain()} />
      )}
      <Button title="Sair da sala" variant="ghost" onPress={() => void session.leave()} />
    </Dim>
  );
}

export function ConfirmLeaveOverlay({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }): React.JSX.Element {
  return (
    <Dim>
      <Text style={styles.heading}>Sair da partida?</Text>
      <Text style={styles.muted}>Seu parceiro vai voltar para a sala de espera.</Text>
      <Button title="Sair" variant="danger" onPress={onConfirm} />
      <Button title="Continuar jogando" variant="ghost" onPress={onCancel} />
    </Dim>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }): React.JSX.Element {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(40, 20, 15, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.cream, borderRadius: radii.lg, padding: 22, gap: 12, alignItems: 'stretch' },
  heading: { fontFamily: fonts.display, fontSize: 30, color: colors.tomato, textAlign: 'center' },
  body: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  muted: { fontFamily: fonts.display, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  stars: { fontSize: 44, lineHeight: 52, color: colors.banana, textAlign: 'center' },
  starsOff: { color: colors.inkSoft, opacity: 0.5 },
  rating: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  score: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  stat: { alignItems: 'center' },
  statValue: { fontFamily: fonts.display, fontSize: 26 },
  statLabel: { fontFamily: fonts.display, fontSize: 13, color: colors.inkSoft },
});
