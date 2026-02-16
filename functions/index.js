const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
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

async function getUserProfile(uid) {
  const snapshot = await admin.firestore().collection('users').doc(uid).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
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

exports.deleteAlunoProfileSecure = onCall({
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
  const callerProfile = await getUserProfile(callerUid);
  if (!callerProfile || callerProfile.role !== 'admin_academia') {
    throw new HttpsError('permission-denied', 'Apenas admin de academia pode excluir aluno.');
  }

  const alunoId = String(request.data?.alunoId || '').trim();
  if (!alunoId) {
    throw new HttpsError('invalid-argument', 'Parâmetro alunoId é obrigatório.');
  }

  const db = admin.firestore();
  const alunoRef = db.collection('users').doc(alunoId);
  const alunoSnap = await alunoRef.get();

  if (!alunoSnap.exists) {
    throw new HttpsError('not-found', 'Aluno não encontrado.');
  }

  const alunoData = alunoSnap.data() || {};
  if (alunoData.role !== 'aluno') {
    throw new HttpsError('failed-precondition', 'O usuário informado não é aluno.');
  }

  if (!callerProfile.academia_id || alunoData.academia_id !== callerProfile.academia_id) {
    throw new HttpsError('permission-denied', 'Sem permissão para excluir usuário de outra academia.');
  }

  const treinoAssociadoSnap = await db
    .collection('treinos')
    .where('aluno_id', '==', alunoId)
    .limit(1)
    .get();

  if (!treinoAssociadoSnap.empty) {
    throw new HttpsError('failed-precondition', 'Não é possível excluir aluno com treino associado.');
  }

  const email = String(alunoData.email || '').trim().toLowerCase();
  if (email) {
    await db.collection('emails_bloqueados').doc(email).set({
      email,
      blocked_at: admin.firestore.FieldValue.serverTimestamp(),
      blocked_by: callerUid,
      reason: 'aluno_deleted_firestore_only'
    }, { merge: true });
  }

  await alunoRef.delete();

  logger.info('Aluno excluído com segurança', {
    callerUid,
    alunoId,
    academiaId: callerProfile.academia_id
  });

  return { success: true };
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

exports.limparVinculoTreinosAlunoExcluido = onDocumentDeleted(
  {
    document: 'users/{userId}',
    region: 'us-central1'
  },
  async (event) => {
    const userId = event.params?.userId;
    const deletedData = event.data?.data() || {};

    if (!userId || deletedData.role !== 'aluno') {
      return;
    }

    const db = admin.firestore();
    let totalTreinosAtualizados = 0;
    let totalSessoesRemovidas = 0;
    let totalNotificacoesRemovidas = 0;
    let cursor = null;

    while (true) {
      let query = db
        .collection('treinos')
        .where('aluno_id', '==', userId)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(400);

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { aluno_id: '' });
      });

      await batch.commit();
      totalTreinosAtualizados += snapshot.size;
      cursor = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.size < 400) {
        break;
      }
    }

    cursor = null;
    while (true) {
      let query = db
        .collection('sessoes_treino')
        .where('aluno_id', '==', userId)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(400);

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      totalSessoesRemovidas += snapshot.size;
      cursor = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.size < 400) {
        break;
      }
    }

    cursor = null;
    while (true) {
      let query = db
        .collection('notificacoes')
        .where('aluno_id', '==', userId)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(400);

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      totalNotificacoesRemovidas += snapshot.size;
      cursor = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.size < 400) {
        break;
      }
    }

    logger.info('Limpeza de dados órfãos concluída para aluno excluído', {
      userId,
      totalTreinosAtualizados,
      totalSessoesRemovidas,
      totalNotificacoesRemovidas
    });
  }
);
