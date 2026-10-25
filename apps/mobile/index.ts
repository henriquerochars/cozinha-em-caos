import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

/**
 * On the web, Skia needs CanvasKit (wasm) to be loaded *before* any Skia module
 * is evaluated, so the app itself is imported lazily after the download finishes.
 * The wasm file lives in /public (served by Expo) – see README for details.
 */
if (Platform.OS === 'web') {
  void (async () => {
    // The game has its own warm palette: ask dark-mode extensions (Dark Reader) not to recolor it.
    if (typeof document !== 'undefined') {
      for (const [name, content] of [
        ['darkreader-lock', ''],
        ['color-scheme', 'light'],
      ]) {
        const meta = document.createElement('meta');
        meta.name = name!;
        if (content) meta.content = content;
        document.head.appendChild(meta);
      }
    }
    try {
      const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
      await LoadSkiaWeb({ locateFile: (file: string) => `/${file}` });
    } catch (err) {
      console.error('Falha ao carregar o CanvasKit (Skia web):', err);
    }
    const { default: App } = await import('./App');
    registerRootComponent(App);
  })();
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: App } = require('./App') as typeof import('./App');
  registerRootComponent(App);
}
