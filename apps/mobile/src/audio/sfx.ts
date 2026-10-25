import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES = {
  bell: require('../../assets/sounds/bell.wav') as number,
  chop: require('../../assets/sounds/chop.wav') as number,
  ding: require('../../assets/sounds/ding.wav') as number,
  end: require('../../assets/sounds/end.wav') as number,
  fail: require('../../assets/sounds/fail.wav') as number,
  go: require('../../assets/sounds/go.wav') as number,
  invalid: require('../../assets/sounds/invalid.wav') as number,
  pickup: require('../../assets/sounds/pickup.wav') as number,
  place: require('../../assets/sounds/place.wav') as number,
  sizzle: require('../../assets/sounds/sizzle.wav') as number,
  step: require('../../assets/sounds/step.wav') as number,
  success: require('../../assets/sounds/success.wav') as number,
  tick: require('../../assets/sounds/tick.wav') as number,
};
/* eslint-enable @typescript-eslint/no-require-imports */

export type SfxName = keyof typeof SOURCES;

const VOICES = 2;

/**
 * Tiny sound-effect player on top of expo-audio: every sound gets a couple of
 * pre-created players ("voices") so rapid repeats never cut each other off.
 * Call `init()` after the first user interaction (browsers require it).
 */
class Sfx {
  private players = new Map<SfxName, AudioPlayer[]>();
  private voiceIndex = new Map<SfxName, number>();
  private lastPlayedAt = new Map<SfxName, number>();
  private ready = false;
  private initPromise: Promise<void> | null = null;
  muted = false;
  hapticsEnabled = true;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
      } catch {
        // audio mode is best effort (not supported everywhere)
      }
      try {
        for (const name of Object.keys(SOURCES) as SfxName[]) {
          const voices: AudioPlayer[] = [];
          for (let i = 0; i < VOICES; i++) voices.push(createAudioPlayer(SOURCES[name]));
          this.players.set(name, voices);
          this.voiceIndex.set(name, 0);
        }
        this.ready = true;
      } catch (err) {
        console.warn('Áudio indisponível:', err);
      }
    })();
    return this.initPromise;
  }

  /** Plays a sound; `minGapMs` avoids machine-gun repeats of the same effect. */
  play(name: SfxName, opts: { volume?: number; minGapMs?: number } = {}): void {
    if (!this.ready || this.muted) return;
    const now = Date.now();
    const last = this.lastPlayedAt.get(name) ?? 0;
    if (now - last < (opts.minGapMs ?? 40)) return;
    this.lastPlayedAt.set(name, now);
    const voices = this.players.get(name);
    if (!voices || voices.length === 0) return;
    const idx = this.voiceIndex.get(name) ?? 0;
    this.voiceIndex.set(name, (idx + 1) % voices.length);
    const p = voices[idx];
    if (!p) return;
    try {
      p.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
      void p.seekTo(0).catch(() => undefined);
      p.play();
    } catch {
      // never let audio break the game loop
    }
  }

  haptic(kind: 'light' | 'medium' | 'success' | 'error' | 'select'): void {
    if (!this.hapticsEnabled || Platform.OS === 'web') return;
    const run = async (): Promise<void> => {
      switch (kind) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        default:
          await Haptics.selectionAsync();
      }
    };
    run().catch(() => undefined);
  }

  dispose(): void {
    this.players.forEach((voices) => voices.forEach((p) => p.remove()));
    this.players.clear();
    this.ready = false;
    this.initPromise = null;
  }
}

export const sfx = new Sfx();
