# Componentes

Este documento lista os componentes reutilizáveis do projeto e suas responsabilidades.

- `TreinoCard` - cartão que exibe um treino com lista de itens e possibilidade de marcar exercícios como feitos. Recebe `treino` e `onOpen(treino)`.
- `Header` - cabeçalho simples com título, usa `theme` para cores e espaçamento.
- `TreinoDetail` - tela de detalhe do treino, lista itens, permite editar nome e adicionar/remover exercícios.

Considere manter componentes pequenos, sem lógica de rede; serviços em `src/services/*` lidam com Firestore.

## Convenção de textos (confirmações e ações destrutivas)

Para manter consistência de UX, siga este padrão em telas e componentes:

- **Título do modal (`Alert.confirm`)**
	- Use `Confirmar exclusão` apenas quando a ação realmente exclui.
	- Para outras ações, use título específico: `Confirmar ocultação`, `Confirmar remoção de associação`, `Confirmar finalização do treino`, `Confirmar criação de vínculo`.
- **Mensagem do modal**
	- Preferir formato direto com verbo de ação: `Deseja realmente ...?`
	- Quando aplicável, encerrar com `Deseja continuar?`.
- **Rótulo do botão de confirmação**
	- Usar texto específico da ação: `Excluir`, `Ocultar`, `Remover associação`, `Finalizar treino`, `Criar vínculo`.
- **Rótulos visuais de botão**
	- Preferir capitalização em frase (sentence case), por exemplo: `🗑️ Excluir treino`, `Inicializar exercícios padrão`.

Essa convenção vale para novas telas e para ajustes em telas existentes.
