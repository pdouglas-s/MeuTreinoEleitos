import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, RefreshControl, Share, ImageBackground } from 'react-native';
import theme from '../../theme';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Alert } from '../../utils/alert';
import { gerarRelatorioEsforcoPorCategoria } from '../../services/notificacoesService';
import CardMedia from '../../components/CardMedia';

const PERIODOS = [7, 30, 90];
const relatorioHeroImage = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1500&q=80';
const relatorioBackgroundImage = 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1700&q=80';

const NIVEL_LABEL = {
  1: 'Muito leve',
  2: 'Leve',
  3: 'Moderado',
  4: 'Pesado',
  5: 'Muito pesado'
};

function formatMedia(value) {
  if (!Number.isFinite(Number(value))) return '—';
  return `${String(value).replace('.', ',')}/5`;
}

function renderDistribuicao(distribuicao = {}) {
  return [1, 2, 3, 4, 5]
    .map((nivel) => `${nivel}: ${distribuicao[nivel] || 0}`)
    .join('  •  ');
}

function gerarResumoCompartilhamento(relatorio, periodoDias) {
  const linhas = [];
  linhas.push(`📊 Relatório de esforço (${periodoDias} dias)`);
  linhas.push(`Treinos finalizados: ${relatorio?.totalNotificacoesConsideradas || 0}`);
  linhas.push(`Média geral: ${formatMedia(relatorio?.mediaGeral)}`);
  linhas.push(`Tempo médio de treino: ${relatorio?.tempoMedioFormatado || '—'}`);
  linhas.push(`Tempo total no período: ${relatorio?.tempoTotalFormatado || '00:00:00'}`);
  linhas.push('');
  linhas.push('Categorias musculares:');

  const categorias = Array.isArray(relatorio?.categorias) ? relatorio.categorias : [];
  if (!categorias.length) {
    linhas.push('- Sem dados no período');
  } else {
    categorias.slice(0, 8).forEach((item) => {
      linhas.push(`- ${item.categoria}: ${item.total_treinos} treinos | média ${formatMedia(item.media_esforco)} | tempo médio ${item.tempo_medio_formatado || '—'}`);
    });
  }

  return linhas.join('\n');
}

export default function RelatorioEsforcoScreen() {
  const { profile } = useAuth();
  const userId = auth.currentUser?.uid || profile?.id || profile?.uid || null;
  const isAcademyAdmin = profile?.role === 'admin_academia';
  const isProfessor = profile?.role === 'professor';

  const [periodoDias, setPeriodoDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [relatorio, setRelatorio] = useState({
    periodoDias: 30,
    totalNotificacoesConsideradas: 0,
    mediaGeral: null,
    tempoTotalSegundos: 0,
    tempoTotalFormatado: '00:00:00',
    tempoMedioSegundos: 0,
    tempoMedioFormatado: '—',
    totalTreinosComTempo: 0,
    distribuicaoGeral: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    categorias: []
  });

  const podeAcessar = isAcademyAdmin || isProfessor;

  const carregarRelatorio = useCallback(async (dias, options = {}) => {
    const { silent = false } = options;
    if (!podeAcessar) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!silent) setLoading(true);

    try {
      const dados = await gerarRelatorioEsforcoPorCategoria({
        professorId: isAcademyAdmin ? null : userId,
        academiaId: isAcademyAdmin ? profile?.academia_id : null,
        dias
      });
      setRelatorio(dados);
    } catch (err) {
      console.error('Erro ao carregar relatório de esforço:', err);
      Alert.alert('Erro', 'Não foi possível carregar o relatório estatístico.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [podeAcessar, isAcademyAdmin, userId, profile?.academia_id]);

  React.useEffect(() => {
    carregarRelatorio(periodoDias);
  }, [carregarRelatorio, periodoDias]);

  const subtitle = useMemo(() => {
    if (isAcademyAdmin) return 'Base de dados da academia';
    return 'Base de dados dos seus alunos';
  }, [isAcademyAdmin]);

  function handleRefresh() {
    setRefreshing(true);
    carregarRelatorio(periodoDias, { silent: true });
  }

  async function handleCompartilharResumo() {
    try {
      const mensagem = gerarResumoCompartilhamento(relatorio, periodoDias);
      await Share.share({
        message: mensagem,
        title: 'Relatório de esforço por categoria'
      });
    } catch (err) {
      console.error('Erro ao compartilhar resumo:', err);
      Alert.alert('Erro', 'Não foi possível compartilhar o resumo agora.');
    }
  }

  if (!podeAcessar) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Relatório de Esforço</Text>
          <Text style={styles.muted}>Este relatório está disponível para professor e admin da academia.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: relatorioBackgroundImage }}
        style={styles.screenBackground}
        imageStyle={styles.screenBackgroundImage}
      >
        <View style={styles.screenBackgroundTint} />
      </ImageBackground>

      <FlatList
        data={relatorio.categorias}
        keyExtractor={(item) => item.categoria}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={(
          <View>
            <ImageBackground source={{ uri: relatorioHeroImage }} style={styles.heroCard} imageStyle={styles.heroCardImage}>
              <View style={styles.heroCardTint} />
              <View style={styles.heroCardContent}>
                <Text style={styles.heroTag}>ANÁLISE GERENCIAL</Text>
                <Text style={styles.heroTitle}>Relatório de esforço e tempo</Text>
                <Text style={styles.heroHint}>Visão consolidada para decisões da equipe</Text>
              </View>
            </ImageBackground>

            <View style={styles.card}>
              <CardMedia variant="relatorio" label="VISÃO CONSOLIDADA" />
              <Text style={styles.title}>Relatório por categoria</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>

              <View style={styles.periodoRow}>
                {PERIODOS.map((dias) => (
                  <TouchableOpacity
                    key={dias}
                    style={[styles.periodoBtn, periodoDias === dias && styles.periodoBtnActive]}
                    onPress={() => setPeriodoDias(dias)}
                  >
                    <Text style={[styles.periodoText, periodoDias === dias && styles.periodoTextActive]}>{dias} dias</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <CardMedia variant="treino" label="TREINOS" compact />
                <Text style={styles.statValue}>{relatorio.totalNotificacoesConsideradas}</Text>
                <Text style={styles.statLabel}>Treinos finalizados</Text>
              </View>
              <View style={styles.statCard}>
                <CardMedia variant="progresso" label="ESFORÇO" compact />
                <Text style={styles.statValue}>{formatMedia(relatorio.mediaGeral)}</Text>
                <Text style={styles.statLabel}>Média geral</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <CardMedia variant="treino" label="TEMPO MÉDIO" compact />
                <Text style={styles.statValue}>{relatorio.tempoMedioFormatado || '—'}</Text>
                <Text style={styles.statLabel}>Tempo médio de treino</Text>
              </View>
              <View style={styles.statCard}>
                <CardMedia variant="academia" label="TEMPO TOTAL" compact />
                <Text style={styles.statValue}>{relatorio.tempoTotalFormatado || '00:00:00'}</Text>
                <Text style={styles.statLabel}>Tempo total no período</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={handleCompartilharResumo} activeOpacity={0.85}>
              <Text style={styles.shareBtnText}>Compartilhar resumo</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <CardMedia variant="progresso" label="DISTRIBUIÇÃO" compact />
              <Text style={styles.sectionTitle}>Distribuição de esforço</Text>
              <Text style={styles.distribuicaoTexto}>{renderDistribuicao(relatorio.distribuicaoGeral)}</Text>
              <Text style={styles.muted}>1={NIVEL_LABEL[1]} • 3={NIVEL_LABEL[3]} • 5={NIVEL_LABEL[5]}</Text>
            </View>

            <Text style={styles.sectionTitle}>Categorias</Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.card}>
            <Text style={styles.muted}>Sem dados de treino finalizado no período selecionado.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <CardMedia variant="exercicio" label={String(item.categoria || 'CATEGORIA').toUpperCase()} compact />
            <Text style={styles.categoriaTitulo}>{item.categoria}</Text>
            <Text style={styles.categoriaResumo}>Treinos: {item.total_treinos}  •  Esforço: {formatMedia(item.media_esforco)}  •  Tempo: {item.tempo_medio_formatado || '—'}</Text>
            <Text style={styles.categoriaLinha}>Níveis: {renderDistribuicao(item.distribuicao)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 12
  },
  screenBackground: {
    ...StyleSheet.absoluteFillObject
  },
  screenBackgroundImage: {
    opacity: 0.12
  },
  screenBackgroundTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    opacity: 0.08
  },
  heroCard: {
    minHeight: 132,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    marginBottom: 10,
    justifyContent: 'flex-end'
  },
  heroCardImage: {
    borderRadius: theme.radii.lg
  },
  heroCardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.text,
    opacity: 0.56
  },
  heroCardContent: {
    padding: 12,
    backgroundColor: 'rgba(17, 24, 39, 0.32)'
  },
  heroTag: {
    color: theme.colors.card,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8
  },
  heroTitle: {
    color: theme.colors.card,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4
  },
  heroHint: {
    color: theme.colors.card,
    fontSize: 12,
    marginTop: 4
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 10
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4
  },
  muted: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 6
  },
  periodoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  periodoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: theme.colors.background
  },
  periodoBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.background
  },
  periodoText: {
    color: theme.colors.muted,
    fontWeight: '600',
    fontSize: 12
  },
  periodoTextActive: {
    color: theme.colors.primary
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
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
  shareBtn: {
    marginBottom: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    alignItems: 'center'
  },
  shareBtnText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '700'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6
  },
  distribuicaoTexto: {
    color: theme.colors.text,
    fontSize: 13
  },
  categoriaTitulo: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4
  },
  categoriaResumo: {
    color: theme.colors.text,
    fontSize: 13,
    marginTop: 2
  },
  categoriaLinha: {
    color: theme.colors.text,
    fontSize: 13,
    marginTop: 2
  }
});
