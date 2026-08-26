import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../store/auth.store';
import { colors, spacing, radii, fonts, useThemedStyles } from '../../theme';

export default function RegisterScreen() {
  const s = useThemedStyles(createStyles);
  const { signUp, loading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) return;
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setError(null);
    const err = await signUp(email, password);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.page}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <Text style={s.logo}>Orbe</Text>
          <Text style={s.subtitle}>Crie sua conta</Text>

          {success ? (
            <View style={s.successBox}>
              <Text style={s.successText}>
                Verifique seu e-mail para confirmar o cadastro.
              </Text>
              <Link href="/(auth)/login" style={s.link}>
                Ir para o login →
              </Link>
            </View>
          ) : (
            <>
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
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.ink3}
                  secureTextEntry
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Confirmar senha</Text>
                <TextInput
                  style={s.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
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
                  ? <ActivityIndicator color={colors.onPrimary} />
                  : <Text style={s.btnText}>Criar conta</Text>
                }
              </TouchableOpacity>

              <Text style={s.footerText}>
                Já tem conta?{' '}
                <Link href="/(auth)/login" style={s.link}>Entrar</Link>
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = () => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
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
    fontFamily: fonts.sansMedium,
    fontSize: 13,
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
  successBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  successText: {
    fontSize: 14,
    color: colors.ink,
    textAlign: 'center',
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
    color: colors.onPrimary,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
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
    fontFamily: fonts.sansMedium,
  },
});
