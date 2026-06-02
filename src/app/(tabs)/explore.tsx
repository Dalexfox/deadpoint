import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { fetchGyms, type Gym } from '../../lib/gyms';

const BG         = '#ffffff';
const CARD       = '#f4f1eb';
const SURFACE    = '#ece8df';
const SAND       = '#c8a84a';
const SAND_LT    = '#e8c87a';
const INK        = '#1a1408';
const INK2       = '#3d3320';
const INK3       = '#8a7a50';
const DIVIDER    = 'rgba(26,20,8,0.08)';

type UserRow = {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
};

function toInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');
}

function UserAvatar({ user, size }: { user: UserRow; size: number }) {
  if (user.avatarUrl) {
    return (
      <Image
        source={{ uri: user.avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: SAND,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontSize: size * 0.35,
          fontFamily: 'Syne_800ExtraBold',
          color: '#ffffff',
          letterSpacing: 0.3,
        }}>
        {toInitials(user.fullName || user.username || '?')}
      </Text>
    </View>
  );
}

function FollowButton({
  userId,
  isFollowing,
  isLoading,
  onToggle,
}: {
  userId: string;
  isFollowing: boolean;
  isLoading: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.followBtn, isFollowing && styles.followingBtn]}
      onPress={() => onToggle(userId)}
      disabled={isLoading}
      activeOpacity={0.7}>
      {isLoading ? (
        <ActivityIndicator size="small" color={isFollowing ? INK3 : '#ffffff'} />
      ) : (
        <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function UserRowItem({
  user,
  isFollowing,
  isToggling,
  onToggle,
}: {
  user: UserRow;
  isFollowing: boolean;
  isToggling: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <View style={styles.userRow}>
      <UserAvatar user={user} size={48} />
      <View style={styles.userMeta}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.fullName || user.username}
        </Text>
        <Text style={styles.userHandle} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
      <FollowButton
        userId={user.id}
        isFollowing={isFollowing}
        isLoading={isToggling}
        onToggle={onToggle}
      />
    </View>
  );
}

function GymRowItem({ gym }: { gym: Gym }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.gymRow}
      onPress={() => router.push(`/gym/${gym.id}`)}
      activeOpacity={0.7}>
      <View style={styles.gymIcon}>
        <Ionicons name="location-outline" size={18} color={SAND} />
      </View>
      <View style={styles.userMeta}>
        <Text style={styles.gymName} numberOfLines={1}>{gym.name}</Text>
        <Text style={styles.gymNeighborhood} numberOfLines={1}>
          {gym.neighborhood}{gym.city ? ` · ${gym.city}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={INK3} />
    </TouchableOpacity>
  );
}

export default function ExploreScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [gymResults, setGymResults]       = useState<Gym[]>([]);
  const [allGyms, setAllGyms]             = useState<Gym[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<UserRow[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load gyms once — cached after first call
  useEffect(() => {
    fetchGyms().then(setAllGyms);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!active || !user) return;
        setCurrentUserId(user.id);

        const { data: followRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        if (!active) return;
        const followed = new Set<string>((followRows ?? []).map((r: any) => r.following_id as string));
        setFollowingSet(followed);

        await loadSuggestions(user.id, followed, () => active);
      })();

      return () => { active = false; };
    }, [])
  );

  async function loadSuggestions(
    userId: string,
    followed: Set<string>,
    isActive: () => boolean
  ) {
    setSuggestionsLoading(true);

    const { data: mySessions } = await supabase
      .from('sessions')
      .select('gym_id')
      .eq('user_id', userId);

    if (!isActive()) return;

    const myGymIds = [...new Set<string>((mySessions ?? []).map((s: any) => s.gym_id as string))];

    if (myGymIds.length === 0) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const { data: gymSessions } = await supabase
      .from('sessions')
      .select('user_id')
      .in('gym_id', myGymIds)
      .neq('user_id', userId);

    if (!isActive()) return;

    const candidateIds = [
      ...new Set<string>(
        (gymSessions ?? [])
          .map((s: any) => s.user_id as string)
          .filter((id: string) => !followed.has(id))
      ),
    ].slice(0, 20);

    if (candidateIds.length === 0) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', candidateIds);

    if (!isActive()) return;

    setSuggestions(
      (profiles ?? []).map((p: any) => ({
        id: p.id,
        fullName: p.full_name ?? '',
        username: p.username ?? '',
        avatarUrl: p.avatar_url ?? null,
      }))
    );
    setSuggestionsLoading(false);
  }

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setGymResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);

    // Filter gyms instantly from local cache
    const lower = q.toLowerCase();
    setGymResults(
      allGyms.filter(g =>
        g.name.toLowerCase().includes(lower) ||
        (g.neighborhood ?? '').toLowerCase().includes(lower) ||
        (g.city ?? '').toLowerCase().includes(lower)
      )
    );

    searchDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);

      setSearchResults(
        (data ?? [])
          .filter((p: any) => p.id !== currentUserId)
          .map((p: any) => ({
            id: p.id,
            fullName: p.full_name ?? '',
            username: p.username ?? '',
            avatarUrl: p.avatar_url ?? null,
          }))
      );
      setSearchLoading(false);
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, currentUserId, allGyms]);

  const handleToggleFollow = async (targetId: string) => {
    if (!currentUserId || togglingId) return;
    setTogglingId(targetId);

    const wasFollowing = followingSet.has(targetId);

    setFollowingSet((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(targetId);
      else next.add(targetId);
      return next;
    });

    if (wasFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetId);
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: targetId });
    }

    setTogglingId(null);
  };

  const isSearching = searchQuery.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>EXPLORE</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={17} color={INK3} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search climbers & gyms..."
          placeholderTextColor={INK3}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.clearBtn}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {isSearching ? (
          <>
            {/* Gym results — instant from local cache */}
            {gymResults.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>GYMS</Text>
                {gymResults.map(gym => <GymRowItem key={gym.id} gym={gym} />)}
                <View style={styles.sectionDivider} />
              </>
            )}

            {/* Climber results */}
            {searchLoading ? (
              <ActivityIndicator color={SAND} style={styles.loader} />
            ) : searchResults.length === 0 && gymResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No results</Text>
                <Text style={styles.emptyText}>Try a different name or gym.</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <>
                <Text style={styles.sectionHeader}>CLIMBERS</Text>
                {searchResults.map((user) => (
                  <UserRowItem
                    key={user.id}
                    user={user}
                    isFollowing={followingSet.has(user.id)}
                    isToggling={togglingId === user.id}
                    onToggle={handleToggleFollow}
                  />
                ))}
              </>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.taglineBlock}>
              <Text style={styles.tagline}>Send It.</Text>
              <Text style={styles.taglineSub}>Find your people. Discover your next project.</Text>
            </View>
            {suggestionsLoading ? (
              <ActivityIndicator color={SAND} style={styles.loader} />
            ) : suggestions.length === 0 ? null : (
              suggestions.map((user) => (
                <UserRowItem
                  key={user.id}
                  user={user}
                  isFollowing={followingSet.has(user.id)}
                  isToggling={togglingId === user.id}
                  onToggle={handleToggleFollow}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 42,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: 1,
    lineHeight: 46,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK,
    padding: 0,
  },
  clearBtn: {
    fontSize: 22,
    color: INK3,
    lineHeight: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Syne_800ExtraBold',
    color: INK3,
    letterSpacing: 1.4,
    marginBottom: 16,
  },
  loader: {
    marginTop: 48,
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 26,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: 1,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    textAlign: 'center',
  },
  // ── Tagline (empty search state) ────────────────────────────
  taglineBlock: {
    marginBottom: 24,
  },
  tagline: {
    fontSize: 38,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -1,
    lineHeight: 42,
  },
  taglineSub: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: INK3,
    marginTop: 4,
  },

  // ── Gym row ──────────────────────────────────────────────────
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  gymIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: DIVIDER,
  },
  gymName: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.1,
  },
  gymNeighborhood: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  sectionDivider: {
    height: 20,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DIVIDER,
  },
  userMeta: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -0.1,
  },
  userHandle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK2,
  },
  followBtn: {
    backgroundColor: SAND,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  followBtnText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: '#ffffff',
  },
  followingBtnText: {
    color: INK3,
  },
});
