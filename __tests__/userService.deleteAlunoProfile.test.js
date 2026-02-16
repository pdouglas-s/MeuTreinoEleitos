jest.mock('../src/firebase/config', () => ({
  auth: { currentUser: { uid: 'admin-1' } },
  db: {},
  functions: {}
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(),
  updateDoc: jest.fn(() => Promise.resolve()),
  serverTimestamp: jest.fn(() => 'mock-timestamp')
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn()
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

const { getDoc } = require('firebase/firestore');
const { httpsCallable } = require('firebase/functions');

const { deleteAlunoProfile } = require('../src/services/userService');

describe('userService.deleteAlunoProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('bloqueia exclusão quando aluno possui treino associado', async () => {
    const callableMock = jest.fn().mockRejectedValue(
      new Error('Não é possível excluir aluno com treino associado')
    );
    httpsCallable.mockReturnValue(callableMock);

    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      });

    await expect(deleteAlunoProfile('aluno-1')).rejects.toThrow(
      'Não é possível excluir aluno com treino associado'
    );
    expect(callableMock).toHaveBeenCalledWith({ alunoId: 'aluno-1' });
  });

  test('permite exclusão quando não há treino associado', async () => {
    const callableMock = jest.fn().mockResolvedValue({ data: { success: true } });
    httpsCallable.mockReturnValue(callableMock);

    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      });

    await expect(deleteAlunoProfile('aluno-1')).resolves.toBeUndefined();
    expect(callableMock).toHaveBeenCalledWith({ alunoId: 'aluno-1' });
  });
});
