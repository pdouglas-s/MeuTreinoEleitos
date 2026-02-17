import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import theme from '../theme';
import { Alert } from '../utils/alert';
import { listItensByTreino, addItemToTreino, deleteItem } from '../services/treinoItensService';
import { updateTreino, deleteTreino, duplicateTreinoParaAluno } from '../services/treinoService';
import { listAllExercicios } from '../services/exerciciosService';
import { listAllAlunos } from '../services/userService';
import { enviarNotificacao } from '../services/notificacoesService';
import { auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrors';

export default function TreinoDetail({ route, navigation }) {
  const { treino } = route.params;
  const { profile } = useAuth();
  const isProfessor = ['professor', 'admin_academia', 'admin_sistema'].includes(profile?.role);
  const isAcademyStaff = ['professor', 'admin_academia'].includes(profile?.role);
  const currentUserId = auth.currentUser?.uid || profile?.id || profile?.uid || null;
  const isTreinoOwner = treino?.professor_id === currentUserId;
  const isSameAcademiaTreino = String(treino?.academia_id || '').trim() === String(profile?.academia_id || '').trim();
  const isAcademiaEditableTreino = isAcademyStaff
    && isSameAcademiaTreino
    && treino?.is_padrao !== true;
  const canEditTreino = isAcademiaEditableTreino
    || (profile?.role === 'admin_sistema' && treino?.is_padrao === true)
    || (profile?.role === 'professor' && isTreinoOwner && treino?.is_padrao !== true);
  const canManageItens = isAcademiaEditableTreino;
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const originalTreinoRef = useRef({
    nome_treino: treino.nome_treino || '',
    aluno_id: treino.aluno_id || ''
  });
  const originalItensRef = useRef(null);

  // campos para novo item
  const [exNome, setExNome] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  const [carga, setCarga] = useState('');
  const [editNome, setEditNome] = useState(treino.nome_treino || '');
  
  // Busca de exercícios
  const [busca, setBusca] = useState('');
  const [todosExercicios, setTodosExercicios] = useState([]);
  const [exerciciosEncontrados, setExerciciosEncontrados] = useState([]);
  const [mostrarBusca, setMostrarBusca] = useState(false);
  
  // Lista de alunos
  const [alunos, setAlunos] = useState([]);
  const [alunoSelecionado, setAlunoSelecionado] = useState(treino.aluno_id || '');
  const temAlunoAssociado = String(treino?.aluno_id || '').trim().length > 0;

  useEffect(() => {
    navigation.setOptions({ title: treino.nome_treino });
    loadItens();
    if (isProfessor) {
      loadExercicios();
      loadAlunos();
    }
  }, []);

  async function loadExercicios() {
    try {
      const all = await listAllExercicios();
      setTodosExercicios(all);
      setExerciciosEncontrados(all);
    } catch (err) {
      console.warn('Erro ao carregar exercícios', err.message);
    }
  }

  async function loadAlunos() {
    try {
      const list = await listAllAlunos();
      list.sort((a, b) => a.nome.localeCompare(b.nome));
      setAlunos(list);
    } catch (err) {
      console.warn('Erro ao carregar alunos', err.message);
    }
  }

  async function loadItens() {
    try {
      const list = await listItensByTreino(treino.id);
      setItens(list);
      if (originalItensRef.current === null) {
        originalItensRef.current = list.map((item) => ({
          exercicio_id: item.exercicio_id,
          exercicio_nome: item.exercicio_nome,
          series: item.series,
          repeticoes: item.repeticoes,
          carga: item.carga,
          descanso: item.descanso
        }));
      }
    } catch (err) {
      console.warn('Erro ao carregar itens', err.message);
    } finally {
      setLoading(false);
    }
  }

  function normalizeNomeExercicio(value) {
    return String(value || '').trim().toLowerCase();
  }

  function buildItensDiff(originalItens = [], itensAtuais = []) {
    const mapOriginal = new Map();
    originalItens.forEach((item) => {
      const chave = normalizeNomeExercicio(item?.exercicio_nome);
      if (!chave || mapOriginal.has(chave)) return;
      mapOriginal.set(chave, String(item?.exercicio_nome || '').trim());
    });

    const mapAtual = new Map();
    itensAtuais.forEach((item) => {
      const chave = normalizeNomeExercicio(item?.exercicio_nome);
      if (!chave || mapAtual.has(chave)) return;
      mapAtual.set(chave, String(item?.exercicio_nome || '').trim());
    });

    const itensIncluidos = Array.from(mapAtual.entries())
      .filter(([chave]) => !mapOriginal.has(chave))
      .map(([, nome]) => nome);

    const itensExcluidos = Array.from(mapOriginal.entries())
      .filter(([chave]) => !mapAtual.has(chave))
      .map(([, nome]) => nome);

    return { itensIncluidos, itensExcluidos };
  }

  function getAlunoDestinoNotificacao() {
    const candidato = String(alunoSelecionado || treino.aluno_id || '').trim();
    return candidato || null;
  }

  async function notificarTreinoAtualizado(treinoId, treinoNome, alteracoes = {}) {
    const alunoDestinoId = getAlunoDestinoNotificacao();
    if (!alunoDestinoId) return;

    try {
      await enviarNotificacao(auth.currentUser?.uid, alunoDestinoId, 'treino_atualizado', {
        treino_id: treinoId,
        treino_nome: treinoNome,
        professor_nome: profile?.nome || 'Professor',
        academia_id: treino?.academia_id || profile?.academia_id || null,
        itens_incluidos: alteracoes.itensIncluidos || [],
        itens_excluidos: alteracoes.itensExcluidos || []
      });
    } catch (notifyErr) {
      console.warn('Falha ao enviar notificação de treino atualizado:', notifyErr?.message || notifyErr);
    }
  }

  async function restoreOriginalTreinoSnapshot() {
    const originalTreino = originalTreinoRef.current;
    const originalItens = originalItensRef.current || [];

    await updateTreino(treino.id, {
      nome_treino: originalTreino.nome_treino,
      aluno_id: originalTreino.aluno_id
    });

    const itensAtuais = await listItensByTreino(treino.id);
    await Promise.all(itensAtuais.map((item) => deleteItem(item.id)));
    await Promise.all(
      originalItens.map((item) =>
        addItemToTreino({
          treino_id: treino.id,
          exercicio_id: item.exercicio_id,
          exercicio_nome: item.exercicio_nome,
          series: item.series,
          repeticoes: item.repeticoes,
          carga: item.carga,
          descanso: item.descanso,
          allowDuplicate: true
        })
      )
    );
  }

  function ensureCanManageItens() {
    if (canManageItens) return true;
    Alert.alert('Acesso negado', 'Você não pode editar exercícios deste treino');
    return false;
  }

  function ensureCanEditTreino() {
    if (canEditTreino) return true;
    Alert.alert('Acesso negado', 'Você não tem permissão para salvar alterações neste treino');
    return false;
  }

  async function handleAddItem() {
    if (!ensureCanManageItens()) return;
    if (!exNome) return Alert.alert('Erro', 'Nome do exercício é obrigatório');

    const nomeNovo = String(exNome || '').trim().toLowerCase();
    const jaExiste = itens.some((item) => String(item?.exercicio_nome || '').trim().toLowerCase() === nomeNovo);
    if (jaExiste) return Alert.alert('Atenção', 'Este exercício já foi adicionado neste treino');

    try {
      await addItemToTreino({ treino_id: treino.id, exercicio_nome: exNome, series: Number(series) || null, repeticoes: Number(reps) || null, carga: Number(carga) || null });
      await notificarTreinoAtualizado(treino.id, editNome || treino.nome_treino || 'Treino');
      setExNome(''); setSeries(''); setReps(''); setCarga('');
      loadItens();
      Alert.alert('Sucesso', 'Item adicionado');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível adicionar o exercício.'));
    }
  }

  async function handleDeleteItem(itemId) {
    if (!ensureCanManageItens()) return;
    try {
      await deleteItem(itemId);
      await notificarTreinoAtualizado(treino.id, editNome || treino.nome_treino || 'Treino');
      loadItens();
      Alert.alert('Sucesso', 'Item removido');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível remover o exercício.'));
    }
  }

  async function confirmCreateNovoVinculo() {
    const mensagem = 'Ao continuar, será criado um novo vínculo para o aluno selecionado e o vínculo anterior será preservado. Deseja continuar?';
    return Alert.confirm('Confirmar novo vínculo', mensagem, {
      confirmText: 'Criar vínculo'
    });
  }

  async function handleCreateNovoVinculo() {
    const { id: novoTreinoId } = await duplicateTreinoParaAluno(treino.id, {
      aluno_id: alunoSelecionado,
      nome_treino: editNome
    });

    await restoreOriginalTreinoSnapshot();

    try {
      await enviarNotificacao(auth.currentUser?.uid, alunoSelecionado, 'treino_associado', {
        treino_id: novoTreinoId,
        treino_nome: editNome,
        professor_nome: profile?.nome || 'Professor',
        aluno_nome: alunos.find((item) => item.id === alunoSelecionado)?.nome || null,
        academia_id: treino?.academia_id || profile?.academia_id || null
      });
    } catch (notifyErr) {
      console.warn('Falha ao enviar notificação de treino associado:', notifyErr?.message || notifyErr);
    }

    Alert.alert('Sucesso', 'Novo vínculo criado para o aluno selecionado sem alterar o vínculo anterior');
    navigation.goBack();
  }

  async function handleUpdateTreino() {
    if (!ensureCanEditTreino()) return;
    if (!editNome) return Alert.alert('Erro', 'Nome do treino é obrigatório');
    try {
      const alunoAnterior = treino.aluno_id || '';
      const alunoDestinoId = getAlunoDestinoNotificacao();
      const itensAtuais = await listItensByTreino(treino.id);
      const alteracoesItens = buildItensDiff(originalItensRef.current || [], itensAtuais);

      if (alunoSelecionado && alunoSelecionado !== alunoAnterior) {
        const confirmado = await confirmCreateNovoVinculo();
        if (!confirmado) return;
        await handleCreateNovoVinculo();
        return;
      }

      const updates = { nome_treino: editNome };
      if (alunoSelecionado !== treino.aluno_id) {
        updates.aluno_id = alunoSelecionado;
      }
      const result = await updateTreino(treino.id, updates);
      treino.aluno_id = alunoSelecionado; // Atualizar objeto local
      treino.nome_treino = editNome;

      const mensagemSucesso = result?.convertedFromStandard
        ? 'Treino padrão convertido para treino da sua academia e atualizado com sucesso'
        : 'Treino atualizado';

      if (alunoSelecionado && alunoSelecionado !== alunoAnterior) {
        try {
          await enviarNotificacao(auth.currentUser?.uid, alunoSelecionado, 'treino_associado', {
            treino_id: treino.id,
            treino_nome: editNome,
            professor_nome: profile?.nome || 'Professor',
            aluno_nome: alunos.find((item) => item.id === alunoSelecionado)?.nome || null,
            academia_id: treino?.academia_id || profile?.academia_id || null
          });
        } catch (notifyErr) {
          console.warn('Falha ao enviar notificação de treino associado:', notifyErr?.message || notifyErr);
        }
      } else if (alunoDestinoId) {
        await notificarTreinoAtualizado(treino.id, editNome, alteracoesItens);
      }

      originalItensRef.current = itensAtuais.map((item) => ({
        exercicio_id: item.exercicio_id,
        exercicio_nome: item.exercicio_nome,
        series: item.series,
        repeticoes: item.repeticoes,
        carga: item.carga,
        descanso: item.descanso
      }));

      Alert.alert('Sucesso', mensagemSucesso);
      navigation.setOptions({ title: editNome });
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível atualizar o treino.'));
    }
  }

  async function handleDeleteTreino() {
    if (!ensureCanEditTreino()) return;
    try {
      const alunoAssociadoId = String(treino?.aluno_id || '').trim();
      if (alunoAssociadoId) {
        await updateTreino(treino.id, { aluno_id: '' });
        treino.aluno_id = '';
        setAlunoSelecionado('');
        Alert.alert('Sucesso', 'Associação entre treino e aluno removida');
        navigation.goBack();
        return;
      }

      const treinoExcluido = await deleteTreino(treino.id);
      const alunoNome = treinoExcluido?.aluno_id
        ? (alunos.find((item) => item.id === treinoExcluido.aluno_id)?.nome || null)
        : null;

      if (treinoExcluido?.aluno_id) {
        try {
          await enviarNotificacao(auth.currentUser?.uid, treinoExcluido.aluno_id, 'treino_excluido', {
            treino_id: treinoExcluido.id,
            treino_nome: treinoExcluido.nome_treino || treino.nome_treino || 'Treino',
            professor_nome: profile?.nome || 'Professor',
            academia_id: treinoExcluido.academia_id || treino?.academia_id || profile?.academia_id || null
          });
        } catch (notifyErr) {
          console.warn('Falha ao enviar notificação de treino excluído:', notifyErr?.message || notifyErr);
        }
      }

      try {
        await enviarNotificacao(auth.currentUser?.uid, null, 'treino_excluido_academia', {
          treino_id: treinoExcluido.id,
          treino_nome: treinoExcluido.nome_treino || treino.nome_treino || 'Treino',
          professor_nome: profile?.nome || 'Professor',
          aluno_nome: alunoNome,
          academia_id: treinoExcluido.academia_id || treino?.academia_id || profile?.academia_id || null
        });
      } catch (notifyErr) {
        console.warn('Falha ao enviar notificação de exclusão para academia:', notifyErr?.message || notifyErr);
      }

      Alert.alert('Sucesso', 'Treino excluído');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o treino.'));
    }
  }

  async function confirmDeleteTreino() {
    const possuiAlunoVinculado = String(treino?.aluno_id || '').trim().length > 0;
    const alunoNomeAssociado = possuiAlunoVinculado
      ? (alunos.find((item) => item.id === treino.aluno_id)?.nome || 'aluno associado')
      : '';
    const confirmado = await Alert.confirm(
      'Confirmar exclusão',
      possuiAlunoVinculado
        ? `Deseja remover a associação do treino "${treino.nome_treino}" com ${alunoNomeAssociado}?`
        : `Deseja realmente excluir o treino "${treino.nome_treino}"? Todos os exercícios serão perdidos.`,
      { confirmText: possuiAlunoVinculado ? 'Remover associação' : 'Excluir', destructive: true }
    );
    if (!confirmado) return;
    handleDeleteTreino();
  }

  async function buscarExercicios(termo) {
    setBusca(termo);
    const termoCategoria = String(termo || '').trim().toLowerCase();
    if (termoCategoria.length < 2) {
      setExerciciosEncontrados(todosExercicios);
      return;
    }

    const filtrados = todosExercicios.filter((ex) =>
      String(ex.categoria || '').toLowerCase().includes(termoCategoria)
    );
    setExerciciosEncontrados(filtrados);
  }

  function selecionarExercicio(exercicio) {
    setExNome(exercicio.nome);
    setSeries(String(exercicio.series_padrao || ''));
    setReps(String(exercicio.repeticoes_padrao || ''));
    setCarga(String(exercicio.carga_padrao || ''));
    setMostrarBusca(false);
    setBusca('');
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{treino.nome_treino}</Text>

      <View style={styles.cardBlock}>
        <Text style={styles.section}>Exercícios do Treino</Text>
        {loading && <Text style={styles.mutedText}>Carregando...</Text>}
        {!loading && itens.length === 0 && <Text style={styles.mutedText}>Nenhum exercício adicionado ainda</Text>}
        {!loading && itens.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: theme.colors.text }}>{item.exercicio_nome}</Text>
              <Text style={{ color: theme.colors.muted }}>{`${item.series || '-'} x ${item.repeticoes || '-'} • ${item.carga || '-'}kg`}</Text>
            </View>
            {canManageItens && (
              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={{ padding: 8 }}>
                <Text style={{ color: '#dc2626' }}>Remover</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {canManageItens && (
        <View style={styles.cardBlock}>
        <Text style={styles.section}>Adicionar exercício</Text>
        
        <Button 
          title={mostrarBusca ? "Fechar banco de exercícios" : "📚 Buscar no banco de exercícios"} 
          onPress={() => setMostrarBusca(!mostrarBusca)} 
        />

        {mostrarBusca && (
          <View style={styles.buscaContainer}>
            <TextInput 
              placeholder="Buscar por categoria (ex.: Peito)" 
              style={styles.input} 
              value={busca} 
              onChangeText={buscarExercicios} 
            />
            <ScrollView style={styles.listaExercicios} nestedScrollEnabled>
              {exerciciosEncontrados.map((ex) => (
                <TouchableOpacity 
                  key={ex.id} 
                  style={styles.exercicioItem} 
                  onPress={() => selecionarExercicio(ex)}
                >
                  <Text style={{ fontSize: 15, fontWeight: '500' }}>{ex.nome}</Text>
                  <Text style={{ fontSize: 12, color: '#666' }}>
                    {ex.categoria} • {ex.series_padrao}x{ex.repeticoes_padrao}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <TextInput placeholder="Nome do exercício" style={styles.input} value={exNome} onChangeText={setExNome} />
        <TextInput placeholder="Séries" style={styles.input} value={series} onChangeText={setSeries} keyboardType="numeric" />
        <TextInput placeholder="Repetições" style={styles.input} value={reps} onChangeText={setReps} keyboardType="numeric" />
        <TextInput placeholder="Carga (kg)" style={styles.input} value={carga} onChangeText={setCarga} keyboardType="numeric" />
        <Button title="Adicionar" onPress={handleAddItem} />
        </View>
      )}

      {canEditTreino && (
        <View style={styles.cardBlock}>
          <Text style={styles.section}>Editar treino</Text>
          <TextInput placeholder="Nome do treino" style={styles.input} value={editNome} onChangeText={setEditNome} />
          
          <Text style={styles.section}>Associar a um aluno</Text>
          <View style={styles.pickerContainer}>
            <select 
              style={styles.picker}
              value={alunoSelecionado}
              onChange={(e) => setAlunoSelecionado(e.target.value)}
            >
              <option value="">Nenhum aluno (treino modelo)</option>
              {alunos.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome} ({aluno.email})
                </option>
              ))}
            </select>
          </View>

          {alunoSelecionado && alunoSelecionado !== (treino.aluno_id || '') && (
            <Text style={styles.warningText}>
              Ao salvar, será criado um novo vínculo para o aluno selecionado. O vínculo anterior permanecerá inalterado.
            </Text>
          )}
          
          <Button
            title={alunoSelecionado && alunoSelecionado !== (treino.aluno_id || '') ? '🔗 Criar novo vínculo' : '💾 Salvar alterações'}
            onPress={handleUpdateTreino}
            color={alunoSelecionado && alunoSelecionado !== (treino.aluno_id || '') ? '#d97706' : '#059669'}
          />
        </View>
      )}

      {canEditTreino && (
        <TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteTreino}>
          <Text style={styles.deleteButtonText}>
            {temAlunoAssociado ? '🗑️ Excluir associação' : '🗑️ Excluir Treino'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing(2), backgroundColor: theme.colors.background },
  title: { fontSize: theme.fontSizes.xl, fontWeight: '700', marginBottom: theme.spacing(1), color: theme.colors.text },
  cardBlock: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5)
  },
  mutedText: { color: theme.colors.muted, marginBottom: 10 },
  warningText: {
    color: '#b45309',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: theme.radii.sm,
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  section: { fontWeight: '600', marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5), color: theme.colors.text },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: theme.radii.sm, padding: theme.spacing(1.5), marginBottom: theme.spacing(1), backgroundColor: theme.colors.background },
  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  deleteButton: {
    marginTop: 24,
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#fee',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#fca',
    alignItems: 'center'
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 16
  },
  buscaContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: theme.radii.md,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  listaExercicios: {
    maxHeight: 200,
    marginTop: 8
  },
  exercicioItem: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: theme.radii.sm,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing(1),
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  picker: {
    width: '100%',
    padding: theme.spacing(1.5),
    fontSize: 16,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent'
  }
});
