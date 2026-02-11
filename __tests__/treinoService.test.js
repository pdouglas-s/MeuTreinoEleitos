jest.mock('../src/firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn()
}));

const { addDoc, getDocs } = require('firebase/firestore');
const treinoService = require('../src/services/treinoService');

describe('treinoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createTreino calls addDoc and returns id', async () => {
    addDoc.mockResolvedValue({ id: 'abc123' });
    const res = await treinoService.createTreino({ aluno_id: 'a1', professor_id: 'p1', nome_treino: 'T1' });
    expect(addDoc).toHaveBeenCalled();
    expect(res).toEqual({ id: 'abc123' });
  });

  test('listTreinosByAluno maps docs', async () => {
    const fakeSnap = { docs: [{ id: 't1', data: () => ({ nome_treino: 'T1' }) }] };
    getDocs.mockResolvedValue(fakeSnap);
    const res = await treinoService.listTreinosByAluno('a1');
    expect(getDocs).toHaveBeenCalled();
    expect(res).toEqual([{ id: 't1', nome_treino: 'T1' }]);
  });
});
