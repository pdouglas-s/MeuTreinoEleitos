import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import theme from '../theme';
import { Alert } from '../utils/alert';
import { listItensByTreino, addItemToTreino, deleteItem } from '../services/treinoItensService';
import { updateTreino, deleteTreino } from '../services/treinoService';
import { listAllExercicios } from '../services/exerciciosService';
import { listAllAlunos } from '../services/userService';
import { enviarNotificacao } from '../services/notificacoesService';
import { auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

export default function TreinoDetail({ route, navigation }) {
  const { treino } = route.params;
  const { profile } = useAuth();
  const isProfessor = profile?.role === 'professor';
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
      console.warn('Erro ao carregar itens', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddItem() {
    if (!isProfessor) return Alert.alert('Acesso negado', 'Somente professor pode editar o treino');
    if (!exNome) return Alert.alert('Erro', 'Nome do exercício é obrigatório');
    try {
      await addItemToTreino({ treino_id: treino.id, exercicio_nome: exNome, series: Number(series) || null, repeticoes: Number(reps) || null, carga: Number(carga) || null });
      setExNome(''); setSeries(''); setReps(''); setCarga('');
      loadItens();
      Alert.alert('Sucesso', 'Item adicionado');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleDeleteItem(itemId) {
    if (!isProfessor) return Alert.alert('Acesso negado', 'Somente professor pode remover exercícios');
    try {
      await deleteItem(itemId);
      loadItens();
      Alert.alert('Sucesso', 'Item removido');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleUpdateTreino() {
    if (!isProfessor) return Alert.alert('Acesso negado', 'Somente professor pode editar o treino');
    if (!editNome) return Alert.alert('Erro', 'Nome do treino é obrigatório');
    try {
      const alunoAnterior = treino.aluno_id || '';
      const updates = { nome_treino: editNome };
      if (alunoSelecionado !== treino.aluno_id) {
        updates.aluno_id = alunoSelecionado;
      }
      await updateTreino(treino.id, updates);
      treino.aluno_id = alunoSelecionado; // Atualizar objeto local

      if (alunoSelecionado && alunoSelecionado !== alunoAnterior) {
        try {
          await enviarNotificacao(auth.currentUser?.uid, alunoSelecionado, 'treino_associado', {
            treino_id: treino.id,
            treino_nome: editNome,
            professor_nome: profile?.nome || 'Professor'
          });
        } catch (notifyErr) {
          console.warn('Falha ao enviar notificação de treino associado:', notifyErr?.message || notifyErr);
        }
      }

      Alert.alert('Sucesso', 'Treino atualizado');
      navigation.setOptions({ title: editNome });
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleDeleteTreino() {
    if (!isProfessor) return Alert.alert('Acesso negado', 'Somente professor pode excluir o treino');
    try {
      await deleteTreino(treino.id);
      Alert.alert('Sucesso', 'Treino excluído');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  function confirmDeleteTreino() {
    if (window.confirm) {
      if (window.confirm(`Deseja realmente excluir o treino "${treino.nome_treino}"? Todos os exercícios serão perdidos.`)) {
        handleDeleteTreino();
      }
    } else {
      Alert.alert('Confirmar exclusão', `Deseja realmente excluir o treino "${treino.nome_treino}"? Todos os exercícios serão perdidos.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', onPress: handleDeleteTreino, style: 'destructive' }
      ]);
    }
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
            {isProfessor && (
              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={{ padding: 8 }}>
                <Text style={{ color: '#dc2626' }}>Remover</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {isProfessor && (
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

      {isProfessor && (
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
          
          <Button title="💾 Salvar alterações" onPress={handleUpdateTreino} color="#059669" />
        </View>
      )}

      {isProfessor && (
        <TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteTreino}>
          <Text style={styles.deleteButtonText}>🗑️ Excluir Treino</Text>
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
