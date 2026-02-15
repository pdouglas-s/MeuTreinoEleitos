import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { login } from '../services/userService';
import { Alert } from '../utils/alert';
import { isValidEmail } from '../utils/validation';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const emailInvalido = email.trim().length > 0 && !isValidEmail(email);
  const loginDisabled = !email.trim() || !password || emailInvalido;

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
      if (profile.role === 'professor') navigation.replace('ProfessorHome');
      else navigation.replace('AlunoHome');
    } catch (err) {
      Alert.alert('Falha no login', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MeuTreino</Text>
      <TextInput placeholder="E-mail" style={[styles.input, emailInvalido && styles.inputError]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.helperText}>Exemplo: nome@dominio.com</Text>
      {emailInvalido && <Text style={styles.errorText}>E-mail inválido</Text>}
      <TextInput placeholder="Senha" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
      <Button title="Entrar" onPress={handleLogin} disabled={loginDisabled} />
      <View style={styles.divider} />
      <Button title="Criar Conta" onPress={() => navigation.navigate('Register')} color="#666" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 28, textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12 },
  inputError: { borderColor: '#dc2626' },
  helperText: { color: '#666', fontSize: 12, marginTop: -6, marginBottom: 10 },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 10 },
  divider: { height: 20 }
});
