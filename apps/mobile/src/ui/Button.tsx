import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radii } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const FACE: Record<Variant, string> = {
  primary: colors.banana,
  secondary: colors.sky,
  danger: colors.tomato,
  ghost: 'transparent',
};
const RIM: Record<Variant, string> = {
  primary: colors.bananaDark,
  secondary: colors.skyDark,
  danger: colors.tomatoDark,
  ghost: 'transparent',
};
const TEXT: Record<Variant, string> = {
  primary: colors.ink,
  secondary: colors.white,
  danger: colors.white,
  ghost: colors.inkSoft,
};

/** Chunky cartoon button with a "pushed down" press state. */
export function Button({ title, onPress, variant = 'primary', disabled, small, style }: Props): React.JSX.Element {
  const lift = variant === 'ghost' ? 0 : 5;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.wrap, { opacity: disabled ? 0.5 : 1 }, style, pressed && variant !== 'ghost' ? { transform: [{ translateY: lift - 1 }] } : null]} accessibilityRole="button">
      {({ pressed }) => (
        <View>
          {variant !== 'ghost' && <View style={[styles.rim, { backgroundColor: RIM[variant], top: pressed ? 1 : lift, borderRadius: radii.md }]} />}
          <View style={[styles.face, small && styles.faceSmall, { backgroundColor: FACE[variant], borderRadius: radii.md }, variant === 'ghost' && styles.ghostFace]}>
            <Text style={[styles.text, small && styles.textSmall, { color: TEXT[variant] }, variant === 'ghost' && styles.ghostText]} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  rim: { position: 'absolute', left: 0, right: 0, bottom: -5 },
  face: { paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  faceSmall: { paddingVertical: 9, paddingHorizontal: 16 },
  ghostFace: { paddingVertical: 8 },
  text: { fontFamily: fonts.display, fontSize: 20, letterSpacing: 0.5 },
  textSmall: { fontSize: 15 },
  ghostText: { fontSize: 15, textDecorationLine: 'underline' },
});
