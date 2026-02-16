jest.mock('../src/firebase/config', () => ({
  auth: { currentUser: { uid: 'admin-1' } },
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  getDocs: jest.fn(),
  setDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'mock-timestamp')
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  updatePassword: jest.fn(),
  getAuth: jest.fn(() => ({ currentUser: { uid: 'secondary' } })),
  signOut: jest.fn(() => Promise.resolve()),
  setPersistence: jest.fn(() => Promise.resolve()),
  inMemoryPersistence: {}
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  deleteApp: jest.fn(() => Promise.resolve())
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'meu-treino-eleitos'
    }
  }
}));

const {
  getDoc,
  getDocs,
  setDoc,
  deleteDoc
} = require('firebase/firestore');

const { deleteAlunoProfile } = require('../src/services/userService');

describe('userService.deleteAlunoProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('bloqueia exclusão quando aluno possui treino associado', async () => {
    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'aluno', academia_id: 'acad-1', email: 'aluno@teste.com' })
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      });

    getDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'treino-1' }]
    });

    await expect(deleteAlunoProfile('aluno-1')).rejects.toThrow(
      'Não é possível excluir aluno com treino associado'
    );

    expect(deleteDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  test('permite exclusão quando não há treino associado', async () => {
    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'aluno', academia_id: 'acad-1', email: 'aluno@teste.com' })
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      });

    getDocs.mockResolvedValue({ empty: true, docs: [] });

    await expect(deleteAlunoProfile('aluno-1')).resolves.toBeUndefined();

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});
