import { Canvas, Picture, createPicture } from '@shopify/react-native-skia';
import { INPUT_SEND_INTERVAL_MS, WORLD_H, WORLD_W, type GameEvent, type GameStateView } from '@cozinha/shared';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent, type PointerEvent, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { sfx } from '../audio/sfx';
import { session, useSession } from '../multiplayer/session';
import { colors, fonts as themeFonts } from '../theme';
import { ClientWorld } from './engine/ClientWorld';
import { TouchControls, computeLayout } from './engine/controls';
import { reactToEvent } from './engine/events';
import { FxSystem } from './engine/fx';
import { drawControls } from './rendering/controlsDraw';
import { itemParticleColors } from './rendering/items';
import { paints, type FontSet } from './rendering/paint';
import { drawScene } from './rendering/scene';
import { ConfirmLeaveOverlay, PausedOverlay, ResultsOverlay } from '../screens/overlays';

interface Props {
  fonts: FontSet;
}

/** The match screen: Skia canvas (world + controls), touch overlay and the phase overlays. */
export function GameScreen({ fonts }: Props): React.JSX.Element {
  const snap = useSession();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [confirmLeave, setConfirmLeave] = useState(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }, []);

  useEffect(() => {
    if (snap.phase !== 'ended' && snap.phase !== 'paused') setConfirmLeave(false);
  }, [snap.phase]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.canvasHost} onLayout={onLayout}>
        {size.w > 0 && size.h > 0 && <GameCanvas fonts={fonts} width={size.w} height={size.h} bottomInset={insets.bottom} />}
      </View>

      {!confirmLeave && snap.phase !== 'ended' && (
        <Pressable onPress={() => setConfirmLeave(true)} style={[styles.exit, { bottom: insets.bottom + 6 }]} hitSlop={10} accessibilityRole="button">
          <Text style={styles.exitText}>sair</Text>
        </Pressable>
      )}

      {snap.phase === 'paused' && <PausedOverlay onLeave={() => void session.leave()} />}
      {snap.phase === 'ended' && <ResultsOverlay />}
      {confirmLeave && <ConfirmLeaveOverlay onCancel={() => setConfirmLeave(false)} onConfirm={() => void session.leave()} />}
    </View>
  );
}

interface CanvasProps {
  fonts: FontSet;
  width: number;
  height: number;
  bottomInset: number;
}

const webTouchStyle: ViewStyle | null = Platform.OS === 'web' ? ({ touchAction: 'none', userSelect: 'none', cursor: 'crosshair' } as unknown as ViewStyle) : null;

/**
 * Owns the game loop. Deliberately has no React state: every frame it rebuilds a
 * Skia picture and hands it to the canvas through a shared value, so nothing
 * re-renders while playing.
 */
const GameCanvas = memo(function GameCanvas({ fonts, width, height, bottomInset }: CanvasProps): React.JSX.Element {
  const worldRef = useRef(new ClientWorld());
  const fxRef = useRef(new FxSystem());
  const layout = useMemo(() => computeLayout(width, height, bottomInset, WORLD_W, WORLD_H), [width, height, bottomInset]);
  const controlsRef = useRef<TouchControls | null>(null);
  if (!controlsRef.current) controlsRef.current = new TouchControls(layout);
  const overlayRef = useRef<React.ComponentRef<typeof View>>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const picture = useSharedValue(createPicture(() => undefined, { width, height }));

  useEffect(() => {
    controlsRef.current?.setLayout(layout);
  }, [layout]);

  // server events -> fx/sounds
  useEffect(() => {
    return session.onEvent((ev: GameEvent) => {
      reactToEvent(ev, worldRef.current, fxRef.current, sfx, session.myId());
    });
  }, []);

  // keyboard (web / desktop testing)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const down = (e: KeyboardEvent): void => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      controlsRef.current?.keyDown(e.key);
    };
    const up = (e: KeyboardEvent): void => controlsRef.current?.keyUp(e.key);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // the loop
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let lastCount = 0;
    const world = worldRef.current;
    const fx = fxRef.current;

    const ambient = (dt: number, state: GameStateView | null, myId: string): void => {
      if (!state || world.phase !== 'playing') return;
      world.stations.forEach((s) => {
        // chopping: rhythm of knife sounds + flying bits
        if (s.busyBy !== '') {
          s.chopTimer += dt;
          if (s.chopTimer >= 0.4) {
            s.chopTimer = 0;
            const c = world.stationCenter(s.def.id);
            const first = s.items[0];
            fx.chips(c.x + (Math.random() - 0.5) * 10, c.y - 8, first ? itemParticleColors(first) : ['#FFFFFF']);
            sfx.play('chop', { volume: s.busyBy === myId ? 0.8 : 0.45, minGapMs: 120 });
          }
        } else {
          s.chopTimer = 0.3;
        }
        // stoves: steam while cooking, lazy puffs when done
        if (s.def.type === 'stove_pan' || s.def.type === 'stove_pot') {
          if (s.cookState === 'cooking' || s.cookState === 'done') {
            s.steamTimer -= dt;
            if (s.steamTimer <= 0) {
              const c = world.stationCenter(s.def.id);
              fx.steam(c.x, s.def.y + 4);
              s.steamTimer = s.cookState === 'cooking' ? 0.1 + Math.random() * 0.1 : 0.45 + Math.random() * 0.3;
            }
          }
        }
      });
      const me = world.chefs.get(myId);
      if (me && me.moving && me.stepTimer >= 0.27) {
        me.stepTimer = 0;
        sfx.play('step', { volume: 0.22, minGapMs: 150 });
      }
    };

    const countdown = (): void => {
      if (world.phase !== 'countdown') {
        lastCount = 0;
        return;
      }
      const secs = Math.max(1, Math.ceil((world.countdownEndsAt - world.clock) / 1000));
      if (secs !== lastCount) {
        lastCount = secs;
        fx.showBanner(String(secs), 'Preparar…', '#FFFFFF', 1.0);
        sfx.play('tick', { volume: 0.7 });
      }
    };

    const frame = (t: number): void => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, Math.max(0.001, (t - last) / 1000));
      last = t;
      const controls = controlsRef.current!;
      const myId = session.myId();
      world.localId = myId;

      controls.update(dt);
      const input = controls.input();
      world.input = input;
      session.sendInput(input.x, input.y, t, INPUT_SEND_INTERVAL_MS);
      if (controls.consumeAction()) {
        if (world.phase === 'playing') {
          session.sendAction();
          sfx.haptic('light');
        }
      }

      const state = session.state;
      world.update(dt, state);
      ambient(dt, state, myId);
      countdown();
      fx.update(dt);

      const L = controls.layout;
      const me = world.chefs.get(myId);
      picture.value = createPicture(
        (canvas) => {
          canvas.drawRect({ x: 0, y: 0, width: L.width, height: L.height }, paints.fill('#3B2A2A'));
          canvas.save();
          canvas.translate(L.worldX, L.worldY);
          canvas.scale(L.scale, L.scale);
          canvas.clipRect({ x: 0, y: 0, width: WORLD_W, height: WORLD_H }, 1, true);
          drawScene(canvas, world, fx, state, fonts, myId);
          canvas.restore();
          drawControls(canvas, controls, world, fonts, world.time, me?.slot ?? 0);
        },
        { width: L.width, height: L.height },
      );
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      controlsRef.current?.releaseAll();
      session.sendInput(0, 0, Number.MAX_SAFE_INTEGER, 0);
    };
  }, [fonts, picture]);

  // ------------------------------------------------------------- touches
  const measureOrigin = useCallback(() => {
    overlayRef.current?.measureInWindow((x: number, y: number) => {
      originRef.current = { x, y };
    });
  }, []);

  const onTouch = useCallback((kind: 'down' | 'move' | 'up') => (e: GestureResponderEvent) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const o = originRef.current;
    for (const t of e.nativeEvent.changedTouches) {
      const id = Number(t.identifier);
      if (kind === 'up') controls.pointerUp(id);
      else if (kind === 'down') controls.pointerDown(id, t.pageX - o.x, t.pageY - o.y);
      else controls.pointerMove(id, t.pageX - o.x, t.pageY - o.y);
    }
  }, []);

  const onPointer = useCallback((kind: 'down' | 'move' | 'up') => (e: PointerEvent) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const ne = e.nativeEvent;
    const o = originRef.current;
    const id = ne.pointerId;
    if (kind === 'up') controls.pointerUp(id);
    else if (kind === 'down') controls.pointerDown(id, ne.clientX - o.x, ne.clientY - o.y);
    else controls.pointerMove(id, ne.clientX - o.x, ne.clientY - o.y);
  }, []);

  const touchProps = Platform.OS === 'web'
    ? { onPointerDown: onPointer('down'), onPointerMove: onPointer('move'), onPointerUp: onPointer('up'), onPointerCancel: onPointer('up'), onPointerLeave: onPointer('up') }
    : { onTouchStart: onTouch('down'), onTouchMove: onTouch('move'), onTouchEnd: onTouch('up'), onTouchCancel: onTouch('up') };

  return (
    <View style={styles.fill}>
      <Canvas style={styles.fill} opaque>
        <Picture picture={picture} />
      </Canvas>
      <View ref={overlayRef} style={[styles.fill, styles.overlay, webTouchStyle]} onLayout={measureOrigin} {...touchProps} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#3B2A2A' },
  canvasHost: { flex: 1 },
  fill: { flex: 1 },
  overlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  exit: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  exitText: { fontFamily: themeFonts.display, color: colors.cream, opacity: 0.7, fontSize: 13, letterSpacing: 1 },
});
