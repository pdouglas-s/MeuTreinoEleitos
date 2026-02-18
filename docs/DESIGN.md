# Guidelines de Design

Tema e tipografia
- Use `src/theme.js` como fonte de verdade para cores, espaçamentos, raios e tamanhos de fonte.

Espaçamento e layout
- Use a função `theme.spacing(n)` para margens e paddings (ex.: `theme.spacing(1)` = 8px).
- Componentes devem ser responsivos e evitar larguras fixas; prefira `flex`.

Acessibilidade
- Botões e interações devem ter `accessibilityLabel` quando necessário e contraste suficiente.

Testes e documentação
- Componentes devem ter testes de snapshot básicos e testes de interação com `@testing-library/react-native`.

UX Writing (confirmações e ações destrutivas)
- Use `Confirmar exclusão` apenas para ações que realmente excluem dados.
- Para ações não destrutivas, use títulos específicos: `Confirmar ocultação`, `Confirmar remoção de associação`, `Confirmar finalização do treino`, `Confirmar criação de vínculo`.
- Mensagens devem ser diretas, preferindo o formato `Deseja realmente ...?`; quando aplicável, finalizar com `Deseja continuar?`.
- O texto do botão de confirmação deve refletir a ação: `Excluir`, `Ocultar`, `Remover associação`, `Finalizar treino`, `Criar vínculo`.
- Em botões visíveis na tela, prefira capitalização em frase (sentence case), por exemplo: `🗑️ Excluir treino` e `Inicializar exercícios padrão`.
