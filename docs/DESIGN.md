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
