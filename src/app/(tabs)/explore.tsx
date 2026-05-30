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
// expo-symbols removed — requires dev build, not available in Expo Go
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';

const BG         = '#ffffff';
const SURFACE    = '#d8eaf0';
const PRIMARY    = '#2E7A96';
const TEXT       = '#0d2b36';
const TEXT_SUB   = '#3d7a8a';
const TEXT_MUTED = '#8bb5c4';
const DIVIDER    = '#c8dde8';

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
        backgroundColor: PRIMARY,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text
        style={{
          fontSize: size * 0.35,
          fontFamily: 'DMSans_800ExtraBold',
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
        <ActivityIndicator size="small" color={isFollowing ? TEXT_MUTED : '#ffffff'} />
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

export default function ExploreScreen() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<UserRow[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
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
  }, [searchQuery, currentUserId]);

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
        <Text style={{ fontSize: 15, color: TEXT_MUTED }}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search climbers..."
          placeholderTextColor={TEXT_MUTED}
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
          searchLoading ? (
            <ActivityIndicator color={PRIMARY} style={styles.loader} />
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No climbers found</Text>
              <Text style={styles.emptyText}>Try a different username.</Text>
            </View>
          ) : (
            searchResults.map((user) => (
              <UserRowItem
                key={user.id}
                user={user}
                isFollowing={followingSet.has(user.id)}
                isToggling={togglingId === user.id}
                onToggle={handleToggleFollow}
              />
            ))
          )
        ) : (
          <>
            <Text style={styles.sectionHeader}>SUGGESTED CLIMBERS</Text>
            {suggestionsLoading ? (
              <ActivityIndicator color={PRIMARY} style={styles.loader} />
            ) : suggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No suggestions yet</Text>
                <Text style={styles.emptyText}>
                  Log a session to find climbers at your gym.
                </Text>
              </View>
            ) : (
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
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
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
    fontFamily: 'DMSans_500Medium',
    color: TEXT,
    padding: 0,
  },
  clearBtn: {
    fontSize: 22,
    color: TEXT_MUTED,
    lineHeight: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT_MUTED,
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
    fontFamily: 'BebasNeue_400Regular',
    color: TEXT,
    letterSpacing: 1,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_MUTED,
    textAlign: 'center',
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
    fontFamily: 'DMSans_800ExtraBold',
    color: TEXT,
    letterSpacing: -0.1,
  },
  userHandle: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: TEXT_SUB,
  },
  followBtn: {
    backgroundColor: PRIMARY,
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
    fontFamily: 'DMSans_700Bold',
    color: '#ffffff',
  },
  followingBtnText: {
    color: TEXT_MUTED,
  },
});
