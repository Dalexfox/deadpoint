import { DefaultTheme, ThemeProvider, Tabs, usePathname, useRouter } from 'expo-router';
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
function LogIcon({ ringColor }: { ringColor: string }) {
  // Elevated center action — floats above the bar (negative margin) with a ring
  // matching the bar background so it reads as a raised button, Strava-style.
  return (
    <View style={[styles.logButton, { borderColor: ringColor }]}>
      <Ionicons name="add" size={30} color="#ffffff" />
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
  const router   = useRouter();
  const isFeed   = pathname === '/';

  const tabBarStyle = isFeed ? styles.tabBarDark : styles.tabBarLight;
  const activeTint  = isFeed ? '#ffffff'         : INK;
  const inactiveTint = isFeed ? 'rgba(255,255,255,0.38)' : 'rgba(26,20,8,0.3)';
  // Ring around the elevated Log button matches the bar bg so it reads as floating.
  const logRing = isFeed ? '#0d0d0b' : '#ffffff';

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
            tabBarIcon: () => <LogIcon ringColor={logRing} />,
          }}
          listeners={{
            // Don't switch to the heavy "identify" tab — open the fast composer
            // (quick log) directly. The identify flow is an opt-in link inside it.
            tabPress: (e) => {
              e.preventDefault();
              router.push({ pathname: '/log-flow/send', params: { quick: 'true' } });
            },
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
  logButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: SAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,               // float above the bar
    borderWidth: 4,               // borderColor set per-theme (matches bar bg)
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
