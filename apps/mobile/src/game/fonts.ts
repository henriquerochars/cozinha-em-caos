import { useTypeface } from '@shopify/react-native-skia';
import { useFonts } from 'expo-font';
import { useMemo } from 'react';
import { FontSet } from './rendering/paint';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LILITA = require('../../assets/fonts/LilitaOne-Regular.ttf') as number;

/** Loads the display font for both React Native <Text> and Skia drawing. */
export function useGameFonts(): { fonts: FontSet; ready: boolean; error: string } {
  const [rnLoaded, rnError] = useFonts({ LilitaOne: LILITA });
  const typeface = useTypeface(LILITA);
  const fonts = useMemo(() => new FontSet(typeface), [typeface]);
  return { fonts, ready: rnLoaded && typeface !== null, error: rnError ? String(rnError) : '' };
}
