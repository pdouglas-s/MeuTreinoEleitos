import { db } from '../firebase/config';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';

/**
 * Envia notificação para o professor
 */
export async function enviarNotificacao(professorId, alunoId, tipo, dados) {
  const notifRef = collection(db, 'notificacoes');
  
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
      break;
    default:
      mensagem = 'Nova atividade do aluno';
  }
  
  const docRef = await addDoc(notifRef, {
    professor_id: professorId,
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
 * Lista notificações de um professor
 */
export async function listarNotificacoesProfessor(professorId, somenteNaoLidas = false) {
  let q = query(
    collection(db, 'notificacoes'),
    where('professor_id', '==', professorId),
    orderBy('created_at', 'desc')
  );
  
  if (somenteNaoLidas) {
    q = query(
      collection(db, 'notificacoes'),
      where('professor_id', '==', professorId),
      where('lida', '==', false),
      orderBy('created_at', 'desc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
