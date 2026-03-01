# PR Checklist — 2026-03-01

## Resumo
- Implementado console administrativo Firestore no painel do admin do sistema.
- Implementada lógica de presets de consulta no painel administrativo.
- Expandida gestão de exercícios para fluxo do admin do sistema (vínculo por academia e busca).
- Atualizado detalhe de treino para edição de informações complementares.
- Ajustadas regras do Firestore para criação de exercício não padrão por admin do sistema com academia válida.
- Atualizados snapshots e cobertura de testes para novas funcionalidades.

## O que mudou
- Serviço novo: `src/services/firestoreAdminService.js`
  - Operações: SELECT, INSERT, UPDATE, DELETE
  - Validação de perfil `admin_sistema`
  - Fallback para leitura sem índice quando aplicável
- Tela admin sistema: `src/screens/SystemAdminHome.js`
  - Console Firestore com filtros, ordenação, limite e presets
  - Extração de função pura `resolveFirestoreSelectPreset` para testabilidade
- Tela gestão de exercícios: `src/screens/Professor/GerenciarExercicios.js`
  - Busca por nome/categoria
  - Criação e edição de exercícios não padrão com academia selecionável para admin do sistema
- Tela detalhe treino: `src/screens/TreinoDetail.js`
  - Campo `info_complementar` com persistência no update
- Segurança: `firestore.rules`
  - Permissão para admin do sistema criar exercício não padrão com `academia_id` válido

## Testes
- Execução completa:
  - Comando: `npx jest --runInBand`
  - Resultado: 12 suites passed, 51 tests passed, 2 snapshots passed
- Novos testes adicionados:
  - `__tests__/firestoreAdminService.test.js`
  - `__tests__/SystemAdminHome.firestorePresets.test.js`
- Snapshot atualizado:
  - `__tests__/TreinoCard.snapshot.test.js`

## Checklist de validação
- [x] Build/Test local passando
- [x] Regras de permissão ajustadas conforme escopo
- [x] Fluxos novos cobertos por teste automatizado
- [x] Snapshot atualizado e validado
- [x] Documentação atualizada

## Documentação atualizada
- `docs/FUNCIONALIDADES.md`
- `docs/RELEASE_NOTES.md`

## Riscos/atenção
- Operações no console Firestore são destrutivas em UPDATE/DELETE; uso restrito a `admin_sistema`.
- Requer deploy de `firestore.rules` para refletir permissões em produção.

## Pós-merge recomendado
- Executar deploy das regras do Firestore.
- Validar fluxo manual de console Firestore em ambiente de homologação com usuário `admin_sistema`.
