const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();

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
