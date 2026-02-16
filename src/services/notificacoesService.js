import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { listarSessoesFinalizadasNoPeriodo } from './historicoService';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
}

function toDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inicioSemana(date) {
  const base = new Date(date);
  const diaSemana = base.getDay();
  const ajuste = diaSemana === 0 ? -6 : 1 - diaSemana;
  base.setDate(base.getDate() + ajuste);
  base.setHours(0, 0, 0, 0);
  return base;
}

function fimSemana(date) {
  const inicio = inicioSemana(date);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  fim.setHours(23, 59, 59, 999);
  return fim;
}

function toSemanaChave(date) {
  const inicio = inicioSemana(date);
  const y = inicio.getFullYear();
  const m = String(inicio.getMonth() + 1).padStart(2, '0');
  const d = String(inicio.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatarIntervaloSemana(inicio, fim) {
  const ini = inicio.toLocaleDateString('pt-BR');
  const end = fim.toLocaleDateString('pt-BR');
  return `${ini} a ${end}`;
}

function resumirIntensidade(sessoes) {
  const intensidades = sessoes
    .map((s) => Number(s?.nivel_esforco))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);

  if (!intensidades.length) return null;
  const media = intensidades.reduce((acc, n) => acc + n, 0) / intensidades.length;
  return Math.round(media * 10) / 10;
}

function coletarFeedbacks(sessoes) {
  const lista = sessoes
    .map((s) => String(s?.feedback || '').trim())
    .filter(Boolean);

  return Array.from(new Set(lista)).slice(0, 3);
}

/**
 * Envia notificação
 */
export async function enviarNotificacao(professorId, alunoId, tipo, dados) {
  const notifRef = collection(db, 'notificacoes');
  const professorDestinoId = tipo === 'treino_excluido' ? null : professorId;

  const intensidadeTexto = {
    1: '😄 Muito leve',
    2: '🙂 Leve',
    3: '😐 Moderado',
    4: '😓 Pesado',
    5: '🥵 Muito pesado'
  };
  
  let mensagem = '';
  switch (tipo) {
    case 'treino_iniciado':
      mensagem = `${dados.aluno_nome} iniciou o treino "${dados.treino_nome}"`;
      break;
    case 'exercicio_concluido':
      mensagem = `${dados.aluno_nome} concluiu ${dados.exercicio_nome} (${dados.series}x${dados.repeticoes})`;
      break;
    case 'treino_finalizado':
      mensagem = `${dados.aluno_nome} finalizou o treino "${dados.treino_nome}" - ${dados.total_exercicios} exercícios`;
      if (dados.nivel_esforco && intensidadeTexto[dados.nivel_esforco]) {
        mensagem += `\nIntensidade: ${intensidadeTexto[dados.nivel_esforco]}`;
      }
      if (dados.feedback && String(dados.feedback).trim()) {
        mensagem += `\nFeedback: ${String(dados.feedback).trim()}`;
      }
      break;
    case 'treino_associado':
      mensagem = `${dados.professor_nome || 'Professor'} associou o treino "${dados.treino_nome}" para você`;
      break;
    case 'treino_excluido':
      mensagem = `${dados.professor_nome || 'Professor'} removeu o treino "${dados.treino_nome}" da sua lista`;
      break;
    default:
      mensagem = 'Nova atividade do aluno';
  }
  
  const docRef = await addDoc(notifRef, {
    professor_id: professorDestinoId,
    aluno_id: alunoId,
    tipo,
    mensagem,
    dados,
    lida: false,
    created_at: new Date()
  });
  
  return docRef.id;
}

/**
 * Gera notificação semanal para atleta aos domingos
 */
export async function notificarResumoSemanalAluno(alunoId, professorId, alunoNome = 'Atleta', dataReferencia = new Date()) {
  if (!alunoId) return { enviada: false, motivo: 'aluno_invalido' };

  const agora = toDateValue(dataReferencia) || new Date();
  if (agora.getDay() !== 0) {
    return { enviada: false, motivo: 'fora_do_domingo' };
  }

  const semanaInicio = inicioSemana(agora);
  const semanaFim = fimSemana(agora);
  const semanaChave = toSemanaChave(agora);

  const qExistentes = query(collection(db, 'notificacoes'), where('aluno_id', '==', alunoId));
  const existentesSnap = await getDocs(qExistentes);
  const jaEnviada = existentesSnap.docs.some((docSnap) => {
    const data = docSnap.data();
    return data?.tipo === 'resumo_semanal' && data?.dados?.semana_chave === semanaChave;
  });

  if (jaEnviada) {
    return { enviada: false, motivo: 'ja_enviada', semanaChave };
  }

  const sessoesSemana = await listarSessoesFinalizadasNoPeriodo(alunoId, semanaInicio, semanaFim);
  const totalTreinos = sessoesSemana.length;
  const mediaIntensidade = resumirIntensidade(sessoesSemana);
  const feedbacks = coletarFeedbacks(sessoesSemana);
  const faixaSemana = formatarIntervaloSemana(semanaInicio, semanaFim);

  let mensagem = `${alunoNome}, resumo da sua semana (${faixaSemana}):\n`;
  mensagem += `Treinos finalizados: ${totalTreinos}`;
  mensagem += mediaIntensidade ? `\nIntensidade média: ${String(mediaIntensidade).replace('.', ',')}/5` : '\nIntensidade média: não informada';
  if (feedbacks.length) {
    mensagem += `\nFeedbacks: ${feedbacks.join(' | ')}`;
  }

  const dados = {
    semana_chave: semanaChave,
    semana_inicio: semanaInicio,
    semana_fim: semanaFim,
    total_treinos: totalTreinos,
    media_intensidade: mediaIntensidade,
    feedbacks
  };

  const docRef = await addDoc(collection(db, 'notificacoes'), {
    professor_id: professorId || null,
    aluno_id: alunoId,
    tipo: 'resumo_semanal',
    mensagem,
    dados,
    lida: false,
    created_at: new Date()
  });

  return {
    enviada: true,
    notificacaoId: docRef.id,
    semanaChave,
    totalTreinos,
    mediaIntensidade,
    feedbacks
  };
}

/**
 * Lista notificações de um professor
 */
export async function listarNotificacoesProfessor(professorId, somenteNaoLidas = false) {
  const baseCollection = collection(db, 'notificacoes');
  const orderedQuery = somenteNaoLidas
    ? query(
        baseCollection,
        where('professor_id', '==', professorId),
        where('lida', '==', false),
        orderBy('created_at', 'desc')
      )
    : query(
        baseCollection,
        where('professor_id', '==', professorId),
        orderBy('created_at', 'desc')
      );

  try {
    const snapshot = await getDocs(orderedQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    const needsIndex = err?.code === 'failed-precondition' || String(err?.message || '').toLowerCase().includes('requires an index');
    if (!needsIndex) throw err;

    const fallbackQuery = somenteNaoLidas
      ? query(baseCollection, where('professor_id', '==', professorId), where('lida', '==', false))
      : query(baseCollection, where('professor_id', '==', professorId));

    const snapshot = await getDocs(fallbackQuery);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return sortByCreatedAtDesc(notifs);
  }
}

/**
 * Lista notificações de um aluno
 */
export async function listarNotificacoesAluno(alunoId, somenteNaoLidas = false) {
  const baseCollection = collection(db, 'notificacoes');
  const orderedQuery = somenteNaoLidas
    ? query(
        baseCollection,
        where('aluno_id', '==', alunoId),
        where('lida', '==', false),
        orderBy('created_at', 'desc')
      )
    : query(
        baseCollection,
        where('aluno_id', '==', alunoId),
        orderBy('created_at', 'desc')
      );

  try {
    const snapshot = await getDocs(orderedQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    const needsIndex = err?.code === 'failed-precondition' || String(err?.message || '').toLowerCase().includes('requires an index');
    if (!needsIndex) throw err;

    const fallbackQuery = somenteNaoLidas
      ? query(baseCollection, where('aluno_id', '==', alunoId), where('lida', '==', false))
      : query(baseCollection, where('aluno_id', '==', alunoId));

    const snapshot = await getDocs(fallbackQuery);
    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return sortByCreatedAtDesc(notifs);
  }
}

/**
 * Marca notificação como lida
 */
export async function marcarComoLida(notificacaoId) {
  const notifRef = doc(db, 'notificacoes', notificacaoId);
  await updateDoc(notifRef, { lida: true });
}

/**
 * Marca todas notificações de um professor como lidas
 */
export async function marcarTodasComoLidas(professorId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('professor_id', '==', professorId),
    where('lida', '==', false)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(docSnap => {
    batch.update(docSnap.ref, { lida: true });
  });
  
  await batch.commit();
}

/**
 * Marca todas notificações de um aluno como lidas
 */
export async function marcarTodasComoLidasAluno(alunoId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('aluno_id', '==', alunoId),
    where('lida', '==', false)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach(docSnap => {
    batch.update(docSnap.ref, { lida: true });
  });

  await batch.commit();
}

/**
 * Conta notificações não lidas
 */
export async function contarNaoLidas(professorId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('professor_id', '==', professorId),
    where('lida', '==', false)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Conta notificações não lidas de um aluno
 */
export async function contarNaoLidasAluno(alunoId) {
  const q = query(
    collection(db, 'notificacoes'),
    where('aluno_id', '==', alunoId),
    where('lida', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}
