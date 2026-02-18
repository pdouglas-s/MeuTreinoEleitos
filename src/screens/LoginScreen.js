import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ImageBackground } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { hasSystemAdmin, login } from '../services/userService';
import { Alert } from '../utils/alert';
import { isValidEmail } from '../utils/validation';
import { getAuthErrorMessage } from '../utils/authErrors';
import theme from '../theme';
import CardMedia from '../components/CardMedia';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const emailInvalido = email.trim().length > 0 && !isValidEmail(email);
  const loginDisabled = !email.trim() || !password || emailInvalido;

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      async function checkPublicRegister() {
        try {
          const exists = await hasSystemAdmin();
          if (active) setShowRegister(!exists);
        } catch (error) {
          if (active) setShowRegister(false);
        }
      }

      checkPublicRegister();
      return () => {
        active = false;
      };
    }, [])
  );

  async function handleLogin() {
    if (!email || !password) return Alert.alert('Erro', 'E-mail e senha são obrigatórios');
    try {
      const { profile } = await login({ email, password });
      if (!profile) return Alert.alert('Erro', 'Perfil não encontrado');
      if (profile.primeiro_acesso) {
        // forçar troca de senha
        navigation.replace('ChangePassword');
        return;
      }
      if (profile.role === 'admin_sistema') navigation.replace('SystemAdminHome');
      else if (profile.role === 'admin_academia') navigation.replace('AdminAcademiaHome');
      else if (profile.role === 'professor') navigation.replace('ProfessorHome');
      else navigation.replace('AlunoHome');
    } catch (err) {
      const message = getAuthErrorMessage(err, 'Não foi possível fazer login. Tente novamente.');
      Alert.alert('Erro', message);
    }
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80' }}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
      >
        <View style={styles.screenBackgroundTint} />
      </ImageBackground>

      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80' }}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroTint} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTag}>ACESSO ÚNICO</Text>
          <Text style={styles.heroTitle}>Entre com seu perfil para continuar</Text>
        </View>
      </ImageBackground>

      <View style={styles.card}>
        <CardMedia variant="auth" label="ACESSO MULTIPERFIL" />
        <Text style={styles.title}>Bem-vindo ao MeuTreino</Text>
        <Text style={styles.subtitle}>Acesso para sistema, academia, professor e aluno</Text>
        <View style={styles.formPanel}>
          <View style={styles.formHighlight}>
            <Text style={styles.formHighlightIcon}>🏋️</Text>
            <View style={styles.formHighlightTextWrap}>
              <Text style={styles.formHighlightTitle}>Portal único de acesso</Text>
              <Text style={styles.formHighlightHint}>Use as credenciais do seu perfil para entrar com segurança.</Text>
            </View>
          </View>

          <TextInput placeholder="E-mail" style={[styles.input, emailInvalido && styles.inputError]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.helperText}>Exemplo: nome@dominio.com</Text>
          {emailInvalido && <Text style={styles.errorText}>E-mail inválido</Text>}
          <TextInput placeholder="Senha" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
          <Button title="Entrar" onPress={handleLogin} disabled={loginDisabled} />
          {showRegister && (
            <>
              <View style={styles.divider} />
              <Button title="Criar Conta" onPress={() => navigation.navigate('Register')} color={theme.colors.muted} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: theme.colors.background },
  screenBackground: {
    ...StyleSheet.absoluteFillObject
  },
  screenBackgroundImage: {
    opacity: 0.12
  },
  screenBackgroundTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    opacity: 0.08
  },
  hero: {
    height: 170,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginBottom: 12,
    justifyContent: 'flex-end'
  },
  heroImage: {
    borderRadius: theme.radii.lg
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.text,
    opacity: 0.56
  },
  heroContent: {
    padding: 14,
    backgroundColor: 'rgba(17, 24, 39, 0.32)'
  },
  heroTag: {
    color: theme.colors.card,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8
  },
  heroTitle: {
    color: theme.colors.card,
    marginTop: 6,
    fontSize: theme.fontSizes.lg,
    fontWeight: '700'
  },
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 16,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center'
  },
  title: { fontSize: 26, textAlign: 'center', marginBottom: 8, color: theme.colors.text, fontWeight: '700' },
  subtitle: { fontSize: 14, textAlign: 'center', color: theme.colors.muted, marginBottom: 14 },
  formPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: 12,
    backgroundColor: theme.colors.background
  },
  formHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: 10,
    marginBottom: 12
  },
  formHighlightIcon: {
    fontSize: 18,
    marginRight: 8
  },
  formHighlightTextWrap: {
    flex: 1
  },
  formHighlightTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  formHighlightHint: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 12
  },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12, backgroundColor: theme.colors.background },
  inputError: { borderColor: '#dc2626' },
  helperText: { color: theme.colors.muted, fontSize: 12, marginTop: -6, marginBottom: 10 },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 10 },
  divider: { height: 16 }
});
