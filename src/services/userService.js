import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Cria um usuário aluno e registra no Firestore conforme schema
export async function createAluno({ nome, email }) {
  const defaultPassword = process.env.DEFAULT_STUDENT_PASSWORD || '';
  if (!defaultPassword) throw new Error('DEFAULT_STUDENT_PASSWORD não configurada');

  const userCred = await createUserWithEmailAndPassword(auth, email, defaultPassword);
  const uid = userCred.user.uid;

  await setDoc(doc(db, 'users', uid), {
    nome,
    email,
    role: 'aluno',
    primeiro_acesso: true
  });

  return { uid };
}

export async function login({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const snapshot = await getDoc(doc(db, 'users', uid));
  const data = snapshot.exists() ? snapshot.data() : null;
  return { uid, profile: data };
}
