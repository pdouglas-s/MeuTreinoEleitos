# MeuTreinoEleitos

Aplicativo mobile (Expo + React Native) com integração Firebase (Auth + Firestore) para gerenciamento de treinos entre professores e alunos.

## 🚀 Início Rápido

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Firebase

**📖 Guia completo:** [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)

Resumo:
1. Crie projeto no [Firebase Console](https://console.firebase.google.com/)
2. Ative Authentication (Email/Password) e Firestore
3. Configure as variáveis de ambiente com suas credenciais

### 3. Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha com suas credenciais do Firebase:

```bash
cp .env.example .env
```

Ou configure temporariamente no PowerShell (Windows):

```powershell
$env:EXPO_PUBLIC_FIREBASE_API_KEY="sua_api_key"
$env:EXPO_PUBLIC_FIREBASE_APP_ID="seu_app_id"
$env:EXPO_PUBLIC_FIREBASE_PROJECT_ID="meu-treino-eleitos"
$env:EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="seu_messaging_sender_id"
$env:DEFAULT_STUDENT_PASSWORD="Mudar@123"
```

Para definir variáveis permanentemente no Windows (PowerShell administrado):

```powershell
[System.Environment]::SetEnvironmentVariable('EXPO_PUBLIC_FIREBASE_API_KEY', 'sua_api_key', 'User')
[System.Environment]::SetEnvironmentVariable('EXPO_PUBLIC_FIREBASE_APP_ID', 'seu_app_id', 'User')
[System.Environment]::SetEnvironmentVariable('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'meu-treino-eleitos', 'User')
[System.Environment]::SetEnvironmentVariable('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'seu_messaging_sender_id', 'User')
[System.Environment]::SetEnvironmentVariable('DEFAULT_STUDENT_PASSWORD', 'Mudar@123', 'User')
```

Depois de definir variáveis de ambiente permanentemente, reinicie o terminal.

Comandos úteis:

```powershell
npm install
npm run start
npm test
```

3. Inicie o projeto:

```bash
npm run start
```

Observações importantes

- Siga o esquema de dados definido em `instructions.md`.
- A implementação aqui é um ponto de partida com telas básicas e serviços; complete a lógica de negócio e regras de segurança do Firestore antes de usar em produção.
