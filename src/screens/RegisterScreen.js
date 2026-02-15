import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Platform } from 'react-native';
import { signOut } from 'firebase/auth';
import { registerUser } from '../services/userService';
import { Alert } from '../utils/alert';
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from '../utils/validation';
import { auth } from '../firebase/config';

console.log('RegisterScreen loading...');

export default function RegisterScreen({ navigation }) {
  console.log('RegisterScreen rendering...');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const emailInvalido = email.trim().length > 0 && !isValidEmail(email);
  const senhaInvalida = password.length > 0 && !isValidPassword(password);
  const registerDisabled = !nome.trim() || !email.trim() || !password || emailInvalido || senhaInvalida;

  async function handleRegister() {
    console.log('handleRegister called, nome:', nome);
    
    if (!email || !password || !nome) {
      return Alert.alert('Erro', 'Preencha todos os campos');
    }
    if (!isValidPassword(password)) {
      return Alert.alert('Erro', `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
    }
    if (!isValidEmail(email)) {
      return Alert.alert('Erro', 'Digite um e-mail válido');
    }

    try {
      const nomeUpper = nome.toUpperCase();
      const roleAutomatica = nomeUpper === 'ADMIN' ? 'professor' : 'aluno';
      console.log(`Registrando usuário como ${roleAutomatica} (nome: ${nomeUpper})`);
      
      await registerUser({ email, password, nome });
      
      const mensagem = roleAutomatica === 'professor' 
        ? 'Conta de Professor criada! Faça login.\n\nNome cadastrado: ADMIN'
        : `Conta de Aluno criada! Faça login.\n\nNome cadastrado: ${nomeUpper}`;
      
      Alert.alert('Sucesso', mensagem);
      await signOut(auth).catch(() => {});
      // Navegar para Login após pequeno delay
      setTimeout(() => {
        navigation.navigate('Login');
      }, 100);
    } catch (err) {
      console.error('Error in handleRegister:', err);
      Alert.alert('Erro ao criar conta', err.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Criar Conta</Text>
      
      <TextInput
        placeholder="Nome completo"
        style={styles.input}
        value={nome}
        onChangeText={setNome}
      />
      
      <TextInput
        placeholder="E-mail"
        style={[styles.input, emailInvalido && styles.inputError]}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Text style={styles.helperText}>Exemplo: nome@dominio.com</Text>
      {emailInvalido && <Text style={styles.errorText}>E-mail inválido</Text>}
      
      <TextInput
        placeholder={`Senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres)`}
        secureTextEntry
        style={[styles.input, senhaInvalida && styles.inputError]}
        value={password}
        onChangeText={setPassword}
      />
      {senhaInvalida && <Text style={styles.errorText}>Senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres</Text>}

      <Button title="Criar Conta" onPress={handleRegister} disabled={registerDisabled} />
      
      <Button
        title="Já tenho conta"
        onPress={() => navigation.navigate('Login')}
        color="#666"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
  },
});
