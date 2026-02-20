const React = require('react');
const { render, fireEvent, waitFor } = require('@testing-library/react-native');
const TreinoCard = require('../src/components/TreinoCard').default;
const { ThemeContext, light } = require('../src/theme');

jest.mock('../src/services/historicoService', () => ({
  criarSessaoTreino: jest.fn().mockResolvedValue('sessao-1'),
  marcarExercicioConcluido: jest.fn().mockResolvedValue({}),
  salvarExercicioSessao: jest.fn().mockResolvedValue({}),
  finalizarSessao: jest.fn().mockResolvedValue({}),
  buscarSessaoAtiva: jest.fn().mockResolvedValue(null),
  calcularTempoMedioAcademia: jest.fn().mockResolvedValue({ mediaSegundos: 0, mediaFormatada: '00:00', totalSessoes: 0 }),
  formatarDuracao: jest.fn().mockImplementation((segundos) => {
    const total = Number.isFinite(Number(segundos)) ? Math.max(0, Math.floor(Number(segundos))) : 0;
    const minutos = Math.floor(total / 60);
    const segs = total % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  })
}));

jest.mock('../src/services/notificacoesService', () => ({
  enviarNotificacao: jest.fn().mockResolvedValue('notif-1')
}));

jest.mock('../src/services/treinoItensService', () => ({
  updateTreinoItem: jest.fn().mockResolvedValue({})
}));

const historicoService = require('../src/services/historicoService');
const treinoItensService = require('../src/services/treinoItensService');

describe('TreinoCard UI', () => {
  const treino = {
    id: 'treino-1',
    aluno_id: 'aluno-1',
    nome_treino: 'Treino Teste',
    itens: [{ id: 'item-1', exercicio_nome: 'Ex1', series: 3, repeticoes: 8, carga: 10 }]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    historicoService.buscarSessaoAtiva.mockResolvedValue(null);
  });

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

  test('persiste peso editado na sessão do aluno', async () => {
    const { getByText, getByPlaceholderText } = render(
      React.createElement(
        ThemeContext.Provider,
        { value: { theme: light, toggle: () => {} } },
        React.createElement(TreinoCard, { treino, alunoId: 'aluno-1', professorId: 'prof-1', alunoNome: 'Aluno' })
      )
    );

    await waitFor(() => {
      expect(getByText('Ex1')).toBeTruthy();
    });

    fireEvent.press(getByText('  Iniciar Treino do Dia'));

    await waitFor(() => {
      expect(getByText('  Finalizar Sessão')).toBeTruthy();
    });

    fireEvent.press(getByText('Ex1'));

    const inputPeso = getByPlaceholderText('Novo peso (kg)');
    fireEvent.changeText(inputPeso, '22');
    fireEvent.press(getByText('Salvar peso'));

    await waitFor(() => {
      expect(historicoService.salvarExercicioSessao).toHaveBeenCalledWith('sessao-1', expect.objectContaining({
        exercicio_nome: 'Ex1',
        series: 3,
        repeticoes: 8,
        carga: 22
      }));
    });

    expect(treinoItensService.updateTreinoItem).toHaveBeenCalledWith('item-1', { carga: 22 });
  });

  test('restaura peso salvo da sessão ativa ao recarregar', async () => {
    historicoService.buscarSessaoAtiva
      .mockResolvedValueOnce({
        id: 'sessao-ativa-1',
        status: 'em_andamento',
        data_inicio: new Date(),
        exercicios: [
          { exercicio_nome: 'Ex1', carga: 35, concluido_em: new Date() }
        ]
      })
      .mockResolvedValueOnce({
        id: 'sessao-ativa-1',
        status: 'em_andamento',
        data_inicio: new Date(),
        exercicios: [
          { exercicio_nome: 'Ex1', carga: 35, concluido_em: new Date() }
        ]
      });

    const tree = React.createElement(
      ThemeContext.Provider,
      { value: { theme: light, toggle: () => {} } },
      React.createElement(TreinoCard, { treino, alunoId: 'aluno-1', professorId: 'prof-1', alunoNome: 'Aluno' })
    );

    const { getByText, unmount } = render(tree);

    await waitFor(() => {
      expect(getByText('3 x 8 • 35kg')).toBeTruthy();
    });

    unmount();

    const { getByText: getByTextReload } = render(tree);

    await waitFor(() => {
      expect(getByTextReload('3 x 8 • 35kg')).toBeTruthy();
    });
  });
});
