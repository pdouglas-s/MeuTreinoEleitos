import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Platform } from 'react-native';
import { registerUser } from '../services/userService';
import { Alert } from '../utils/alert';

console.log('RegisterScreen loading...');

export default function RegisterScreen({ navigation }) {
  console.log('RegisterScreen rendering...');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [role, setRole] = useState('aluno');

  async function handleRegister() {
    console.log('handleRegister called, role:', role);
    
    if (!email || !password || !nome) {
      return Alert.alert('Erro', 'Preencha todos os campos');
    }
    if (password.length < 6) {
      return Alert.alert('Erro', 'A senha deve ter no mínimo 6 caracteres');
    }

    try {
      console.log('Calling registerUser with role:', role);
      await registerUser({ email, password, nome, role });
      Alert.alert('Sucesso', 'Conta criada com sucesso! Faça login.');
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
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        placeholder="Senha (mínimo 6 caracteres)"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.label}>Tipo de usuário:</Text>
      <View style={styles.roleButtons}>
        <Button
          title="Aluno"
          onPress={() => setRole('aluno')}
          color={role === 'aluno' ? '#1976d2' : '#666'}
        />
        <View style={{ width: 10 }} />
        <Button
          title="Professor"
          onPress={() => setRole('professor')}
          color={role === 'professor' ? '#1976d2' : '#666'}
        />
      </View>

      <Button title="Criar Conta" onPress={handleRegister} />
      
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
  label: {
    fontSize: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  roleButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    justifyContent: 'space-around',
  },
});
