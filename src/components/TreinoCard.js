import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import { criarSessaoTreino, marcarExercicioConcluido, finalizarSessao, buscarSessaoAtiva } from '../services/historicoService';
import { enviarNotificacao } from '../services/notificacoesService';
import { sugerirPlaylistsTreino } from '../services/musicSuggestionService';
import { Alert } from '../utils/alert';
import { getAuthErrorMessage } from '../utils/authErrors';

export default function TreinoCard({ treino, onOpen, alunoId, professorId, alunoNome, collapsedByDefault = false }) {
  const [exercicios, setExercicios] = useState(
    (treino.itens || []).map((e) => ({ ...e, done: false }))
  );
  const [sessaoId, setSessaoId] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [iniciandoSessao, setIniciandoSessao] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [pesoEditando, setPesoEditando] = useState('');
  const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(true);
  const [nivelEsforco, setNivelEsforco] = useState(0);
  const [feedbackTreino, setFeedbackTreino] = useState('');
  const [playlistSugestao, setPlaylistSugestao] = useState(null);
  const opcoesEsforco = [
    { nivel: 1, emoji: '😄', label: 'Muito leve' },
    { nivel: 2, emoji: '🙂', label: 'Leve' },
    { nivel: 3, emoji: '😐', label: 'Moderado' },
    { nivel: 4, emoji: '😓', label: 'Pesado' },
    { nivel: 5, emoji: '🥵', label: 'Muito pesado' }
  ];

  const modoCompacto = collapsedByDefault === true;

  useEffect(() => {
    if (modoCompacto) {
      setDetalhesAbertos(false);
    }
  }, [modoCompacto, treino?.id]);

  useEffect(() => {
    carregarSessaoAtiva();
  }, [treino.id]);

  useEffect(() => {
    const itensTreino = treino.itens || [];
    setExercicios((prev) => {
      if (!sessaoId) {
        return itensTreino.map((item) => ({ ...item, done: false }));
      }

      return itensTreino.map((item) => {
        const exercicioAnterior = prev.find((prevItem) => prevItem.id === item.id || prevItem.exercicio_nome === item.exercicio_nome);
        return { ...item, done: !!exercicioAnterior?.done };
      });
    });

  }, [treino.itens, sessaoId, nivelEsforco]);

  useEffect(() => {
    if (!sessaoId || !playlistSugestao) return;
    setPlaylistSugestao(sugerirPlaylistsTreino(treino?.itens || [], nivelEsforco));
  }, [nivelEsforco, sessaoId, treino?.itens]);

  async function abrirPlaylist(url, plataforma) {
    try {
      const link = String(url || '').trim();
      if (!link) return;

      const canOpen = await Linking.canOpenURL(link);
      if (!canOpen) {
        Alert.alert('Atenção', `Não foi possível abrir ${plataforma} neste dispositivo.`);
        return;
      }

      await Linking.openURL(link);
    } catch (err) {
      console.warn(`Erro ao abrir ${plataforma}:`, err?.message || err);
      Alert.alert('Erro', `Falha ao abrir ${plataforma}.`);
    }
  }

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
      setPlaylistSugestao(sugerirPlaylistsTreino(treino?.itens || [], nivelEsforco));
      
      if (professorId) {
        try {
          await enviarNotificacao(professorId, alunoId, 'treino_iniciado', {
            aluno_nome: alunoNome,
            treino_nome: treino.nome_treino,
            treino_id: treino.id,
            academia_id: treino.academia_id || null
          });
        } catch (notifyErr) {
          console.warn('Falha ao enviar notificação de treino iniciado:', notifyErr?.message || notifyErr);
        }
      }

      if (modoCompacto) {
        setDetalhesAbertos(true);
      }
      
      Alert.alert('Sucesso', 'Treino iniciado! Boa sorte! 💪\nSugestões de playlist disponíveis abaixo.');
    } catch (err) {
      console.error('Erro ao iniciar sessão:', err);
      Alert.alert('Erro', getAuthErrorMessage(err, 'Não foi possível iniciar o treino.'));
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

        if (professorId) {
          try {
            await enviarNotificacao(professorId, alunoId, 'exercicio_concluido', {
              aluno_nome: alunoNome,
              exercicio_nome: item.exercicio_nome,
              series: item.series,
              repeticoes: item.repeticoes,
              carga: item.carga,
              treino_nome: treino.nome_treino,
              academia_id: treino.academia_id || null
            });
          } catch (notifyErr) {
            console.warn('Falha ao enviar notificação de exercício concluído:', notifyErr?.message || notifyErr);
          }
        }
      } catch (err) {
        console.error('Erro ao marcar exercício:', err);
        // Reverter em caso de erro
        copy[index].done = !novoDone;
        setExercicios(copy);
        Alert.alert('Erro', 'Não foi possível salvar o progresso');
      }
    }
  }

  function iniciarEdicaoPeso(index) {
    const cargaAtual = exercicios[index]?.carga;
    setEditingIndex(index);
    setPesoEditando(cargaAtual === null || cargaAtual === undefined ? '' : String(cargaAtual));
  }

  function cancelarEdicaoPeso() {
    setEditingIndex(null);
    setPesoEditando('');
  }

  function salvarPeso(index) {
    const valor = String(pesoEditando || '').trim();
    const normalizado = valor.replace(',', '.');
    if (normalizado && Number.isNaN(Number(normalizado))) {
      Alert.alert('Erro', 'Digite um peso válido');
      return;
    }

    const proximoPeso = normalizado ? Number(normalizado) : null;
    setExercicios((prev) => prev.map((item, i) => (i === index ? { ...item, carga: proximoPeso } : item)));
    cancelarEdicaoPeso();
  }

  function abrirFinalizacao() {
    if (!sessaoId) {
      Alert.alert('Atenção', 'Nenhuma sessão ativa para finalizar');
      return;
    }
    setMostrarFinalizacao(true);
  }

  function cancelarFinalizacao() {
    setMostrarFinalizacao(false);
    setNivelEsforco(0);
    setFeedbackTreino('');
  }

  async function handleFinalizarSessao() {
    if (!sessaoId) {
      Alert.alert('Atenção', 'Nenhuma sessão ativa para finalizar');
      return;
    }

    if (nivelEsforco < 1 || nivelEsforco > 5) {
      Alert.alert('Atenção', 'Selecione o nível de esforço do treino');
      return;
    }

    const totalConcluidos = exercicios.filter((e) => e.done).length;
    const total = exercicios.length;

    if (totalConcluidos < total) {
      const confirmar = await Alert.confirm(
        'Confirmar finalização',
        `Você concluiu ${totalConcluidos} de ${total} exercícios.\n\nDeseja finalizar mesmo assim?`,
        { confirmText: 'Finalizar' }
      );
      if (!confirmar) return;
    }

    try {
      await finalizarSessao(sessaoId, {
        nivel_esforco: nivelEsforco,
        feedback: String(feedbackTreino || '').trim() || null
      });
      
      if (professorId) {
        try {
          await enviarNotificacao(professorId, alunoId, 'treino_finalizado', {
            aluno_nome: alunoNome,
            treino_nome: treino.nome_treino,
            treino_id: treino.id,
            total_exercicios: totalConcluidos,
            total_planejado: total,
            nivel_esforco: nivelEsforco,
            feedback: String(feedbackTreino || '').trim() || null,
            academia_id: treino.academia_id || null
          });
        } catch (notifyErr) {
          console.warn('Falha ao enviar notificação de treino finalizado:', notifyErr?.message || notifyErr);
        }
      }

      Alert.alert('Parabéns! 🎉', `Treino finalizado com sucesso!\n\n${totalConcluidos}/${total} exercícios concluídos`);
      
      // Resetar sessão para permitir novo treino
      setSessaoId(null);
      setPlaylistSugestao(null);
      setExercicios((treino.itens || []).map((e) => ({ ...e, done: false })));
      cancelarFinalizacao();
    } catch (err) {
      console.error('Erro ao finalizar sessão:', err);
      Alert.alert('Erro', 'Não foi possível finalizar o treino');
    }
  }

  const doneCount = exercicios.filter((e) => e.done).length;

  function handleAbrirDetalhes() {
    if (modoCompacto) {
      setDetalhesAbertos((prev) => {
        const proximoAberto = !prev;
        if (!proximoAberto) {
          setPlaylistSugestao(null);
        } else if (sessaoId && !playlistSugestao) {
          setPlaylistSugestao(sugerirPlaylistsTreino(treino?.itens || [], nivelEsforco));
        }
        return proximoAberto;
      });
      return;
    }
    if (onOpen) onOpen(treino);
  }

  if (carregando) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{treino.nome_treino}</Text>
          <TouchableOpacity style={styles.openBtn} onPress={handleAbrirDetalhes}>
            <Text style={styles.openBtnText}>{modoCompacto ? (detalhesAbertos ? 'Fechar' : 'Abrir') : 'Abrir'}</Text>
          </TouchableOpacity>
        </View>
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

      {sessaoId && detalhesAbertos && playlistSugestao && (
        <View style={styles.musicCard}>
          <View style={styles.musicHeader}>
            <Ionicons name="musical-notes" size={18} color={theme.colors.primary} />
            <Text style={styles.musicTitle}>Playlist sugerida ({playlistSugestao.categoriaPrincipal})</Text>
          </View>
          <Text style={styles.musicPace}>Ritmo: {String(playlistSugestao.intensidade || 'moderado')}</Text>
          <Text style={styles.musicHint}>{playlistSugestao.resumo}</Text>
          <View style={styles.musicActions}>
            <TouchableOpacity
              style={[styles.musicBtn, styles.spotifyBtn]}
              onPress={() => abrirPlaylist(playlistSugestao.spotifyUrl, 'Spotify')}
            >
              <Text style={styles.musicBtnText}>Spotify: {playlistSugestao.spotifyNome || 'Playlist'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.musicBtn, styles.deezerBtn]}
              onPress={() => abrirPlaylist(playlistSugestao.deezerUrl, 'Deezer')}
            >
              <Text style={styles.musicBtnText}>Deezer: {playlistSugestao.deezerNome || 'Playlist'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {detalhesAbertos && (
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
              <TouchableOpacity style={styles.itemInfo} onPress={() => iniciarEdicaoPeso(index)} activeOpacity={0.8}>
                <Text style={[styles.itemTitle, item.done && styles.itemTitleDone]}>{item.exercicio_nome || 'Exercício'}</Text>
                <Text style={styles.itemMeta}>{`${item.series || '-'} x ${item.repeticoes || '-'} • ${item.carga || '-'}kg`}</Text>
                <Text style={styles.itemHint}>Toque para editar apenas o peso</Text>

                {editingIndex === index && (
                  <View style={styles.editContainer}>
                    <TextInput
                      style={styles.editInput}
                      value={pesoEditando}
                      onChangeText={setPesoEditando}
                      keyboardType="numeric"
                      placeholder="Novo peso (kg)"
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity style={styles.editSaveBtn} onPress={() => salvarPeso(index)}>
                        <Text style={styles.editSaveText}>Salvar peso</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.editCancelBtn} onPress={cancelarEdicaoPeso}>
                        <Text style={styles.editCancelText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {sessaoId && detalhesAbertos && (
        <TouchableOpacity style={styles.finishBtn} onPress={abrirFinalizacao}>
          <Ionicons name="checkmark-done" size={16} color={theme.colors.card} />
          <Text style={styles.finishText}>  Finalizar Sessão</Text>
        </TouchableOpacity>
      )}

      {sessaoId && mostrarFinalizacao && detalhesAbertos && (
        <View style={styles.finalizacaoCard}>
          <Text style={styles.finalizacaoTitle}>Nível de esforço do treino</Text>
          <Text style={styles.finalizacaoHint}>Escolha a carinha que melhor representa seu esforço</Text>

          <View style={styles.esforcoBarra}>
            {opcoesEsforco.map((opcao) => (
              <TouchableOpacity
                key={opcao.nivel}
                style={[styles.esforcoSegmento, nivelEsforco === opcao.nivel && styles.esforcoSegmentoAtivo]}
                onPress={() => setNivelEsforco(opcao.nivel)}
              >
                <Text style={styles.esforcoEmoji}>{opcao.emoji}</Text>
                <Text style={[styles.esforcoTexto, nivelEsforco === opcao.nivel && styles.esforcoTextoAtivo]}>{opcao.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.feedbackInput}
            placeholder="Feedback do treino (opcional)"
            value={feedbackTreino}
            onChangeText={setFeedbackTreino}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.finalizacaoActions}>
            <TouchableOpacity style={styles.cancelFinalBtn} onPress={cancelarFinalizacao}>
              <Text style={styles.cancelFinalText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendFinalBtn} onPress={handleFinalizarSessao}>
              <Text style={styles.sendFinalText}>Enviar e Finalizar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radii.md, padding: theme.spacing(1.5), marginBottom: theme.spacing(1.5), elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { fontSize: theme.fontSizes.lg, fontWeight: '700', color: theme.colors.text },
  openBtn: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: theme.radii.sm,
    paddingVertical: 4,
    paddingHorizontal: 8
  },
  openBtnText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600'
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  progress: { fontSize: theme.fontSizes.sm, color: theme.colors.muted },
  startBtn: { marginBottom: 12, backgroundColor: theme.colors.primary, padding: 10, borderRadius: theme.radii.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  startText: { color: theme.colors.card, fontWeight: '600', fontSize: 15 },
  musicCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    padding: 10
  },
  musicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  musicTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700'
  },
  musicHint: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 3,
    marginBottom: 8
  },
  musicPace: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4
  },
  musicActions: {
    flexDirection: 'row',
    gap: 8
  },
  musicBtn: {
    flex: 1,
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    alignItems: 'center'
  },
  spotifyBtn: {
    backgroundColor: theme.colors.primary
  },
  deezerBtn: {
    backgroundColor: theme.colors.text
  },
  musicBtnText: {
    color: theme.colors.card,
    fontWeight: '700',
    fontSize: 12
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.background, marginTop: 8 },
  checkbox: { width: 34, height: 34, borderRadius: theme.radii.sm, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxDone: { backgroundColor: theme.colors.background },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: theme.fontSizes.md, color: theme.colors.text },
  itemTitleDone: { textDecorationLine: 'line-through', color: theme.colors.muted },
  itemMeta: { fontSize: theme.fontSizes.sm, color: theme.colors.muted },
  itemHint: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  editContainer: { marginTop: 8 },
  editInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  editActions: { flexDirection: 'row', marginTop: 8, gap: 8 },
  editSaveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  editSaveText: { color: theme.colors.card, fontWeight: '600', fontSize: 12 },
  editCancelBtn: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  editCancelText: { color: theme.colors.muted, fontWeight: '600', fontSize: 12 },
  finishBtn: { marginTop: 12, backgroundColor: theme.colors.primary, padding: 10, borderRadius: theme.radii.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  finishText: { color: theme.colors.card, fontWeight: '600' },
  finalizacaoCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.md,
    padding: 12,
    backgroundColor: theme.colors.background
  },
  finalizacaoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text
  },
  finalizacaoHint: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
    marginBottom: 8
  },
  esforcoBarra: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap'
  },
  esforcoSegmento: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: theme.radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: theme.colors.card
  },
  esforcoSegmentoAtivo: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  esforcoEmoji: {
    fontSize: 20,
    marginBottom: 4
  },
  esforcoTexto: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 11,
    textAlign: 'center'
  },
  esforcoTextoAtivo: {
    color: theme.colors.card
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.card,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 74
  },
  finalizacaoActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10
  },
  cancelFinalBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: theme.colors.card
  },
  cancelFinalText: {
    color: theme.colors.muted,
    fontWeight: '600',
    fontSize: 12
  },
  sendFinalBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primary
  },
  sendFinalText: {
    color: theme.colors.card,
    fontWeight: '700',
    fontSize: 12
  }
});
