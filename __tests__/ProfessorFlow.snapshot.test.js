jest.mock('../src/firebase/config', () => ({ auth: { currentUser: { uid: 'p1' } }, db: {} }));
jest.mock('../src/services/treinoService', () => ({
  listTreinosByProfessor: jest.fn().mockResolvedValue([{ id: 't1', nome_treino: 'Prof Treino' }]),
  createTreino: jest.fn().mockResolvedValue({ id: 't2' })
}));
jest.mock('../src/services/treinoItensService', () => ({ addItemToTreino: jest.fn().mockResolvedValue({ id: 'i1' }) }));
jest.mock('../src/services/userService', () => ({ createAluno: jest.fn().mockResolvedValue({ uid: 'a1' }) }));

// Avoid running effects that perform async updates during snapshot render in this test.
const React = require('react');
const origUseEffect = React.useEffect;
React.useEffect = () => {};
const renderer = require('react-test-renderer');
const ProfessorHome = require('../src/screens/Professor/ProfessorHome').default;
const { ThemeContext, light } = require('../src/theme');

it('ProfessorHome render snapshot (flow básico)', () => {
  const tree = renderer.create(
    React.createElement(ThemeContext.Provider, { value: { theme: light, toggle: () => {} } }, React.createElement(ProfessorHome))
  );
  expect(tree.toJSON()).toMatchSnapshot();
  // restore
  React.useEffect = origUseEffect;
});
