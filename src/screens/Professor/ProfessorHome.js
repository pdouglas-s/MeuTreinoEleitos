import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, FlatList } from 'react-native';
import theme from '../../theme';
import { createAluno } from '../../services/userService';
import { createTreino, listTreinosByProfessor } from '../../services/treinoService';
import { addItemToTreino } from '../../services/treinoItensService';
import { auth } from '../../firebase/config';

export default function ProfessorHome() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');

  // Treinos
  const [nomeTreino, setNomeTreino] = useState('');
  const [treinos, setTreinos] = useState([]);
  const [selectedTreino, setSelectedTreino] = useState(null);

  // Item fields
  const [exNome, setExNome] = useState('');
  const [series, setSeries] = useState('');
  const [reps, setReps] = useState('');
  const [carga, setCarga] = useState('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) loadTreinos(uid);
  }, []);

  async function loadTreinos(professor_id) {
    try {
      const list = await listTreinosByProfessor(professor_id);
      setTreinos(list);
    } catch (err) {
      console.warn('Erro ao carregar treinos', err.message);
    }
  }

  async function handleCreateAluno() {
    if (!nome || !email) return Alert.alert('Erro', 'Nome e e-mail são obrigatórios');
    try {
      await createAluno({ nome, email });
      Alert.alert('Sucesso', 'Aluno criado (senha padrão definida via variável de ambiente)');
      setNome('');
      setEmail('');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleCreateTreino() {
    if (!nomeTreino) return Alert.alert('Erro', 'Nome do treino é obrigatório');
    try {
      const professor_id = auth.currentUser?.uid;
      const { id } = await createTreino({ aluno_id: '', professor_id, nome_treino: nomeTreino, ativo: true });
      const novo = { id, aluno_id: '', professor_id, nome_treino: nomeTreino, ativo: true };
      setTreinos([novo, ...treinos]);
      setNomeTreino('');
      Alert.alert('Sucesso', 'Treino criado');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleAddItem() {
    if (!selectedTreino) return Alert.alert('Erro', 'Selecione um treino para adicionar o item');
    if (!exNome) return Alert.alert('Erro', 'Nome do exercício obrigatório');
    try {
      await addItemToTreino({ treino_id: selectedTreino.id, exercicio_nome: exNome, series: Number(series) || null, repeticoes: Number(reps) || null, carga: Number(carga) || null });
      setExNome(''); setSeries(''); setReps(''); setCarga('');
      Alert.alert('Sucesso', 'Item adicionado ao treino');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Área do Professor</Text>

      <Text style={styles.section}>Criar Aluno</Text>
      <TextInput placeholder="Nome do aluno" style={styles.input} value={nome} onChangeText={setNome} />
      <TextInput placeholder="E-mail do aluno" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Button title="Criar Aluno" onPress={handleCreateAluno} />

      <Text style={styles.section}>Treinos</Text>
      <TextInput placeholder="Nome do treino" style={styles.input} value={nomeTreino} onChangeText={setNomeTreino} />
      <Button title="Criar Treino (sem aluno)" onPress={handleCreateTreino} />

      <Text style={[styles.section, { marginTop: 12 }]}>Seus Treinos</Text>
      <FlatList
        data={treinos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.treinoRow}>
            <Text style={{ flex: 1 }}>{item.nome_treino}</Text>
            <Button title={selectedTreino?.id === item.id ? 'Selecionado' : 'Selecionar'} onPress={() => setSelectedTreino(item)} />
          </View>
        )}
      />

      <Text style={styles.section}>Adicionar Item ao Treino Selecionado</Text>
      <TextInput placeholder="Nome do exercício" style={styles.input} value={exNome} onChangeText={setExNome} />
      <TextInput placeholder="Séries" style={styles.input} value={series} onChangeText={setSeries} keyboardType="numeric" />
      <TextInput placeholder="Repetições" style={styles.input} value={reps} onChangeText={setReps} keyboardType="numeric" />
      <TextInput placeholder="Carga (kg)" style={styles.input} value={carga} onChangeText={setCarga} keyboardType="numeric" />
      <Button title="Adicionar Item" onPress={handleAddItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing(2), backgroundColor: theme.colors.background },
  title: { fontSize: theme.fontSizes.xl, marginBottom: theme.spacing(1) },
  section: { fontWeight: '600', marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5), color: theme.colors.text },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: theme.radii.sm, padding: theme.spacing(1.5), marginBottom: theme.spacing(1) },
  treinoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }
});
