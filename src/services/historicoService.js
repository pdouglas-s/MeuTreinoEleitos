import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

function removeUndefinedFields(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

/**
 * Cria uma sessão de treino (treino do dia)
 */
export async function criarSessaoTreino(treinoId, alunoId, professorId) {
  const treinoSnap = await getDoc(doc(db, 'treinos', treinoId));
  const academiaId = treinoSnap.exists() ? (treinoSnap.data()?.academia_id || null) : null;

  const sessaoRef = collection(db, 'sessoes_treino');
  const docRef = await addDoc(sessaoRef, {
    treino_id: treinoId,
    aluno_id: alunoId,
    professor_id: professorId,
    academia_id: academiaId,
    data_inicio: new Date(),
    data_fim: null,
    status: 'em_andamento', // em_andamento, finalizado
    exercicios: [],
    created_at: new Date()
  });
  return docRef.id;
}

/**
 * Marca um exercício como concluído dentro de uma sessão
 */
export async function marcarExercicioConcluido(sessaoId, exercicioData) {
  const sessaoRef = doc(db, 'sessoes_treino', sessaoId);
  const exercicioCompleto = removeUndefinedFields({
    ...exercicioData,
    concluido_em: new Date()
  });
  
  const sessaoDoc = await getDoc(sessaoRef);
  if (!sessaoDoc.exists()) throw new Error('Sessão não encontrada');

  const sessaoData = sessaoDoc.data();
  const exercicios = sessaoData.exercicios || [];
  exercicios.push(exercicioCompleto);
  
  await updateDoc(sessaoRef, {
    exercicios
  });
  
  return exercicioCompleto;
}

/**
 * Finaliza uma sessão de treino
 */
export async function finalizarSessao(sessaoId, dadosAdicionais = {}) {
  const sessaoRef = doc(db, 'sessoes_treino', sessaoId);
  await updateDoc(sessaoRef, {
    data_fim: new Date(),
    status: 'finalizado',
    ...dadosAdicionais
  });
}

/**
 * Lista sessões de um aluno
 */
export async function listarSessoesAluno(alunoId, limite = 10) {
  const q = query(
    collection(db, 'sessoes_treino'),
    where('aluno_id', '==', alunoId),
    orderBy('created_at', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Lista sessões de todos os alunos de um professor
 */
export async function listarSessoesProfessor(professorId, limite = 20) {
  const q = query(
    collection(db, 'sessoes_treino'),
    where('professor_id', '==', professorId),
    orderBy('created_at', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Verifica se há sessão ativa para um treino
 */
export async function buscarSessaoAtiva(treinoId, alunoId) {
  const q = query(
    collection(db, 'sessoes_treino'),
    where('treino_id', '==', treinoId),
    where('aluno_id', '==', alunoId),
    where('status', '==', 'em_andamento')
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Busca histórico completo de um treino específico
 */
export async function buscarHistoricoTreino(treinoId) {
  const q = query(
    collection(db, 'sessoes_treino'),
    where('treino_id', '==', treinoId),
    where('status', '==', 'finalizado'),
    orderBy('data_fim', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Lista sessões finalizadas de um aluno em um período
 */
export async function listarSessoesFinalizadasNoPeriodo(alunoId, dataInicio, dataFim) {
  const q = query(
    collection(db, 'sessoes_treino'),
    where('aluno_id', '==', alunoId),
    where('status', '==', 'finalizado')
  );

  const snapshot = await getDocs(q);
  const inicioMs = new Date(dataInicio).getTime();
  const fimMs = new Date(dataFim).getTime();

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((sessao) => {
      const valor = sessao?.data_fim;
      const dataFimSessao = typeof valor?.toDate === 'function' ? valor.toDate() : new Date(valor);
      const ms = dataFimSessao.getTime();
      return !Number.isNaN(ms) && ms >= inicioMs && ms <= fimMs;
    });
}
