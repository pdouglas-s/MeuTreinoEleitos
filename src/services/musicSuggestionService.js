function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

const CATEGORY_RULES = [
  {
    categoria: 'Pernas',
    termos: ['agachamento', 'leg press', 'extensora', 'flexora', 'panturrilha', 'stiff', 'avanço', 'lunge']
  },
  {
    categoria: 'Costas',
    termos: ['remada', 'puxada', 'barra fixa', 'pulldown', 'levantamento terra']
  },
  {
    categoria: 'Peito',
    termos: ['supino', 'crucifixo', 'cross over', 'flexão', 'voador', 'peck deck']
  },
  {
    categoria: 'Ombros',
    termos: ['desenvolvimento', 'elevação lateral', 'elevação frontal', 'elevação posterior', 'remada alta']
  },
  {
    categoria: 'Bíceps',
    termos: ['rosca', 'zottman', 'martelo', 'scott']
  },
  {
    categoria: 'Tríceps',
    termos: ['tríceps', 'triceps', 'coice', 'francês', 'testa', 'mergulho']
  },
  {
    categoria: 'Abdômen',
    termos: ['abdominal', 'prancha', 'infra', 'oblíquo', 'obliquo']
  },
  {
    categoria: 'Glúteos',
    termos: ['glúteo', 'gluteo', 'hip thrust', 'elevação pélvica', 'ponte glúteo']
  }
];

const PLAYLIST_STYLES = {
  foco: {
    leve: {
      spotify: { nome: 'Deep Focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' },
      deezer: { nome: 'Pop & Hits Editor', url: 'https://www.deezer.com/playlist/908622995' }
    },
    moderado: {
      spotify: { nome: 'Deep Focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' },
      deezer: { nome: 'Pop & Hits Editor', url: 'https://www.deezer.com/playlist/908622995' }
    },
    pesado: {
      spotify: { nome: 'Workout', url: 'https://open.spotify.com/playlist/37i9dQZF1DX70RN3TfWWJh' },
      deezer: { nome: 'Deezer Charts', url: 'https://www.deezer.com/playlist/3155776842' }
    }
  },
  cardio: {
    leve: {
      spotify: { nome: 'Deep Focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' },
      deezer: { nome: 'Pop & Hits Editor', url: 'https://www.deezer.com/playlist/908622995' }
    },
    moderado: {
      spotify: { nome: 'Workout', url: 'https://open.spotify.com/playlist/37i9dQZF1DX70RN3TfWWJh' },
      deezer: { nome: 'Deezer Charts', url: 'https://www.deezer.com/playlist/3155776842' }
    },
    pesado: {
      spotify: { nome: 'Workout', url: 'https://open.spotify.com/playlist/37i9dQZF1DX70RN3TfWWJh' },
      deezer: { nome: 'Deezer Charts', url: 'https://www.deezer.com/playlist/3155776842' }
    }
  },
  forca: {
    leve: {
      spotify: { nome: 'Workout', url: 'https://open.spotify.com/playlist/37i9dQZF1DX70RN3TfWWJh' },
      deezer: { nome: 'Deezer Charts', url: 'https://www.deezer.com/playlist/3155776842' }
    },
    moderado: {
      spotify: { nome: 'Beast Mode', url: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP' },
      deezer: { nome: 'Deezer Charts', url: 'https://www.deezer.com/playlist/3155776842' }
    },
    pesado: {
      spotify: { nome: 'Beast Mode', url: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP' },
      deezer: { nome: 'Deezer Charts', url: 'https://www.deezer.com/playlist/3155776842' }
    }
  }
};

const CATEGORY_STYLE_MAP = {
  'Pernas': 'forca',
  'Costas': 'forca',
  'Peito': 'forca',
  'Ombros': 'forca',
  'Bíceps': 'forca',
  'Tríceps': 'forca',
  'Glúteos': 'forca',
  'Abdômen': 'cardio',
  'Geral': 'foco'
};

function inferirCategoria(exercicioNome) {
  const nome = normalizeText(exercicioNome);
  if (!nome) return 'Geral';

  for (const regra of CATEGORY_RULES) {
    const encontrou = regra.termos.some((termo) => nome.includes(normalizeText(termo)));
    if (encontrou) return regra.categoria;
  }

  return 'Geral';
}

function intensidadeParaTexto(nivelEsforco) {
  const nivel = Number(nivelEsforco);
  if (!Number.isFinite(nivel) || nivel <= 0) return 'moderado';
  if (nivel <= 2) return 'leve';
  if (nivel >= 4) return 'pesado';
  return 'moderado';
}

function montarQueryPlaylist(categoriaPrincipal, totalExercicios, nivelEsforco = 0) {
  const intensidade = intensidadeParaTexto(nivelEsforco);

  if (intensidade === 'leve') {
    return `treino ${categoriaPrincipal} ritmo leve warm up`;
  }

  if (intensidade === 'pesado') {
    return `treino intenso ${categoriaPrincipal} hard workout motivation`;
  }

  if (categoriaPrincipal === 'Pernas' || categoriaPrincipal === 'Costas') {
    return `treino pesado ${categoriaPrincipal} power workout`;
  }

  if (categoriaPrincipal === 'Abdômen') {
    return 'treino funcional hiit cardio gym';
  }

  if (totalExercicios >= 8) {
    return `treino intenso ${categoriaPrincipal} gym motivation`;
  }

  return `treino ${categoriaPrincipal} academia motivação`;
}

function playlistCatalogo(intensidade, categoriaPrincipal) {
  const estilo = CATEGORY_STYLE_MAP[categoriaPrincipal] || 'foco';
  const estiloCatalogo = PLAYLIST_STYLES[estilo] || PLAYLIST_STYLES.foco;
  return estiloCatalogo[intensidade] || estiloCatalogo.moderado;
}

export function sugerirPlaylistsTreino(itens = [], nivelEsforco = 0) {
  const exercicios = Array.isArray(itens) ? itens : [];
  const intensidade = intensidadeParaTexto(nivelEsforco);

  if (!exercicios.length) {
    const catalogo = playlistCatalogo(intensidade, 'Geral');
    const queryPadrao = intensidade === 'leve'
      ? 'treino leve mobilidade warm up'
      : (intensidade === 'pesado' ? 'treino intenso academia motivacao' : 'treino academia motivacao');

    return {
      categoriaPrincipal: 'Geral',
      intensidade,
      categoriasDetectadas: ['Geral'],
      spotifyUrl: catalogo.spotify?.url || `https://open.spotify.com/search/${encodeURIComponent(queryPadrao)}/playlists`,
      deezerUrl: catalogo.deezer?.url || `https://www.deezer.com/search/${encodeURIComponent(queryPadrao)}`,
      spotifyNome: catalogo.spotify?.nome || 'Playlist Spotify',
      deezerNome: catalogo.deezer?.nome || 'Playlist Deezer',
      origem: 'catalogo',
      resumo: 'Playlist existente sugerida para aquecimento e foco no treino.'
    };
  }

  const contagemCategorias = {};
  exercicios.forEach((item) => {
    const categoria = inferirCategoria(item?.exercicio_nome);
    contagemCategorias[categoria] = (contagemCategorias[categoria] || 0) + 1;
  });

  const categoriasOrdenadas = Object.entries(contagemCategorias)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria]) => categoria);

  const categoriaPrincipal = categoriasOrdenadas[0] || 'Geral';
  const catalogo = playlistCatalogo(intensidade, categoriaPrincipal);
  const query = montarQueryPlaylist(categoriaPrincipal, exercicios.length, nivelEsforco);

  return {
    categoriaPrincipal,
    intensidade,
    categoriasDetectadas: categoriasOrdenadas,
    spotifyUrl: catalogo.spotify?.url || `https://open.spotify.com/search/${encodeURIComponent(query)}/playlists`,
    deezerUrl: catalogo.deezer?.url || `https://www.deezer.com/search/${encodeURIComponent(query)}`,
    spotifyNome: catalogo.spotify?.nome || 'Playlist Spotify',
    deezerNome: catalogo.deezer?.nome || 'Playlist Deezer',
    origem: catalogo.spotify?.url && catalogo.deezer?.url ? 'catalogo' : 'busca',
    resumo: `Baseado no foco em ${categoriaPrincipal.toLowerCase()} e ritmo ${intensidade} da sessão.`
  };
}
