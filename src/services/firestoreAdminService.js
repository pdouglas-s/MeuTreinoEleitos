import { auth, db } from '../firebase/config';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

const DEFAULT_SELECT_LIMIT = 25;

function normalizePath(path) {
  return String(path || '').trim().replace(/^\/+|\/+$/g, '');
}

function normalizeDocId(id) {
  return String(id || '').trim();
}

async function ensureSystemAdmin() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');

  const profileSnap = await getDoc(doc(db, 'users', uid));
  if (!profileSnap.exists()) throw new Error('Perfil do usuário não encontrado');

  const profile = profileSnap.data() || {};
  if (profile.role !== 'admin_sistema') {
    throw new Error('Apenas admin do sistema pode acessar o console do Firestore');
  }
}

function normalizeSelectLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SELECT_LIMIT;
  return Math.min(100, Math.floor(parsed));
}

function normalizeSelectFilters(filters) {
  if (!Array.isArray(filters)) return [];

  return filters
    .map((item) => ({
      field: String(item?.field || '').trim(),
      op: String(item?.op || '==').trim(),
      value: item?.value
    }))
    .filter((item) => item.field);
}

function normalizeSort(sort) {
  const field = String(sort?.field || '').trim();
  const direction = String(sort?.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  return field ? { field, direction } : null;
}

function getByPath(source, path) {
  const keys = String(path || '').split('.').filter(Boolean);
  let current = source;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

function compareValues(left, op, right) {
  switch (op) {
    case '==': return left === right;
    case '!=': return left !== right;
    case '<': return left < right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '>=': return left >= right;
    default: return false;
  }
}

function applyFilterAndSort(items, filters, sort, maxItems) {
  let result = Array.isArray(items) ? [...items] : [];

  if (Array.isArray(filters) && filters.length > 0) {
    result = result.filter((item) => filters.every((rule) => {
      const left = getByPath(item, rule.field);
      return compareValues(left, rule.op, rule.value);
    }));
  }

  if (sort?.field) {
    result.sort((a, b) => {
      const aValue = getByPath(a, sort.field);
      const bValue = getByPath(b, sort.field);

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sort.direction === 'desc' ? 1 : -1;
      if (bValue == null) return sort.direction === 'desc' ? -1 : 1;

      if (aValue > bValue) return sort.direction === 'desc' ? -1 : 1;
      if (aValue < bValue) return sort.direction === 'desc' ? 1 : -1;
      return 0;
    });
  }

  return result.slice(0, maxItems);
}

function isIndexError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('failed-precondition') && message.includes('requires an index');
}

export async function adminSelectFirestore({
  collectionPath,
  documentId,
  limitCount = DEFAULT_SELECT_LIMIT,
  filters = [],
  sort = null
}) {
  await ensureSystemAdmin();

  const path = normalizePath(collectionPath);
  const docId = normalizeDocId(documentId);
  if (!path) throw new Error('Informe a coleção');
  const maxItems = normalizeSelectLimit(limitCount);

  if (docId) {
    const snap = await getDoc(doc(db, path, docId));
    if (!snap.exists()) return [];
    return [{ id: snap.id, ...snap.data() }];
  }

  const constraints = [];
  const normalizedFilters = normalizeSelectFilters(filters);
  const normalizedSort = normalizeSort(sort);

  normalizedFilters.forEach((item) => {
    constraints.push(where(item.field, item.op, item.value));
  });

  const fetchLimit = normalizedSort ? Math.min(500, Math.max(maxItems * 5, maxItems)) : maxItems;
  constraints.push(limit(fetchLimit));

  try {
    const q = query(collection(db, path), ...constraints);
    const snap = await getDocs(q);
    const docs = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    return applyFilterAndSort(docs, normalizedFilters, normalizedSort, maxItems);
  } catch (error) {
    if (!isIndexError(error)) throw error;

    const fallbackSnap = await getDocs(query(collection(db, path), limit(500)));
    const docs = fallbackSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    return applyFilterAndSort(docs, normalizedFilters, normalizedSort, maxItems);
  }
}

export async function adminInsertFirestore({ collectionPath, documentId, payload }) {
  await ensureSystemAdmin();

  const path = normalizePath(collectionPath);
  const docId = normalizeDocId(documentId);
  if (!path) throw new Error('Informe a coleção');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload inválido para inserção');
  }

  if (docId) {
    await setDoc(doc(db, path, docId), payload);
    return { id: docId };
  }

  const created = await addDoc(collection(db, path), payload);
  return { id: created.id };
}

export async function adminUpdateFirestore({ collectionPath, documentId, payload }) {
  await ensureSystemAdmin();

  const path = normalizePath(collectionPath);
  const docId = normalizeDocId(documentId);
  if (!path) throw new Error('Informe a coleção');
  if (!docId) throw new Error('Informe o ID do documento para atualizar');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload inválido para atualização');
  }

  await updateDoc(doc(db, path, docId), payload);
  return { id: docId };
}

export async function adminDeleteFirestore({ collectionPath, documentId }) {
  await ensureSystemAdmin();

  const path = normalizePath(collectionPath);
  const docId = normalizeDocId(documentId);
  if (!path) throw new Error('Informe a coleção');
  if (!docId) throw new Error('Informe o ID do documento para excluir');

  await deleteDoc(doc(db, path, docId));
  return { id: docId };
}
