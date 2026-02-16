import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import theme from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase/config';
import { listTreinosByAcademia, listTreinosByProfessor } from '../../services/treinoService';
import { listAllAlunos } from '../../services/userService';
import { Alert } from '../../utils/alert';
import { getAuthErrorMessage } from '../../utils/authErrors';

export default function TreinosListScreen() {
  const { profile } = useAuth();
  const [treinos, setTreinos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [alunosMap, setAlunosMap] = useState({});

  const isAcademyAdmin = profile?.role === 'admin_academia';

  useEffect(() => {
    carregarDados();
  }, [profile?.role, profile?.academia_id]);

  async function carregarDados() {
    setLoading(true);
    try {
      const [treinosList, alunosList] = await Promise.all([
        isAcademyAdmin
          ? listTreinosByAcademia(profile?.academia_id)
          : listTreinosByProfessor(auth.currentUser?.uid),
        listAllAlunos()
      ]);

      const map = {};
      alunosList.forEach((aluno) => {
        map[aluno.id] = aluno.nome;
      });

      const sortedTreinos = [...treinosList].sort((a, b) => (a.nome_treino || '').localeCompare(b.nome_treino || ''));
      setTreinos(sortedTreinos);
      setAlunosMap(map);
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar os treinos.'));
    } finally {
      setLoading(false);
    }
  }

  const treinosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return treinos;
    return treinos.filter((treino) => {
      const nomeTreino = String(treino?.nome_treino || '').toLowerCase();
      const nomeAluno = String(alunosMap[treino?.aluno_id] || '').toLowerCase();
      return nomeTreino.includes(termo) || nomeAluno.includes(termo);
    });
  }, [treinos, alunosMap, busca]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando treinos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Treinos</Text>
      <TextInput
        placeholder="Buscar por treino ou aluno"
        style={styles.input}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
      />

      <FlatList
        data={treinosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemNome}>{item.nome_treino}</Text>
            <Text style={styles.itemSub}>
              {item.aluno_id && alunosMap[item.aluno_id]
                ? `👤 ${alunosMap[item.aluno_id]}`
                : '📋 Treino modelo (sem aluno)'}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyHint}>Nenhum treino encontrado.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(2)
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.muted,
    fontSize: 14
  },
  title: {
    fontSize: theme.fontSizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    backgroundColor: theme.colors.card
  },
  itemRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.card,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 6
  },
  itemNome: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text
  },
  itemSub: {
    marginTop: 3,
    fontSize: 12,
    color: theme.colors.muted
  },
  emptyHint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.muted
  }
});
