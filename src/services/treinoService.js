import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';

const treinosCol = collection(db, 'treinos');

export async function createTreino({ aluno_id, professor_id, nome_treino, ativo = true }) {
  const docRef = await addDoc(treinosCol, { aluno_id, professor_id, nome_treino, ativo });
  return { id: docRef.id };
}

export async function listTreinosByAluno(aluno_id) {
  const q = query(treinosCol, where('aluno_id', '==', aluno_id));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listTreinosByProfessor(professor_id) {
  const q = query(treinosCol, where('professor_id', '==', professor_id));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateTreino(treino_id, data) {
  const ref = doc(db, 'treinos', treino_id);
  await updateDoc(ref, data);
}
