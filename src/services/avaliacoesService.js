import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const avalCol = collection(db, 'avaliacoes');

export async function addAvaliacao({ aluno_id, data, peso, percentual_gordura, medidas_json = {}, obs = '' }) {
  const docRef = await addDoc(avalCol, { aluno_id, data, peso, percentual_gordura, medidas_json, obs });
  return { id: docRef.id };
}

export async function listAvaliacoesByAluno(aluno_id) {
  const q = query(avalCol, where('aluno_id', '==', aluno_id));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
