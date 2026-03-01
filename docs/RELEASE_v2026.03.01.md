## Resumo
Entrega de melhorias para administração do sistema e banco de exercícios, incluindo console Firestore no painel de `admin_sistema`, evolução da gestão de exercícios por academia e atualização do detalhe de treino.

## Principais mudanças
- Novo serviço `src/services/firestoreAdminService.js` com operações administrativas `SELECT`, `INSERT`, `UPDATE` e `DELETE` protegidas por checagem de perfil `admin_sistema`.
- Novo bloco de console Firestore em `src/screens/SystemAdminHome.js`, com:
  - consulta por documento ou lista,
  - filtros, ordenação e limite,
  - presets rápidos,
  - payload JSON para escrita,
  - confirmação para `DELETE`.
- Evolução de `src/screens/Professor/GerenciarExercicios.js`:
  - busca textual de exercícios,
  - criação de exercícios por `admin_sistema` vinculando academia,
  - edição de exercícios não padrão com seleção de academia.
- Atualização de `src/screens/TreinoDetail.js` para edição de `info_complementar`.
- Ajuste de permissões em `firestore.rules` para criação de exercícios não padrão por `admin_sistema` com `academia_id` válido.

## Qualidade
- Testes automatizados: **12 suites, 51 testes e 2 snapshots (100% pass)**.
- Snapshot do `TreinoCard` atualizado para refletir o estado atual do componente.
- Novos testes adicionados:
  - `__tests__/firestoreAdminService.test.js`
  - `__tests__/SystemAdminHome.firestorePresets.test.js`

## Segurança e operação
- Operações no console Firestore são destrutivas em `UPDATE`/`DELETE`; uso restrito a `admin_sistema`.
- Necessário deploy de `firestore.rules` para refletir permissões em produção.
