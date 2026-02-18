import { db } from '../firebase/config';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, arrayUnion, documentId, getDoc } from 'firebase/firestore';

const exerciciosCol = collection(db, 'exercicios');

function normalizeAcademiaId(academiaId) {
  return String(academiaId || '').trim();
}

function isExercicioPadraoVisivelParaAcademia(exercicio, academiaId) {
  if (exercicio?.is_padrao !== true) return true;

  const academiaIdNormalizado = normalizeAcademiaId(academiaId);
  if (!academiaIdNormalizado) return true;

  const ocultoParaAcademias = Array.isArray(exercicio?.oculto_para_academias)
    ? exercicio.oculto_para_academias.map((item) => normalizeAcademiaId(item)).filter(Boolean)
    : [];

  return !ocultoParaAcademias.includes(academiaIdNormalizado);
}

// Criar novo exercício no banco
export async function createExercicio({ nome, categoria, descricao, series_padrao, repeticoes_padrao, carga_padrao, criado_por, academia_id, is_padrao }) {
  const data = { nome, categoria };
  if (descricao) data.descricao = descricao;
  if (series_padrao) data.series_padrao = series_padrao;
  if (repeticoes_padrao) data.repeticoes_padrao = repeticoes_padrao;
  if (carga_padrao) data.carga_padrao = carga_padrao;
  if (criado_por) data.criado_por = criado_por; // UID do professor que criou
  if (academia_id) data.academia_id = academia_id;
  if (is_padrao !== undefined) data.is_padrao = is_padrao; // Flag para exercícios padrão do sistema
  
  const docRef = await addDoc(exerciciosCol, data);
  return { id: docRef.id };
}

// Listar todos os exercícios
export async function listAllExercicios({ academiaId } = {}) {
  const snap = await getDocs(exerciciosCol);
  const exercicios = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return exercicios.filter((item) => isExercicioPadraoVisivelParaAcademia(item, academiaId));
}

// Listar exercícios por categoria
export async function listExerciciosByCategoria(categoria) {
  const q = query(exerciciosCol, where('categoria', '==', categoria));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Buscar exercícios por nome (parcial)
export async function searchExerciciosByNome(termo) {
  const all = await listAllExercicios();
  const termoLower = termo.toLowerCase();
  return all.filter(ex => ex.nome.toLowerCase().includes(termoLower));
}

// Atualizar exercício
export async function updateExercicio(exercicio_id, data) {
  const ref = doc(db, 'exercicios', exercicio_id);
  await updateDoc(ref, data);
}

// Personalizar exercício padrão para uma academia sem alterar o padrão global
export async function personalizarExercicioPadraoParaAcademia({ exercicioPadrao, payload = {}, academiaId, criadoPor }) {
  const academiaIdNormalizado = normalizeAcademiaId(academiaId);
  if (!exercicioPadrao?.id || !academiaIdNormalizado) {
    throw new Error('Dados inválidos para personalizar exercício padrão');
  }

  const nome = String(payload?.nome || exercicioPadrao?.nome || '').trim();
  const categoria = String(payload?.categoria || exercicioPadrao?.categoria || '').trim();
  if (!nome) throw new Error('Nome do exercício é obrigatório');

  const dataAcademia = {
    nome,
    categoria,
    series_padrao: payload?.series_padrao ?? null,
    repeticoes_padrao: payload?.repeticoes_padrao ?? null,
    is_padrao: false,
    academia_id: academiaIdNormalizado,
    criado_por: criadoPor || null,
    origem_exercicio_padrao_id: exercicioPadrao.id
  };

  const q = query(
    exerciciosCol,
    where('origem_exercicio_padrao_id', '==', exercicioPadrao.id),
    where('academia_id', '==', academiaIdNormalizado)
  );
  const existing = await getDocs(q);

  if (existing.docs.length > 0) {
    const refExistente = existing.docs[0].ref;
    await updateDoc(refExistente, dataAcademia);
  } else {
    await addDoc(exerciciosCol, dataAcademia);
  }

  const refPadrao = doc(db, 'exercicios', exercicioPadrao.id);
  let ocultacaoAplicada = true;

  try {
    await updateDoc(refPadrao, {
      oculto_para_academias: arrayUnion(academiaIdNormalizado)
    });
  } catch (err) {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    const isPermissionError = code.includes('permission-denied') || message.includes('insufficient permissions');

    if (!isPermissionError) {
      throw err;
    }

    ocultacaoAplicada = false;
  }

  return { ocultacaoAplicada };
}

export async function ocultarExercicioPadraoParaAcademia({ exercicioPadraoId, academiaId }) {
  const academiaIdNormalizado = normalizeAcademiaId(academiaId);
  const exercicioPadraoIdNormalizado = String(exercicioPadraoId || '').trim();

  if (!academiaIdNormalizado || !exercicioPadraoIdNormalizado) {
    throw new Error('Dados inválidos para ocultar exercício padrão da academia');
  }

  const refPadrao = doc(db, 'exercicios', exercicioPadraoIdNormalizado);
  await updateDoc(refPadrao, {
    oculto_para_academias: arrayUnion(academiaIdNormalizado)
  });

  const snapAtualizado = await getDoc(refPadrao);
  const ocultoParaAcademias = Array.isArray(snapAtualizado.data()?.oculto_para_academias)
    ? snapAtualizado.data().oculto_para_academias.map((item) => normalizeAcademiaId(item)).filter(Boolean)
    : [];

  if (!ocultoParaAcademias.includes(academiaIdNormalizado)) {
    throw new Error('A ocultação do exercício padrão não foi persistida para a academia.');
  }

  return { ocultacaoAplicada: true };
}

// Deletar exercício
export async function deleteExercicio(exercicio_id) {
  const ref = doc(db, 'exercicios', exercicio_id);
  await deleteDoc(ref);
}

// Deletar personalizações de academia derivadas de exercícios padrão
export async function deleteCustomizacoesExerciciosPadrao(onProgress) {
  const snap = await getDocs(exerciciosCol);
  const customizacoes = snap.docs.filter((itemDoc) => {
    const origem = String(itemDoc.data()?.origem_exercicio_padrao_id || '').trim();
    return !!origem;
  });

  const total = customizacoes.length;
  if (onProgress) onProgress(0, total, `Encontradas ${total} personalizações para remover...`);

  for (let i = 0; i < customizacoes.length; i++) {
    const itemDoc = customizacoes[i];
    if (onProgress) {
      onProgress(i, total, `Removendo personalização: ${itemDoc.data()?.nome || 'exercício'}`);
    }
    await deleteDoc(itemDoc.ref);
  }

  if (onProgress) onProgress(total, total, 'Personalizações removidas!');
  return total;
}

function chunkArray(list, size) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

export async function exercicioTemAlunoAssociado({
  exercicioId,
  exercicioNome,
  academiaId = null,
  allowNameFallback = false,
  strictAcademiaScope = false
}) {
  const treinoIds = new Set();

  const idNormalizado = String(exercicioId || '').trim();
  const nomeNormalizado = String(exercicioNome || '').trim();
  const academiaIdNormalizado = normalizeAcademiaId(academiaId);

  if (strictAcademiaScope && academiaIdNormalizado && idNormalizado) {
    const treinosAcademiaSnap = await getDocs(
      query(collection(db, 'treinos'), where('academia_id', '==', academiaIdNormalizado))
    );

    const treinoIdsComAluno = treinosAcademiaSnap.docs
      .filter((treinoDoc) => {
        const treinoData = treinoDoc.data() || {};
        const alunoId = String(treinoData?.aluno_id || '').trim();
        return !!alunoId;
      })
      .map((treinoDoc) => treinoDoc.id)
      .filter(Boolean);

    if (!treinoIdsComAluno.length) return false;

    const batchesAcademia = chunkArray(treinoIdsComAluno, 10);
    for (const batch of batchesAcademia) {
      const itensSnap = await getDocs(
        query(
          collection(db, 'treino_itens'),
          where('treino_id', 'in', batch),
          where('exercicio_id', '==', idNormalizado)
        )
      );
      if (!itensSnap.empty) return true;
    }

    return false;
  }

  if (idNormalizado) {
    const itensById = await getDocs(query(collection(db, 'treino_itens'), where('exercicio_id', '==', idNormalizado)));
    itensById.docs.forEach((itemDoc) => {
      const treinoId = String(itemDoc.data()?.treino_id || '').trim();
      if (treinoId) treinoIds.add(treinoId);
    });
  }

  if ((!idNormalizado || allowNameFallback) && nomeNormalizado) {
    const itensByNome = await getDocs(query(collection(db, 'treino_itens'), where('exercicio_nome', '==', nomeNormalizado)));
    itensByNome.docs.forEach((itemDoc) => {
      const treinoId = String(itemDoc.data()?.treino_id || '').trim();
      if (treinoId) treinoIds.add(treinoId);
    });
  }

  const treinoIdsList = Array.from(treinoIds);
  if (!treinoIdsList.length) return false;

  const batches = chunkArray(treinoIdsList, 10);
  for (const batch of batches) {
    const treinosSnap = await getDocs(query(collection(db, 'treinos'), where(documentId(), 'in', batch)));
    const encontrouAssociado = treinosSnap.docs.some((treinoDoc) => {
      const treinoData = treinoDoc.data() || {};
      const treinoAcademiaId = normalizeAcademiaId(treinoData?.academia_id);

      if (academiaIdNormalizado) {
        if (strictAcademiaScope) {
          if (treinoAcademiaId !== academiaIdNormalizado) return false;
        } else if (treinoAcademiaId && treinoAcademiaId !== academiaIdNormalizado) {
          return false;
        }
      }

      const alunoId = String(treinoData?.aluno_id || '').trim();
      return !!alunoId;
    });
    if (encontrouAssociado) return true;
  }

  return false;
}

// Deletar todos os exercícios padrão (is_padrao === true)
export async function deleteExerciciosPadrao(onProgress) {
  const q = query(exerciciosCol, where('is_padrao', '==', true));
  const snap = await getDocs(q);
  const total = snap.docs.length;
  
  if (onProgress) onProgress(0, total, `Encontrados ${total} exercícios padrão para excluir...`);
  
  // Deletar sequencialmente para garantir progresso preciso
  for (let i = 0; i < snap.docs.length; i++) {
    const doc = snap.docs[i];
    if (onProgress) {
      onProgress(i, total, `Excluindo: ${doc.data().nome || 'exercício'}`);
    }
    await deleteDoc(doc.ref);
  }
  
  if (onProgress) onProgress(total, total, 'Exclusão concluída!');
  return total;
}

// Verificar se existem exercícios padrão
export async function existemExerciciosPadrao() {
  const q = query(exerciciosCol, where('is_padrao', '==', true));
  const snap = await getDocs(q);
  return snap.docs.length > 0;
}

// Inicializar banco com exercícios comuns (executar uma vez)
export async function inicializarBancoExercicios(onProgress) {
  const exerciciosComuns = [
    // ==================== PEITO (18) ====================
    { nome: 'Supino Reto com Barra', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Supino Reto com Halteres', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Supino Inclinado com Barra', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Supino Inclinado com Halteres', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Supino Declinado com Barra', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Supino Declinado com Halteres', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Supino na Máquina', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Crucifixo Reto', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Crucifixo Inclinado', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Crucifixo Declinado', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Cross Over Alto', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Cross Over Médio', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Cross Over Baixo', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Flexão de Braço', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Flexão Declinada', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Flexão com Palmas', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 10 },
    { nome: 'Voador (Peck Deck)', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Pull Over com Halteres', categoria: 'Peito', series_padrao: 3, repeticoes_padrao: 12 },
    
    // ==================== COSTAS (18) ====================
    { nome: 'Barra Fixa Aberta', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 10 },
    { nome: 'Barra Fixa Fechada', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 10 },
    { nome: 'Barra Fixa Supinada', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 10 },
    { nome: 'Puxada Frontal Aberta', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Puxada Frontal Fechada', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Puxada Triângulo', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Puxada Supinada', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Curvada com Barra', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Curvada com Halteres', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Baixa', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Cavalinho', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Unilateral com Halter', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Alta na Polia', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Serrote', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Levantamento Terra', categoria: 'Costas', series_padrao: 4, repeticoes_padrao: 8 },
    { nome: 'Levantamento Terra Sumô', categoria: 'Costas', series_padrao: 4, repeticoes_padrao: 8 },
    { nome: 'Pulldown com Corda', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Bom Dia', categoria: 'Costas', series_padrao: 3, repeticoes_padrao: 12 },
    
    // ==================== PERNAS (22) ====================
    { nome: 'Agachamento Livre', categoria: 'Pernas', series_padrao: 4, repeticoes_padrao: 12 },
    { nome: 'Agachamento Frontal', categoria: 'Pernas', series_padrao: 4, repeticoes_padrao: 12 },
    { nome: 'Agachamento Sumô', categoria: 'Pernas', series_padrao: 4, repeticoes_padrao: 12 },
    { nome: 'Agachamento Hack', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Agachamento Búlgaro', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Agachamento Sissy', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Leg Press 45°', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Leg Press Horizontal', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Cadeira Extensora', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Cadeira Flexora', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Mesa Flexora', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Stiff com Barra', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Stiff com Halteres', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Avanço com Halteres', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Avanço com Barra', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Passada (Walking Lunge)', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Cadeira Adutora', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Cadeira Abdutora', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Panturrilha em Pé', categoria: 'Pernas', series_padrao: 4, repeticoes_padrao: 20 },
    { nome: 'Panturrilha Sentado', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Panturrilha no Leg Press', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Panturrilha Unilateral', categoria: 'Pernas', series_padrao: 3, repeticoes_padrao: 15 },
    
    // ==================== GLÚTEOS (10) ====================
    { nome: 'Elevação Pélvica com Barra', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Pélvica Unilateral', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Hip Thrust', categoria: 'Glúteos', series_padrao: 4, repeticoes_padrao: 12 },
    { nome: 'Coice na Polia', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Coice na Máquina', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Glúteo 4 Apoios', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Abdução de Quadril na Polia', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Agachamento Sumô com Pausa', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Step Up', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Ponte Glúteo', categoria: 'Glúteos', series_padrao: 3, repeticoes_padrao: 20 },
    
    // ==================== OMBROS (16) ====================
    { nome: 'Desenvolvimento com Barra', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Desenvolvimento com Halteres', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Desenvolvimento Arnold', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Desenvolvimento na Máquina', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Elevação Lateral com Halteres', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Lateral na Polia', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Lateral na Máquina', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Frontal com Barra', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Frontal com Halteres', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Frontal com Anilha', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Posterior com Halteres', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação Posterior na Polia', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Remada Alta com Barra', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Remada Alta com Halteres', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Encolhimento com Barra', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Encolhimento com Halteres', categoria: 'Ombros', series_padrao: 3, repeticoes_padrao: 15 },
    
    // ==================== BÍCEPS (14) ====================
    { nome: 'Rosca Direta com Barra', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Direta com Barra W', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Direta com Halteres', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Alternada', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Martelo', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Scott com Barra', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Scott com Halteres', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Scott na Máquina', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Concentrada', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca 21', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 21 },
    { nome: 'Rosca Inversa', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca na Polia Baixa', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Rosca Spider', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Rosca Zottman', categoria: 'Bíceps', series_padrao: 3, repeticoes_padrao: 12 },
    
    // ==================== TRÍCEPS (13) ====================
    { nome: 'Tríceps Testa com Barra', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Tríceps Testa com Halteres', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Tríceps Francês em Pé', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Tríceps Francês Sentado', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Tríceps Corda', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Tríceps Barra Reta', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Tríceps Barra W', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Tríceps Coice com Halteres', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Tríceps Coice na Polia', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Tríceps Banco', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Mergulho em Paralelas', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Supino Fechado', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Tríceps na Máquina', categoria: 'Tríceps', series_padrao: 3, repeticoes_padrao: 15 },
    
    // ==================== ANTEBRAÇO (6) ====================
    { nome: 'Rosca Punho com Barra', categoria: 'Antebraço', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Rosca Punho com Halteres', categoria: 'Antebraço', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Rosca Punho Inversa com Barra', categoria: 'Antebraço', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Rosca Punho Inversa com Halteres', categoria: 'Antebraço', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Giro de Punho com Halteres', categoria: 'Antebraço', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Farmer Walk', categoria: 'Antebraço', series_padrao: 3, repeticoes_padrao: 1 },
    
    // ==================== ABDÔMEN (15) ====================
    { nome: 'Abdominal Supra', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Abdominal Infra', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Abdominal Oblíquo', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Abdominal Cruzado', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Abdominal Remador', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Prancha Frontal', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 1 },
    { nome: 'Prancha Lateral', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 1 },
    { nome: 'Prancha Dinâmica', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Abdominal Canivete', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Abdominal na Polia', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação de Pernas', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Elevação de Pernas na Barra', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Mountain Climbers', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 30 },
    { nome: 'Russian Twist', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Dead Bug', categoria: 'Abdômen', series_padrao: 3, repeticoes_padrao: 15 },
    
    // ==================== FUNCIONAL (12) ====================
    { nome: 'Burpee', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Swing com Kettlebell', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Clean com Barra', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 8 },
    { nome: 'Snatch com Barra', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 8 },
    { nome: 'Turkish Get Up', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 5 },
    { nome: 'Box Jump', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 12 },
    { nome: 'Wall Ball', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 15 },
    { nome: 'Battle Rope', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 30 },
    { nome: 'Sled Push', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Sled Pull', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 20 },
    { nome: 'Tire Flip', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 10 },
    { nome: 'Rope Climb', categoria: 'Funcional', series_padrao: 3, repeticoes_padrao: 3 },
    
    // ==================== CARDIO (8) ====================
    { nome: 'Corrida na Esteira', categoria: 'Cardio', series_padrao: 1, repeticoes_padrao: 20 },
    { nome: 'Bicicleta Ergométrica', categoria: 'Cardio', series_padrao: 1, repeticoes_padrao: 30 },
    { nome: 'Elíptico', categoria: 'Cardio', series_padrao: 1, repeticoes_padrao: 20 },
    { nome: 'Transport', categoria: 'Cardio', series_padrao: 1, repeticoes_padrao: 15 },
    { nome: 'Remo Ergométrico', categoria: 'Cardio', series_padrao: 1, repeticoes_padrao: 20 },
    { nome: 'Pular Corda', categoria: 'Cardio', series_padrao: 3, repeticoes_padrao: 100 },
    { nome: 'HIIT Corrida', categoria: 'Cardio', series_padrao: 1, repeticoes_padrao: 15 },
    { nome: 'HIIT Bike', categoria: 'Cardio', series_padrao: 1, repeticoes_padrao: 15 },
    
    // ==================== ALONGAMENTO (10) ====================
    { nome: 'Alongamento de Peito', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Costas', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Pernas', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Quadríceps', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Posteriores', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Glúteos', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Ombros', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Bíceps', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Tríceps', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
    { nome: 'Alongamento de Panturrilha', categoria: 'Alongamento', series_padrao: 2, repeticoes_padrao: 1 },
  ];

  const totalEtapas = exerciciosComuns.length + 2;

  if (onProgress) onProgress(0, totalEtapas, 'Limpando exercícios padrão antigos...');
  const deleted = await deleteExerciciosPadrao((current, total, status) => {
    if (onProgress) onProgress(0, totalEtapas, status);
  });

  if (onProgress) onProgress(1, totalEtapas, 'Limpando personalizações das academias...');
  const customizacoesRemovidas = await deleteCustomizacoesExerciciosPadrao((current, total, status) => {
    if (onProgress) onProgress(1, totalEtapas, status);
  });
  
  if (onProgress) onProgress(2, totalEtapas, 'Criando novos exercícios...');
  const results = [];
  const errors = [];
  
  for (let i = 0; i < exerciciosComuns.length; i++) {
    const exercicio = exerciciosComuns[i];
    try {
      if (onProgress) {
        onProgress(i + 3, totalEtapas, `Criando: ${exercicio.nome}`);
      }
      const result = await createExercicio({ ...exercicio, is_padrao: true });
      results.push(result);
    } catch (err) {
      errors.push({ exercicio: exercicio.nome, erro: err.message });
    }
  }
  
  return results;
}
