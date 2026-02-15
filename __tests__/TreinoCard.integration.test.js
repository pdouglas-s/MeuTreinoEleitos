const React = require('react');
const { render, fireEvent, waitFor } = require('@testing-library/react-native');
const TreinoCard = require('../src/components/TreinoCard').default;
const { ThemeContext, light } = require('../src/theme');

jest.mock('../src/services/historicoService', () => ({
  criarSessaoTreino: jest.fn().mockResolvedValue('sessao-1'),
  marcarExercicioConcluido: jest.fn().mockResolvedValue({}),
  finalizarSessao: jest.fn().mockResolvedValue({}),
  buscarSessaoAtiva: jest.fn().mockResolvedValue(null)
}));

jest.mock('../src/services/notificacoesService', () => ({
  enviarNotificacao: jest.fn().mockResolvedValue('notif-1')
}));

describe('TreinoCard UI', () => {
  const treino = { nome_treino: 'Treino Teste', itens: [{ exercicio_nome: 'Ex1', series: 3, repeticoes: 8, carga: 10 }] };

  test('marca exercício como feito ao tocar no checkbox', async () => {
    const { getByTestId } = render(
      React.createElement(
        ThemeContext.Provider,
        { value: { theme: light, toggle: () => {} } },
        React.createElement(TreinoCard, { treino, alunoId: 'aluno-1', professorId: 'prof-1', alunoNome: 'Aluno' })
      )
    );

    await waitFor(() => {
      expect(getByTestId('checkbox-0')).toBeTruthy();
    });

    const checkbox = getByTestId('checkbox-0');
    fireEvent.press(checkbox);
    expect(checkbox).toBeTruthy();
  });

  test('permite editar apenas o peso ao tocar no exercício', async () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(
      React.createElement(
        ThemeContext.Provider,
        { value: { theme: light, toggle: () => {} } },
        React.createElement(TreinoCard, { treino, alunoId: 'aluno-1', professorId: 'prof-1', alunoNome: 'Aluno' })
      )
    );

    await waitFor(() => {
      expect(getByText('Ex1')).toBeTruthy();
    });

    fireEvent.press(getByText('Ex1'));

    const inputPeso = getByPlaceholderText('Novo peso (kg)');
    fireEvent.changeText(inputPeso, '22');
    fireEvent.press(getByText('Salvar peso'));

    await waitFor(() => {
      expect(getByText('3 x 8 • 22kg')).toBeTruthy();
    });

    expect(queryByPlaceholderText('Novo peso (kg)')).toBeNull();
  });
});
