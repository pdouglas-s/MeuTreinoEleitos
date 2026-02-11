import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList, Alert, TouchableOpacity } from 'react-native';
import theme from '../theme';
import { listItensByTreino, addItemToTreino, deleteItem } from '../services/treinoItensService';
import { updateTreino } from '../services/treinoService';
import { auth } from '../firebase/config';

export default function TreinoDetail({ route, navigation }) {
  const { treino } = route.params;
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);

  // campos para novo item
  const [exNome, setExNome] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  const [carga, setCarga] = useState('');
  const [editNome, setEditNome] = useState(treino.nome_treino || '');

  useEffect(() => {
    navigation.setOptions({ title: treino.nome_treino });
    loadItens();
  }, []);

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
    try {
      await deleteItem(itemId);
      loadItens();
      Alert.alert('Sucesso', 'Item removido');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleUpdateTreino() {
    if (!editNome) return Alert.alert('Erro', 'Nome do treino é obrigatório');
    try {
      await updateTreino(treino.id, { nome_treino: editNome });
      Alert.alert('Sucesso', 'Treino atualizado');
      navigation.setOptions({ title: editNome });
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{treino.nome_treino}</Text>
      {loading && <Text>Carregando...</Text>}
      {!loading && (
        <FlatList
          data={itens}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <View style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16 }}>{item.exercicio_nome}</Text>
                <Text style={{ color: '#666' }}>{`${item.series || '-'} x ${item.repeticoes || '-'} • ${item.carga || '-'}kg`}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={{ padding: 8 }}>
                <Text style={{ color: 'red' }}>Remover</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Text style={styles.section}>Editar nome do treino</Text>
      <TextInput placeholder="Nome do treino" style={styles.input} value={editNome} onChangeText={setEditNome} />
      <Button title="Salvar nome" onPress={handleUpdateTreino} />

      <Text style={styles.section}>Adicionar exercício</Text>
      <TextInput placeholder="Nome do exercício" style={styles.input} value={exNome} onChangeText={setExNome} />
      <TextInput placeholder="Séries" style={styles.input} value={series} onChangeText={setSeries} keyboardType="numeric" />
      <TextInput placeholder="Repetições" style={styles.input} value={reps} onChangeText={setReps} keyboardType="numeric" />
      <TextInput placeholder="Carga (kg)" style={styles.input} value={carga} onChangeText={setCarga} keyboardType="numeric" />
      <Button title="Adicionar" onPress={handleAddItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing(2) },
  title: { fontSize: theme.fontSizes.xl, fontWeight: '600', marginBottom: theme.spacing(1) },
  section: { fontWeight: '600', marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5), color: theme.colors.text },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: theme.radii.sm, padding: theme.spacing(1.5), marginBottom: theme.spacing(1) },
  itemRow: { paddingVertical: 8 }
});
