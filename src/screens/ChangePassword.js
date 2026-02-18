import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { changePassword, setPrimeiroAcessoFalse } from '../services/userService';
import { Alert } from '../utils/alert';
import { auth } from '../firebase/config';
import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { isValidPassword, MIN_PASSWORD_LENGTH } from '../utils/validation';
import { getAuthErrorMessage } from '../utils/authErrors';
import theme from '../theme';
import CardMedia from '../components/CardMedia';

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
      if (role === 'admin_sistema') navigation.replace('SystemAdminHome');
      else if (role === 'admin_academia') navigation.replace('AdminAcademiaHome');
      else if (role === 'professor') navigation.replace('ProfessorHome');
      else navigation.replace('AlunoHome');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível alterar a senha.'));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <CardMedia variant="auth" label="SEGURANÇA DA CONTA" />
        <Text style={styles.title}>Trocar Senha</Text>
        <Text style={styles.subtitle}>Defina uma nova senha para concluir seu primeiro acesso</Text>
        <TextInput placeholder={`Nova senha (mínimo ${MIN_PASSWORD_LENGTH})`} secureTextEntry style={[styles.input, senhaInvalida && styles.inputError]} value={password} onChangeText={setPassword} />
        {senhaInvalida && <Text style={styles.errorText}>Senha deve ter no mínimo {MIN_PASSWORD_LENGTH} caracteres</Text>}
        <TextInput placeholder="Confirmar senha" secureTextEntry style={[styles.input, confirmInvalido && styles.inputError]} value={confirm} onChangeText={setConfirm} />
        {confirmInvalido && <Text style={styles.errorText}>Senhas não conferem</Text>}
        <Button title="Salvar" onPress={handleChange} disabled={saveDisabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', backgroundColor: theme.colors.background },
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 16
  },
  title: { fontSize: 20, marginBottom: 8, textAlign: 'center', color: theme.colors.text, fontWeight: '700' },
  subtitle: { fontSize: 13, color: theme.colors.muted, marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 12, backgroundColor: theme.colors.background },
  inputError: { borderColor: '#dc2626' },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 10 }
});
