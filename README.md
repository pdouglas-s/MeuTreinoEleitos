# MeuTreinoEleitos

Scaffold inicial do aplicativo mobile (Expo) com integração mínima ao Firebase (Auth + Firestore).

Como usar

1. Instale dependências:

```bash
npm install
```

2. Configure variáveis de ambiente (não inclua senhas em repositórios públicos):

- `EXPO_PUBLIC_FIREBASE_API_KEY` e demais chaves do Firebase
- `DEFAULT_STUDENT_PASSWORD` (senha padrão para alunos — defina localmente como `Mudar@123` conforme regra de negócio, mas NÃO commite)

Exemplo (Windows PowerShell):

```powershell
$env:EXPO_PUBLIC_FIREBASE_API_KEY="sua_api_key"
$env:DEFAULT_STUDENT_PASSWORD="Mudar@123"
```

3. Inicie o projeto:

```bash
npm run start
```

Observações importantes

- Siga o esquema de dados definido em `instructions.md`.
- A implementação aqui é um ponto de partida com telas básicas e serviços; complete a lógica de negócio e regras de segurança do Firestore antes de usar em produção.
