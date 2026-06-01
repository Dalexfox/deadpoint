import { DefaultTheme, ThemeProvider, Tabs, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

const INK      = '#1a1408';
const INK3     = '#8a7a50';
const SAND     = '#c8a84a';

type IconProps = { color: ColorValue; focused: boolean };

function FeedIcon({ color, focused }: IconProps) {
  return <Ionicons name={focused ? 'layers' : 'layers-outline'} size={24} color={color} />;
}
function GymsIcon({ color, focused }: IconProps) {
  return <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color} />;
}
function LogIcon() {
  return (
    <View style={styles.logButtonOuter}>
      <View style={styles.logButton}>
        <Ionicons name="add" size={26} color="#ffffff" />
      </View>
    </View>
  );
}
function ExploreIcon({ color, focused }: IconProps) {
  return <Ionicons name={focused ? 'search-circle' : 'search-outline'} size={24} color={color} />;
}
function ProfileIcon({ color, focused }: IconProps) {
  return <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />;
}

export default function TabsLayout() {
  const pathname = usePathname();
  const isFeed   = pathname === '/';

  const tabBarStyle = isFeed ? styles.tabBarDark : styles.tabBarLight;
  const activeTint  = isFeed ? '#ffffff'         : INK;
  const inactiveTint = isFeed ? 'rgba(255,255,255,0.38)' : 'rgba(26,20,8,0.3)';

  return (
    <ThemeProvider value={DefaultTheme}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: activeTint,
          tabBarInactiveTintColor: inactiveTint,
          tabBarStyle: tabBarStyle,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Feed', tabBarIcon: (p) => <FeedIcon {...p} /> }}
        />
        <Tabs.Screen
          name="explore"
          options={{ title: 'Explore', tabBarIcon: (p) => <ExploreIcon {...p} /> }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: '',
            tabBarIcon: () => <LogIcon />,
            tabBarItemStyle: { marginTop: 8 },
          }}
        />
        <Tabs.Screen
          name="gyms"
          options={{ title: 'Gyms', tabBarIcon: (p) => <GymsIcon {...p} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', tabBarIcon: (p) => <ProfileIcon {...p} /> }}
        />
      </Tabs>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabBarLight: {
    backgroundColor: '#ffffff',
    borderTopColor: 'rgba(26,20,8,0.08)',
    elevation: 0,
  },
  tabBarDark: {
    backgroundColor: '#0d0d0b',
    borderTopColor: 'rgba(255,255,255,0.08)',
    elevation: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.2,
  },
  logButtonOuter: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: SAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
