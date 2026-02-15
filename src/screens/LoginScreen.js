import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { hasSystemAdmin, login } from '../services/userService';
import { Alert } from '../utils/alert';
import { isValidEmail } from '../utils/validation';
import { getAuthErrorMessage } from '../utils/authErrors';
import theme from '../theme';

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
          console.warn('Erro ao verificar cadastro público no login:', error?.message || error);
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
      console.error('Falha no login:', { code: err?.code, message: err?.message, raw: err });
      Alert.alert('Falha no login', message);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>MeuTreino</Text>
        <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: theme.colors.background },
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 16
  },
  title: { fontSize: 28, textAlign: 'center', marginBottom: 8, color: theme.colors.text, fontWeight: '700' },
  subtitle: { fontSize: 14, textAlign: 'center', color: theme.colors.muted, marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12, backgroundColor: theme.colors.background },
  inputError: { borderColor: '#dc2626' },
  helperText: { color: theme.colors.muted, fontSize: 12, marginTop: -6, marginBottom: 10 },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 10 },
  divider: { height: 16 }
});
