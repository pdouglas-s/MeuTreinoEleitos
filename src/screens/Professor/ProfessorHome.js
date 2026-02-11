import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { createAluno } from '../../services/userService';

export default function ProfessorHome() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  async function handleCreateAluno() {
    if (!nome || !email) return Alert.alert('Erro', 'Nome e e-mail são obrigatórios');
    try {
      await createAluno({ nome, email });
      Alert.alert('Sucesso', 'Aluno criado (senha padrão definida via variável de ambiente)');
      setNome('');
      setEmail('');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Área do Professor</Text>
      <TextInput placeholder="Nome do aluno" style={styles.input} value={nome} onChangeText={setNome} />
      <TextInput placeholder="E-mail do aluno" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Button title="Criar Aluno" onPress={handleCreateAluno} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12 }
});
