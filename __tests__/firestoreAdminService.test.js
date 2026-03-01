jest.mock('../src/firebase/config', () => ({
  auth: { currentUser: { uid: 'admin-1' } },
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  query: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn()
}));

const { auth } = require('../src/firebase/config');
const {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where
} = require('firebase/firestore');

const {
  adminSelectFirestore,
  adminInsertFirestore,
  adminUpdateFirestore,
  adminDeleteFirestore
} = require('../src/services/firestoreAdminService');

function mockSystemAdminProfile(role = 'admin_sistema') {
  getDoc.mockResolvedValueOnce({
    exists: () => true,
    data: () => ({ role })
  });
}

describe('firestoreAdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = { uid: 'admin-1' };

    doc.mockImplementation((...parts) => ({ parts }));
    collection.mockImplementation((...parts) => ({ parts }));
    where.mockImplementation((field, op, value) => ({ field, op, value }));
    limit.mockImplementation((value) => ({ value }));
    query.mockImplementation((...constraints) => ({ constraints }));
  });

  test('adminSelectFirestore returns document by id in doc mode', async () => {
    mockSystemAdminProfile();
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'user-1',
      data: () => ({ nome: 'Alice' })
    });

    const data = await adminSelectFirestore({
      collectionPath: 'users',
      documentId: 'user-1'
    });

    expect(data).toEqual([{ id: 'user-1', nome: 'Alice' }]);
    expect(getDocs).not.toHaveBeenCalled();
  });

  test('adminSelectFirestore falls back when query requires index', async () => {
    mockSystemAdminProfile();

    const indexError = new Error('The query requires an index');
    indexError.code = 'failed-precondition';

    getDocs
      .mockRejectedValueOnce(indexError)
      .mockResolvedValueOnce({
        docs: [
          { id: 'b', data: () => ({ nome: 'Bruno', role: 'aluno' }) },
          { id: 'a', data: () => ({ nome: 'Ana', role: 'aluno' }) },
          { id: 'x', data: () => ({ nome: 'Xavier', role: 'professor' }) }
        ]
      });

    const data = await adminSelectFirestore({
      collectionPath: 'users',
      filters: [{ field: 'role', op: '==', value: 'aluno' }],
      sort: { field: 'nome', direction: 'asc' },
      limitCount: '2'
    });

    expect(getDocs).toHaveBeenCalledTimes(2);
    expect(data).toEqual([
      { id: 'a', nome: 'Ana', role: 'aluno' },
      { id: 'b', nome: 'Bruno', role: 'aluno' }
    ]);
  });

  test('adminInsertFirestore creates with automatic id when documentId is empty', async () => {
    mockSystemAdminProfile();
    addDoc.mockResolvedValue({ id: 'new-id-1' });

    const result = await adminInsertFirestore({
      collectionPath: 'users',
      payload: { nome: 'Novo usuário' }
    });

    expect(addDoc).toHaveBeenCalled();
    expect(result).toEqual({ id: 'new-id-1' });
  });

  test('adminUpdateFirestore updates existing doc', async () => {
    mockSystemAdminProfile();

    const result = await adminUpdateFirestore({
      collectionPath: 'users',
      documentId: 'user-1',
      payload: { nome: 'Alterado' }
    });

    expect(updateDoc).toHaveBeenCalled();
    expect(result).toEqual({ id: 'user-1' });
  });

  test('adminDeleteFirestore deletes existing doc', async () => {
    mockSystemAdminProfile();

    const result = await adminDeleteFirestore({
      collectionPath: 'users',
      documentId: 'user-9'
    });

    expect(deleteDoc).toHaveBeenCalled();
    expect(result).toEqual({ id: 'user-9' });
  });

  test('rejects operation when current user is not system admin', async () => {
    mockSystemAdminProfile('professor');

    await expect(
      adminInsertFirestore({
        collectionPath: 'users',
        payload: { nome: 'Teste' }
      })
    ).rejects.toThrow('Apenas admin do sistema pode acessar o console do Firestore');

    expect(addDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });
});
