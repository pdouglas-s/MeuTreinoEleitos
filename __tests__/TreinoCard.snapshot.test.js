const React = require('react');
const renderer = require('react-test-renderer');
const TreinoCard = require('../src/components/TreinoCard').default;
const { ThemeContext, light } = require('../src/theme');

jest.mock('../src/services/historicoService', () => ({
  criarSessaoTreino: jest.fn().mockResolvedValue('sessao-1'),
  marcarExercicioConcluido: jest.fn().mockResolvedValue({}),
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

it('TreinoCard snapshot', async () => {
  const treino = { nome_treino: 'Snapshot Treino', itens: [{ exercicio_nome: 'E1', series: 3, repeticoes: 10 }] };
  let component;
  await renderer.act(async () => {
    component = renderer.create(
      React.createElement(
        ThemeContext.Provider,
        { value: { theme: light, toggle: () => {} } },
        React.createElement(TreinoCard, { treino, alunoId: 'aluno-1', professorId: 'prof-1', alunoNome: 'Aluno' })
      )
    );
    await Promise.resolve();
  });

  const tree = component.toJSON();
  expect(tree).toMatchSnapshot();
});
