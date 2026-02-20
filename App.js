import React, { useEffect, useState, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeContext, light, dark } from './src/theme';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import Constants from 'expo-constants';

const Stack = Platform.OS === 'web'
  ? require('@react-navigation/stack').createStackNavigator()
  : require('@react-navigation/native-stack').createNativeStackNavigator();

function readPublicEnv(name) {
  const extraValue = Constants.expoConfig?.extra?.[name];
  const envValue = typeof process !== 'undefined' && process?.env ? process.env[name] : undefined;
  return extraValue || envValue || '';
}

// Verifica se as variáveis Firebase essenciais estão configuradas
const isFirebaseConfigured = () => {
  try {
    const apiKey = readPublicEnv('EXPO_PUBLIC_FIREBASE_API_KEY');
    const appId = readPublicEnv('EXPO_PUBLIC_FIREBASE_APP_ID');
    return !!(apiKey && appId);
  } catch (e) {
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

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const originalWarn = console.warn;
    const originalError = console.error;
    const ignored = [
      'setNativeProps is deprecated',
      "Trying to remove a child that doesn't exist",
      'useNativeDriver` is not supported because the native animated module is missing'
    ];

    const shouldIgnore = (args = []) => {
      const joined = args.map((item) => String(item || '')).join(' ');
      return ignored.some((snippet) => joined.includes(snippet));
    };

    console.warn = (...args) => {
      if (shouldIgnore(args)) return;
      originalWarn(...args);
    };

    console.error = (...args) => {
      if (shouldIgnore(args)) return;
      originalError(...args);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  const configured = isFirebaseConfigured();

  // Se Firebase não está configurado, mostra tela de erro SEM carregar as outras telas
  if (!configured) {
    return <ConfigError />;
  }

  return (
    <AuthProvider>
      <ThemeContext.Provider value={{ theme, toggle }}>
        <AppNavigator />
      </ThemeContext.Provider>
    </AuthProvider>
  );
}

// Componente de navegação que usa o contexto de autenticação
function AppNavigator() {
  const { loading, isAuthenticated, profile } = useAuth();
  const webScreenOptions = Platform.OS === 'web'
    ? {
        animationEnabled: false,
        animation: 'none',
        gestureEnabled: false
      }
    : {};

  // Somente carrega as telas quando Firebase estiver configurado
  const LoginScreen = lazy(() => import('./src/screens/LoginScreen'));
  const RegisterScreen = lazy(() => import('./src/screens/RegisterScreen'));
  const ProfessorHome = lazy(() => import('./src/screens/Professor/ProfessorHome'));
  const AdminAcademiaHome = lazy(() => import('./src/screens/AdminAcademiaHome'));
  const SystemAdminHome = lazy(() => import('./src/screens/SystemAdminHome'));
  const AlunoHome = lazy(() => import('./src/screens/Aluno/AlunoHome'));
  const TreinoDetail = lazy(() => import('./src/screens/TreinoDetail'));
  const ChangePassword = lazy(() => import('./src/screens/ChangePassword'));
  const GerenciarExercicios = lazy(() => import('./src/screens/Professor/GerenciarExercicios'));
  const NotificacoesScreen = lazy(() => import('./src/screens/Professor/NotificacoesScreen'));
  const AlunosListScreen = lazy(() => import('./src/screens/Professor/AlunosListScreen'));
  const ProfessoresListScreen = lazy(() => import('./src/screens/Professor/ProfessoresListScreen'));
  const TreinosListScreen = lazy(() => import('./src/screens/Professor/TreinosListScreen'));
  const RelatorioEsforcoScreen = lazy(() => import('./src/screens/Professor/RelatorioEsforcoScreen'));

  if (loading) {
    return <Loading />;
  }

  // Determinar tela inicial baseada no estado de autenticação
  let initialRoute = 'Login';
  if (isAuthenticated && profile) {
    if (profile.primeiro_acesso) {
      initialRoute = 'ChangePassword';
    } else if (profile.role === 'admin_sistema') {
      initialRoute = 'SystemAdminHome';
    } else if (profile.role === 'admin_academia') {
      initialRoute = 'AdminAcademiaHome';
    } else if (profile.role === 'professor') {
      initialRoute = 'ProfessorHome';
    } else {
      initialRoute = 'AlunoHome';
    }
  }

  return (
    <Suspense fallback={<Loading />}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={webScreenOptions}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Criar Conta' }} />
          <Stack.Screen name="SystemAdminHome" component={SystemAdminHome} options={{ title: 'Sistema' }} />
          <Stack.Screen name="AdminAcademiaHome" component={AdminAcademiaHome} options={{ title: 'Academia' }} />
          <Stack.Screen name="ProfessorHome" component={ProfessorHome} options={{ title: 'Professor' }} />
          <Stack.Screen name="AlunoHome" component={AlunoHome} options={{ title: 'Aluno' }} />
          <Stack.Screen name="TreinoDetail" component={TreinoDetail} options={{ title: 'Treino' }} />
          <Stack.Screen name="ChangePassword" component={ChangePassword} options={{ title: 'Trocar Senha' }} />
          <Stack.Screen
            name="GerenciarExercicios"
            component={GerenciarExercicios}
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen name="Notificacoes" component={NotificacoesScreen} options={{ title: 'Notificações' }} />
          <Stack.Screen
            name="AlunosList"
            component={AlunosListScreen}
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen
            name="ProfessoresList"
            component={ProfessoresListScreen}
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen
            name="TreinosList"
            component={TreinosListScreen}
            options={{
              headerShown: false
            }}
          />
          <Stack.Screen name="RelatorioEsforco" component={RelatorioEsforcoScreen} options={{ title: 'Relatório de Esforço' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </Suspense>
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
