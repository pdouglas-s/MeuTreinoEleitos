const React = require('react');
const renderer = require('react-test-renderer');
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
