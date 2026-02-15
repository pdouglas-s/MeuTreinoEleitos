import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../../theme';
import { Alert } from '../../utils/alert';
import { createAluno, createProfessor, deleteProfessorProfile, listAllAlunos, listAllProfessores, unblockBlockedEmail } from '../../services/userService';
import { createTreino, listTreinosByProfessor, deleteTreino } from '../../services/treinoService';
import { contarNaoLidas } from '../../services/notificacoesService';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { isValidEmail } from '../../utils/validation';

export default function ProfessorHome({ navigation }) {
  const { logout, profile } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nomeProfessor, setNomeProfessor] = useState('');
  const [emailProfessor, setEmailProfessor] = useState('');
  const [emailDesbloqueio, setEmailDesbloqueio] = useState('');
  const [professores, setProfessores] = useState([]);

  // Treinos
  const [nomeTreino, setNomeTreino] = useState('');
  const [treinos, setTreinos] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [alunosMap, setAlunosMap] = useState({});
  const [notifCount, setNotifCount] = useState(0);
  const isAdmin = profile?.role === 'professor' && String(profile?.nome || '').trim().toUpperCase() === 'ADMIN';
  const emailAlunoInvalido = email.trim().length > 0 && !isValidEmail(email);
  const emailProfessorInvalido = emailProfessor.trim().length > 0 && !isValidEmail(emailProfessor);
  const emailDesbloqueioInvalido = emailDesbloqueio.trim().length > 0 && !isValidEmail(emailDesbloqueio);
  const createAlunoDisabled = !nome.trim() || !email.trim() || emailAlunoInvalido;
  const createProfessorDisabled = !nomeProfessor.trim() || !emailProfessor.trim() || emailProfessorInvalido;
  const desbloquearEmailDisabled = !emailDesbloqueio.trim() || emailDesbloqueioInvalido;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      loadTreinos(uid);
      loadAlunos();
      loadNotificacoes(uid);
      if (isAdmin) {
        loadProfessores();
      }
      
      // Atualizar contador a cada 30 segundos
      const interval = setInterval(() => loadNotificacoes(uid), 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  async function loadNotificacoes(professorId) {
    try {
      const count = await contarNaoLidas(professorId);
      setNotifCount(count);
    } catch (err) {
      console.warn('Erro ao carregar notificações', err);
    }
  }

  async function loadTreinos(professor_id) {
    try {
      const list = await listTreinosByProfessor(professor_id);
      // Ordenar alfabeticamente por nome_treino
      list.sort((a, b) => a.nome_treino.localeCompare(b.nome_treino));
      setTreinos(list);
    } catch (err) {
      console.warn('Erro ao carregar treinos', err.message);
    }
  }

  async function loadAlunos() {
    try {
      const list = await listAllAlunos();
      setAlunos(list);
      // Criar um mapa id -> nome para lookup rápido
      const map = {};
      list.forEach(aluno => {
        map[aluno.id] = aluno.nome;
      });
      setAlunosMap(map);
    } catch (err) {
      console.warn('Erro ao carregar alunos', err.message);
    }
  }

  async function loadProfessores() {
    try {
      const list = await listAllProfessores();
      setProfessores(list.filter(item => item.nome !== 'ADMIN'));
    } catch (err) {
      console.warn('Erro ao carregar professores', err.message);
    }
  }

  async function handleCreateAluno() {
    if (!nome || !email) return Alert.alert('Erro', 'Nome e e-mail são obrigatórios');
    if (!isValidEmail(email)) return Alert.alert('Erro', 'Digite um e-mail válido');
    try {
      await createAluno({ nome, email });
      Alert.alert('Sucesso', 'Aluno criado (senha padrão definida via variável de ambiente)');
      setNome('');
      setEmail('');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleCreateProfessor() {
    if (!nomeProfessor || !emailProfessor) return Alert.alert('Erro', 'Nome e e-mail são obrigatórios');
    if (!isValidEmail(emailProfessor)) return Alert.alert('Erro', 'Digite um e-mail válido');
    try {
      await createProfessor({ nome: nomeProfessor, email: emailProfessor });
      Alert.alert('Sucesso', 'Professor criado com senha padrão e primeiro acesso habilitado');
      setNomeProfessor('');
      setEmailProfessor('');
      await loadProfessores();
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleDeleteProfessor(professorId) {
    try {
      await deleteProfessorProfile(professorId);
      setProfessores(prev => prev.filter(item => item.id !== professorId));
      Alert.alert('Sucesso', 'Professor removido do Firestore e e-mail bloqueado no sistema');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleUnblockEmail() {
    if (!emailDesbloqueio) return Alert.alert('Erro', 'E-mail é obrigatório');
    if (!isValidEmail(emailDesbloqueio)) return Alert.alert('Erro', 'Digite um e-mail válido');
    try {
      await unblockBlockedEmail(emailDesbloqueio);
      setEmailDesbloqueio('');
      Alert.alert('Sucesso', 'E-mail desbloqueado no sistema');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  function confirmDeleteProfessor(professor) {
    if (window.confirm) {
      if (window.confirm(`Deseja realmente excluir o professor "${professor.nome}"?`)) {
        handleDeleteProfessor(professor.id);
      }
    } else {
      Alert.alert('Confirmar exclusão', `Deseja realmente excluir o professor "${professor.nome}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', onPress: () => handleDeleteProfessor(professor.id), style: 'destructive' }
      ]);
    }
  }

  async function handleCreateTreino() {
    if (!nomeTreino) return Alert.alert('Erro', 'Nome do treino é obrigatório');
    try {
      const professor_id = auth.currentUser?.uid;
      const { id } = await createTreino({ aluno_id: '', professor_id, nome_treino: nomeTreino, ativo: true });
      const novo = { id, aluno_id: '', professor_id, nome_treino: nomeTreino, ativo: true };
      const novaLista = [novo, ...treinos];
      // Ordenar alfabeticamente
      novaLista.sort((a, b) => a.nome_treino.localeCompare(b.nome_treino));
      setTreinos(novaLista);
      setNomeTreino('');
      Alert.alert('Sucesso', 'Treino criado');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  function handleSelectTreino(treino) {
    navigation.navigate('TreinoDetail', { treino });
  }

  async function handleDeleteTreino(treino_id) {
    try {
      await deleteTreino(treino_id);
      setTreinos(treinos.filter(t => t.id !== treino_id));
      Alert.alert('Sucesso', 'Treino excluído');
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  function confirmDelete(treino) {
    if (window.confirm) {
      if (window.confirm(`Deseja realmente excluir o treino "${treino.nome_treino}"?`)) {
        handleDeleteTreino(treino.id);
      }
    } else {
      Alert.alert('Confirmar exclusão', `Deseja realmente excluir o treino "${treino.nome_treino}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', onPress: () => handleDeleteTreino(treino.id), style: 'destructive' }
      ]);
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

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Área do Professor</Text>
          <Text style={styles.subtitle}>Bem-vindo, {profile?.nome}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.notifBtn} 
            onPress={() => {
              navigation.navigate('Notificacoes');
              loadNotificacoes(auth.currentUser?.uid);
            }}
          >
            <Ionicons name="notifications" size={22} color={theme.colors.primary} />
            {notifCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>🚪 Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.bancoExerciciosBtn} 
        onPress={() => navigation.navigate('GerenciarExercicios')}
      >
        <Text style={styles.bancoExerciciosText}>📚 Gerenciar Banco de Exercícios</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Criar Aluno</Text>
      <TextInput placeholder="Nome do aluno" style={styles.input} value={nome} onChangeText={setNome} />
      <TextInput placeholder="E-mail do aluno" style={[styles.input, emailAlunoInvalido && styles.inputError]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Text style={styles.helperText}>Exemplo: nome@dominio.com</Text>
      {emailAlunoInvalido && <Text style={styles.errorText}>E-mail inválido</Text>}
      <Button title="Criar Aluno" onPress={handleCreateAluno} disabled={createAlunoDisabled} />

      {isAdmin && (
        <>
          <Text style={styles.section}>Criar Professor</Text>
          <TextInput placeholder="Nome do professor" style={styles.input} value={nomeProfessor} onChangeText={setNomeProfessor} />
          <TextInput placeholder="E-mail do professor" style={[styles.input, emailProfessorInvalido && styles.inputError]} value={emailProfessor} onChangeText={setEmailProfessor} keyboardType="email-address" autoCapitalize="none" />
          <Text style={styles.helperText}>Exemplo: nome@dominio.com</Text>
          {emailProfessorInvalido && <Text style={styles.errorText}>E-mail inválido</Text>}
          <Button title="Criar Professor" onPress={handleCreateProfessor} disabled={createProfessorDisabled} />

          <Text style={[styles.section, { marginTop: 12 }]}>Professores</Text>
          <FlatList
            data={professores}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.treinoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.nome}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{item.email}</Text>
                </View>
                <TouchableOpacity onPress={() => confirmDeleteProfessor(item)} style={styles.deleteBtn}>
                  <Text style={{ color: '#dc2626', fontSize: 14 }}>🗑️ Excluir</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <Text style={[styles.section, { marginTop: 12 }]}>Desbloquear E-mail</Text>
          <TextInput
            placeholder="E-mail bloqueado"
            style={[styles.input, emailDesbloqueioInvalido && styles.inputError]}
            value={emailDesbloqueio}
            onChangeText={setEmailDesbloqueio}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.helperText}>Exemplo: nome@dominio.com</Text>
          {emailDesbloqueioInvalido && <Text style={styles.errorText}>E-mail inválido</Text>}
          <Button title="Desbloquear E-mail" onPress={handleUnblockEmail} disabled={desbloquearEmailDisabled} />
        </>
      )}

      <Text style={styles.section}>Treinos</Text>
      <TextInput placeholder="Nome do treino" style={styles.input} value={nomeTreino} onChangeText={setNomeTreino} />
      <Button title="Criar Treino (sem aluno)" onPress={handleCreateTreino} />

      <Text style={[styles.section, { marginTop: 12 }]}>Seus Treinos</Text>
      <FlatList
        data={treinos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.treinoRow}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => handleSelectTreino(item)}>
              <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.nome_treino}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                {item.aluno_id && alunosMap[item.aluno_id] 
                  ? `👤 ${alunosMap[item.aluno_id]}` 
                  : '📋 Treino modelo (sem aluno)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
              <Text style={{ color: '#dc2626', fontSize: 14 }}>🗑️ Excluir</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing(2), backgroundColor: theme.colors.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.muted,
    fontSize: 14
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2)
  },
  title: { fontSize: theme.fontSizes.xl, fontWeight: '700' },
  subtitle: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  notifBtn: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700'
  },
  logoutBtn: {
    backgroundColor: '#fee',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#fca'
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 14
  },
  section: { fontWeight: '600', marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5), color: theme.colors.text },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: theme.radii.sm, padding: theme.spacing(1.5), marginBottom: theme.spacing(1) },
  helperText: { color: theme.colors.muted, fontSize: 12, marginTop: -6, marginBottom: 10 },
  inputError: { borderColor: '#dc2626' },
  errorText: { color: '#dc2626', fontSize: 12, marginTop: -6, marginBottom: 10 },
  treinoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
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
  bancoExerciciosBtn: {
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginBottom: 16
  },
  bancoExerciciosText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15
  }
});