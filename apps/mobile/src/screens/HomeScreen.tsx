import { normalizeRoomCode } from '@cozinha/shared';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { sfx } from '../audio/sfx';
import { session, useSession } from '../multiplayer/session';
import { colors, fonts } from '../theme';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Body, Card, ErrorText, Screen, Subtitle, Title } from '../ui/Screen';

type Mode = 'menu' | 'join';

export function HomeScreen(): React.JSX.Element {
  const snap = useSession();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<Mode>('menu');
  const [showServer, setShowServer] = useState(false);
  const [serverUrl, setServerUrl] = useState(snap.serverUrl);
  const busy = snap.status === 'connecting';
  const chefName = name.trim() || 'Chef';

  const commitServer = (): void => {
    if (serverUrl.trim() !== snap.serverUrl) session.setServerUrl(serverUrl);
  };

  const create = async (): Promise<void> => {
    commitServer();
    void sfx.init();
    try {
      await session.createRoom(chefName);
    } catch {
      // the session already exposes the error message
    }
  };

  const join = async (): Promise<void> => {
    commitServer();
    void sfx.init();
    try {
      await session.joinRoom(code, chefName);
    } catch {
      // see above
    }
  };

  return (
    <Screen center>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🍳</Text>
        <Title>Cozinha{'\n'}em Caos</Title>
        <Body muted>Dois celulares, uma cozinha, pedidos demais.</Body>
      </View>

      <Card>
        <Input label="Seu nome de chef" value={name} onChangeText={setName} placeholder="Chef" maxLength={12} autoCapitalize="words" returnKeyType="done" />

        {mode === 'menu' ? (
          <>
            <Button title="Criar sala" onPress={() => void create()} disabled={busy} />
            <Button title="Entrar com código" variant="secondary" onPress={() => setMode('join')} disabled={busy} />
          </>
        ) : (
          <>
            <Input
              label="Código da sala"
              mono
              value={code}
              onChangeText={(v) => setCode(normalizeRoomCode(v))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="go"
              onSubmitEditing={() => void join()}
            />
            <Button title="Entrar" variant="secondary" onPress={() => void join()} disabled={busy || code.length !== 6} />
            <Button title="Voltar" variant="ghost" onPress={() => setMode('menu')} disabled={busy} />
          </>
        )}

        {busy && (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.tomato} />
            <Body muted>Conectando…</Body>
          </View>
        )}
        <ErrorText>{snap.error}</ErrorText>
      </Card>

      <Pressable onPress={() => setShowServer((v) => !v)} hitSlop={8}>
        <Text style={styles.serverToggle}>{showServer ? 'esconder servidor' : `servidor: ${snap.serverUrl}`}</Text>
      </Pressable>
      {showServer && (
        <Card>
          <Subtitle>Servidor</Subtitle>
          <Body muted>Os dois celulares precisam apontar para o mesmo servidor (normalmente o IP do computador na rede Wi-Fi).</Body>
          <Input label="Endereço (ws://ip:2567)" value={serverUrl} onChangeText={setServerUrl} onBlur={commitServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8 },
  emoji: { fontSize: 64, lineHeight: 76 },
  busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  serverToggle: { fontFamily: fonts.display, fontSize: 12, color: colors.inkSoft, textAlign: 'center', opacity: 0.8 },
});
