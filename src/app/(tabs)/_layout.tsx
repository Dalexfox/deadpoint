import { DefaultTheme, ThemeProvider, Tabs, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
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
function LogIcon() {
  return (
    <View style={styles.logButtonOuter}>
      <View style={styles.logButton}>
        <SymbolView name="plus" size={22} tintColor="#ffffff" />
      </View>
    </View>
  );
}
function ExploreIcon({ color, focused }: IconProps) {
  return <SymbolView name={focused ? 'magnifyingglass.circle.fill' : 'magnifyingglass'} size={24} tintColor={color} />;
}
function ProfileIcon({ color, focused }: IconProps) {
  return <SymbolView name={focused ? 'person.fill' : 'person'} size={24} tintColor={color} />;
}

export default function TabsLayout() {
  // usePathname returns '/' for the Feed tab (index) and '/gyms', '/explore',
  // '/log', '/profile' for all others. Switch the tab bar dark on Feed only.
  const pathname = usePathname();
  const isFeed   = pathname === '/';

  const tabBarStyle = isFeed ? styles.tabBarDark : styles.tabBarLight;
  const activeTint  = isFeed ? '#ffffff'         : PRIMARY;
  const inactiveTint = isFeed ? 'rgba(255,255,255,0.38)' : INACTIVE;

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
    borderTopColor: '#c8dde8',
    elevation: 0,
  },
  tabBarDark: {
    backgroundColor: '#0d2b36',
    borderTopColor: '#1a3d4f',
    elevation: 0,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.2,
  },
  logButtonOuter: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: '#0d2b36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#ff507c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff507c',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
