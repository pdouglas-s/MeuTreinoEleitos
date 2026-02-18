import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, TouchableWithoutFeedback, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import theme from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase/config';
import { deleteTreino, listTreinosByAcademia, listTreinosByProfessor } from '../../services/treinoService';
import { listAllAlunos } from '../../services/userService';
import { Alert } from '../../utils/alert';
import { getAuthErrorMessage } from '../../utils/authErrors';

export default function TreinosListScreen({ navigation }) {
  const { profile } = useAuth();
  const [treinos, setTreinos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [alunosMap, setAlunosMap] = useState({});
  const [gruposAbertos, setGruposAbertos] = useState({});

  const isAcademyAdmin = profile?.role === 'admin_academia';

  useEffect(() => {
    carregarDados();
  }, [profile?.role, profile?.academia_id]);

  useFocusEffect(
    React.useCallback(() => {
      carregarDados();
      return undefined;
    }, [profile?.role, profile?.academia_id])
  );

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
    const base = !termo
      ? treinos
      : treinos.filter((treino) => {
      const nomeTreino = String(treino?.nome_treino || '').toLowerCase();
      const nomeAluno = String(alunosMap[treino?.aluno_id] || '').toLowerCase();
      return nomeTreino.includes(termo) || nomeAluno.includes(termo);
      });

    const normalize = (value) => String(value || '').trim().toLowerCase();
    return [...base].sort((a, b) => {
      const alunoA = normalize(alunosMap[a?.aluno_id]);
      const alunoB = normalize(alunosMap[b?.aluno_id]);
      const temAlunoA = !!alunoA;
      const temAlunoB = !!alunoB;

      if (temAlunoA && temAlunoB && alunoA !== alunoB) {
        return alunoA.localeCompare(alunoB);
      }
      if (temAlunoA && !temAlunoB) return -1;
      if (!temAlunoA && temAlunoB) return 1;

      return normalize(a?.nome_treino).localeCompare(normalize(b?.nome_treino));
    });
  }, [treinos, alunosMap, busca]);

  const gruposTreinos = useMemo(() => {
    const gruposMap = new Map();

    treinosFiltrados.forEach((treino) => {
      const alunoNome = String(alunosMap[treino?.aluno_id] || '').trim();
      const ehModelo = !alunoNome;
      const groupKey = ehModelo ? 'modelo' : `aluno:${String(treino?.aluno_id || '').trim()}`;
      const groupTitle = ehModelo ? '📋 Treinos modelo (sem aluno)' : `👤 ${alunoNome}`;

      if (!gruposMap.has(groupKey)) {
        gruposMap.set(groupKey, {
          key: groupKey,
          title: groupTitle,
          isModelo: ehModelo,
          items: []
        });
      }

      gruposMap.get(groupKey).items.push(treino);
    });

    const grupos = Array.from(gruposMap.values());
    return grupos.sort((a, b) => {
      if (a.isModelo && !b.isModelo) return 1;
      if (!a.isModelo && b.isModelo) return -1;
      return a.title.localeCompare(b.title);
    });
  }, [treinosFiltrados, alunosMap]);

  useEffect(() => {
    const keysAtuais = new Set(gruposTreinos.map((grupo) => grupo.key));
    setGruposAbertos((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        if (keysAtuais.has(key) && prev[key]) {
          next[key] = true;
        }
      });
      return next;
    });
  }, [gruposTreinos]);

  function alternarGrupo(groupKey) {
    setGruposAbertos((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  }

  function handleOpenTreino(treino) {
    navigation.navigate('TreinoDetail', { treino });
  }

  async function handleDeleteTreino(item) {
    const confirmado = await Alert.confirm(
      'Confirmar exclusão',
      `Deseja realmente excluir o treino "${item?.nome_treino || 'Treino'}"?`,
      { confirmText: 'Excluir', destructive: true }
    );
    if (!confirmado) return;

    try {
      await deleteTreino(item.id);
      setTreinos((prev) => prev.filter((treino) => treino.id !== item.id));
      Alert.alert('Sucesso', 'Treino excluído com sucesso.');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o treino.'));
    }
  }

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
      <TouchableWithoutFeedback onPress={() => navigation.goBack()}>
        <View style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Voltar ao painel</Text>
        </View>
      </TouchableWithoutFeedback>
      <Text style={styles.title}>Treinos</Text>
      <TextInput
        placeholder="Buscar por treino ou aluno"
        style={styles.input}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {gruposTreinos.map((grupo) => {
          const grupoAberto = !!gruposAbertos[grupo.key];
          return (
            <View key={grupo.key} style={styles.groupCard}>
              <TouchableOpacity
                style={styles.groupHeader}
                activeOpacity={0.85}
                onPress={() => alternarGrupo(grupo.key)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupTitle}>Treinos disponíveis</Text>
                  <Text style={styles.groupContext}>{grupo.title}</Text>
                  <Text style={styles.groupMeta}>{grupo.items.length} treino(s)</Text>
                </View>
                <Text style={styles.groupChevron}>{grupoAberto ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              {grupoAberto && grupo.items.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <TouchableWithoutFeedback onPress={() => handleOpenTreino(item)}>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemNome}>{item.nome_treino}</Text>
                      <Text style={styles.itemSub}>
                        {item.aluno_id && alunosMap[item.aluno_id]
                          ? `👤 ${alunosMap[item.aluno_id]}`
                          : '📋 Treino modelo (sem aluno)'}
                      </Text>
                    </View>
                  </TouchableWithoutFeedback>
                  {!String(item?.aluno_id || '').trim() && (
                    <TouchableWithoutFeedback onPress={() => handleDeleteTreino(item)}>
                      <View style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>🗑️ Excluir</Text>
                      </View>
                    </TouchableWithoutFeedback>
                  )}
                </View>
              ))}
            </View>
          );
        })}

        {gruposTreinos.length === 0 && (
          <Text style={styles.emptyHint}>Nenhum treino encontrado.</Text>
        )}
      </ScrollView>
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
  backBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.card,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10
  },
  backBtnText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    backgroundColor: theme.colors.card
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingBottom: theme.spacing(3)
  },
  groupCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.card,
    marginBottom: 8,
    overflow: 'hidden'
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text
  },
  groupContext: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600'
  },
  groupMeta: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.muted
  },
  groupChevron: {
    fontSize: 16,
    color: theme.colors.muted,
    marginLeft: 10
  },
  itemRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: theme.colors.background,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 0
  },
  itemContent: {
    flex: 1
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
  },
  deleteBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.background
  },
  deleteBtnText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '600'
  }
});
