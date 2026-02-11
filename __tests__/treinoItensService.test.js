jest.mock('../src/firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn()
}));

const { addDoc, getDocs } = require('firebase/firestore');
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
});
