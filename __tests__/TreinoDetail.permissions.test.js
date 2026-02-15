const React = require('react');
const { render, waitFor } = require('@testing-library/react-native');
const TreinoDetail = require('../src/screens/TreinoDetail').default;

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../src/services/treinoItensService', () => ({
  listItensByTreino: jest.fn(),
  addItemToTreino: jest.fn(),
  deleteItem: jest.fn()
}));

jest.mock('../src/services/treinoService', () => ({
  updateTreino: jest.fn(),
  deleteTreino: jest.fn()
}));

jest.mock('../src/services/exerciciosService', () => ({
  searchExerciciosByNome: jest.fn(),
  listAllExercicios: jest.fn()
}));

jest.mock('../src/services/userService', () => ({
  listAllAlunos: jest.fn()
}));

jest.mock('../src/firebase/config', () => ({
  auth: { currentUser: { uid: 'aluno-1' } }
}));

describe('TreinoDetail permissions', () => {
  const { useAuth } = require('../src/contexts/AuthContext');
  const { listItensByTreino } = require('../src/services/treinoItensService');
  const { listAllExercicios } = require('../src/services/exerciciosService');
  const { listAllAlunos } = require('../src/services/userService');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('aluno não visualiza ações de edição do treino', async () => {
    useAuth.mockReturnValue({
      profile: { role: 'aluno', nome: 'Aluno Teste' }
    });

    listItensByTreino.mockResolvedValue([
      { id: 'item-1', exercicio_nome: 'Agachamento', series: 3, repeticoes: 10, carga: 20 }
    ]);
    listAllExercicios.mockResolvedValue([]);
    listAllAlunos.mockResolvedValue([]);

    const navigation = { setOptions: jest.fn(), goBack: jest.fn() };
    const route = {
      params: {
        treino: { id: 'treino-1', nome_treino: 'Treino A', aluno_id: 'aluno-1', professor_id: 'prof-1' }
      }
    };

    const { queryByText, getByText } = render(
      React.createElement(TreinoDetail, { route, navigation })
    );

    await waitFor(() => {
      expect(getByText('Agachamento')).toBeTruthy();
    });

    expect(queryByText('Adicionar exercício')).toBeNull();
    expect(queryByText('Editar treino')).toBeNull();
    expect(queryByText('Associar a um aluno')).toBeNull();
    expect(queryByText('🗑️ Excluir Treino')).toBeNull();
    expect(queryByText('Remover')).toBeNull();

    expect(listAllExercicios).not.toHaveBeenCalled();
    expect(listAllAlunos).not.toHaveBeenCalled();
  });

  test('professor visualiza ações de edição do treino', async () => {
    useAuth.mockReturnValue({
      profile: { role: 'professor', nome: 'Professor Teste' }
    });

    listItensByTreino.mockResolvedValue([
      { id: 'item-1', exercicio_nome: 'Supino', series: 4, repeticoes: 8, carga: 40 }
    ]);
    listAllExercicios.mockResolvedValue([
      { id: 'ex-1', nome: 'Supino', categoria: 'Peito', series_padrao: 4, repeticoes_padrao: 8 }
    ]);
    listAllAlunos.mockResolvedValue([
      { id: 'aluno-1', nome: 'Aluno Um', email: 'aluno1@dominio.com' }
    ]);

    const navigation = { setOptions: jest.fn(), goBack: jest.fn() };
    const route = {
      params: {
        treino: { id: 'treino-1', nome_treino: 'Treino Professor', aluno_id: '', professor_id: 'prof-1' }
      }
    };

    const { getByText } = render(
      React.createElement(TreinoDetail, { route, navigation })
    );

    await waitFor(() => {
      expect(getByText('Supino')).toBeTruthy();
    });

    expect(getByText('Adicionar exercício')).toBeTruthy();
    expect(getByText('Editar treino')).toBeTruthy();
    expect(getByText('Associar a um aluno')).toBeTruthy();
    expect(getByText('🗑️ Excluir Treino')).toBeTruthy();
    expect(getByText('Remover')).toBeTruthy();

    expect(listAllExercicios).toHaveBeenCalled();
    expect(listAllAlunos).toHaveBeenCalled();
  });
});
