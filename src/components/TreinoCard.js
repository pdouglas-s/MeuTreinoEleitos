import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { criarSessaoTreino, marcarExercicioConcluido, finalizarSessao, buscarSessaoAtiva } from '../services/historicoService';
import { enviarNotificacao } from '../services/notificacoesService';
import { Alert } from '../utils/alert';

export default function TreinoCard({ treino, onOpen, alunoId, professorId, alunoNome }) {
  const [exercicios, setExercicios] = useState(
    (treino.itens || []).map((e) => ({ ...e, done: false }))
  );
  const [sessaoId, setSessaoId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [iniciandoSessao, setIniciandoSessao] = useState(false);

  useEffect(() => {
    carregarSessaoAtiva();
  }, [treino.id]);

  async function carregarSessaoAtiva() {
    try {
      const sessao = await buscarSessaoAtiva(treino.id, alunoId);
      if (sessao) {
        setSessaoId(sessao.id);
        // Restaurar estado dos exercícios da sessão
        const exerciciosConcluidos = sessao.exercicios || [];
        const exerciciosAtualizados = (treino.itens || []).map((item) => {
          const concluido = exerciciosConcluidos.find(
            (ec) => ec.exercicio_nome === item.exercicio_nome
          );
          return { ...item, done: !!concluido };
        });
        setExercicios(exerciciosAtualizados);
      }
    } catch (err) {
      console.warn('Erro ao carregar sessão ativa:', err);
    } finally {
      setCarregando(false);
    }
  }

  async function iniciarSessao() {
    try {
      setIniciandoSessao(true);
      const novoSessaoId = await criarSessaoTreino(treino.id, alunoId, professorId);
      setSessaoId(novoSessaoId);
      
      // Enviar notificação ao professor
      await enviarNotificacao(professorId, alunoId, 'treino_iniciado', {
        aluno_nome: alunoNome,
        treino_nome: treino.nome_treino,
        treino_id: treino.id
      });
      
      Alert.alert('Sucesso', 'Treino iniciado! Boa sorte! 💪');
    } catch (err) {
      console.error('Erro ao iniciar sessão:', err);
      Alert.alert('Erro', 'Não foi possível iniciar o treino: ' + err.message);
    } finally {
      setIniciandoSessao(false);
    }
  }

  async function toggleDone(index) {
    if (!sessaoId) {
      Alert.alert('Atenção', 'Você precisa iniciar o treino do dia primeiro!');
      return;
    }

    const copy = [...exercicios];
    const item = copy[index];
    const novoDone = !item.done;
    copy[index].done = novoDone;
    setExercicios(copy);

    // Se marcou como concluído, salvar no Firestore
    if (novoDone) {
      try {
        await marcarExercicioConcluido(sessaoId, {
          exercicio_nome: item.exercicio_nome,
          series: item.series,
          repeticoes: item.repeticoes,
          carga: item.carga
        });

        // Enviar notificação ao professor
        await enviarNotificacao(professorId, alunoId, 'exercicio_concluido', {
          aluno_nome: alunoNome,
          exercicio_nome: item.exercicio_nome,
          series: item.series,
          repeticoes: item.repeticoes,
          carga: item.carga,
          treino_nome: treino.nome_treino
        });
      } catch (err) {
        console.error('Erro ao marcar exercício:', err);
        // Reverter em caso de erro
        copy[index].done = !novoDone;
        setExercicios(copy);
        Alert.alert('Erro', 'Não foi possível salvar o progresso');
      }
    }
  }

  async function handleFinalizarSessao() {
    if (!sessaoId) {
      Alert.alert('Atenção', 'Nenhuma sessão ativa para finalizar');
      return;
    }

    const totalConcluidos = exercicios.filter((e) => e.done).length;
    const total = exercicios.length;

    if (totalConcluidos < total) {
      const confirmar = window.confirm 
        ? window.confirm(`Você concluiu ${totalConcluidos} de ${total} exercícios.\n\nDeseja finalizar mesmo assim?`)
        : true;
      if (!confirmar) return;
    }

    try {
      await finalizarSessao(sessaoId);
      
      // Enviar notificação ao professor
      await enviarNotificacao(professorId, alunoId, 'treino_finalizado', {
        aluno_nome: alunoNome,
        treino_nome: treino.nome_treino,
        treino_id: treino.id,
        total_exercicios: totalConcluidos,
        total_planejado: total
      });

      Alert.alert('Parabéns! 🎉', `Treino finalizado com sucesso!\n\n${totalConcluidos}/${total} exercícios concluídos`);
      
      // Resetar sessão para permitir novo treino
      setSessaoId(null);
      setExercicios((treino.itens || []).map((e) => ({ ...e, done: false })));
    } catch (err) {
      console.error('Erro ao finalizar sessão:', err);
      Alert.alert('Erro', 'Não foi possível finalizar o treino');
    }
  }

  const doneCount = exercicios.filter((e) => e.done).length;

  if (carregando) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.95} style={styles.card} onPress={() => onOpen && onOpen(treino)}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{treino.nome_treino}</Text>
        <View style={styles.statusRow}>
          {sessaoId && <Ionicons name="fitness" size={18} color={theme.colors.primary} style={{ marginRight: 6 }} />}
          <Text style={styles.progress}>{`${doneCount}/${exercicios.length}`}</Text>
        </View>
      </View>

      {!sessaoId && (
        <TouchableOpacity 
          style={styles.startBtn} 
          onPress={iniciarSessao}
          disabled={iniciandoSessao}
        >
          {iniciandoSessao ? (
            <ActivityIndicator size="small" color={theme.colors.card} />
          ) : (
            <>
              <Ionicons name="play-circle" size={18} color={theme.colors.card} />
              <Text style={styles.startText}>  Iniciar Treino do Dia</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <FlatList
        data={exercicios}
        keyExtractor={(item, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity 
              onPress={() => toggleDone(index)} 
              style={[styles.checkbox, item.done && styles.checkboxDone]} 
              testID={`checkbox-${index}`}
              disabled={!sessaoId}
            >
              {item.done ? (
                <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
              ) : (
                <Ionicons name="ellipse-outline" size={24} color={theme.colors.muted} style={{ opacity: sessaoId ? 1 : 0.4 }} />
              )}
            </TouchableOpacity>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemTitle, item.done && styles.itemTitleDone]}>{item.exercicio_nome || 'Exercício'}</Text>
              <Text style={styles.itemMeta}>{`${item.series || '-'} x ${item.repeticoes || '-'} • ${item.carga || '-'}kg`}</Text>
            </View>
          </View>
        )}
      />

      {sessaoId && (
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinalizarSessao}>
          <Ionicons name="checkmark-done" size={16} color={theme.colors.card} />
          <Text style={styles.finishText}>  Finalizar Sessão</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radii.md, padding: theme.spacing(1.5), marginBottom: theme.spacing(1.5), elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  title: { fontSize: theme.fontSizes.lg, fontWeight: '700', color: theme.colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  progress: { fontSize: theme.fontSizes.sm, color: theme.colors.muted },
  startBtn: { marginBottom: 12, backgroundColor: theme.colors.primary, padding: 10, borderRadius: theme.radii.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  startText: { color: theme.colors.card, fontWeight: '600', fontSize: 15 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.background, marginTop: 8 },
  checkbox: { width: 34, height: 34, borderRadius: theme.radii.sm, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxDone: { backgroundColor: theme.colors.background },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: theme.fontSizes.md, color: theme.colors.text },
  itemTitleDone: { textDecorationLine: 'line-through', color: theme.colors.muted },
  itemMeta: { fontSize: theme.fontSizes.sm, color: theme.colors.muted },
  finishBtn: { marginTop: 12, backgroundColor: theme.colors.primary, padding: 10, borderRadius: theme.radii.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  finishText: { color: theme.colors.card, fontWeight: '600' }
});
