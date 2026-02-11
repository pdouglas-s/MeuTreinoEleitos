import React, { useState, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ThemeContext, light, dark } from './src/theme';

const Stack = createNativeStackNavigator();

// Verifica se as variáveis Firebase essenciais estão configuradas
const isFirebaseConfigured = () => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
    return !!(apiKey || appId);
  } catch (e) {
    console.error('Error checking Firebase config:', e);
    return false;
  }
};

// Tela de erro quando Firebase não está configurado
function ConfigError() {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>⚠️ Firebase não configurado</Text>
      <Text style={styles.errorText}>Configure as variáveis de ambiente:</Text>
      <Text style={styles.code}>EXPO_PUBLIC_FIREBASE_API_KEY</Text>
      <Text style={styles.code}>EXPO_PUBLIC_FIREBASE_APP_ID</Text>
      <Text style={styles.code}>EXPO_PUBLIC_FIREBASE_PROJECT_ID</Text>
      <Text style={styles.errorText}>PowerShell:</Text>
      <Text style={styles.code}>$env:EXPO_PUBLIC_FIREBASE_API_KEY="sua_chave"</Text>
      <Text style={styles.errorText}>Depois reinicie: npx expo start --web</Text>
    </View>
  );
}

// Loading enquanto carrega telas
function Loading() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#1976d2" />
      <Text style={styles.loadingText}>Carregando...</Text>
    </View>
  );
}

export default function App() {
  const [theme, setTheme] = useState(light);
  function toggle() { setTheme((t) => (t === light ? dark : light)); }

  const configured = isFirebaseConfigured();
  console.log('App rendering, Firebase configured:', configured);

  // Se Firebase não está configurado, mostra tela de erro SEM carregar as outras telas
  if (!configured) {
    return <ConfigError />;
  }

  // Somente carrega as telas quando Firebase estiver configurado
  const LoginScreen = lazy(() => import('./src/screens/LoginScreen'));
  const ProfessorHome = lazy(() => import('./src/screens/Professor/ProfessorHome'));
  const AlunoHome = lazy(() => import('./src/screens/Aluno/AlunoHome'));
  const TreinoDetail = lazy(() => import('./src/screens/TreinoDetail'));
  const ChangePassword = lazy(() => import('./src/screens/ChangePassword'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <Suspense fallback={<Loading />}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
            <Stack.Screen name="ProfessorHome" component={ProfessorHome} options={{ title: 'Professor' }} />
            <Stack.Screen name="AlunoHome" component={AlunoHome} options={{ title: 'Aluno' }} />
            <Stack.Screen name="TreinoDetail" component={TreinoDetail} options={{ title: 'Treino' }} />
            <Stack.Screen name="ChangePassword" component={ChangePassword} options={{ title: 'Trocar Senha' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </Suspense>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 24,
    textAlign: 'center'
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center'
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    backgroundColor: '#f5f5f5',
    padding: 8,
    marginVertical: 4,
    borderRadius: 4,
    color: '#1976d2'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  }
});
