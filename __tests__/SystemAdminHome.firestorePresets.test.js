const { resolveFirestoreSelectPreset } = require('../src/screens/SystemAdminHome');

describe('SystemAdminHome - Firestore select presets', () => {
  test('returns guard when preset requires academia_id and it is not provided', () => {
    const result = resolveFirestoreSelectPreset(
      {
        key: 'users-por-academia',
        collection: 'users',
        mode: 'list',
        requiresAcademiaId: true,
        filterField: 'academia_id',
        filterOp: '==',
        filterValue: '"__ACADEMIA_ID__"'
      },
      ''
    );

    expect(result).toEqual({ requiresAcademiaId: true, state: null });
  });

  test('resolves academia_id placeholder when academy id is provided', () => {
    const result = resolveFirestoreSelectPreset(
      {
        key: 'users-por-academia',
        collection: 'users',
        mode: 'list',
        limit: '50',
        filterField: 'academia_id',
        filterOp: '==',
        filterValue: '"__ACADEMIA_ID__"',
        sortField: 'nome',
        sortDirection: 'asc'
      },
      'acad_001'
    );

    expect(result.requiresAcademiaId).toBe(false);
    expect(result.state).toMatchObject({
      collectionPath: 'users',
      selectMode: 'list',
      selectLimit: '50',
      filterField: 'academia_id',
      filterOp: '==',
      filterValue: '"acad_001"',
      sortField: 'nome',
      sortDirection: 'asc'
    });
  });

  test('falls back to defaults for empty preset fields', () => {
    const result = resolveFirestoreSelectPreset({}, 'acad_x');

    expect(result.requiresAcademiaId).toBe(false);
    expect(result.state).toEqual({
      collectionPath: 'users',
      selectMode: 'list',
      documentId: '',
      selectLimit: '25',
      filterField: '',
      filterOp: '==',
      filterValue: '',
      sortField: '',
      sortDirection: 'asc'
    });
  });
});
