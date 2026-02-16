import { auth, db, functions } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getAuth, signOut } from 'firebase/auth';
import { setPersistence, inMemoryPersistence } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import Constants from 'expo-constants';
import { isValidEmail, normalizeEmail } from '../utils/validation';

const ROLE_ALUNO = 'aluno';
const ROLE_PROFESSOR = 'professor';
const ROLE_ADMIN_SISTEMA = 'admin_sistema';
const ROLE_ADMIN_ACADEMIA = 'admin_academia';

function getFirebaseClientConfig() {
  const extra = Constants.expoConfig?.extra || {};
  const projectId = extra.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'meu-treino-eleitos';

  return {
    apiKey: extra.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: extra.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: extra.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: extra.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: extra.EXPO_PUBLIC_FIREBASE_APP_ID || ''
  };
}

function getDefaultPasswordByRole(role) {
  const extra = Constants.expoConfig?.extra || {};
  if (role === ROLE_PROFESSOR || role === ROLE_ADMIN_ACADEMIA) {
    return extra.DEFAULT_TEACHER_PASSWORD || extra.DEFAULT_STUDENT_PASSWORD || '';
  }
  return extra.DEFAULT_STUDENT_PASSWORD || '';
}

async function getCurrentUserProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

async function isCurrentUserSystemAdmin() {
  const me = await getCurrentUserProfile();
  return me?.role === ROLE_ADMIN_SISTEMA;
}

async function isCurrentUserAcademyStaff() {
  const me = await getCurrentUserProfile();
  return me?.role === ROLE_ADMIN_ACADEMIA || me?.role === ROLE_PROFESSOR;
}

async function isCurrentUserAcademyAdmin() {
  const me = await getCurrentUserProfile();
  return me?.role === ROLE_ADMIN_ACADEMIA;
}

async function getCurrentUserAcademiaId() {
  const me = await getCurrentUserProfile();
  return me?.academia_id || null;
}

async function ensureAcademiaExists(academiaId) {
  if (!academiaId) throw new Error('Academia é obrigatória');
  const snapshot = await getDoc(doc(db, 'academias', academiaId));
  if (!snapshot.exists()) throw new Error('Academia não encontrada');
}

export async function hasSystemAdmin() {
  const adminLockRef = doc(db, 'system', 'admin_lock');
  const adminLockSnap = await getDoc(adminLockRef);
  return adminLockSnap.exists();
}

async function createAuthUserWithoutReplacingSession(email, password) {
  const secondaryAppName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(getFirebaseClientConfig(), secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    await setPersistence(secondaryAuth, inMemoryPersistence);
    const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return userCred.user.uid;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

// Cria um usuário aluno e registra no Firestore conforme schema
export async function createAluno({ nome, email }) {
  const defaultPassword = getDefaultPasswordByRole('aluno');
  console.log('createAluno - defaultPassword configured:', !!defaultPassword);
  
  if (!defaultPassword) throw new Error('DEFAULT_STUDENT_PASSWORD não configurada');
  
  // Remover espaços e converter nome para MAIÚSCULO
  const nomeUpperCase = nome.trim().toUpperCase();
  const emailNormalizado = normalizeEmail(email);

  if (!isValidEmail(emailNormalizado)) {
    throw new Error('E-mail inválido');
  }
  
  // Impedir criação de ADMIN por este método
  if (nomeUpperCase === 'ADMIN') {
    throw new Error('Não é possível criar ADMIN através deste método. Use o registro normal.');
  }

  const uid = await createAuthUserWithoutReplacingSession(emailNormalizado, defaultPassword);
  const academiaId = await getCurrentUserAcademiaId();
  if (!academiaId) {
    throw new Error('Apenas usuários vinculados a uma academia podem criar alunos');
  }

  await setDoc(doc(db, 'users', uid), {
    nome: nomeUpperCase,
    email: emailNormalizado,
    role: ROLE_ALUNO,
    academia_id: academiaId,
    primeiro_acesso: true
  });

  return { uid };
}

// Registra um novo usuário (professor ou aluno)
// REGRA: Apenas nome "ADMIN" pode ser professor, demais são sempre alunos
// Nome sempre convertido para MAIÚSCULO para garantir unicidade
export async function registerUser({ nome, email, password, role, academiaId, academia_id }) {
  console.log('registerUser called with:', { nome, email, role, academiaId, hasPassword: !!password });
  
  // Remover espaços e converter nome para MAIÚSCULO
  const nomeUpperCase = nome.trim().toUpperCase();
  const emailNormalizado = normalizeEmail(email);

  if (!isValidEmail(emailNormalizado)) {
    throw new Error('E-mail inválido');
  }
  
  const roleSolicitada = role || (nomeUpperCase === 'ADMIN' ? ROLE_ADMIN_SISTEMA : ROLE_ALUNO);
  const rolesValidas = [ROLE_ALUNO, ROLE_ADMIN_SISTEMA, ROLE_ADMIN_ACADEMIA];
  if (!rolesValidas.includes(roleSolicitada)) {
    throw new Error('Tipo de usuário inválido');
  }

  const currentUid = auth.currentUser?.uid || null;
  const adminLockRef = doc(db, 'system', 'admin_lock');
  const adminLockSnap = await getDoc(adminLockRef);

  if (!currentUid) {
    if (roleSolicitada !== ROLE_ADMIN_SISTEMA) {
      throw new Error('Cadastro público permitido apenas para o primeiro admin do sistema');
    }
    if (adminLockSnap.exists()) {
      throw new Error('Cadastro público desabilitado. Solicite criação de conta ao administrador');
    }
  }
  
  try {
    // Primeiro cria a conta no Firebase Auth
    const userCred = await createUserWithEmailAndPassword(auth, emailNormalizado, password);
    const uid = userCred.user.uid;
    console.log('User created in Auth:', uid);

    if (roleSolicitada === ROLE_ADMIN_SISTEMA) {
      if (adminLockSnap.exists()) {
        // Já existe ADMIN, deletar conta recém criada e lançar erro
        await userCred.user.delete();
        throw new Error('Já existe um administrador cadastrado no sistema. Apenas um ADMIN é permitido.');
      }
      
      // Criar documento de lock ANTES de criar o perfil
      await setDoc(adminLockRef, {
        admin_uid: uid,
        created_at: serverTimestamp(),
        email: emailNormalizado
      });
    }

    let academiaIdVinculo = null;
    if (roleSolicitada === ROLE_ADMIN_ACADEMIA) {
      academiaIdVinculo = String(academiaId || academia_id || '').trim();
      await ensureAcademiaExists(academiaIdVinculo);
    }

    // Criar perfil no Firestore
    await setDoc(doc(db, 'users', uid), {
      nome: nomeUpperCase,
      email: emailNormalizado,
      role: roleSolicitada,
      academia_id: academiaIdVinculo || null,
      primeiro_acesso: false
    });
    console.log('User profile created in Firestore');

    return { uid };
  } catch (error) {
    console.error('Error in registerUser:', error);
    throw error;
  }
}

export async function createProfessor({ nome, email }) {
  const defaultPassword = getDefaultPasswordByRole('professor');
  if (!defaultPassword) throw new Error('DEFAULT_TEACHER_PASSWORD ou DEFAULT_STUDENT_PASSWORD não configurada');

  const academyAdmin = await isCurrentUserAcademyAdmin();
  if (!academyAdmin) throw new Error('Apenas admin de academia pode criar professor');
  const academiaId = await getCurrentUserAcademiaId();
  if (!academiaId) throw new Error('Usuário atual não está vinculado a uma academia');

  const nomeUpperCase = nome.trim().toUpperCase();
  const emailNormalizado = normalizeEmail(email);
  if (!nomeUpperCase) throw new Error('Nome é obrigatório');
  if (!isValidEmail(emailNormalizado)) throw new Error('E-mail inválido');

  const uid = await createAuthUserWithoutReplacingSession(emailNormalizado, defaultPassword);

  await setDoc(doc(db, 'users', uid), {
    nome: nomeUpperCase,
    email: emailNormalizado,
    role: ROLE_PROFESSOR,
    academia_id: academiaId,
    primeiro_acesso: true
  });

  return { uid };
}

export async function listAllProfessores() {
  const usersCol = collection(db, 'users');
  const academiaId = await getCurrentUserAcademiaId();
  const q = academiaId
    ? query(usersCol, where('role', '==', ROLE_PROFESSOR), where('academia_id', '==', academiaId))
    : query(usersCol, where('role', '==', ROLE_PROFESSOR));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
}

export async function deleteProfessorProfile(professorId) {
  const academyAdmin = await isCurrentUserAcademyAdmin();
  if (!academyAdmin) throw new Error('Apenas admin de academia pode excluir professor');

  const ref = doc(db, 'users', professorId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Professor não encontrado');

  const data = snap.data();
  if (data.role !== ROLE_PROFESSOR) {
    throw new Error('O usuário informado não é professor');
  }
  if (data.role === ROLE_ADMIN_SISTEMA) {
    throw new Error('Não é permitido excluir o admin do sistema');
  }

  const minhaAcademia = await getCurrentUserAcademiaId();
  if (minhaAcademia && data.academia_id !== minhaAcademia) {
    throw new Error('Sem permissão para excluir usuário de outra academia');
  }

  const emailNormalizado = normalizeEmail(data.email || '');
  if (emailNormalizado) {
    await setDoc(doc(db, 'emails_bloqueados', emailNormalizado), {
      email: emailNormalizado,
      blocked_at: serverTimestamp(),
      blocked_by: auth.currentUser?.uid || null,
      reason: 'professor_deleted_firestore_only'
    }, { merge: true });
  }

  await deleteDoc(ref);
}

export async function deleteAlunoProfile(alunoId) {
  const academyAdmin = await isCurrentUserAcademyAdmin();
  if (!academyAdmin) throw new Error('Apenas admin de academia pode excluir aluno');

  const alunoIdNormalizado = String(alunoId || '').trim();
  if (!alunoIdNormalizado) throw new Error('Aluno inválido');

  const deleteByFirestore = async () => {
    const ref = doc(db, 'users', alunoIdNormalizado);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Aluno não encontrado');

    const data = snap.data();
    if (data.role !== ROLE_ALUNO) {
      throw new Error('O usuário informado não é aluno');
    }

    const minhaAcademia = await getCurrentUserAcademiaId();
    if (minhaAcademia && data.academia_id !== minhaAcademia) {
      throw new Error('Sem permissão para excluir usuário de outra academia');
    }

    const treinosCol = collection(db, 'treinos');
    const treinoAssociadoQ = query(treinosCol, where('aluno_id', '==', alunoIdNormalizado), limit(1));
    const treinoAssociadoSnap = await getDocs(treinoAssociadoQ);
    if (!treinoAssociadoSnap.empty) {
      throw new Error('Não é possível excluir aluno com treino associado');
    }

    const emailNormalizado = normalizeEmail(data.email || '');
    if (emailNormalizado) {
      await setDoc(doc(db, 'emails_bloqueados', emailNormalizado), {
        email: emailNormalizado,
        blocked_at: serverTimestamp(),
        blocked_by: auth.currentUser?.uid || null,
        reason: 'aluno_deleted_firestore_only'
      }, { merge: true });
    }

    await deleteDoc(ref);
  };

  const isWebLocalhost = (() => {
    try {
      const host = String(globalThis?.location?.host || '').toLowerCase();
      return host.includes('localhost') || host.includes('127.0.0.1');
    } catch (_) {
      return false;
    }
  })();

  try {
    if (!functions || isWebLocalhost) {
      await deleteByFirestore();
      return;
    }

    const callable = httpsCallable(functions, 'deleteAlunoProfileSecure');
    await callable({ alunoId: alunoIdNormalizado });
  } catch (error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    const shouldFallback =
      code.includes('functions/unavailable')
      || code.includes('functions/not-found')
      || code.includes('not-found')
      || code.includes('unavailable')
      || message.includes('cors')
      || message.includes('failed to fetch')
      || message.includes('network');

    if (!shouldFallback) throw error;

    await deleteByFirestore();
  }
}

export async function updateManagedUserProfile({ userId, nome, email }) {
  const academyAdmin = await isCurrentUserAcademyAdmin();
  if (!academyAdmin) throw new Error('Apenas admin de academia pode editar usuários');

  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Usuário não encontrado');

  const data = snap.data();
  if (![ROLE_ALUNO, ROLE_PROFESSOR].includes(data.role)) {
    throw new Error('Apenas alunos e professores podem ser editados nesta tela');
  }

  const minhaAcademia = await getCurrentUserAcademiaId();
  if (minhaAcademia && data.academia_id !== minhaAcademia) {
    throw new Error('Sem permissão para editar usuário de outra academia');
  }

  const payload = {};

  const nomeNormalizado = String(nome || '').trim();
  if (nomeNormalizado) {
    payload.nome = nomeNormalizado.toUpperCase();
  }

  if (data.role === ROLE_ALUNO && email !== undefined) {
    const emailAtual = normalizeEmail(data.email || '');
    const emailSolicitado = normalizeEmail(email);
    if (emailSolicitado !== emailAtual) {
      throw new Error('Não é permitido alterar o e-mail do aluno. Apenas o nome pode ser atualizado');
    }
  }

  if (email !== undefined) {
    const emailNormalizado = normalizeEmail(email);
    if (!isValidEmail(emailNormalizado)) throw new Error('E-mail inválido');
    if (data.role !== ROLE_ALUNO) {
      payload.email = emailNormalizado;
    }
  }

  if (!Object.keys(payload).length) return;

  await updateDoc(ref, payload);
}

export async function unblockBlockedEmail(email) {
  const admin = await isCurrentUserSystemAdmin();
  if (!admin) throw new Error('Apenas admin do sistema pode desbloquear e-mail');

  const emailNormalizado = normalizeEmail(email);
  if (!isValidEmail(emailNormalizado)) throw new Error('E-mail inválido');

  const ref = doc(db, 'emails_bloqueados', emailNormalizado);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    throw new Error('E-mail não está bloqueado');
  }

  await deleteDoc(ref);
}

export async function login({ email, password }) {
  const emailNormalizado = normalizeEmail(email);
  if (!isValidEmail(emailNormalizado)) {
    throw new Error('E-mail inválido');
  }

  const cred = await signInWithEmailAndPassword(auth, emailNormalizado, password);
  const uid = cred.user.uid;
  const snapshot = await getDoc(doc(db, 'users', uid));
  const data = snapshot.exists() ? snapshot.data() : null;
  return { uid, profile: data };
}

export async function changePassword(newPassword) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado');
  await updatePassword(auth.currentUser, newPassword);
}

export async function setPrimeiroAcessoFalse(uid) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { primeiro_acesso: false });
}

// Listar todos os alunos (para professores)
export async function listAllAlunos() {
  const usersCol = collection(db, 'users');
  const academiaId = await getCurrentUserAcademiaId();
  const q = academiaId
    ? query(usersCol, where('role', '==', ROLE_ALUNO), where('academia_id', '==', academiaId))
    : query(usersCol, where('role', '==', ROLE_ALUNO));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createAcademia({ nome }) {
  const isSystemAdmin = await isCurrentUserSystemAdmin();
  if (!isSystemAdmin) throw new Error('Apenas admin do sistema pode cadastrar academias');

  const nomeNormalizado = String(nome || '').trim();
  if (!nomeNormalizado) throw new Error('Nome da academia é obrigatório');

  const id = `acad_${Date.now()}`;
  await setDoc(doc(db, 'academias', id), {
    nome: nomeNormalizado,
    nome_upper: nomeNormalizado.toUpperCase(),
    criado_por: auth.currentUser?.uid || null,
    created_at: serverTimestamp(),
    ativa: true
  });

  return { id };
}

export async function listAcademias() {
  const snap = await getDocs(collection(db, 'academias'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
}

export async function createAcademiaAdmin({ nome, email, academia_id }) {
  const isSystemAdmin = await isCurrentUserSystemAdmin();
  if (!isSystemAdmin) throw new Error('Apenas admin do sistema pode criar admin de academia');

  const defaultPassword = getDefaultPasswordByRole(ROLE_ADMIN_ACADEMIA);
  if (!defaultPassword) throw new Error('Senha padrão não configurada');

  const nomeUpperCase = String(nome || '').trim().toUpperCase();
  const emailNormalizado = normalizeEmail(email);
  if (!nomeUpperCase) throw new Error('Nome é obrigatório');
  if (!isValidEmail(emailNormalizado)) throw new Error('E-mail inválido');

  const academiaId = String(academia_id || '').trim();
  await ensureAcademiaExists(academiaId);

  const uid = await createAuthUserWithoutReplacingSession(emailNormalizado, defaultPassword);
  await setDoc(doc(db, 'users', uid), {
    nome: nomeUpperCase,
    email: emailNormalizado,
    role: ROLE_ADMIN_ACADEMIA,
    academia_id: academiaId,
    primeiro_acesso: true
  });

  return { uid };
}

export async function getSystemDashboardStats() {
  const isSystemAdmin = await isCurrentUserSystemAdmin();
  if (!isSystemAdmin) throw new Error('Apenas admin do sistema pode acessar os indicadores');

  const [academiasSnap, usersSnap, treinosSnap, notificacoesSnap] = await Promise.all([
    getDocs(collection(db, 'academias')),
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'treinos')),
    getDocs(collection(db, 'notificacoes'))
  ]);

  const academias = academiasSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const users = usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const treinos = treinosSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  const notificacoes = notificacoesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  const usersById = users.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const porAcademia = academias
    .map((academia) => {
      const usuariosAcademia = users.filter((u) => u.academia_id === academia.id);
      const alunos = usuariosAcademia.filter((u) => u.role === ROLE_ALUNO).length;
      const professores = usuariosAcademia.filter((u) => u.role === ROLE_PROFESSOR).length;
      const adminsAcademia = usuariosAcademia.filter((u) => u.role === ROLE_ADMIN_ACADEMIA).length;

      const treinoCount = treinos.filter((t) => {
        const professor = usersById[t.professor_id];
        return professor?.academia_id === academia.id;
      }).length;

      const notifCount = notificacoes.filter((n) => {
        const professor = usersById[n.professor_id];
        return professor?.academia_id === academia.id;
      }).length;

      return {
        academia_id: academia.id,
        academia_nome: academia.nome || academia.id,
        alunos,
        professores,
        admins_academia: adminsAcademia,
        usuarios_total: usuariosAcademia.length,
        treinos: treinoCount,
        notificacoes: notifCount
      };
    })
    .sort((a, b) => b.usuarios_total - a.usuarios_total || a.academia_nome.localeCompare(b.academia_nome));

  const totalAcademias = academias.length;
  const totalAlunos = users.filter((u) => u.role === ROLE_ALUNO).length;
  const totalProfessores = users.filter((u) => u.role === ROLE_PROFESSOR).length;
  const totalAdminsAcademia = users.filter((u) => u.role === ROLE_ADMIN_ACADEMIA).length;
  const totalTreinos = treinos.length;
  const totalTreinosModelo = treinos.filter((t) => !String(t?.aluno_id || '').trim()).length;
  const totalTreinosVinculados = treinos.filter((t) => String(t?.aluno_id || '').trim().length > 0).length;
  const totalNotificacoes = notificacoes.length;
  const mediaAlunosPorAcademia = totalAcademias > 0 ? Number((totalAlunos / totalAcademias).toFixed(1)) : 0;
  const academiaComMaisAlunos = porAcademia.length > 0 ? porAcademia.slice().sort((a, b) => b.alunos - a.alunos)[0] : null;

  return {
    resumo: {
      total_academias: totalAcademias,
      total_alunos: totalAlunos,
      total_professores: totalProfessores,
      total_admins_academia: totalAdminsAcademia,
      total_treinos: totalTreinos,
      total_treinos_modelo: totalTreinosModelo,
      total_treinos_vinculados: totalTreinosVinculados,
      total_notificacoes: totalNotificacoes,
      media_alunos_por_academia: mediaAlunosPorAcademia,
      academia_com_mais_alunos: academiaComMaisAlunos
        ? {
            nome: academiaComMaisAlunos.academia_nome,
            alunos: academiaComMaisAlunos.alunos
          }
        : null
    },
    por_academia: porAcademia
  };
}
