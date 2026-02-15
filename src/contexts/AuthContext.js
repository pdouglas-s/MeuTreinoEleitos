import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth } from '../firebase/config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

const AuthContext = createContext({});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getProfileWithRetry(uid, maxAttempts = 5, delayMs = 250) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const profileDoc = await getDoc(doc(db, 'users', uid));
    if (profileDoc.exists()) {
      return profileDoc.data();
    }
    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Monitorar mudanças de autenticação
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Usuário autenticado
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          setUser(firebaseUser);
          
          // Salvar token no AsyncStorage
          await AsyncStorage.setItem('userToken', idToken);
          await AsyncStorage.setItem('userId', firebaseUser.uid);
          
          // Buscar perfil do Firestore (com retry para evitar condição de corrida pós-cadastro)
          const profileData = await getProfileWithRetry(firebaseUser.uid);
          if (profileData) {
            setProfile(profileData);
            await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
          } else {
            setProfile(null);
            await AsyncStorage.removeItem('userProfile');
          }
        } else {
          // Usuário deslogado
          setUser(null);
          setProfile(null);
          setToken(null);
          await AsyncStorage.multiRemove(['userToken', 'userId', 'userProfile']);
        }
      } catch (error) {
        console.error('Erro no onAuthStateChanged:', error);
      } finally {
        setLoading(false);
      }
    });

    // Limpar listener ao desmontar
    return () => unsubscribe();
  }, []);

  // Função para refresh manual do token
  const refreshToken = async () => {
    if (auth.currentUser) {
      try {
        const newToken = await auth.currentUser.getIdToken(true); // força refresh
        setToken(newToken);
        await AsyncStorage.setItem('userToken', newToken);
        return newToken;
      } catch (error) {
        console.error('Erro ao refresh token:', error);
        throw error;
      }
    }
    return null;
  };

  // Função para obter token válido (com auto-refresh se expirado)
  const getValidToken = async () => {
    if (auth.currentUser) {
      try {
        const tokenResult = await auth.currentUser.getIdTokenResult();
        const expirationTime = new Date(tokenResult.expirationTime).getTime();
        const now = Date.now();
        
        // Se token expira em menos de 5 minutos, fazer refresh
        if (expirationTime - now < 5 * 60 * 1000) {
          return await refreshToken();
        }
        
        return tokenResult.token;
      } catch (error) {
        console.error('Erro ao obter token válido:', error);
        throw error;
      }
    }
    return null;
  };

  // Função de logout
  const logout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged automaticamente limpará o estado
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  };

  const value = {
    user,
    profile,
    loading,
    token,
    isAuthenticated: !!user,
    isProfessor: profile?.role === 'professor',
    isAluno: profile?.role === 'aluno',
    refreshToken,
    getValidToken,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

export default AuthContext;
