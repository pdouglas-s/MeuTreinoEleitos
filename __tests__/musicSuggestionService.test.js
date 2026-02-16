const { sugerirPlaylistsTreino } = require('../src/services/musicSuggestionService');

describe('musicSuggestionService', () => {
  test('sugere playlists diferentes para Abdômen e Costas no mesmo nível de esforço', () => {
    const treinoAbdomen = [
      { exercicio_nome: 'Abdominal Supra' },
      { exercicio_nome: 'Prancha Frontal' }
    ];

    const treinoCostas = [
      { exercicio_nome: 'Remada Curvada com Barra' },
      { exercicio_nome: 'Puxada Frontal Aberta' }
    ];

    const nivelEsforco = 4;

    const sugestaoAbdomen = sugerirPlaylistsTreino(treinoAbdomen, nivelEsforco);
    const sugestaoCostas = sugerirPlaylistsTreino(treinoCostas, nivelEsforco);

    expect(sugestaoAbdomen.categoriaPrincipal).toBe('Abdômen');
    expect(sugestaoCostas.categoriaPrincipal).toBe('Costas');

    expect(sugestaoAbdomen.spotifyUrl).not.toBe(sugestaoCostas.spotifyUrl);
    expect(sugestaoAbdomen.spotifyNome).not.toBe(sugestaoCostas.spotifyNome);
  });

  test('mantém playlist existente para categoria de força', () => {
    const treinoPernas = [
      { exercicio_nome: 'Agachamento Livre' },
      { exercicio_nome: 'Leg Press 45°' }
    ];

    const sugestao = sugerirPlaylistsTreino(treinoPernas, 4);

    expect(sugestao.origem).toBe('catalogo');
    expect(sugestao.spotifyUrl).toContain('open.spotify.com/playlist/');
    expect(sugestao.deezerUrl).toContain('deezer.com/playlist/');
  });
});
