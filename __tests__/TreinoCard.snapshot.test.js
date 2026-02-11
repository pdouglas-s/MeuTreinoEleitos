import React from 'react';
import renderer from 'react-test-renderer';
import TreinoCard from '../src/components/TreinoCard';

it('TreinoCard snapshot', () => {
  const treino = { nome_treino: 'Snapshot Treino', itens: [{ exercicio_nome: 'E1', series: 3, repeticoes: 10 }] };
  const tree = renderer.create(<TreinoCard treino={treino} />).toJSON();
  expect(tree).toMatchSnapshot();
});
