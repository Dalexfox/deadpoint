import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="gym/[id]" />
      </Stack>
    </ThemeProvider>
  );
}
