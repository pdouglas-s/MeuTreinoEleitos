import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import theme from '../../theme';
import { deleteProfessorProfile, listAllProfessores, updateManagedUserProfile } from '../../services/userService';
import { Alert } from '../../utils/alert';
import { getAuthErrorMessage } from '../../utils/authErrors';

export default function ProfessoresListScreen({ navigation }) {
  const [professores, setProfessores] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecionadoId, setSelecionadoId] = useState('');
  const [editandoId, setEditandoId] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');

  useEffect(() => {
    carregarProfessores();
  }, []);

  async function carregarProfessores() {
    setLoading(true);
    try {
      const list = await listAllProfessores();
      const sortedList = [...list].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setProfessores(sortedList);
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar os professores.'));
    } finally {
      setLoading(false);
    }
  }

  const professoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return professores;
    return professores.filter((professor) => {
      const nome = String(professor?.nome || '').toLowerCase();
      const email = String(professor?.email || '').toLowerCase();
      return nome.includes(termo) || email.includes(termo);
    });
  }, [professores, busca]);

  function iniciarEdicao(professor) {
    setEditandoId(professor.id);
    setEditNome(String(professor?.nome || ''));
    setEditEmail(String(professor?.email || ''));
  }

  function cancelarEdicao() {
    setEditandoId('');
    setEditNome('');
    setEditEmail('');
  }

  async function salvarEdicao(professorId) {
    try {
      await updateManagedUserProfile({ userId: professorId, nome: editNome, email: editEmail });
      Alert.alert('Sucesso', 'Professor atualizado com sucesso.');
      cancelarEdicao();
      await carregarProfessores();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível atualizar o professor.'));
    }
  }

  async function excluirProfessor(professor) {
    const confirmado = await Alert.confirm(
      'Confirmar exclusão',
      `Deseja realmente excluir o professor "${professor?.nome || 'Professor'}"?`,
      { confirmText: 'Excluir', destructive: true }
    );

    if (!confirmado) return;

    try {
      await deleteProfessorProfile(professor.id);
      Alert.alert('Sucesso', 'Professor excluído com sucesso.');
      if (selecionadoId === professor.id) setSelecionadoId('');
      await carregarProfessores();
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o professor.'));
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando professores...</Text>
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
      <Text style={styles.title}>Professores Cadastrados</Text>
      <TextInput
        placeholder="Buscar por nome ou e-mail"
        style={styles.input}
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
      />

      <FlatList
        data={professoresFiltrados}
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
                  <TouchableWithoutFeedback onPress={() => excluirProfessor(item)}>
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
                  <TextInput
                    placeholder="E-mail"
                    style={styles.inputEdit}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
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
        ListEmptyComponent={<Text style={styles.emptyHint}>Nenhum professor encontrado.</Text>}
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
