import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const ACCENT = '#ff507c';

const GYMS = [
  { id: '1', name: 'Vital Climbing LES', neighborhood: 'Lower East Side', city: 'NYC' },
  { id: '2', name: 'Vital Climbing Brooklyn', neighborhood: 'Brooklyn', city: 'NYC' },
  { id: '3', name: 'Vital Climbing UES', neighborhood: 'Upper East Side', city: 'NYC' },
  { id: '4', name: 'Vital Climbing UWS', neighborhood: 'Upper West Side', city: 'NYC' },
];

export default function GymsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Gyms</Text>
        <Text style={styles.subheading}>{GYMS.length} locations</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}>
        {GYMS.map((gym) => (
          <TouchableOpacity
            key={gym.id}
            style={styles.card}
            onPress={() => router.push(`/gym/${gym.id}`)}
            activeOpacity={0.8}>
            <View style={styles.cardBody}>
              <Text style={styles.gymName}>{gym.name}</Text>
              <Text style={styles.gymLocation}>
                {gym.neighborhood} · {gym.city}
              </Text>
            </View>
            <View style={styles.visitButton}>
              <Text style={styles.visitLabel}>Log →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: -0.8,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  gymName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: -0.3,
  },
  gymLocation: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: 0.1,
  },
  visitButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  visitLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
});
