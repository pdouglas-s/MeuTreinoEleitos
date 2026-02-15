jest.mock('../src/firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  deleteDoc: jest.fn()
}));

const { addDoc, getDocs, doc, deleteDoc } = require('firebase/firestore');
const itensService = require('../src/services/treinoItensService');

describe('treinoItensService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('addItemToTreino calls addDoc and returns id', async () => {
    addDoc.mockResolvedValue({ id: 'item123' });
    const res = await itensService.addItemToTreino({ treino_id: 't1', exercicio_nome: 'Supino' });
    expect(addDoc).toHaveBeenCalled();
    expect(res).toEqual({ id: 'item123' });
  });

  test('listItensByTreino maps docs', async () => {
    const fakeSnap = { docs: [{ id: 'i1', data: () => ({ exercicio_nome: 'Supino' }) }] };
    getDocs.mockResolvedValue(fakeSnap);
    const res = await itensService.listItensByTreino('t1');
    expect(getDocs).toHaveBeenCalled();
    expect(res).toEqual([{ id: 'i1', exercicio_nome: 'Supino' }]);
  });

  test('addItemToTreino propagates permission-denied error', async () => {
    const permissionError = new Error('Missing or insufficient permissions.');
    permissionError.code = 'permission-denied';
    addDoc.mockRejectedValue(permissionError);

    await expect(
      itensService.addItemToTreino({ treino_id: 't1', exercicio_nome: 'Supino' })
    ).rejects.toMatchObject({
      code: 'permission-denied'
    });
  });

  test('deleteItem propagates permission-denied error', async () => {
    doc.mockReturnValue({ id: 'i1' });
    const permissionError = new Error('Missing or insufficient permissions.');
    permissionError.code = 'permission-denied';
    deleteDoc.mockRejectedValue(permissionError);

    await expect(itensService.deleteItem('i1')).rejects.toMatchObject({
      code: 'permission-denied'
    });
  });
});
