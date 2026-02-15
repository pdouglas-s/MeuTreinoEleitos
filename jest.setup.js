// Jest setup: mock expo modules that cause native/platform calls
jest.mock('expo-asset', () => ({
  Asset: { fromModule: () => ({ localUri: '' }) },
  default: { loadAsync: jest.fn() },
  PlatformUtils: { exists: () => false }
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const Mock = (props) => React.createElement('Icon', props, props.children || null);
  return { Ionicons: Mock, MaterialIcons: Mock, default: Mock };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({}))
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-user' } })),
  setPersistence: jest.fn(() => Promise.resolve()),
  browserLocalPersistence: {},
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signOut: jest.fn(() => Promise.resolve()),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: 'test-user' } })),
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: 'test-user' } })),
  updatePassword: jest.fn(() => Promise.resolve())
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
  getDocs: jest.fn(() => Promise.resolve({ docs: [], empty: true, size: 0 })),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  writeBatch: jest.fn(() => ({ update: jest.fn(), commit: jest.fn(() => Promise.resolve()) })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => null }))
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} })))
}));
