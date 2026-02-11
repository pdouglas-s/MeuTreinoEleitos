# MeuTreinoEleitos

Scaffold inicial do aplicativo mobile (Expo) com integração mínima ao Firebase (Auth + Firestore).

Como usar

1. Instale dependências:

```bash
npm install
```

2. Configure variáveis de ambiente (não inclua senhas em repositórios públicos):

- `EXPO_PUBLIC_FIREBASE_API_KEY` e demais chaves do Firebase
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `DEFAULT_STUDENT_PASSWORD` (senha padrão para alunos — defina localmente como `Mudar@123` conforme regra de negócio, mas NÃO commite)

Exemplo (Windows PowerShell - temporário para sessão atual):

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
