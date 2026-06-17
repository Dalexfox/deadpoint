/**
 * MentionText — renders a notes/description string, turning `@username` tokens
 * into tappable links that navigate to that climber's profile. Plain "tag in the
 * description" mentions: no table, the username is just typed into the notes.
 *
 * Tapping resolves the handle → profiles.id on demand, then routes to
 * /(tabs)/profile (self) or /user/[id] (other). Unknown handles are inert.
 */
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';

// Capturing group so String.split keeps the @handles as their own chunks.
const MENTION = /(@[a-zA-Z0-9_.]+)/g;

export function MentionText({
  text, style, mentionStyle, numberOfLines,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const router = useRouter();

  const onPressMention = async (token: string) => {
    const handle = token.replace(/^@/, '');
    if (!handle) return;
    try {
      const [{ data: { user } }, { data }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('id').ilike('username', handle).maybeSingle(),
      ]);
      if (!data?.id) return; // not a real user → inert
      if (user && data.id === user.id) router.push('/(tabs)/profile');
      else router.push(`/user/${data.id}`);
    } catch {
      // best-effort — a failed lookup just does nothing
    }
  };

  const parts = text.split(MENTION);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) =>
        part.startsWith('@') && part.length > 1 ? (
          <Text key={i} style={mentionStyle} onPress={() => onPressMention(part)}>{part}</Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
