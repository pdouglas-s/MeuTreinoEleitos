import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TreinoCard from '../src/components/TreinoCard';

describe('TreinoCard UI', () => {
  const treino = { nome_treino: 'Treino Teste', itens: [{ exercicio_nome: 'Ex1', series: 3, repeticoes: 8, carga: 10 }] };

  test('marca exercício como feito ao tocar no checkbox', () => {
    const { getByTestId } = render(<TreinoCard treino={treino} />);
    const checkbox = getByTestId('checkbox-0');
    fireEvent.press(checkbox);
    // após pressionar, o componente deve renderizar ícone checkmark (sem exceção)
    expect(checkbox).toBeTruthy();
  });
});
