import { db } from '../firebase/config';
import { auth } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, deleteDoc, getDoc } from 'firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';

const treinosCol = collection(db, 'treinos');
const treinoItensCol = collection(db, 'treino_itens');

async function getCurrentUserAcademiaId() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data()?.academia_id || null;
}

export async function createTreino({ aluno_id, professor_id, nome_treino, ativo = true, academia_id, is_padrao = false }) {
  const academiaId = academia_id || await getCurrentUserAcademiaId();
  const professorId = professor_id || auth.currentUser?.uid || null;
  const nomeTreinoNormalizado = String(nome_treino || '').trim();

  if (!professorId) {
    throw new Error('Professor não autenticado para criar treino');
  }
  if (!nomeTreinoNormalizado) {
    throw new Error('Nome do treino é obrigatório');
  }
  if (!academiaId || typeof academiaId !== 'string') {
    throw new Error('Professor sem academia vinculada. Atualize seu cadastro para criar treinos');
  }

  const docRef = await addDoc(treinosCol, {
    aluno_id,
    professor_id: professorId,
    nome_treino: nomeTreinoNormalizado,
    ativo,
    academia_id: academiaId,
    is_padrao: !!is_padrao,
    origem_padrao: false,
    bloqueado_exclusao: false
  });
  return { id: docRef.id };
}

export async function listTreinosByAluno(aluno_id) {
  const q = query(treinosCol, where('aluno_id', '==', aluno_id));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listTreinosByProfessor(professor_id) {
  const academiaId = await getCurrentUserAcademiaId();
  if (!academiaId || typeof academiaId !== 'string') {
    throw new Error('Professor sem academia vinculada para listar treinos');
  }

  const qAcademia = query(treinosCol, where('academia_id', '==', academiaId));
  const qPadrao = query(treinosCol, where('is_padrao', '==', true));
  const [academiaSnap, padraoSnap] = await Promise.all([getDocs(qAcademia), getDocs(qPadrao)]);

  const map = {};
  academiaSnap.docs.forEach((d) => {
    map[d.id] = { id: d.id, ...d.data() };
  });
  padraoSnap.docs.forEach((d) => {
    if (!map[d.id]) map[d.id] = { id: d.id, ...d.data() };
  });

  return Object.values(map);
}

export async function listTreinosByAcademia(academia_id) {
  const academiaId = academia_id || await getCurrentUserAcademiaId();
  if (!academiaId || typeof academiaId !== 'string') {
    throw new Error('Admin sem academia vinculada para listar treinos');
  }

  const q = query(treinosCol, where('academia_id', '==', academiaId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateTreino(treino_id, data) {
  const ref = doc(db, 'treinos', treino_id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Treino não encontrado');

  const atual = snapshot.data();
  const nomeNovo = data?.nome_treino;
  const nomeAntigo = atual?.nome_treino;

  if (atual?.is_padrao === true && typeof nomeNovo === 'string' && nomeNovo.trim() && nomeNovo !== nomeAntigo) {
    const academiaId = await getCurrentUserAcademiaId();
    if (!academiaId) throw new Error('Usuário sem academia vinculada para converter treino padrão');

    const payload = {
      ...data,
      is_padrao: false,
      origem_padrao: true,
      bloqueado_exclusao: true,
      academia_id: academiaId,
      professor_id: auth.currentUser?.uid || atual.professor_id || null,
      aluno_id: data?.aluno_id !== undefined ? data.aluno_id : (atual.aluno_id || '')
    };

    await updateDoc(ref, payload);
    return { convertedFromStandard: true };
  }

  await updateDoc(ref, data);
  return { convertedFromStandard: false };
}

export async function duplicateTreinoParaAluno(treino_id, { aluno_id, nome_treino } = {}) {
  const novoAlunoId = String(aluno_id || '').trim();
  if (!novoAlunoId) throw new Error('Aluno é obrigatório para criar novo vínculo');

  const ref = doc(db, 'treinos', treino_id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Treino não encontrado');

  const atual = snapshot.data();
  const professorId = auth.currentUser?.uid || atual.professor_id || null;
  const academiaId = atual.academia_id || await getCurrentUserAcademiaId();
  const nomeTreino = String(nome_treino || atual.nome_treino || '').trim();

  if (!professorId) throw new Error('Professor não autenticado para duplicar treino');
  if (!academiaId) throw new Error('Professor sem academia vinculada para duplicar treino');
  if (!nomeTreino) throw new Error('Nome do treino é obrigatório');

  const novoTreinoRef = await addDoc(treinosCol, {
    aluno_id: novoAlunoId,
    professor_id: professorId,
    nome_treino: nomeTreino,
    ativo: atual.ativo !== false,
    academia_id: academiaId,
    is_padrao: false,
    origem_padrao: !!atual.origem_padrao,
    bloqueado_exclusao: !!atual.bloqueado_exclusao
  });

  const itensSnap = await getDocs(query(treinoItensCol, where('treino_id', '==', treino_id)));
  const createPromises = itensSnap.docs.map((itemDoc) => {
    const item = itemDoc.data();
    const payload = {
      treino_id: novoTreinoRef.id,
      exercicio_id: item.exercicio_id,
      exercicio_nome: item.exercicio_nome,
      series: item.series,
      repeticoes: item.repeticoes,
      carga: item.carga,
      descanso: item.descanso,
      ordem: item.ordem
    };
    const sanitizedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    );
    return addDoc(treinoItensCol, sanitizedPayload);
  });

  await Promise.all(createPromises);
  return { id: novoTreinoRef.id, itensCopiados: createPromises.length };
}

export async function deleteTreino(treino_id) {
  const ref = doc(db, 'treinos', treino_id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Treino não encontrado');

  const data = snapshot.data();
  const temVinculoAluno = typeof data?.aluno_id === 'string' && data.aluno_id.trim().length > 0;
  if (temVinculoAluno) {
    throw new Error('Não é permitido excluir treino associado a aluno');
  }

  if (data?.bloqueado_exclusao === true && !temVinculoAluno) {
    throw new Error('Este treino foi convertido de um padrão e não pode ser excluído');
  }

  await deleteDoc(ref);
  return { id: treino_id, ...data };
}
