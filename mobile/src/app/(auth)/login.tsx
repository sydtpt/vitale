import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/auth.store';
import { colors, spacing, radii, fonts } from '../../theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, loading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setError(null);
    const err = await signIn(email, password);
    if (err) {
      setError(err);
    } else {
      router.replace('/(tabs)/');
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.card}>
        <Text style={s.logo}>Rotina</Text>
        <Text style={s.subtitle}>Entre na sua conta</Text>

        <View style={s.field}>
          <Text style={s.label}>E-mail</Text>
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="voce@email.com"
            placeholderTextColor={colors.ink3}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Senha</Text>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.ink3}
            secureTextEntry
          />
        </View>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Entrar</Text>
          }
        </TouchableOpacity>

        <Text style={s.footerText}>
          Não tem conta?{' '}
          <Link href="/(auth)/register" style={s.link}>Criar conta</Link>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing['3xl'],
    width: '100%',
    maxWidth: 400,
  },
  logo: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: fonts.sans,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  errorBox: {
    backgroundColor: '#fff0f0',
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 13,
    color: '#e05252',
    fontFamily: fonts.sans,
  },
  btn: {
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.sans,
  },
  footerText: {
    fontSize: 13,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontFamily: fonts.sans,
  },
  link: {
    color: colors.primary,
    fontWeight: '500',
  },
});
