import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import theme from '../../theme';
import { deleteAlunoProfile, listAllAlunos, updateManagedUserProfile } from '../../services/userService';
import { Alert } from '../../utils/alert';
import { getAuthErrorMessage } from '../../utils/authErrors';

export default function AlunosListScreen({ navigation }) {
  const [alunos, setAlunos] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecionadoId, setSelecionadoId] = useState('');
  const [editandoId, setEditandoId] = useState('');
  const [editNome, setEditNome] = useState('');

  useEffect(() => {
    carregarAlunos();
  }, []);

  async function carregarAlunos() {
    setLoading(true);
    try {
      const list = await listAllAlunos();
      const sortedList = [...list].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setAlunos(sortedList);
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar os alunos.'));
    } finally {
      setLoading(false);
    }
  }

  const alunosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return alunos;
    return alunos.filter((aluno) => {
      const nome = String(aluno?.nome || '').toLowerCase();
      const email = String(aluno?.email || '').toLowerCase();
      return nome.includes(termo) || email.includes(termo);
    });
  }, [alunos, busca]);

  function iniciarEdicao(aluno) {
    setEditandoId(aluno.id);
    setEditNome(String(aluno?.nome || ''));
  }

  function cancelarEdicao() {
    setEditandoId('');
    setEditNome('');
  }

  async function salvarEdicao(alunoId) {
    try {
      await updateManagedUserProfile({ userId: alunoId, nome: editNome });
      Alert.alert('Sucesso', 'Aluno atualizado com sucesso.');
      cancelarEdicao();
      await carregarAlunos();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível atualizar o aluno.'));
    }
  }

  async function excluirAluno(aluno) {
    const confirmado = await Alert.confirm(
      'Confirmar exclusão',
      `Deseja realmente excluir o aluno "${aluno?.nome || 'Aluno'}"?`,
      { confirmText: 'Excluir', destructive: true }
    );

    if (!confirmado) return;

    try {
      await deleteAlunoProfile(aluno.id);
      Alert.alert('Sucesso', 'Aluno excluído com sucesso.');
      if (selecionadoId === aluno.id) setSelecionadoId('');
      await carregarAlunos();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o aluno.'));
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando alunos...</Text>
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
      <Text style={styles.title}>Alunos Cadastrados</Text>
      <TextInput
        placeholder="Buscar por nome ou e-mail"
        style={styles.input}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
      />

      <FlatList
        data={alunosFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableWithoutFeedback onPress={() => setSelecionadoId((prev) => (prev === item.id ? '' : item.id))}>
            <View style={styles.itemRow}>
              <Text style={styles.itemNome}>{item.nome}</Text>
              <Text style={styles.itemEmail}>{item.email}</Text>

              {selecionadoId === item.id && editandoId !== item.id && (
                <View style={styles.actionsRow}>
                  <TouchableWithoutFeedback onPress={() => iniciarEdicao(item)}>
                    <View style={styles.editBtn}>
                      <Text style={styles.editBtnText}>✏️ Editar</Text>
                    </View>
                  </TouchableWithoutFeedback>
                  <TouchableWithoutFeedback onPress={() => excluirAluno(item)}>
                    <View style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>🗑️ Excluir</Text>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              )}

              {editandoId === item.id && (
                <View style={styles.editBox}>
                  <TextInput
                    placeholder="Nome"
                    style={styles.inputEdit}
                    value={editNome}
                    onChangeText={setEditNome}
                  />
                  <Text style={styles.editHint}>E-mail do aluno não pode ser alterado.</Text>
                  <View style={styles.actionsRow}>
                    <TouchableWithoutFeedback onPress={() => salvarEdicao(item.id)}>
                      <View style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>Salvar</Text>
                      </View>
                    </TouchableWithoutFeedback>
                    <TouchableWithoutFeedback onPress={cancelarEdicao}>
                      <View style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancelar</Text>
                      </View>
                    </TouchableWithoutFeedback>
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        )}
        ListEmptyComponent={<Text style={styles.emptyHint}>Nenhum aluno encontrado.</Text>}
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
  itemEmail: {
    marginTop: 3,
    fontSize: 12,
    color: theme.colors.muted
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  editBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.background
  },
  editBtnText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600'
  },
  deleteBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.background
  },
  deleteBtnText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '600'
  },
  editBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10
  },
  inputEdit: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    padding: 10,
    backgroundColor: theme.colors.background,
    marginBottom: 8
  },
  editHint: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: 8
  },
  saveBtn: {
    flex: 1,
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.primary
  },
  saveBtnText: {
    color: theme.colors.card,
    fontSize: 12,
    fontWeight: '700'
  },
  cancelBtn: {
    flex: 1,
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: theme.colors.background
  },
  cancelBtnText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600'
  },
  emptyHint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.muted
  }
});
