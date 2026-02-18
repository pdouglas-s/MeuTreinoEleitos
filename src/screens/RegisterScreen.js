import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import { signOut } from 'firebase/auth';
import { hasSystemAdmin, registerUser } from '../services/userService';
import { Alert } from '../utils/alert';
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from '../utils/validation';
import { getAuthErrorMessage } from '../utils/authErrors';
import { auth } from '../firebase/config';
import theme from '../theme';
import CardMedia from '../components/CardMedia';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cadastroPublicoAtivo, setCadastroPublicoAtivo] = useState(true);
  const [checking, setChecking] = useState(true);
  const emailInvalido = email.trim().length > 0 && !isValidEmail(email);
  const senhaInvalida = password.length > 0 && !isValidPassword(password);
  const registerDisabled = !nome.trim() || !email.trim() || !password || emailInvalido || senhaInvalida || !cadastroPublicoAtivo || checking;

  useEffect(() => {
    async function checkPublicRegister() {
      try {
        const exists = await hasSystemAdmin();
        setCadastroPublicoAtivo(!exists);
        if (exists) {
          Alert.alert('Cadastro desabilitado', 'O cadastro público está disponível apenas até o primeiro admin do sistema.');
        }
      } catch (error) {
        console.warn('Erro ao verificar cadastro público:', error?.message || error);
      } finally {
        setChecking(false);
      }
    }
    checkPublicRegister();
  }, []);

  async function handleRegister() {
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
      await registerUser({ email, password, nome, role: 'admin_sistema' });

      const mensagem = 'Conta de Admin do Sistema criada! Faça login.';
      
      Alert.alert('Sucesso', mensagem);
      await signOut(auth).catch(() => {});
      // Navegar para Login após pequeno delay
      setTimeout(() => {
        navigation.navigate('Login');
      }, 100);
    } catch (err) {
      console.error('Error in handleRegister:', err);
      Alert.alert('Erro ao criar conta', getAuthErrorMessage(err, 'Não foi possível criar a conta.'));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <CardMedia variant="sistema" label="CADASTRO INICIAL" />
        <Text style={styles.title}>Criar Conta</Text>
        <Text style={styles.subtitle}>Preencha os dados para começar</Text>

        <TextInput
          placeholder="Nome completo"
          style={styles.input}
          value={nome}
          onChangeText={setNome}
        />

        <Text style={styles.sectionLabel}>Tipo de usuário: Admin do Sistema</Text>

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

        <View style={{ height: 14 }} />
        <Button
          title="Já tenho conta"
          onPress={() => navigation.navigate('Login')}
          color={theme.colors.muted}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: theme.colors.background
  },
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 16
  },
  title: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
    color: theme.colors.text
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: theme.colors.muted
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    backgroundColor: theme.colors.background,
  },
  sectionLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10
  },
  helperText: {
    color: theme.colors.muted,
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
