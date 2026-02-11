# Componentes

Este documento lista os componentes reutilizáveis do projeto e suas responsabilidades.

- `TreinoCard` - cartão que exibe um treino com lista de itens e possibilidade de marcar exercícios como feitos. Recebe `treino` e `onOpen(treino)`.
- `Header` - cabeçalho simples com título, usa `theme` para cores e espaçamento.
- `TreinoDetail` - tela de detalhe do treino, lista itens, permite editar nome e adicionar/remover exercícios.

Considere manter componentes pequenos, sem lógica de rede; serviços em `src/services/*` lidam com Firestore.
