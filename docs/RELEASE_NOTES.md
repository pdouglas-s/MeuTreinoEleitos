# Release Notes

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
