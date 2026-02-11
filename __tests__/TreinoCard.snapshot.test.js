const React = require('react');
const renderer = require('react-test-renderer');
const TreinoCard = require('../src/components/TreinoCard').default;
const { ThemeContext, light } = require('../src/theme');

it('TreinoCard snapshot', () => {
  const treino = { nome_treino: 'Snapshot Treino', itens: [{ exercicio_nome: 'E1', series: 3, repeticoes: 10 }] };
  const tree = renderer.create(
    React.createElement(ThemeContext.Provider, { value: { theme: light, toggle: () => {} } }, React.createElement(TreinoCard, { treino }))
  ).toJSON();
  expect(tree).toMatchSnapshot();
});
