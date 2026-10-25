import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const DEFAULT_SERVER_PORT = 2567;

/**
 * Resolves the multiplayer server URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_SERVER_URL (set in apps/mobile/.env or the shell) – use this for production.
 *  2. On web: same host the page was served from (so `expo start --web` + local server just works).
 *  3. On a device running through Expo (Expo Go / dev build): the development machine's LAN IP,
 *     which Expo exposes through `hostUri`. This means phones on the same Wi-Fi connect automatically.
 *  4. localhost (simulators).
 */
export function resolveServerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.hostname}:${DEFAULT_SERVER_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return `ws://${host}:${DEFAULT_SERVER_PORT}`;
  }

  return `ws://localhost:${DEFAULT_SERVER_PORT}`;
}
