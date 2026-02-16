jest.mock('../src/firebase/config', () => ({
  auth: { currentUser: { uid: 'admin-1' } },
  db: {},
  functions: {}
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

const { getDoc, getDocs, setDoc, deleteDoc } = require('firebase/firestore');
const { httpsCallable } = require('firebase/functions');

const { deleteAlunoProfile, updateManagedUserProfile } = require('../src/services/userService');

describe('userService.deleteAlunoProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('usa Cloud Function quando disponível', async () => {
    const callableMock = jest.fn().mockResolvedValue({ data: { success: true } });
    httpsCallable.mockReturnValue(callableMock);

    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
    });

    await expect(deleteAlunoProfile('aluno-1')).resolves.toBeUndefined();

    expect(callableMock).toHaveBeenCalledWith({ alunoId: 'aluno-1' });
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  test('bloqueia exclusão quando function falha e aluno possui treino associado', async () => {
    const callableMock = jest.fn().mockRejectedValue(
      new Error('Failed to fetch')
    );
    httpsCallable.mockReturnValue(callableMock);

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
    expect(callableMock).toHaveBeenCalledWith({ alunoId: 'aluno-1' });
    expect(deleteDoc).not.toHaveBeenCalled();
  });

  test('faz fallback e exclui quando function falha e não há treino associado', async () => {
    const callableMock = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    httpsCallable.mockReturnValue(callableMock);

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
    expect(callableMock).toHaveBeenCalledWith({ alunoId: 'aluno-1' });
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('userService.updateManagedUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('bloqueia alteração de e-mail para aluno', async () => {
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

    await expect(
      updateManagedUserProfile({
        userId: 'aluno-1',
        nome: 'Novo Nome',
        email: 'novo@teste.com'
      })
    ).rejects.toThrow('Não é permitido alterar o e-mail do aluno. Apenas o nome pode ser atualizado');
  });

  test('permite alteração de e-mail para professor', async () => {
    const { updateDoc } = require('firebase/firestore');

    getDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'professor', academia_id: 'acad-1', email: 'prof@teste.com' })
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ role: 'admin_academia', academia_id: 'acad-1' })
      });

    await expect(
      updateManagedUserProfile({
        userId: 'prof-1',
        nome: 'Professor Novo',
        email: 'profnovo@teste.com'
      })
    ).resolves.toBeUndefined();

    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});
