import { Stack } from 'expo-router';

export default function LogStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="match" />
      <Stack.Screen name="send" />
    </Stack>
  );
}
