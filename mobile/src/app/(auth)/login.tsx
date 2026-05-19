import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { Svg, Path } from 'react-native-svg';
import { useAuthStore } from '../../store/auth.store';
import { colors, spacing, radii, fonts } from '../../theme';

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
      <Path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
      <Path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
      <Path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
    </Svg>
  );
}

export default function LoginScreen() {
  const { signIn, signInWithGoogle, loading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setError(null);
    const err = await signIn(email, password);
    if (err) setError(err);
  };

  const handleGoogle = async () => {
    setError(null);
    const err = await signInWithGoogle();
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.card}>
        <Text style={s.logo}>Vitale</Text>
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

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>ou</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity style={s.btnGoogle} onPress={handleGoogle} disabled={loading} activeOpacity={0.85}>
          <GoogleIcon />
          <Text style={s.btnGoogleText}>Continuar com Google</Text>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    fontSize: 12,
    color: colors.ink3,
    fontFamily: fonts.sans,
  },
  btnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.lg,
  },
  btnGoogleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.ink,
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
