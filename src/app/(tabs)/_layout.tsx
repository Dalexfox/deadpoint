import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import type { ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';

const PRIMARY  = '#2E7A96';
const INACTIVE = '#8bb5c4';

type IconProps = { color: ColorValue; focused: boolean };

function FeedIcon({ color, focused }: IconProps) {
  return <SymbolView name={focused ? 'square.stack.fill' : 'square.stack'} size={24} tintColor={color} />;
}
function GymsIcon({ color, focused }: IconProps) {
  return <SymbolView name={focused ? 'map.fill' : 'map'} size={24} tintColor={color} />;
}
function LogIcon({ color, focused }: IconProps) {
  return <SymbolView name={focused ? 'book.fill' : 'book'} size={24} tintColor={color} />;
}
function ProfileIcon({ color, focused }: IconProps) {
  return <SymbolView name={focused ? 'person.fill' : 'person'} size={24} tintColor={color} />;
}

export default function TabsLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: PRIMARY,
          tabBarInactiveTintColor: INACTIVE,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Feed', tabBarIcon: (p) => <FeedIcon {...p} /> }}
        />
        <Tabs.Screen
          name="gyms"
          options={{ title: 'Gyms', tabBarIcon: (p) => <GymsIcon {...p} /> }}
        />
        <Tabs.Screen
          name="log"
          options={{ title: 'Log', tabBarIcon: (p) => <LogIcon {...p} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: (p) => <ProfileIcon {...p} /> }}
        />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#c8dde8',
    elevation: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.2,
  },
});
