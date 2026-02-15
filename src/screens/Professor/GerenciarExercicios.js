import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import theme from '../../theme';
import { Alert } from '../../utils/alert';
import { listAllExercicios, createExercicio, deleteExercicio, inicializarBancoExercicios, existemExerciciosPadrao, deleteExerciciosPadrao, updateExercicio } from '../../services/exerciciosService';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';

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

  useEffect(() => {
    loadExercicios();
  }, []);

  async function loadExercicios() {
    try {
      const list = await listAllExercicios();
      list.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
      setExercicios(list);
      
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
        criado_por: auth.currentUser?.uid // Identifica quem criou
      });
      Alert.alert('Sucesso', 'Exercício criado');
      setNome('');
      setCategoria('');
      setSeries('');
      setReps('');
      loadExercicios();
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleDeleteExercicio(exercicio_id) {
    try {
      await deleteExercicio(exercicio_id);
      Alert.alert('Sucesso', 'Exercício excluído');
      loadExercicios();
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  function iniciarEdicao(exercicio) {
    setEditandoId(exercicio.id);
    setNomeEditado(exercicio.nome || '');
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNomeEditado('');
  }

  async function salvarEdicaoNome(exercicio) {
    const novoNome = String(nomeEditado || '').trim();
    if (!novoNome) return Alert.alert('Erro', 'Nome do exercício é obrigatório');
    if (novoNome === exercicio.nome) {
      cancelarEdicao();
      return;
    }

    try {
      await updateExercicio(exercicio.id, { nome: novoNome });
      setExercicios((prev) => prev.map((item) => (
        item.id === exercicio.id ? { ...item, nome: novoNome } : item
      )));
      Alert.alert('Sucesso', 'Nome do exercício atualizado');
      cancelarEdicao();
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  function confirmDelete(exercicio) {
    if (window.confirm) {
      if (window.confirm(`Deseja realmente excluir "${exercicio.nome}"?`)) {
        handleDeleteExercicio(exercicio.id);
      }
    } else {
      Alert.alert('Confirmar exclusão', `Deseja realmente excluir "${exercicio.nome}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', onPress: () => handleDeleteExercicio(exercicio.id), style: 'destructive' }
      ]);
    }
  }

  async function handleInicializarBanco() {
    const mensagem = temExerciciosPadrao 
      ? 'Isto irá substituir os exercícios padrão do sistema.\n\nSeus exercícios personalizados serão mantidos.\n\nContinuar?'
      : 'Isto irá adicionar 162 exercícios padrão ao banco.\n\nContinuar?';
    
    if (window.confirm && !window.confirm(mensagem)) {
      return;
    }
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
      Alert.alert('Erro', err.message);
    }
  }

  async function handleExcluirPadrao() {
    if (window.confirm && !window.confirm('Deseja excluir TODOS os exercícios padrão do sistema?\n\nSeus exercícios personalizados serão mantidos.\n\nEsta ação não pode ser desfeita!')) {
      return;
    }
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
      Alert.alert('Erro', err.message);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigation.replace('Login');
    } catch (err) {
      Alert.alert('Erro', 'Falha ao sair: ' + err.message);
    }
  }

  const categorias = [...new Set(exercicios.map(e => e.categoria))];
  const totalCategorias = categorias.length;
  const totalPadrao = exercicios.filter((e) => e.is_padrao).length;

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
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{exercicios.length}</Text>
          <Text style={styles.statLabel}>Exercícios</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalCategorias}</Text>
          <Text style={styles.statLabel}>Categorias</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalPadrao}</Text>
          <Text style={styles.statLabel}>Padrão</Text>
        </View>
      </View>

      {exercicios.length === 0 && (
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
        <Text style={styles.blockTitle}>Banco padrão do sistema</Text>
        <Text style={styles.blockHint}>Use para popular ou limpar exercícios padrões sem afetar os personalizados.</Text>
        <View style={styles.actionContainer}>
        <Button 
          title={carregando ? "⏳ Processando..." : (temExerciciosPadrao ? "🔄 Reinicializar Exercícios Padrão" : "✨ Inicializar Exercícios Padrão")}
          onPress={handleInicializarBanco}
          color={temExerciciosPadrao ? "#059669" : "#2563eb"}
          disabled={carregando}
        />
        {temExerciciosPadrao && (
          <View style={{ marginTop: 8 }}>
            <Button 
              title="🗑️ Excluir Exercícios Padrão"
              onPress={handleExcluirPadrao}
              color="#dc2626"
              disabled={carregando}
            />
          </View>
        )}
        </View>
      </View>

      <View style={styles.cardBlock}>
        <Text style={styles.blockTitle}>Cadastrar novo exercício</Text>
        <TextInput placeholder="Nome do exercício" style={styles.input} value={nome} onChangeText={setNome} />
        <TextInput placeholder="Categoria (Peito, Costas, Pernas...)" style={styles.input} value={categoria} onChangeText={setCategoria} />
        <TextInput placeholder="Séries padrão" style={styles.input} value={series} onChangeText={setSeries} keyboardType="numeric" />
        <TextInput placeholder="Repetições padrão" style={styles.input} value={reps} onChangeText={setReps} keyboardType="numeric" />
        <Button title="Adicionar Exercício" onPress={handleCreateExercicio} />
      </View>

      <Text style={styles.section}>Exercícios Cadastrados ({exercicios.length})</Text>
      
      <FlatList
        data={exercicios}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.exercicioRow}>
            <View style={{ flex: 1 }}>
              {editandoId === item.id ? (
                <TextInput
                  value={nomeEditado}
                  onChangeText={setNomeEditado}
                  style={styles.editInput}
                  placeholder="Novo nome do exercício"
                />
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
                  <TouchableOpacity onPress={() => salvarEdicaoNome(item)} style={styles.saveBtn}>
                    <Text style={{ color: '#065f46', fontSize: 13 }}>Salvar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelarEdicao} style={styles.cancelBtn}>
                    <Text style={{ color: '#374151', fontSize: 13 }}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => iniciarEdicao(item)} style={styles.editBtn}>
                    <Text style={{ color: '#1d4ed8', fontSize: 13 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                    <Text style={{ color: '#dc2626', fontSize: 14 }}>🗑️</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
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
    backgroundColor: '#fee',
    marginLeft: 8
  },
  editBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: '#eff6ff',
    marginLeft: 8
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: '#d1fae5',
    marginLeft: 8
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: '#f3f4f6',
    marginLeft: 8
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
    backgroundColor: '#eff6ff',
    borderRadius: theme.radii.md,
    borderWidth: 2,
    borderColor: '#3b82f6'
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
    textAlign: 'center'
  },
  progressBarBackground: {
    height: 24,
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    transition: 'width 0.3s ease'
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e40af',
    textAlign: 'center'
  }
});
