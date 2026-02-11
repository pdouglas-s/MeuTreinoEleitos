import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { changePassword, setPrimeiroAcessoFalse } from '../services/userService';
import { Alert } from '../utils/alert';
import { auth } from '../firebase/config';

export default function ChangePassword({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  async function handleChange() {
    if (!password || !confirm) return Alert.alert('Erro', 'Preencha os campos');
    if (password !== confirm) return Alert.alert('Erro', 'Senhas não conferem');
    try {
      await changePassword(password);
      // atualizar campo primeiro_acesso no firestore
      const uid = auth.currentUser?.uid;
      if (uid) await setPrimeiroAcessoFalse(uid);
      Alert.alert('Sucesso', 'Senha alterada');
      navigation.replace('AlunoHome');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trocar Senha</Text>
      <TextInput placeholder="Nova senha" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} />
      <TextInput placeholder="Confirmar senha" secureTextEntry style={styles.input} value={confirm} onChangeText={setConfirm} />
      <Button title="Salvar" onPress={handleChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 20, marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12 }
});
