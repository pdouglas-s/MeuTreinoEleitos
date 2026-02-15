# Sistema de Autenticação JWT com Firebase

Este projeto implementa autenticação completa com JWT (JSON Web Token) do Firebase Authentication, incluindo persistência de sessão e refresh automático de tokens.

## 🔐 Funcionalidades

- ✅ **Autenticação JWT** via Firebase Authentication
- ✅ **Persistência de sessão** com AsyncStorage
- ✅ **Refresh automático** de tokens expirados
- ✅ **Contexto global** de autenticação
- ✅ **Hook customizado** para acessar tokens
- ✅ **Navegação automática** baseada em autenticação

## 📦 Instalação

```bash
# Instalar nova dependência
npm install

# ou
npx expo install @react-native-async-storage/async-storage
```

## 🎯 Uso

### 1. Hook useAuth (Contexto de Autenticação)

```javascript
import { useAuth } from './src/contexts/AuthContext';

function MeuComponente() {
  const { 
    user,           // Objeto Firebase User
    profile,        // Perfil do Firestore (role, nome, etc)
    loading,        // Estado de carregamento
    isAuthenticated,// Boolean se está autenticado
    isProfessor,    // Boolean se é professor
    isAluno,        // Boolean se é aluno
    token,          // Token JWT atual
    refreshToken,   // Função para refresh manual
    getValidToken   // Função que retorna token válido (faz refresh se necessário)
  } = useAuth();

  return (
    <View>
      {isAuthenticated ? (
        <Text>Bem-vindo, {profile?.nome}!</Text>
      ) : (
        <Text>Faça login</Text>
      )}
    </View>
  );
}
```

### 2. Hook useJWT (Token JWT)

```javascript
import useJWT from './src/hooks/useJWT';

function FazerRequisicao() {
  const { token, isValid, getToken } = useJWT();

  async function buscarDados() {
    // Opção 1: Usar token atual
    const response = await fetch('https://api.exemplo.com/dados', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Opção 2: Garantir token válido (recomendado)
    const validToken = await getToken();
    const response2 = await fetch('https://api.exemplo.com/dados', {
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  return (
    <View>
      <Text>Token válido: {isValid ? 'Sim' : 'Não'}</Text>
      <Button title="Buscar Dados" onPress={buscarDados} />
    </View>
  );
}
```

### 3. Acesso direto ao token (qualquer lugar)

```javascript
import { auth } from './src/firebase/config';

async function minhaFuncao() {
  if (auth.currentUser) {
    // Obter token atual
    const token = await auth.currentUser.getIdToken();
    
    // Forçar refresh do token
    const freshToken = await auth.currentUser.getIdToken(true);
    
    // Obter informações do token (claims)
    const tokenResult = await auth.currentUser.getIdTokenResult();
    console.log('Token expira em:', tokenResult.expirationTime);
    console.log('Claims:', tokenResult.claims);
  }
}
```

## 🔄 Fluxo de Autenticação

1. **Login**
   - Usuário faz login via `LoginScreen`
   - Firebase Authentication gera token JWT
   - Token salvo no AsyncStorage
   - `onAuthStateChanged` detecta mudança
   - Perfil carregado do Firestore
   - Navegação automátic para tela correta

2. **Persistência**
   - Token salvo no AsyncStorage
   - Firebase configura persistência local
   - Ao reabrir app, sessão é restaurada automaticamente

3. **Refresh Automático**
   - `getValidToken()` verifica expiração
   - Se expira em < 5 minutos, faz refresh
   - Token atualizado automaticamente

4. **Logout**
   - `auth.signOut()` remove sessão
   - `onAuthStateChanged` detecta mudança
   - AsyncStorage limpo
   - Navegação para Login

## 📋 Estrutura JWT do Firebase

O token JWT do Firebase contém:

```json
{
  "iss": "https://securetoken.google.com/meu-treino-eleitos",
  "aud": "meu-treino-eleitos",
  "auth_time": 1234567890,
  "user_id": "abc123...",
  "sub": "abc123...",
  "iat": 1234567890,
  "exp": 1234571490,
  "email": "usuario@exemplo.com",
  "email_verified": false,
  "firebase": {
    "identities": {
      "email": ["usuario@exemplo.com"]
    },
    "sign_in_provider": "password"
  }
}
```

## 🔐 Validação no Backend

Se você tiver um backend, valide o token assim:

### Node.js / Express

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Usar em rotas protegidas
app.get('/api/dados', verificarToken, (req, res) => {
  res.json({ userId: req.user.uid });
});
```

## 🛡️ Segurança

- ✅ Tokens expiram em 1 hora
- ✅ Refresh automático antes da expiração
- ✅ Tokens nunca enviados em URLs
- ✅ AsyncStorage criptografado nativamente
- ✅ Persistência usa localStorage seguro no web
- ✅ HTTPS obrigatório em produção

## 🐛 Debug

Para debug tokens:

```javascript
import useJWT from './src/hooks/useJWT';

function DebugToken() {
  const { token, tokenClaims, isValid } = useJWT();

  console.log('Token JWT:', token);
  console.log('Claims:', tokenClaims);
  console.log('Válido:', isValid);
  console.log('Expira em:', new Date(tokenClaims?.exp * 1000));

  return null;
}
```

## 📱 Compatibilidade

- ✅ Expo Web (localStorage)
- ✅ iOS (AsyncStorage)
- ✅ Android (AsyncStorage)

## 🔗 Referências

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [JWT.io](https://jwt.io/) - Decodificador de JWT
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
