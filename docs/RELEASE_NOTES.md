# Release Notes

## 2026-03-01 — Branch atual

### Resumo
Entrega de melhorias para administração do sistema e banco de exercícios, incluindo console Firestore no painel de `admin_sistema`, evolução da gestão de exercícios por academia e atualização do detalhe de treino.

### Principais mudanças
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

### Qualidade
- Snapshot do `TreinoCard` atualizado para refletir o estado atual do componente.
- Novos testes adicionados:
	- `__tests__/firestoreAdminService.test.js`
	- `__tests__/SystemAdminHome.firestorePresets.test.js`

## 2026-02-18 — `60d9c87`

### Resumo
Correção do fluxo de ocultação de exercício padrão por academia, com ajuste de regras Firestore e melhoria de UX na gestão de exercícios.

### Principais mudanças
- Correção de permissões em `firestore.rules` para permitir ocultação de exercício padrão por staff da academia (somente alteração de `oculto_para_academias`).
- Ajustes em `src/services/exerciciosService.js` para reforçar persistência da ocultação e tratamento de falhas.
- Ajustes em `src/screens/Professor/GerenciarExercicios.js` para feedback imediato e melhor diagnóstico de erro no fluxo de ocultação.
- Inclusão de ação explícita de editar para exercícios criados pela academia (além da exclusão).

### Arquivos de destaque
- Regras/segurança: `firestore.rules`
- Serviço: `src/services/exerciciosService.js`
- Tela: `src/screens/Professor/GerenciarExercicios.js`

## 2026-02-18 — `0614a9f`

### Resumo
Melhorias de regras/permissões, UX de navegação e padronização de mensagens/confirmações, com ajustes na gestão de exercícios padrão por academia.

### Principais mudanças
- Permissões Firestore refinadas para cenários de academia e sistema, incluindo ajustes em `exercicios`.
- Fluxo de exercícios padrão atualizado para suportar personalização por academia sem impacto global indevido.
- Padronização de textos de sucesso/erro/confirmação e rótulos de ações destrutivas.
- Correções de UX em navegação/interações (incluindo mitigação de warnings no fluxo web).
- Exibição de séries/repetições em listagens de exercícios com renderização condicional (sem `null`).
- Inclusão de template de PR com checklist de qualidade e UX writing.

### Arquivos de destaque
- Regras/segurança: `firestore.rules`
- Gestão de exercícios: `src/screens/Professor/GerenciarExercicios.js`, `src/services/exerciciosService.js`
- Detalhe de treino: `src/screens/TreinoDetail.js`
- Componentes: `src/components/TreinoCard.js`, `src/components/ErrorBoundary.js`
- Documentação: `README.md`, `docs/COMPONENTS.md`, `docs/DESIGN.md`, `.github/pull_request_template.md`

### Qualidade
- Testes executados com sucesso: 10 suites, 41 testes, 2 snapshots.
