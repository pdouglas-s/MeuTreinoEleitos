# Guia de Integração Firebase - MeuTreino App

## 1. Criar Projeto no Firebase Console

1. Acesse https://console.firebase.google.com/
2. Clique em **"Adicionar projeto"**
3. Nome do projeto: `meu-treino-eleitos` (ou outro nome)
4. Siga o wizard até criar o projeto

## 2. Criar App Web no Firebase

1. No Firebase Console, vá em **"Visão geral do projeto"**
2. Clique no ícone **Web** (`</>`)
3. Nome do app: `MeuTreino Web` (ou outro)
4. Marque **"Configurar também o Firebase Hosting"** (opcional)
5. Clique em **"Registrar app"**
6. **COPIE as credenciais** que aparecem (você vai precisar delas!)

Exemplo do que você verá:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "meu-treino-eleitos.firebaseapp.com",
  projectId: "meu-treino-eleitos",
  storageBucket: "meu-treino-eleitos.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 3. Ativar Serviços no Firebase

### 3.1 Authentication (Login/Senha)
1. Menu lateral: **Authentication** → **Get Started**
2. Aba **"Sign-in method"**
3. Ative **"Email/Password"** → Salvar

### 3.2 Firestore Database
1. Menu lateral: **Firestore Database** → **Criar banco de dados**
2. Escolha local: `southamerica-east1` (São Paulo) ou outro
3. Modo inicial: **"Modo de produção"** (vamos configurar regras depois)
4. Clique em **"Criar"**

### 3.3 Configurar Regras de Segurança
1. Na aba **"Regras"** do Firestore
2. Cole o conteúdo do arquivo `firestore.rules` do projeto:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Usuários podem ler seu próprio perfil
    match /usuarios/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Treinos: alunos lêem os seus, professores gerenciam
    match /treinos/{treinoId} {
      allow read: if request.auth != null && 
        (resource.data.aluno_uid == request.auth.uid || 
         resource.data.professor_uid == request.auth.uid);
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        resource.data.professor_uid == request.auth.uid;
    }
    
    // Itens de treino
    match /treino_itens/{itemId} {
      allow read, write: if request.auth != null;
    }
    
    // Avaliações
    match /avaliacoes/{avaliacaoId} {
      allow read: if request.auth != null && 
        resource.data.aluno_uid == request.auth.uid;
      allow create, update: if request.auth != null;
    }
  }
}
```

3. Clique em **"Publicar"**

## 4. Configurar Credenciais no Projeto

### Opção A: PowerShell (Desenvolvimento Local - Windows)

1. Abra o PowerShell no diretório do projeto
2. Configure as variáveis de ambiente com suas credenciais:

```powershell
# Substitua pelos valores do Firebase Console
$env:EXPO_PUBLIC_FIREBASE_API_KEY="AIzaSyC..."
$env:EXPO_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abc123"
$env:EXPO_PUBLIC_FIREBASE_PROJECT_ID="meu-treino-eleitos"
$env:EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
$env:EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="meu-treino-eleitos.firebaseapp.com"
$env:DEFAULT_STUDENT_PASSWORD="senha123"
```

3. Inicie o servidor:
```powershell
npx expo start --web
```

### Opção B: Arquivo .env (Persistente)

1. Copie `.env.example` para `.env`:
```powershell
Copy-Item .env.example .env
```

2. Edite `.env` e preencha com suas credenciais:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSyC...
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
EXPO_PUBLIC_FIREBASE_PROJECT_ID=meu-treino-eleitos
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=meu-treino-eleitos.firebaseapp.com
DEFAULT_STUDENT_PASSWORD=senha123
```

3. Inicie o servidor:
```powershell
npm run start
```

## 5. Criar Primeiro Usuário (Professor)

### Via Firebase Console:
1. **Authentication** → **Users** → **Add user**
2. Email: `professor@example.com`
3. Password: `senha123`
4. Clique em **"Add user"**
5. Copie o **UID** do usuário criado

### Criar documento de perfil no Firestore:
1. **Firestore Database** → **Iniciar coleção**
2. ID da coleção: `usuarios`
3. ID do documento: *cole o UID copiado acima*
4. Campos:
   - `email` (string): `professor@example.com`
   - `nome` (string): `Professor Teste`
   - `role` (string): `professor`
   - `primeiro_acesso` (boolean): `false`
5. Salvar

## 6. Testar a Integração

### Opção 1: Script de Verificação (Node.js)
```powershell
node .\scripts\check-firebase.mjs
```

**Sucesso:** verá `Firebase write/read OK:` com dados do documento  
**Erro:** verá mensagem de erro específica

### Opção 2: Abrir o App
1. Acesse http://localhost:19006 no navegador
2. Você deve ver a tela de **Login** (não mais a tela de erro)
3. Faça login com:
   - Email: `professor@example.com`
   - Senha: `senha123`

## 7. Criar Alunos via App

Após login como professor:
1. Preencha o formulário **"Criar Novo Aluno"**
2. Nome e Email do aluno
3. A senha padrão será a que você definiu em `DEFAULT_STUDENT_PASSWORD`
4. No primeiro login, o aluno será forçado a trocar a senha

## 8. Troubleshooting

### Erro: "Firebase not initialized"
- Verifique se as variáveis de ambiente estão definidas
- Reinicie o servidor Expo após configurar as variáveis

### Erro: "auth/invalid-api-key"
- Verifique se copiou a API Key correta do Firebase Console
- Remova espaços em branco das variáveis

### Erro: "permission-denied" no Firestore
- Verifique se publicou as regras de segurança no Firestore
- Confirme que o usuário está autenticado

### Tela em branco no navegador
- Abra o Console do navegador (F12)
- Veja os erros e compare com os acima
- Pressione Ctrl+Shift+R para hard reload

## 9. Próximos Passos

- [ ] Criar mais usuários professores se necessário
- [ ] Configurar índices do Firestore conforme o uso crescer
- [ ] Configurar backup automático do Firestore
- [ ] Configurar regras de Storage se for usar upload de imagens
- [ ] Deploy do app para produção (Firebase Hosting ou EAS Build)

## 10. Recursos Adicionais

- [Documentação Firebase Auth](https://firebase.google.com/docs/auth/web/start)
- [Documentação Firestore](https://firebase.google.com/docs/firestore/quickstart)
- [Regras de Segurança](https://firebase.google.com/docs/firestore/security/get-started)
- [Expo + Firebase](https://docs.expo.dev/guides/using-firebase/)
