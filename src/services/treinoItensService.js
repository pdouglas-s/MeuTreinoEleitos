import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';

const itensCol = collection(db, 'treino_itens');

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function sortItensByOrdem(list = []) {
  return [...list].sort((a, b) => {
    const ordemA = Number.isFinite(a?.ordem) ? a.ordem : null;
    const ordemB = Number.isFinite(b?.ordem) ? b.ordem : null;

    if (ordemA !== null && ordemB !== null) return ordemA - ordemB;
    if (ordemA !== null) return -1;
    if (ordemB !== null) return 1;
    return 0;
  });
}

export async function addItemToTreino({ treino_id, exercicio_id, series, repeticoes, carga, descanso, exercicio_nome, ordem, allowDuplicate = false }) {
  let existingItens = [];
  if (!allowDuplicate) {
    const q = query(itensCol, where('treino_id', '==', treino_id));
    const snap = await getDocs(q);
    existingItens = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nomeNovo = normalizeText(exercicio_nome);

    const duplicated = existingItens.some((item) => {
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
  if (ordem !== undefined && ordem !== null) {
    data.ordem = Number(ordem);
  } else {
    const nextOrdem = existingItens.length > 0
      ? Math.max(...existingItens.map((item) => Number(item?.ordem) || 0)) + 1
      : 1;
    data.ordem = nextOrdem;
  }
  
  const docRef = await addDoc(itensCol, data);
  return { id: docRef.id };
}

export async function listItensByTreino(treino_id) {
  const q = query(itensCol, where('treino_id', '==', treino_id));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortItensByOrdem(list);
}

export async function reorderItensByTreino(treino_id, orderedItemIds = []) {
  const ids = orderedItemIds
    .map((itemId) => String(itemId || '').trim())
    .filter(Boolean);
  if (!treino_id || ids.length === 0) return;

  await Promise.all(
    ids.map((itemId, index) => updateDoc(doc(db, 'treino_itens', itemId), {
      ordem: index + 1
    }))
  );
}

export async function updateTreinoItem(item_id, data = {}) {
  const ref = doc(db, 'treino_itens', item_id);
  await updateDoc(ref, data);
}

export async function deleteItem(item_id) {
  const ref = doc(db, 'treino_itens', item_id);
  await deleteDoc(ref);
}
