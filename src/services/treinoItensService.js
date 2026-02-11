import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const itensCol = collection(db, 'treino_itens');

export async function addItemToTreino({ treino_id, exercicio_id, series, repeticoes, carga, descanso, exercicio_nome }) {
  const docRef = await addDoc(itensCol, { treino_id, exercicio_id, series, repeticoes, carga, descanso, exercicio_nome });
  return { id: docRef.id };
}

export async function listItensByTreino(treino_id) {
  const q = query(itensCol, where('treino_id', '==', treino_id));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
