import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

const ACCENT = '#ff507c';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
    }
    // On success, _layout.tsx auth listener redirects to (tabs) automatically
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

          {/* Wordmark */}
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>DEADPOINT</Text>
          </View>

          {/* Heading */}
          <View style={styles.headingBlock}>
            <Text style={styles.heading}>WELCOME{'\n'}BACK.</Text>
            <Text style={styles.subheading}>Log in to see what your crew is climbing.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#bbbbbb"
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
                placeholder="••••••••"
                placeholderTextColor="#bbbbbb"
                secureTextEntry
                autoComplete="password"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitLabel}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign up link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/signup')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Sign up</Text>
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

  // ─── Wordmark ─────────────────────────────────────────────────
  wordmarkRow: {
    marginBottom: 48,
  },
  wordmark: {
    fontSize: 18,
    fontFamily: 'BebasNeue_400Regular',
    color: ACCENT,
    letterSpacing: 4,
  },

  // ─── Heading ─────────────────────────────────────────────────
  headingBlock: {
    marginBottom: 44,
    gap: 10,
  },
  heading: {
    fontSize: 58,
    fontFamily: 'BebasNeue_400Regular',
    color: '#0d2b36',
    letterSpacing: 1,
    lineHeight: 58,
  },
  subheading: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
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
    fontSize: 11,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#aaaaaa',
    letterSpacing: 1.4,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#0d2b36',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: ACCENT,
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  submitLabel: {
    fontSize: 17,
    fontFamily: 'DMSans_800ExtraBold',
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  // ─── Footer ──────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'DMSans_600SemiBold',
    color: '#888888',
  },
  footerLink: {
    fontSize: 14,
    fontFamily: 'DMSans_800ExtraBold',
    color: ACCENT,
  },
});
