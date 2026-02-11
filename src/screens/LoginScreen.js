import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { login } from '../services/userService';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin() {
    if (!email || !password) return Alert.alert('Erro', 'E-mail e senha são obrigatórios');
    try {
      const { profile } = await login({ email, password });
      if (!profile) return Alert.alert('Erro', 'Perfil não encontrado');
      if (profile.role === 'professor') navigation.replace('ProfessorHome');
      else navigation.replace('AlunoHome');
    } catch (err) {
      Alert.alert('Falha no login', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MeuTreino</Text>
      <TextInput placeholder="E-mail" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput placeholder="Senha" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
      <Button title="Entrar" onPress={handleLogin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  title: { fontSize: 28, textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12 }
});
