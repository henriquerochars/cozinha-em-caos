import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme';

/** Cream background, safe-area aware, scrolls when the keyboard shows up. */
export function Screen({ children, center }: { children: React.ReactNode; center?: boolean }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, center && styles.center, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }): React.JSX.Element {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Subtitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }): React.JSX.Element {
  return <Text style={[styles.subtitle, style]}>{children}</Text>;
}

export function Body({ children, style, muted }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }): React.JSX.Element {
  return <Text style={[styles.body, muted && { color: colors.inkSoft }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorText({ children }: { children: React.ReactNode }): React.JSX.Element | null {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  center: { flexGrow: 1, justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, color: colors.tomato, textAlign: 'center', textShadowColor: colors.shadow, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  subtitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center' },
  body: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: colors.cream, borderRadius: radii.lg, padding: 20, gap: 12, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  error: { fontFamily: fonts.display, fontSize: 15, color: colors.tomatoDark, textAlign: 'center' },
});
