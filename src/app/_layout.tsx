import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { useMeshLifecycle } from '../hooks/useMeshLifecycle';
import { useIdentityStore } from '../store/identityStore';
import { usePermissionStore } from '../store/permissionStore';
import { darkTheme, lightTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();

/**
 * Navigation guards (first launch flow):
 *   permissions not granted  → /permissions   (system dialogs; cannot continue without them)
 *   no nick yet              → /onboarding
 *   otherwise                → tabs (chats / network / settings) + chat screens
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  const [ready, setReady] = useState(false);
  const granted = usePermissionStore((s) => s.granted);
  const nick = useIdentityStore((s) => s.nick);

  useEffect(() => {
    useIdentityStore.getState().load();
    usePermissionStore
      .getState()
      .check()
      .finally(() => {
        setReady(true);
        void SplashScreen.hideAsync();
      });
  }, []);

  useMeshLifecycle();

  if (!ready) return null;

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.onSurface,
          contentStyle: { backgroundColor: theme.colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Protected guard={!granted}>
          <Stack.Screen name="permissions" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={granted && !nick}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={granted && !!nick}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ title: 'Czat' }} />
          <Stack.Screen name="new-group" options={{ title: 'Nowa grupa', presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
    </PaperProvider>
  );
}
