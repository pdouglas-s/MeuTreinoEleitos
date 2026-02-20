import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';

function removeUndefinedFields(data) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  );
}

function toDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatarDuracao(segundos) {
  const total = Number.isFinite(Number(segundos)) ? Math.max(0, Math.floor(Number(segundos))) : 0;
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segs = total % 60;

  if (horas > 0) {
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  }

  return `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
}

function calcularDuracaoSessaoSegundos(sessao = {}) {
  const duracaoExistente = Number(sessao?.duracao_segundos);
  if (Number.isFinite(duracaoExistente) && duracaoExistente >= 0) {
    return Math.floor(duracaoExistente);
  }

  const inicio = toDateValue(sessao?.data_inicio);
  const fim = toDateValue(sessao?.data_fim);
  if (!inicio || !fim) return 0;

  const ms = fim.getTime() - inicio.getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
}

function upsertExercicioSessao(exercicios = [], exercicioData = {}) {
  const nome = String(exercicioData?.exercicio_nome || '').trim().toLowerCase();
  if (!nome) return exercicios;

  const indiceExistente = exercicios.findIndex((item) => String(item?.exercicio_nome || '').trim().toLowerCase() === nome);
  if (indiceExistente === -1) {
    return [...exercicios, exercicioData];
  }

  const atual = exercicios[indiceExistente] || {};
  const atualizado = {
    ...atual,
    ...exercicioData,
    concluido_em: exercicioData?.concluido_em || atual?.concluido_em || null
  };

  const copia = [...exercicios];
  copia[indiceExistente] = atualizado;
  return copia;
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
  const exercicios = upsertExercicioSessao(sessaoData.exercicios || [], exercicioCompleto);
  
  await updateDoc(sessaoRef, {
    exercicios
  });
  
  return exercicioCompleto;
}

export async function salvarExercicioSessao(sessaoId, exercicioData) {
  const sessaoRef = doc(db, 'sessoes_treino', sessaoId);
  const payload = removeUndefinedFields({
    ...exercicioData
  });

  const sessaoDoc = await getDoc(sessaoRef);
  if (!sessaoDoc.exists()) throw new Error('Sessão não encontrada');

  const sessaoData = sessaoDoc.data() || {};
  const exercicios = upsertExercicioSessao(sessaoData.exercicios || [], payload);

  await updateDoc(sessaoRef, {
    exercicios
  });

  return payload;
}

/**
 * Finaliza uma sessão de treino
 */
export async function finalizarSessao(sessaoId, dadosAdicionais = {}) {
  const sessaoRef = doc(db, 'sessoes_treino', sessaoId);
  const snapshot = await getDoc(sessaoRef);
  if (!snapshot.exists()) throw new Error('Sessão não encontrada');

  const sessaoAtual = snapshot.data() || {};
  const inicio = toDateValue(sessaoAtual?.data_inicio) || new Date();
  const fim = new Date();
  const duracaoSegundos = Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 1000));

  await updateDoc(sessaoRef, {
    data_fim: fim,
    status: 'finalizado',
    duracao_segundos: duracaoSegundos,
    duracao_formatada: formatarDuracao(duracaoSegundos),
    ...dadosAdicionais
  });

  return {
    data_inicio: inicio,
    data_fim: fim,
    duracao_segundos: duracaoSegundos,
    duracao_formatada: formatarDuracao(duracaoSegundos)
  };
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

/**
 * Calcula tempo médio de permanência em treino por academia
 */
export async function calcularTempoMedioAcademia(academiaId) {
  const academia = String(academiaId || '').trim();
  if (!academia) return { mediaSegundos: 0, mediaFormatada: formatarDuracao(0), totalSessoes: 0 };

  const q = query(
    collection(db, 'sessoes_treino'),
    where('academia_id', '==', academia),
    where('status', '==', 'finalizado')
  );

  const snapshot = await getDocs(q);
  const sessoes = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const duracoes = sessoes
    .map((sessao) => calcularDuracaoSessaoSegundos(sessao))
    .filter((valor) => Number.isFinite(valor) && valor >= 0);

  if (!duracoes.length) {
    return { mediaSegundos: 0, mediaFormatada: formatarDuracao(0), totalSessoes: 0 };
  }

  const mediaSegundos = Math.round(duracoes.reduce((acc, valor) => acc + valor, 0) / duracoes.length);
  return {
    mediaSegundos,
    mediaFormatada: formatarDuracao(mediaSegundos),
    totalSessoes: duracoes.length
  };
}
