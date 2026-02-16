import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

const itensCol = collection(db, 'treino_itens');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export async function addItemToTreino({ treino_id, exercicio_id, series, repeticoes, carga, descanso, exercicio_nome, allowDuplicate = false }) {
  if (!allowDuplicate) {
    const q = query(itensCol, where('treino_id', '==', treino_id));
    const snap = await getDocs(q);
    const nomeNovo = normalizeText(exercicio_nome);

    const duplicated = snap.docs.some((docSnap) => {
      const item = docSnap.data() || {};
      if (exercicio_id && item.exercicio_id && item.exercicio_id === exercicio_id) return true;
      return nomeNovo && normalizeText(item.exercicio_nome) === nomeNovo;
    });

    if (duplicated) {
      throw new Error('Este exercício já foi adicionado neste treino');
    }
  }

  // Remove campos undefined para não causar erro no Firestore
  const data = { treino_id };
  if (exercicio_id !== undefined) data.exercicio_id = exercicio_id;
  if (exercicio_nome !== undefined) data.exercicio_nome = exercicio_nome;
  if (series !== undefined && series !== null) data.series = series;
  if (repeticoes !== undefined && repeticoes !== null) data.repeticoes = repeticoes;
  if (carga !== undefined && carga !== null) data.carga = carga;
  if (descanso !== undefined && descanso !== null) data.descanso = descanso;
  
  const docRef = await addDoc(itensCol, data);
  return { id: docRef.id };
}

export async function listItensByTreino(treino_id) {
  const q = query(itensCol, where('treino_id', '==', treino_id));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteItem(item_id) {
  const ref = doc(db, 'treino_itens', item_id);
  await deleteDoc(ref);
}
