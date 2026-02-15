const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();

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

async function existeResumoNaSemana(db, alunoId, semanaChave) {
  const snapshot = await db
    .collection('notificacoes')
    .where('aluno_id', '==', alunoId)
    .where('tipo', '==', 'resumo_semanal')
    .get();

  return snapshot.docs.some((docSnap) => {
    const dados = docSnap.data()?.dados || {};
    return dados.semana_chave === semanaChave;
  });
}

async function ensureAdmin(uid) {
  const snapshot = await admin.firestore().collection('users').doc(uid).get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.role === 'professor' && data.nome === 'ADMIN';
}

exports.deleteProfessorCompletely = onCall({
  region: 'us-central1',
  cors: [
    /localhost:\d+$/,
    /127\.0\.0\.1:\d+$/,
    'http://localhost:19006',
    'http://127.0.0.1:19006'
  ]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
  }

  const callerUid = request.auth.uid;
  const isAdmin = await ensureAdmin(callerUid);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Apenas ADMIN pode excluir professor.');
  }

  const professorId = request.data?.professorId;
  if (!professorId || typeof professorId !== 'string') {
    throw new HttpsError('invalid-argument', 'Parâmetro professorId é obrigatório.');
  }

  const userRef = admin.firestore().collection('users').doc(professorId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'Professor não encontrado.');
  }

  const userData = userSnap.data() || {};
  if (userData.role !== 'professor') {
    throw new HttpsError('failed-precondition', 'O usuário informado não é professor.');
  }
  if (userData.nome === 'ADMIN') {
    throw new HttpsError('failed-precondition', 'Não é permitido excluir o ADMIN principal.');
  }

  try {
    try {
      await admin.auth().deleteUser(professorId);
    } catch (authError) {
      const code = authError?.errorInfo?.code || authError?.code || '';
      if (!String(code).includes('user-not-found')) {
        throw authError;
      }
    }

    await userRef.delete();

    logger.info('Professor excluído completamente', {
      callerUid,
      professorId
    });

    return { success: true };
  } catch (error) {
    logger.error('Erro ao excluir professor completamente', {
      callerUid,
      professorId,
      error: error?.message
    });
    throw new HttpsError('internal', 'Falha ao excluir professor completo.');
  }
});

exports.enviarResumoSemanalAtletas = onSchedule(
  {
    schedule: 'every sunday 21:00',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1'
  },
  async () => {
    const db = admin.firestore();
    const agora = new Date();
    const semanaInicio = inicioSemana(agora);
    const semanaFim = fimSemana(agora);
    const semanaChave = toSemanaChave(agora);
    const faixaSemana = formatarIntervaloSemana(semanaInicio, semanaFim);

    let processados = 0;
    let enviados = 0;
    let ignorados = 0;

    const alunosSnap = await db.collection('users').where('role', '==', 'aluno').get();

    for (const alunoDoc of alunosSnap.docs) {
      processados += 1;
      const alunoId = alunoDoc.id;
      const alunoData = alunoDoc.data() || {};
      const alunoNome = alunoData.nome || 'Atleta';

      const jaExiste = await existeResumoNaSemana(db, alunoId, semanaChave);
      if (jaExiste) {
        ignorados += 1;
        continue;
      }

      const sessoesSnap = await db
        .collection('sessoes_treino')
        .where('aluno_id', '==', alunoId)
        .where('status', '==', 'finalizado')
        .get();

      const sessoesSemana = sessoesSnap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((sessao) => {
          const dataFim = toDateValue(sessao.data_fim);
          if (!dataFim) return false;
          const ms = dataFim.getTime();
          return ms >= semanaInicio.getTime() && ms <= semanaFim.getTime();
        });

      const totalTreinos = sessoesSemana.length;
      const mediaIntensidade = resumirIntensidade(sessoesSemana);
      const feedbacks = coletarFeedbacks(sessoesSemana);
      const ultimaSessao = [...sessoesSemana].sort((a, b) => {
        const bMs = toDateValue(b.data_fim)?.getTime() || 0;
        const aMs = toDateValue(a.data_fim)?.getTime() || 0;
        return bMs - aMs;
      })[0];

      let mensagem = `${alunoNome}, resumo da sua semana (${faixaSemana}):\n`;
      mensagem += `Treinos finalizados: ${totalTreinos}`;
      mensagem += mediaIntensidade
        ? `\nIntensidade média: ${String(mediaIntensidade).replace('.', ',')}/5`
        : '\nIntensidade média: não informada';
      if (feedbacks.length) {
        mensagem += `\nFeedbacks: ${feedbacks.join(' | ')}`;
      }

      await db.collection('notificacoes').add({
        professor_id: ultimaSessao?.professor_id || null,
        aluno_id: alunoId,
        tipo: 'resumo_semanal',
        mensagem,
        dados: {
          semana_chave: semanaChave,
          semana_inicio: semanaInicio,
          semana_fim: semanaFim,
          total_treinos: totalTreinos,
          media_intensidade: mediaIntensidade,
          feedbacks
        },
        lida: false,
        created_at: new Date()
      });

      enviados += 1;
    }

    logger.info('Resumo semanal processado', {
      semanaChave,
      processados,
      enviados,
      ignorados
    });
  }
);
