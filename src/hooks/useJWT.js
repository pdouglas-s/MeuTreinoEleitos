import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';

/**
 * Hook para obter o token JWT do Firebase Auth
 * Retorna o token atual e uma função para refresh
 * 
 * Uso:
 * const { token, refreshToken, isValid } = useJWT();
 * 
 * // Usar em headers de requisições:
 * headers: { Authorization: `Bearer ${token}` }
 */
export function useJWT() {
  const { token, refreshToken: authRefreshToken, getValidToken, user } = useAuth();
  const [isValid, setIsValid] = useState(false);
  const [tokenClaims, setTokenClaims] = useState(null);

  useEffect(() => {
    if (token) {
      // Decodificar JWT para verificar validade
      try {
        const payload = parseJWT(token);
        setTokenClaims(payload);
        
        // Verificar se o token ainda é válido (exp é timestamp em segundos)
        const now = Math.floor(Date.now() / 1000);
        setIsValid(payload.exp > now);
      } catch (error) {
        setIsValid(false);
      }
    } else {
      setIsValid(false);
      setTokenClaims(null);
    }
  }, [token]);

  const refreshToken = async () => {
    try {
      const newToken = await authRefreshToken();
      return newToken;
    } catch (error) {
      throw error;
    }
  };

  const getToken = async () => {
    try {
      return await getValidToken();
    } catch (error) {
      throw error;
    }
  };

  return {
    token,
    isValid,
    tokenClaims,
    refreshToken,
    getToken,
    userId: user?.uid,
    email: user?.email
  };
}

// Função auxiliar para decodificar JWT sem verificação de assinatura
function parseJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error('Token JWT inválido');
  }
}

export default useJWT;
