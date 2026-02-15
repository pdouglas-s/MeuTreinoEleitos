import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { changePassword, setPrimeiroAcessoFalse } from '../services/userService';
import { Alert } from '../utils/alert';
import { auth } from '../firebase/config';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { isValidPassword, MIN_PASSWORD_LENGTH } from '../utils/validation';

export default function ChangePassword({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const senhaInvalida = password.length > 0 && !isValidPassword(password);
  const confirmInvalido = confirm.length > 0 && confirm !== password;
  const saveDisabled = !password || !confirm || senhaInvalida || confirmInvalido;

  async function handleChange() {
    if (!password || !confirm) return Alert.alert('Erro', 'Preencha os campos');
    if (!isValidPassword(password)) return Alert.alert('Erro', `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
    if (password !== confirm) return Alert.alert('Erro', 'Senhas não conferem');
    try {
      await changePassword(password);
      // atualizar campo primeiro_acesso no firestore
      const uid = auth.currentUser?.uid;
      if (uid) await setPrimeiroAcessoFalse(uid);

      let role = 'aluno';
      if (uid) {
        const snapshot = await getDoc(doc(db, 'users', uid));
        if (snapshot.exists()) {
          role = snapshot.data()?.role || 'aluno';
        }
      }

      Alert.alert('Sucesso', 'Senha alterada');
      if (role === 'professor') navigation.replace('ProfessorHome');
      else navigation.replace('AlunoHome');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trocar Senha</Text>
      <TextInput placeholder={`Nova senha (mínimo ${MIN_PASSWORD_LENGTH})`} secureTextEntry style={[styles.input, senhaInvalida && styles.inputError]} value={password} onChangeText={setPassword} />
      {senhaInvalida && <Text style={styles.errorText}>Senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres</Text>}
      <TextInput placeholder="Confirmar senha" secureTextEntry style={[styles.input, confirmInvalido && styles.inputError]} value={confirm} onChangeText={setConfirm} />
      {confirmInvalido && <Text style={styles.errorText}>Senhas não conferem</Text>}
      <Button title="Salvar" onPress={handleChange} disabled={saveDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  title: { fontSize: 20, marginBottom: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12 },
  inputError: { borderColor: '#dc2626' },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 10 }
});
