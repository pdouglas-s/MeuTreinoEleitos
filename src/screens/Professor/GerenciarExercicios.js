import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import theme from '../../theme';
import { Alert } from '../../utils/alert';
import { listAllExercicios, createExercicio, deleteExercicio, inicializarBancoExercicios, existemExerciciosPadrao, deleteExerciciosPadrao, updateExercicio } from '../../services/exerciciosService';
import { listAllProfessores } from '../../services/userService';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/authErrors';
import CardMedia from '../../components/CardMedia';

export default function GerenciarExercicios({ navigation }) {
  const { logout, profile } = useAuth();
  const [exercicios, setExercicios] = useState([]);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [statusMensagem, setStatusMensagem] = useState('');
  const [temExerciciosPadrao, setTemExerciciosPadrao] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEditado, setNomeEditado] = useState('');
  const [categoriaEditada, setCategoriaEditada] = useState('');
  const [seriesEditadas, setSeriesEditadas] = useState('');
  const [repsEditadas, setRepsEditadas] = useState('');
  const [professoresAcademia, setProfessoresAcademia] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState('todos');

  useEffect(() => {
    loadExercicios();
  }, []);

  async function loadExercicios() {
    try {
      const [list, professoresList] = await Promise.all([
        listAllExercicios(),
        listAllProfessores().catch(() => [])
      ]);
      list.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
      setExercicios(list);
      setProfessoresAcademia(professoresList);
      
      // Verificar se existem exercícios padrão
      const temPadrao = await existemExerciciosPadrao();
      setTemExerciciosPadrao(temPadrao);
    } catch (err) {
      console.warn('Erro ao carregar exercícios', err.message);
    }
  }

  async function handleCreateExercicio() {
    if (!nome || !categoria) return Alert.alert('Erro', 'Nome e categoria são obrigatórios');
    try {
      await createExercicio({ 
        nome, 
        categoria, 
        series_padrao: Number(series) || null, 
        repeticoes_padrao: Number(reps) || null,
        criado_por: auth.currentUser?.uid, // Identifica quem criou
        academia_id: profile?.academia_id || null
      });
      Alert.alert('Sucesso', 'Exercício criado');
      setNome('');
      setCategoria('');
      setSeries('');
      setReps('');
      loadExercicios();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível criar o exercício.'));
    }
  }

  async function handleDeleteExercicio(exercicio_id) {
    try {
      await deleteExercicio(exercicio_id);
      Alert.alert('Sucesso', 'Exercício excluído');
      loadExercicios();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o exercício.'));
    }
  }

  function iniciarEdicao(exercicio) {
    setEditandoId(exercicio.id);
    setNomeEditado(exercicio.nome || '');
    setCategoriaEditada(exercicio.categoria || '');
    setSeriesEditadas(exercicio.series_padrao ? String(exercicio.series_padrao) : '');
    setRepsEditadas(exercicio.repeticoes_padrao ? String(exercicio.repeticoes_padrao) : '');
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEditado('');
    setCategoriaEditada('');
    setSeriesEditadas('');
    setRepsEditadas('');
  }

  async function salvarEdicaoExercicio(exercicio) {
    const novoNome = String(nomeEditado || '').trim();
    const novaCategoria = String(categoriaEditada || '').trim();
    const novasSeries = String(seriesEditadas || '').trim();
    const novasReps = String(repsEditadas || '').trim();

    if (!novoNome) return Alert.alert('Erro', 'Nome do exercício é obrigatório');

    const payload = {
      nome: novoNome,
      categoria: novaCategoria || exercicio.categoria || '',
      series_padrao: novasSeries === '' ? null : Number(novasSeries),
      repeticoes_padrao: novasReps === '' ? null : Number(novasReps)
    };

    if ((novasSeries !== '' && Number.isNaN(payload.series_padrao)) || (novasReps !== '' && Number.isNaN(payload.repeticoes_padrao))) {
      return Alert.alert('Erro', 'Séries e repetições devem ser números válidos');
    }

    const unchanged =
      payload.nome === (exercicio.nome || '')
      && payload.categoria === (exercicio.categoria || '')
      && payload.series_padrao === (exercicio.series_padrao ?? null)
      && payload.repeticoes_padrao === (exercicio.repeticoes_padrao ?? null);

    if (unchanged) {
      cancelarEdicao();
      return;
    }

    try {
      const academiaPayload = {
        ...payload,
        criado_por: auth.currentUser?.uid,
        academia_id: profile?.academia_id || null,
        is_padrao: false
      };

      if (exercicio?.is_padrao === true) {
        await updateExercicio(exercicio.id, academiaPayload);
        Alert.alert('Sucesso', 'Exercício removido do padrão e atualizado para a academia');
        setFiltroAtivo('academia');
      } else {
        await updateExercicio(exercicio.id, academiaPayload);
        Alert.alert('Sucesso', 'Exercício atualizado');
      }

      await loadExercicios();
      cancelarEdicao();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível atualizar o exercício.'));
    }
  }

  async function confirmDelete(exercicio) {
    const confirmado = await Alert.confirm(
      'Confirmar exclusão',
      `Deseja realmente excluir "${exercicio.nome}"?`,
      { confirmText: 'Excluir', destructive: true }
    );
    if (!confirmado) return;
    handleDeleteExercicio(exercicio.id);
  }

  async function handleInicializarBanco() {
    const mensagem = temExerciciosPadrao 
      ? 'Isto irá substituir os exercícios padrão do sistema.\n\nSeus exercícios personalizados serão mantidos.\n\nContinuar?'
      : 'Isto irá adicionar 162 exercícios padrão ao banco.\n\nContinuar?';
    
    const confirmado = await Alert.confirm('Confirmar ação', mensagem, { confirmText: 'Continuar' });
    if (!confirmado) return;
    try {
      setCarregando(true);
      setProgresso(0);
      setStatusMensagem('Preparando...');
      
      console.log('Iniciando reinicialização de exercícios padrão...');
      
      const results = await inicializarBancoExercicios((current, total, status) => {
        setProgresso(Math.round((current / total) * 100));
        setStatusMensagem(status);
      });
      
      console.log('Exercícios criados:', results.length);
      setStatusMensagem('Carregando exercícios...');
      await loadExercicios();
      
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      Alert.alert('Sucesso', `Banco atualizado! ${results.length} exercícios padrão adicionados.`);
    } catch (err) {
      console.error('Erro ao inicializar banco:', err);
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível inicializar o banco de exercícios.'));
    }
  }

  async function handleExcluirPadrao() {
    const confirmado = await Alert.confirm(
      'Confirmar exclusão',
      'Deseja excluir TODOS os exercícios padrão do sistema?\n\nSeus exercícios personalizados serão mantidos.\n\nEsta ação não pode ser desfeita!',
      { confirmText: 'Excluir tudo', destructive: true }
    );
    if (!confirmado) return;
    try {
      setCarregando(true);
      setProgresso(0);
      setStatusMensagem('Preparando exclusão...');
      
      const deleted = await deleteExerciciosPadrao((current, total, status) => {
        setProgresso(Math.round((current / total) * 100));
        setStatusMensagem(status);
      });
      
      setStatusMensagem('Carregando exercícios...');
      await loadExercicios();
      
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      
      Alert.alert('Sucesso', `${deleted} exercícios padrão foram excluídos.`);
    } catch (err) {
      console.error('Erro ao excluir exercícios padrão:', err);
      setCarregando(false);
      setProgresso(0);
      setStatusMensagem('');
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir os exercícios padrão.'));
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigation.replace('Login');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Falha ao sair.'));
    }
  }

  const myAcademiaId = String(profile?.academia_id || '').trim();
  const myUserId = String(auth.currentUser?.uid || '').trim();
  const professorIdsAcademia = new Set([
    myUserId,
    ...professoresAcademia.map((prof) => prof?.id)
  ].filter(Boolean));

  const isExercicioAcademia = (item) => {
    if (item?.is_padrao === true) return false;

    const itemAcademiaId = String(item?.academia_id || '').trim();
    if (myAcademiaId && itemAcademiaId && itemAcademiaId === myAcademiaId) return true;

    const criadoPor = String(item?.criado_por || '').trim();
    return !!criadoPor && professorIdsAcademia.has(criadoPor);
  };

  const exerciciosPadrao = exercicios.filter((item) => item?.is_padrao === true);
  const exerciciosAcademia = exercicios.filter(isExercicioAcademia);

  const exerciciosVisiveis = exercicios.filter((item) => {
    if (item?.is_padrao === true) return true;
    return isExercicioAcademia(item);
  });
  const totalPadrao = exerciciosPadrao.length;
  const totalAcademia = exerciciosAcademia.length;

  const exerciciosFiltrados = filtroAtivo === 'padrao'
    ? exerciciosPadrao
    : filtroAtivo === 'academia'
      ? exerciciosAcademia
      : exerciciosVisiveis;

  const filtroDescricao = filtroAtivo === 'padrao'
    ? ' (somente padrão)'
    : filtroAtivo === 'academia'
      ? ' (somente da academia)'
      : '';

  function alternarFiltro(tipo) {
    setFiltroAtivo((atual) => (atual === tipo ? 'todos' : tipo));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Gerenciar Banco de Exercícios</Text>
          <Text style={styles.subtitle}>Organize os exercícios para montar fichas mais rápido</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.statCard, filtroAtivo === 'todos' && styles.statCardActive]}
          onPress={() => setFiltroAtivo('todos')}
          activeOpacity={0.85}
        >
          <CardMedia variant="exercicio" label="EXERCÍCIOS" compact />
          <Text style={styles.statValue}>{exerciciosVisiveis.length}</Text>
          <Text style={styles.statLabel}>Exercícios</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, filtroAtivo === 'academia' && styles.statCardActive]}
          onPress={() => alternarFiltro('academia')}
          activeOpacity={0.85}
        >
          <CardMedia variant="academia" label="DA ACADEMIA" compact />
          <Text style={styles.statValue}>{totalAcademia}</Text>
          <Text style={styles.statLabel}>Da academia</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, filtroAtivo === 'padrao' && styles.statCardActive]}
          onPress={() => alternarFiltro('padrao')}
          activeOpacity={0.85}
        >
          <CardMedia variant="sistema" label="PADRÃO" compact />
          <Text style={styles.statValue}>{totalPadrao}</Text>
          <Text style={styles.statLabel}>Padrão</Text>
        </TouchableOpacity>
      </View>

      {exerciciosFiltrados.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={{ marginBottom: 12, textAlign: 'center', color: theme.colors.muted }}>Nenhum exercício cadastrado</Text>
        </View>
      )}

      {carregando && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>{statusMensagem}</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progresso}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{progresso}%</Text>
        </View>
      )}

      <View style={styles.cardBlock}>
        <CardMedia variant="sistema" label="BANCO PADRÃO" />
        <Text style={styles.blockTitle}>Banco padrão do sistema</Text>
        <Text style={styles.blockHint}>Use para popular ou limpar exercícios padrões sem afetar os personalizados.</Text>
        <View style={styles.actionContainer}>
        <Button 
          title={carregando ? "⏳ Processando..." : (temExerciciosPadrao ? "🔄 Reinicializar Exercícios Padrão" : "✨ Inicializar Exercícios Padrão")}
          onPress={handleInicializarBanco}
          color={theme.colors.primary}
          disabled={carregando}
        />
        {temExerciciosPadrao && (
          <View style={{ marginTop: 8 }}>
            <Button 
              title="🗑️ Excluir Exercícios Padrão"
              onPress={handleExcluirPadrao}
              color={theme.colors.danger}
              disabled={carregando}
            />
          </View>
        )}
        </View>
      </View>

      <View style={styles.cardBlock}>
        <CardMedia variant="exercicio" label="NOVO EXERCÍCIO" />
        <Text style={styles.blockTitle}>Cadastrar novo exercício</Text>
        <TextInput placeholder="Nome do exercício" style={styles.input} value={nome} onChangeText={setNome} />
        <TextInput placeholder="Categoria (Peito, Costas, Pernas...)" style={styles.input} value={categoria} onChangeText={setCategoria} />
        <TextInput placeholder="Séries padrão" style={styles.input} value={series} onChangeText={setSeries} keyboardType="numeric" />
        <TextInput placeholder="Repetições padrão" style={styles.input} value={reps} onChangeText={setReps} keyboardType="numeric" />
        <Button title="Adicionar Exercício" onPress={handleCreateExercicio} />
      </View>

      <Text style={styles.section}>Exercícios Cadastrados ({exerciciosFiltrados.length}){filtroDescricao}</Text>
      
      <FlatList
        data={exerciciosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.exercicioRow}
            onPress={() => {
              if (editandoId !== item.id) iniciarEdicao(item);
            }}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              {editandoId === item.id ? (
                <>
                  <TextInput
                    value={nomeEditado}
                    onChangeText={setNomeEditado}
                    style={styles.editInput}
                    placeholder="Nome do exercício"
                  />
                  <TextInput
                    value={categoriaEditada}
                    onChangeText={setCategoriaEditada}
                    style={styles.editInput}
                    placeholder="Categoria"
                  />
                  <View style={styles.editTwoColumns}>
                    <TextInput
                      value={seriesEditadas}
                      onChangeText={setSeriesEditadas}
                      style={[styles.editInput, styles.editMiniInput]}
                      placeholder="Séries"
                      keyboardType="numeric"
                    />
                    <TextInput
                      value={repsEditadas}
                      onChangeText={setRepsEditadas}
                      style={[styles.editInput, styles.editMiniInput]}
                      placeholder="Reps"
                      keyboardType="numeric"
                    />
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.nome}</Text>
              )}
              <Text style={{ fontSize: 12, color: theme.colors.muted }}>
                {item.categoria} • {item.series_padrao || '-'}x{item.repeticoes_padrao || '-'}
              </Text>
            </View>
            <View style={styles.rowActions}>
              {editandoId === item.id ? (
                <>
                  <TouchableOpacity onPress={() => salvarEdicaoExercicio(item)} style={styles.saveBtn}>
                    <Text style={styles.saveText}>Salvar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelarEdicao} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>🗑️</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing(2), backgroundColor: theme.colors.background },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: theme.spacing(2) 
  },
  title: { fontSize: theme.fontSizes.xl, marginBottom: theme.spacing(0.5) },
  subtitle: { 
    fontSize: theme.fontSizes.sm, 
    color: theme.colors.muted 
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing(1.5)
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  statCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background
  },
  statValue: {
    fontSize: theme.fontSizes.lg,
    fontWeight: '700',
    color: theme.colors.text
  },
  statLabel: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    marginTop: 2
  },
  logoutBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 14, 
    borderRadius: theme.radii.sm, 
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  logoutText: { 
    color: theme.colors.danger, 
    fontSize: 15, 
    fontWeight: '500' 
  },
  section: { fontWeight: '600', marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5), color: theme.colors.text },
  cardBlock: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5)
  },
  blockTitle: {
    fontSize: theme.fontSizes.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4
  },
  blockHint: {
    fontSize: theme.fontSizes.sm,
    color: theme.colors.muted,
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.background
  },
  exercicioRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: theme.colors.card,
    marginBottom: 4,
    borderRadius: theme.radii.sm
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    marginLeft: 8
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    marginLeft: 8
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginLeft: 8
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: 14
  },
  saveText: {
    color: theme.colors.primary,
    fontSize: 13
  },
  cancelText: {
    color: theme.colors.muted,
    fontSize: 13
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    backgroundColor: '#fff'
  },
  editTwoColumns: {
    flexDirection: 'row',
    gap: 8
  },
  editMiniInput: {
    flex: 1
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  actionContainer: {
    marginTop: 4
  },
  progressContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center'
  },
  progressBarBackground: {
    height: 24,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 12
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center'
  }
});
