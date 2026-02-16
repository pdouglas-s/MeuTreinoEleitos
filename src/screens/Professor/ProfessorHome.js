import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import theme from '../../theme';
import { Alert } from '../../utils/alert';
import { createAcademia, createAcademiaAdmin, createAluno, createProfessor, deleteProfessorProfile, listAcademias, listAllAlunos, listAllProfessores, unblockBlockedEmail } from '../../services/userService';
import { createTreino, listTreinosByProfessor, deleteTreino, updateTreino } from '../../services/treinoService';
import { contarNaoLidas, enviarNotificacao } from '../../services/notificacoesService';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { isValidEmail } from '../../utils/validation';
import { getAuthErrorMessage } from '../../utils/authErrors';

export default function ProfessorHome({ navigation }) {
  const { logout, profile } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nomeProfessor, setNomeProfessor] = useState('');
  const [emailProfessor, setEmailProfessor] = useState('');
  const [emailDesbloqueio, setEmailDesbloqueio] = useState('');
  const [professores, setProfessores] = useState([]);
  const [academias, setAcademias] = useState([]);
  const [nomeAcademia, setNomeAcademia] = useState('');
  const [nomeAdminAcademia, setNomeAdminAcademia] = useState('');
  const [emailAdminAcademia, setEmailAdminAcademia] = useState('');
  const [academiaSelecionadaAdmin, setAcademiaSelecionadaAdmin] = useState('');

  // Treinos
  const [nomeTreino, setNomeTreino] = useState('');
  const [alunoSelecionadoTreino, setAlunoSelecionadoTreino] = useState('');
  const [treinos, setTreinos] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [alunosMap, setAlunosMap] = useState({});
  const [alunosLoaded, setAlunosLoaded] = useState(false);
  const orphanCleanupAttemptsRef = useRef(new Set());
  const orphanCleanupInFlightRef = useRef(false);
  const [notifCount, setNotifCount] = useState(0);
  const isSystemAdmin = profile?.role === 'admin_sistema';
  const isAcademyAdmin = profile?.role === 'admin_academia';
  const isProfessor = profile?.role === 'professor';
  const canManageAcademyUsers = isAcademyAdmin;
  const canManageTreinos = isProfessor;
  const pageTitle = isAcademyAdmin ? 'Área do Admin da Academia' : 'Área do Professor';
  const pageSubtitle = isAcademyAdmin
    ? `Gestão da academia • ${profile?.nome || ''}`
    : `Bem-vindo, ${profile?.nome || ''}`;
  const emailAlunoInvalido = email.trim().length > 0 && !isValidEmail(email);
  const emailProfessorInvalido = emailProfessor.trim().length > 0 && !isValidEmail(emailProfessor);
  const emailDesbloqueioInvalido = emailDesbloqueio.trim().length > 0 && !isValidEmail(emailDesbloqueio);
  const emailAdminAcademiaInvalido = emailAdminAcademia.trim().length > 0 && !isValidEmail(emailAdminAcademia);
  const createAlunoDisabled = !nome.trim() || !email.trim() || emailAlunoInvalido;
  const createProfessorDisabled = !nomeProfessor.trim() || !emailProfessor.trim() || emailProfessorInvalido;
  const desbloquearEmailDisabled = !emailDesbloqueio.trim() || emailDesbloqueioInvalido;
  const createAcademiaDisabled = !nomeAcademia.trim();
  const createAdminAcademiaDisabled = !nomeAdminAcademia.trim() || !emailAdminAcademia.trim() || emailAdminAcademiaInvalido || !academiaSelecionadaAdmin;
  const createTreinoParaAlunoDisabled = !nomeTreino.trim() || !alunoSelecionadoTreino;
  const hasAlunoVinculado = (treino) => !!treino?.aluno_id && !!alunosMap[treino.aluno_id];
  const treinosModeloCount = alunosLoaded
    ? treinos.filter((item) => !hasAlunoVinculado(item)).length
    : treinos.filter((item) => !item.aluno_id).length;
  const treinosComAlunoCount = alunosLoaded
    ? treinos.filter((item) => hasAlunoVinculado(item)).length
    : treinos.filter((item) => !!item.aluno_id).length;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      if (isSystemAdmin) {
        loadAcademias();
      } else {
        if (canManageTreinos) {
          loadTreinos(uid);
        } else {
          setTreinos([]);
        }
        loadAlunos();
        loadNotificacoes(uid);
        if (canManageAcademyUsers) {
          loadProfessores();
        }
      }
      
      // Atualizar contador a cada 30 segundos
      const interval = setInterval(() => {
        if (!isSystemAdmin) loadNotificacoes(uid);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isSystemAdmin, canManageAcademyUsers, canManageTreinos]);

  useFocusEffect(
    React.useCallback(() => {
      const uid = auth.currentUser?.uid;
      if (!uid) return undefined;

      if (isSystemAdmin) {
        loadAcademias();
        return undefined;
      }

      if (canManageTreinos) {
        loadTreinos(uid);
      } else {
        setTreinos([]);
      }

      loadAlunos();
      loadNotificacoes(uid);

      if (canManageAcademyUsers) {
        loadProfessores();
      }

      return undefined;
    }, [isSystemAdmin, canManageAcademyUsers, canManageTreinos])
  );

  useEffect(() => {
    if (!canManageTreinos || !alunosLoaded || treinos.length === 0) return;
    cleanupOrphanTreinoLinks(treinos, alunosMap);
  }, [canManageTreinos, alunosLoaded, treinos, alunosMap]);

  async function loadAcademias() {
    try {
      const list = await listAcademias();
      setAcademias(list);
    } catch (err) {
      console.warn('Erro ao carregar academias', err?.message || err);
    }
  }

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
      setTreinos([]);
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível carregar os treinos.'));
      console.warn('Erro ao carregar treinos', err?.message || err);
    }
  }

  async function loadAlunos() {
    setAlunosLoaded(false);
    try {
      const list = await listAllAlunos();
      const sortedList = [...list].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setAlunos(sortedList);
      // Criar um mapa id -> nome para lookup rápido
      const map = {};
      sortedList.forEach(aluno => {
        map[aluno.id] = aluno.nome;
      });
      setAlunosMap(map);
    } catch (err) {
      console.warn('Erro ao carregar alunos', err.message);
    } finally {
      setAlunosLoaded(true);
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

  async function cleanupOrphanTreinoLinks(treinosList, alunosById) {
    if (orphanCleanupInFlightRef.current) return;

    const orphanTreinos = treinosList.filter((item) => {
      const alunoId = String(item?.aluno_id || '').trim();
      return alunoId && !alunosById[alunoId] && !orphanCleanupAttemptsRef.current.has(item.id);
    });

    if (orphanTreinos.length === 0) return;

    orphanTreinos.forEach((item) => orphanCleanupAttemptsRef.current.add(item.id));
    orphanCleanupInFlightRef.current = true;

    try {
      const results = await Promise.allSettled(
        orphanTreinos.map((item) => updateTreino(item.id, { aluno_id: '' }))
      );

      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failCount = results.length - successCount;

      if (failCount > 0) {
        console.warn(`Falha ao limpar ${failCount} vínculo(s) órfão(s) de treino`);
      }

      if (successCount > 0) {
        const uid = auth.currentUser?.uid;
        if (uid) {
          await loadTreinos(uid);
        }
      }
    } finally {
      orphanCleanupInFlightRef.current = false;
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
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível criar o aluno.'));
    }
  }

  async function handleCreateAcademia() {
    if (!nomeAcademia.trim()) return Alert.alert('Erro', 'Nome da academia é obrigatório');
    try {
      await createAcademia({ nome: nomeAcademia });
      setNomeAcademia('');
      await loadAcademias();
      Alert.alert('Sucesso', 'Academia cadastrada com sucesso');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível cadastrar a academia.'));
    }
  }

  async function handleCreateAdminAcademia() {
    if (!nomeAdminAcademia.trim() || !emailAdminAcademia.trim()) {
      return Alert.alert('Erro', 'Nome e e-mail são obrigatórios');
    }
    if (!academiaSelecionadaAdmin) {
      return Alert.alert('Erro', 'Selecione uma academia');
    }
    if (!isValidEmail(emailAdminAcademia)) {
      return Alert.alert('Erro', 'Digite um e-mail válido');
    }
    try {
      await createAcademiaAdmin({
        nome: nomeAdminAcademia,
        email: emailAdminAcademia,
        academia_id: academiaSelecionadaAdmin
      });
      setNomeAdminAcademia('');
      setEmailAdminAcademia('');
      setAcademiaSelecionadaAdmin('');
      Alert.alert('Sucesso', 'Admin da academia criado com senha padrão e primeiro acesso habilitado');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível criar o admin da academia.'));
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
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível criar o professor.'));
    }
  }

  async function handleDeleteProfessor(professorId) {
    try {
      await deleteProfessorProfile(professorId);
      setProfessores(prev => prev.filter(item => item.id !== professorId));
      Alert.alert('Sucesso', 'Professor removido do Firestore e e-mail bloqueado no sistema');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o professor.'));
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
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível desbloquear o e-mail.'));
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

  async function handleCreateTreino(alunoId = '') {
    if (!nomeTreino) return Alert.alert('Erro', 'Nome do treino é obrigatório');
    try {
      const professor_id = auth.currentUser?.uid;
      const { id } = await createTreino({
        aluno_id: alunoId,
        professor_id,
        nome_treino: nomeTreino,
        ativo: true,
        academia_id: profile?.academia_id || null,
        is_padrao: false
      });

      if (alunoId) {
        try {
          await enviarNotificacao(professor_id, alunoId, 'treino_associado', {
            treino_id: id,
            treino_nome: nomeTreino,
            professor_nome: profile?.nome || 'Professor'
          });
        } catch (notifyErr) {
          console.warn('Falha ao enviar notificação de treino associado:', notifyErr?.message || notifyErr);
        }
      }

      setNomeTreino('');
      setAlunoSelecionadoTreino('');
      await loadTreinos(professor_id);
      Alert.alert('Sucesso', alunoId ? 'Treino criado para o aluno selecionado' : 'Treino modelo criado (sem aluno)');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível criar o treino.'));
    }
  }

  function handleSelectTreino(treino) {
    navigation.navigate('TreinoDetail', { treino });
  }

  async function handleDeleteTreino(treino_id) {
    try {
      const treinoExcluido = await deleteTreino(treino_id);

      if (treinoExcluido?.aluno_id) {
        try {
          await enviarNotificacao(auth.currentUser?.uid, treinoExcluido.aluno_id, 'treino_excluido', {
            treino_id: treinoExcluido.id,
            treino_nome: treinoExcluido.nome_treino || 'Treino',
            professor_nome: profile?.nome || 'Professor'
          });
        } catch (notifyErr) {
          console.warn('Falha ao enviar notificação de treino excluído:', notifyErr?.message || notifyErr);
        }
      }

      setTreinos(treinos.filter(t => t.id !== treino_id));
      Alert.alert('Sucesso', 'Treino excluído');
    } catch (err) {
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível excluir o treino.'));
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
      Alert.alert('Erro', getAuthErrorMessage(err, 'Falha ao sair.'));
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
          <Text style={styles.title}>{pageTitle}</Text>
          <Text style={styles.subtitle}>{pageSubtitle}</Text>
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

      {!isSystemAdmin && <View style={styles.statsRow}>
        {isAcademyAdmin && <View style={styles.statCard}>
          <Text style={styles.statValue}>{alunos.length}</Text>
          <Text style={styles.statLabel}>Alunos</Text>
        </View>}
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{treinos.length}</Text>
          <Text style={styles.statLabel}>Treinos</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{notifCount}</Text>
          <Text style={styles.statLabel}>Notificações</Text>
        </View>
      </View>}

      {!isSystemAdmin && isAcademyAdmin && <TouchableOpacity 
        style={styles.bancoExerciciosBtn} 
        onPress={() => navigation.navigate('GerenciarExercicios')}
      >
        <Text style={styles.bancoExerciciosText}>📚 Gerenciar Banco de Exercícios</Text>
      </TouchableOpacity>}

      {isSystemAdmin && (
        <View style={styles.cardBlock}>
          <Text style={styles.blockTitle}>Administração do Sistema</Text>
          <Text style={styles.section}>Cadastrar Academia</Text>
          <TextInput placeholder="Nome da academia" style={styles.input} value={nomeAcademia} onChangeText={setNomeAcademia} />
          <Button title="Cadastrar Academia" onPress={handleCreateAcademia} disabled={createAcademiaDisabled} />

          <Text style={[styles.section, { marginTop: 12 }]}>Cadastrar Admin da Academia</Text>
          <TextInput placeholder="Nome do admin da academia" style={styles.input} value={nomeAdminAcademia} onChangeText={setNomeAdminAcademia} />
          <TextInput
            placeholder="E-mail do admin da academia"
            style={[styles.input, emailAdminAcademiaInvalido && styles.inputError]}
            value={emailAdminAcademia}
            onChangeText={setEmailAdminAcademia}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View style={styles.pickerContainer}>
            <Picker selectedValue={academiaSelecionadaAdmin} onValueChange={setAcademiaSelecionadaAdmin} style={styles.picker}>
              <Picker.Item label="Selecione uma academia" value="" />
              {academias.map((academia) => (
                <Picker.Item key={academia.id} label={academia.nome} value={academia.id} />
              ))}
            </Picker>
          </View>
          <Button title="Criar Admin da Academia" onPress={handleCreateAdminAcademia} disabled={createAdminAcademiaDisabled} />

          <Text style={[styles.section, { marginTop: 12 }]}>Academias cadastradas</Text>
          {academias.length === 0 && <Text style={styles.emptyHint}>Nenhuma academia cadastrada.</Text>}
          {academias.map((academia) => (
            <View key={academia.id} style={styles.treinoRow}>
              <Text style={{ fontSize: 15, color: theme.colors.text, flex: 1 }}>{academia.nome}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.muted }}>{academia.id}</Text>
            </View>
          ))}
        </View>
      )}

      {isAcademyAdmin && <View style={styles.cardBlock}>
        <Text style={styles.blockTitle}>Cadastro de Aluno</Text>
        <Text style={styles.blockHint}>Crie alunos com senha padrão para início rápido.</Text>
        <TextInput placeholder="Nome do aluno" style={styles.input} value={nome} onChangeText={setNome} />
        <TextInput placeholder="E-mail do aluno" style={[styles.input, emailAlunoInvalido && styles.inputError]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Text style={styles.helperText}>Exemplo: nome@dominio.com</Text>
        {emailAlunoInvalido && <Text style={styles.errorText}>E-mail inválido</Text>}
        <Button title="Criar Aluno" onPress={handleCreateAluno} disabled={createAlunoDisabled} />
      </View>}

      {canManageAcademyUsers && (
        <View style={styles.cardBlock}>
          <Text style={styles.blockTitle}>Administração de Professores</Text>
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
                  <Text style={styles.deleteText}>🗑️ Excluir</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          {professores.length === 0 && <Text style={styles.emptyHint}>Nenhum professor adicional cadastrado.</Text>}

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
        </View>
      )}

      {!isSystemAdmin && canManageTreinos && <View style={styles.cardBlock}>
        <Text style={styles.blockTitle}>Montagem de Ficha</Text>
        <Text style={styles.blockHint}>Crie treino modelo ou vincule diretamente a um aluno cadastrado.</Text>
        <TextInput placeholder="Nome do treino" style={styles.input} value={nomeTreino} onChangeText={setNomeTreino} />
        <Button title="Criar Treino (sem aluno)" onPress={() => handleCreateTreino('')} />

        <Text style={[styles.section, { marginTop: 12 }]}>Criar treino para aluno</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={alunoSelecionadoTreino}
            onValueChange={(value) => setAlunoSelecionadoTreino(value)}
            style={styles.picker}
          >
            <Picker.Item label="Selecione um aluno" value="" />
            {alunos.map((aluno) => (
              <Picker.Item key={aluno.id} label={`${aluno.nome} (${aluno.email})`} value={aluno.id} />
            ))}
          </Picker>
        </View>
        <Button
          title="Criar Treino para Aluno"
          onPress={() => handleCreateTreino(alunoSelecionadoTreino)}
          disabled={createTreinoParaAlunoDisabled}
        />
        <View style={styles.quickInfoRow}>
          <Text style={styles.quickInfoText}>📋 Modelos: {treinosModeloCount}</Text>
          <Text style={styles.quickInfoText}>👤 Vinculados: {treinosComAlunoCount}</Text>
        </View>
      </View>}

      {!isSystemAdmin && canManageTreinos && <View style={styles.cardBlock}>
        <Text style={styles.blockTitle}>Seus Treinos</Text>
        <FlatList
          data={treinos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.treinoRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => handleSelectTreino(item)}>
                <Text style={{ fontSize: 16, fontWeight: '500' }}>{item.nome_treino}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>
                  {(item.aluno_id && !alunosLoaded)
                    ? '👤 Treino vinculado a aluno'
                    : (hasAlunoVinculado(item)
                      ? `👤 Treino vinculado: ${alunosMap[item.aluno_id]}`
                      : '📋 Treino modelo (sem aluno)')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>🗑️ Excluir</Text>
              </TouchableOpacity>
            </View>
          )}
        />
        {treinos.length === 0 && <Text style={styles.emptyHint}>Nenhum treino criado ainda.</Text>}
      </View>}
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
  title: { fontSize: theme.fontSizes.xl, fontWeight: '700', color: theme.colors.text },
  subtitle: { fontSize: 14, color: theme.colors.muted, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing(1.5)
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 12
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
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  badgeText: {
    color: theme.colors.card,
    fontSize: 11,
    fontWeight: '700'
  },
  logoutBtn: {
    backgroundColor: theme.colors.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.danger
  },
  logoutText: {
    color: theme.colors.danger,
    fontWeight: '600',
    fontSize: 14
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
  helperText: { color: theme.colors.muted, fontSize: 12, marginTop: -6, marginBottom: 10 },
  inputError: { borderColor: theme.colors.danger },
  errorText: { color: theme.colors.danger, fontSize: 12, marginTop: -6, marginBottom: 10 },
  treinoRow: { 
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
  deleteText: {
    color: theme.colors.danger,
    fontSize: 14
  },
  bancoExerciciosBtn: {
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginBottom: 16
  },
  bancoExerciciosText: {
    color: theme.colors.card,
    fontWeight: '600',
    fontSize: 15
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.colors.background,
    overflow: 'hidden'
  },
  picker: {
    width: '100%'
  },
  quickInfoRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  quickInfoText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600'
  },
  emptyHint: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 8
  }
});