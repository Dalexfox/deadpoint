import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { OFFICIAL_ACCOUNT_ID } from '../../lib/constants';
import { AuthBrand } from '../../components/AuthBrand';

const SAND = '#c8a84a';
const INK  = '#1a1408';
const INK3 = '#8a7a50';
const CARD = '#f4f1eb';

export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!fullName || !username || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: fullName,
          username: username.toLowerCase().replace(/\s+/g, ''),
          email,
        });

      if (profileError) {
        console.warn('Profile insert error:', profileError.message);
      }

      // Auto-follow the official account, if one is configured. While
      // OFFICIAL_ACCOUNT_ID is null this is a no-op. The resulting follow is
      // ordinary — the user can unfollow it like any other account.
      if (OFFICIAL_ACCOUNT_ID) {
        await supabase
          .from('follows')
          .insert({ follower_id: data.user.id, following_id: OFFICIAL_ACCOUNT_ID });
      }
    }

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <AuthBrand />

          {/* Heading */}
          <View style={styles.headingBlock}>
            <Text style={styles.heading} numberOfLines={2} adjustsFontSizeToFit>
              CREATE{'\n'}ACCOUNT.
            </Text>
            <Text style={styles.subheading}>Track your climbs. Share your sessions.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Alex Fox"
                placeholderTextColor={INK3}
                autoComplete="name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>USERNAME</Text>
              <View style={styles.usernameRow}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={[styles.input, styles.usernameInput]}
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="alexfox"
                  placeholderTextColor={INK3}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={INK3}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={INK3}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSignup}
              activeOpacity={0.85}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitLabel}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Log in link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Log in</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // ─── Back ────────────────────────────────────────────────────
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: 36,
  },
  backArrow: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_300Light',
    color: INK,
    lineHeight: 28,
    marginTop: -2,
  },
  backLabel: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INK,
  },

  // ─── Heading ─────────────────────────────────────────────────
  headingBlock: {
    marginBottom: 36,
    gap: 10,
  },
  heading: {
    fontSize: 58,
    fontFamily: 'Syne_800ExtraBold',
    color: INK,
    letterSpacing: -2,
    lineHeight: 58,
  },
  subheading: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 0.1,
    lineHeight: 22,
  },

  // ─── Form ────────────────────────────────────────────────────
  form: {
    gap: 16,
    marginBottom: 32,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: INK,
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    paddingLeft: 18,
    overflow: 'hidden',
  },
  usernameAt: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: SAND,
    marginRight: 2,
  },
  usernameInput: {
    backgroundColor: 'transparent',
    paddingLeft: 0,
    borderRadius: 0,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#e8383c',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: SAND,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    fontSize: 15,
    fontFamily: 'Syne_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -0.3,
  },

  // ─── Footer ──────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: INK3,
  },
  footerLink: {
    fontSize: 14,
    fontFamily: 'Syne_800ExtraBold',
    color: SAND,
  },
});
