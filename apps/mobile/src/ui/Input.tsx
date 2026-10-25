import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radii } from '../theme';

interface Props extends TextInputProps {
  label: string;
  mono?: boolean;
}

export function Input({ label, mono, style, ...rest }: Props): React.JSX.Element {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#B9A4A4"
        style={[styles.input, mono && styles.mono, style]}
        selectionColor={colors.tomato}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.display, fontSize: 14, color: colors.inkSoft, marginLeft: 4 },
  input: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.bgDeep,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mono: { textAlign: 'center', letterSpacing: 6, fontSize: 28, textTransform: 'uppercase' },
});
