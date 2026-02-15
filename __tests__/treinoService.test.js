jest.mock('../src/firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn()
}));

const { addDoc, getDocs, doc, updateDoc, deleteDoc } = require('firebase/firestore');
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

  test('updateTreino propagates permission-denied error', async () => {
    doc.mockReturnValue({ id: 't1' });
    const permissionError = new Error('Missing or insufficient permissions.');
    permissionError.code = 'permission-denied';
    updateDoc.mockRejectedValue(permissionError);

    await expect(treinoService.updateTreino('t1', { nome_treino: 'Novo' })).rejects.toMatchObject({
      code: 'permission-denied'
    });
  });

  test('deleteTreino propagates permission-denied error', async () => {
    doc.mockReturnValue({ id: 't1' });
    const permissionError = new Error('Missing or insufficient permissions.');
    permissionError.code = 'permission-denied';
    deleteDoc.mockRejectedValue(permissionError);

    await expect(treinoService.deleteTreino('t1')).rejects.toMatchObject({
      code: 'permission-denied'
    });
  });
});
