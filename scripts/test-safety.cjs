const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith('@/')) request = path.join(root, request.slice(2));
  return originalResolve.call(this, request, parent, isMain, options);
};

function compileTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      strict: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
}
require.extensions['.ts'] = compileTs;

function createMemoryStorage(seed = {}, delayMs = 0) {
  const store = new Map(Object.entries(seed));
  const delay = () => delayMs ? new Promise((resolve) => setTimeout(resolve, delayMs)) : Promise.resolve();
  return {
    async getItem(key) { await delay(); return store.has(key) ? store.get(key) : null; },
    async setItem(key, value) { await delay(); store.set(key, String(value)); },
    async removeItem(key) { await delay(); store.delete(key); },
    async multiGet(keys) { await delay(); return keys.map((key) => [key, store.has(key) ? store.get(key) : null]); },
    async multiSet(entries) { await delay(); for (const [key, value] of entries) store.set(key, String(value)); },
    _store: store,
  };
}

async function testGradeAndInvariantRules() {
  const grades = require(path.join(root, 'domain', 'grades.ts'));
  const invariants = require(path.join(root, 'domain', 'invariants.ts'));
  assert(grades.normalizeVGradeInput('vb-v0') === 'VB–V0', 'VB-V0 range should normalize.');
  assert(grades.normalizeVGradeInput('V17') === 'V17', 'V17 should be supported.');
  assert(grades.normalizeVGradeInput('V18') === null, 'V18 should be rejected.');
  invariants.validateBoulderInput({ grade: 'V4', result: 'Flash', attempts: 1 });
  let rejected = false;
  try { invariants.validateBoulderInput({ grade: 'V4', result: 'Flash', attempts: 2 }); } catch { rejected = true; }
  assert(rejected, 'Flash with two attempts must be rejected.');
  rejected = false;
  try { invariants.validateBoulderInput({ grade: 'V4', result: 'Send', attempts: 1 }); } catch { rejected = true; }
  assert(rejected, 'Send with one attempt must be rejected.');
}

async function testSchemaV8Migration() {
  const { CruxRepository } = require(path.join(root, 'data', 'repositories', 'crux-repository.ts'));
  const startedAt = '2026-08-31T18:00:00.000Z';
  const seed = {
    crux_storage_schema_version: '4',
    crux_sessions: JSON.stringify([{ id: 'session-1', gymName: 'Test Gym', startedAt, boulders: [
      { id: 'b1', sessionId: 'session-1', projectId: 'p1', grade: 'V4', result: 'Flash', attempts: 4, terrain: 'Vertical', holdType: ['Crimp'], movementType: ['Technical'], createdAt: '2026-08-31T18:05:00.000Z' },
      { id: 'b2', sessionId: 'session-1', grade: 'V5', result: 'Send', attempts: 1, terrain: 'Overhang', holdType: ['Jug'], movementType: ['Power'], createdAt: '2026-08-31T18:10:00.000Z' },
      { id: 'b3', sessionId: 'session-1', projectId: 'p1', grade: 'V6', result: 'Completed', attempts: 3, terrain: 'Overhang', holdType: ['Crimp'], movementType: ['Technical'], createdAt: '2026-08-31T18:15:00.000Z' },
      { id: 'b4', sessionId: 'session-1', projectId: 'missing', grade: 'V7', result: 'Project', attempts: 2, terrain: 'Roof', holdType: ['Jug'], movementType: ['Power'], createdAt: '2026-08-31T18:20:00.000Z' },
    ] }]),
    crux_projects: JSON.stringify([{ id: 'p1', name: 'Project One', grade: 'V6', status: 'active', createdAt: '2026-08-30T12:00:00.000Z', photos: ['file:///legacy-photo.jpg'] }]),
    crux_goals: JSON.stringify([{ id: 'g1', type: 'grade', title: 'Hard grade', target: 50, createdAt: '2026-08-30T12:00:00.000Z' }]),
  };
  const engine = createMemoryStorage(seed);
  const repo = new CruxRepository(engine);
  const snapshot = await repo.getSnapshot();
  assert(engine._store.get('crux_storage_schema_version') === '8', 'Storage must migrate to schema v8.');
  for (const version of [5, 6, 7, 8]) assert(engine._store.has(`crux_storage_backup_before_v${version}`), `Migration backup v${version} should exist.`);
  const [flash, send, , missing] = snapshot.sessions[0].boulders;
  assert(flash.attempts === 1 && flash.projectId === undefined, 'Legacy Flash should normalize and lose invalid project link.');
  assert(send.attempts === 2, 'Legacy Send should normalize to at least two attempts.');
  assert(missing.projectId === undefined, 'Missing project link should be removed.');
  assert(snapshot.goals[0].target === 17, 'Legacy grade target should cap at V17.');
  assert(snapshot.projects[0].status === 'completed' && snapshot.projects[0].completionSource === 'boulder', 'Completed Boulder should complete linked project.');
  assert(snapshot.projects[0].photos[0].uri === 'file:///legacy-photo.jpg', 'Legacy photo URI should migrate.');
  assert(typeof snapshot.projects[0].photos[0].id === 'string', 'Migrated photo should receive an ID.');
}

async function testMalformedDataPreserved() {
  const { CruxRepository } = require(path.join(root, 'data', 'repositories', 'crux-repository.ts'));
  const engine = createMemoryStorage({ crux_storage_schema_version: '8', crux_sessions: '{bad', crux_projects: '[]', crux_goals: '[]' });
  const repo = new CruxRepository(engine);
  let failed = false;
  try { await repo.createSession('Do not overwrite'); } catch { failed = true; }
  assert(failed, 'Malformed storage must reject writes.');
  assert(engine._store.get('crux_sessions') === '{bad', 'Malformed original data must remain untouched.');
  assert(engine._store.has('crux_storage_recovery_snapshot'), 'Malformed data should produce recovery snapshot.');
}

async function testLifecycleAndConcurrency() {
  const { CruxRepository } = require(path.join(root, 'data', 'repositories', 'crux-repository.ts'));
  const engine = createMemoryStorage({}, 1);
  const repo = new CruxRepository(engine);
  const session = await repo.createSession('Diagnostics Gym');
  const boulder = await repo.addBoulderToSession(session.id, { grade: 'V2', result: 'Send', attempts: 2, terrain: 'Vertical', holdType: ['Jug'], movementType: ['Technical'] });
  assert((await repo.getSessionById(session.id)).boulders.some((item) => item.id === boulder.id), 'Boulder should persist.');
  await repo.updateBoulder(session.id, boulder.id, { grade: 'V3', result: 'Send', attempts: 2, terrain: 'Vertical', holdType: ['Jug'], movementType: ['Technical'] });
  assert((await repo.getSessionById(session.id)).boulders.find((item) => item.id === boulder.id).grade === 'V3', 'Boulder edit should persist.');
  await repo.deleteBoulder(session.id, boulder.id);
  assert(!(await repo.getSessionById(session.id)).boulders.some((item) => item.id === boulder.id), 'Boulder delete should persist.');
  await repo.finishSession(session.id);

  await Promise.all(Array.from({ length: 20 }, (_, index) => repo.createGoal('sessions', `Goal ${index}`, index + 1)));
  assert((await repo.getGoals()).length === 20, 'Save queue should preserve all concurrent goal creations.');
}

async function testSourceBoundaries() {
  const sourceFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.expo', '.git', 'ios', 'android', 'build'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
    }
  };
  walk(root);
  const asyncImports = sourceFiles.filter((file) => fs.readFileSync(file, 'utf8').includes("@react-native-async-storage/async-storage"));
  assert(asyncImports.length === 1 && asyncImports[0].endsWith(path.join('data', 'persistence', 'async-storage-engine.ts')), `AsyncStorage boundary broken: ${asyncImports.join(', ')}`);

  const forbiddenIds = sourceFiles.filter((file) => {
    if (file.endsWith(path.join('utils', 'id.ts'))) return false;
    const text = fs.readFileSync(file, 'utf8');
    return /Math\.random\(\)/.test(text) && /(?:session|boulder|project|goal|photo|milestone)[-_]/i.test(text);
  });
  assert(forbiddenIds.length === 0, `Scattered ID generation found in: ${forbiddenIds.join(', ')}`);
  assert(fs.existsSync(path.join(root, 'app', 'developer-diagnostics.tsx')), 'Developer diagnostics screen is missing.');
}

async function testDuplicatePhotoMigration() {
  const { CruxRepository } = require('../data/repositories/crux-repository.ts');
  const createdAt = '2026-08-01T12:00:00.000Z';
  const photo = (id) => ({ id, uri: `file:///${id}.jpg`, createdAt, sanitized: false });
  const engine = createMemoryStorage({
    crux_storage_schema_version: '7', crux_sessions: '[]', crux_goals: '[]',
    crux_projects: JSON.stringify([{ id: 'p1', name: 'Photos', grade: 'V3', status: 'active', createdAt, photos: [photo('a'), photo('a'), photo('b')] }]),
  });
  const snapshot = await new CruxRepository(engine).getSnapshot();
  assert(snapshot.projects[0].photos.map(p => p.id).join(',') === 'a,b', 'A legacy duplicate must not truncate subsequent photos.');
}

async function testVersionGuards() {
  const { CruxRepository } = require('../data/repositories/crux-repository.ts');
  for (const version of ['8garbage', '-1', 'NaN', '9', '9007199254740993']) {
    const engine = createMemoryStorage({ crux_storage_schema_version: version, crux_sessions: '[]' });
    let failed = false;
    try { await new CruxRepository(engine).createSession('Invalid'); } catch { failed = true; }
    assert(failed && engine._store.get('crux_storage_schema_version') === version, `Version ${version} must reject mutation.`);
  }
}

async function testPartialWriteRecovery() {
  const { CruxRepository } = require('../data/repositories/crux-repository.ts');
  const engine = createMemoryStorage();
  let repo = new CruxRepository(engine);
  const project = await repo.createProject('Recovery', 'V4');
  const session = await repo.createSession('Recovery gym');
  const before = JSON.stringify(await repo.getSnapshot());
  const normalMultiSet = engine.multiSet.bind(engine);
  engine.multiSet = async (entries) => {
    engine._store.set(entries[0][0], entries[0][1]);
    throw new Error('Injected interrupted multi-key write');
  };
  let rejected = false;
  try { await repo.addBoulderToSession(session.id, { grade: 'V4', result: 'Completed', attempts: 2, projectId: project.id }); } catch { rejected = true; }
  assert(rejected, 'Interrupted write must report failure.');
  engine.multiSet = normalMultiSet;
  repo = new CruxRepository(engine);
  assert(JSON.stringify(await repo.getSnapshot()) === before, 'Partial write must restore both project and session after restart.');

  // Simulate process death after the first native storage key was replaced.
  const previous = await engine.multiGet(['crux_sessions', 'crux_projects']);
  engine._store.set('crux_storage_pending_transaction', JSON.stringify(previous));
  engine._store.set('crux_sessions', '[]');
  repo = new CruxRepository(engine);
  assert(JSON.stringify(await repo.getSnapshot()) === before, 'Restart must replay the undo journal before reading.');
  assert(!engine._store.has('crux_storage_pending_transaction'), 'Completed recovery must clear the journal.');
  engine._store.set('crux_storage_pending_transaction', 'not-json');
  rejected = false;
  try { await repo.getSnapshot(); } catch { rejected = true; }
  assert(rejected, 'Corrupt journal must block reads and preserve evidence.');
  assert(engine._store.get('crux_storage_pending_transaction') === 'not-json', 'Corrupt journal must remain intact.');
}

async function testRestartRapidAndReconciliation() {
  const { CruxRepository } = require('../data/repositories/crux-repository.ts');
  const engine = createMemoryStorage();
  let repo = new CruxRepository(engine);
  const sessions = await Promise.all(Array.from({ length: 30 }, () => repo.createSession('Gym')));
  assert(new Set(sessions.map(s => s.id)).size === 1, 'Rapid starts must produce one active session.');
  const session = sessions[0];
  await Promise.all(Array.from({ length: 100 }, () => repo.addBoulderToSession(session.id, { grade: 'V2', result: 'Send', attempts: 2 })));
  repo = new CruxRepository(engine);
  assert((await repo.getSessionById(session.id)).boulders.length === 100, 'All rapid additions must survive repository restart.');
  const project = await repo.createProject('Linked', 'V4');
  const boulder = await repo.addBoulderToSession(session.id, { grade: 'V4', result: 'Completed', attempts: 4, projectId: project.id });
  assert((await repo.getProjects())[0].status === 'completed', 'Completion must reconcile project.');
  await repo.updateBoulder(session.id, boulder.id, { grade: 'V4', result: 'Project', attempts: 4, projectId: project.id });
  assert((await repo.getProjects())[0].status === 'active', 'Editing completion must reopen the project.');
  await repo.finishSession(session.id);
  const end = (await repo.getSessionById(session.id)).finishedAt;
  await repo.finishSession(session.id);
  assert((await repo.getSessionById(session.id)).finishedAt === end, 'Finishing must be idempotent.');
  await repo.updateSession(session.id, { gymName: 'Reopened', startedAt: session.startedAt });
  assert(!(await repo.getSessionById(session.id)).finishedAt, 'Session can be reopened.');
  await repo.deleteProject(project.id);
  assert((await repo.getSessionById(session.id)).boulders.every(b => !b.projectId), 'Project deletion must remove references.');
  await repo.deleteSession(session.id);
  assert((await new CruxRepository(engine).getSessions()).length === 0, 'Session deletion must survive restart.');
}

async function testLargeHistory() {
  const { CruxRepository } = require('../data/repositories/crux-repository.ts');
  const startedAt = '2026-08-01T12:00:00.000Z', finishedAt = '2026-08-01T13:00:00.000Z';
  const sessions = Array.from({ length: 300 }, (_, i) => ({ id: `session-${i}`, gymName: 'History', startedAt, finishedAt,
    boulders: Array.from({ length: 20 }, (_, j) => ({ id: `boulder-${i}-${j}`, sessionId: `session-${i}`, grade: 'V3', result: 'Send', attempts: 2, createdAt: startedAt })) }));
  const engine = createMemoryStorage({ crux_storage_schema_version: '8', crux_sessions: JSON.stringify(sessions), crux_projects: '[]', crux_goals: '[]' });
  const repo = new CruxRepository(engine);
  assert((await repo.getAllBoulders()).length === 6000, 'Large history must load all 6,000 climbs.');
  await repo.updateBoulder('session-299', 'boulder-299-19', { grade: 'V5', result: 'Send', attempts: 3 });
  assert((await new CruxRepository(engine).getSessionById('session-299')).boulders[19].grade === 'V5', 'Large history edit must persist.');
}

async function testDiagnosticTruthAndIsolation() {
  const { CruxRepository } = require('../data/repositories/crux-repository.ts');
  const storagePath = require.resolve('../data/storage.ts');
  const diagnosticPath = require.resolve('../data/diagnostics/storage-lifecycle-test.ts');
  async function run(mode) {
    const repo = new CruxRepository(createMemoryStorage());
    const api = {};
    for (const name of ['addBoulderToSession', 'createSession', 'deleteBoulder', 'deleteSession', 'getMutationQueueSnapshot', 'getSessionById', 'updateBoulder']) api[name] = repo[name].bind(repo);
    api.getCruxSnapshot = repo.getSnapshot.bind(repo);
    if (mode === 'cleanup') api.deleteSession = async () => { throw new Error('Injected cleanup failure'); };
    if (mode === 'race') api.createSession = async (gym, options) => { await repo.createSession('Real session'); return repo.createSession(gym, options); };
    if (mode === 'active') await repo.createSession('Existing real session');
    const old = require.cache[storagePath];
    require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: api };
    delete require.cache[diagnosticPath];
    try {
      const result = await require(diagnosticPath).runFullLifecycleTest();
      if (mode === 'success') assert(result.passed && (await repo.getSessions()).length === 0, 'Successful diagnostics must remove fixture.');
      if (mode === 'cleanup') assert(!result.passed && result.failure.stepLabel.includes('Cleanup'), 'Cleanup failure must never report PASS.');
      if (mode === 'race' || mode === 'active') {
        const sessions = await repo.getSessions();
        assert(!result.passed && sessions.length === 1 && sessions[0].boulders.length === 0, 'Diagnostics must never reuse/delete a real session.');
      }
    } finally { if (old) require.cache[storagePath] = old; else delete require.cache[storagePath]; delete require.cache[diagnosticPath]; }
  }
  for (const mode of ['success', 'cleanup', 'race', 'active']) await run(mode);
}

async function testPhotoPersistence() {
  const mediaPath = require.resolve('../features/media/media-processor.ts');
  const oldLoad = Module._load;
  const files = new Map([['file:///cache/pick.jpg', 'image-bytes']]);
  const fileSystem = {
    documentDirectory: 'file:///new-container/Documents/',
    async makeDirectoryAsync() {},
    async copyAsync({ from, to }) { if (!files.has(from)) throw new Error('Missing source'); files.set(to, files.get(from)); },
    async getInfoAsync(uri) { return files.has(uri) ? { exists: true, size: 11 } : { exists: false }; },
    async deleteAsync(uri) { files.delete(uri); },
  };
  Module._load = function(request, ...args) { return request === 'expo-file-system/legacy' ? fileSystem : oldLoad.call(this, request, ...args); };
  delete require.cache[mediaPath];
  try {
    const media = require(mediaPath);
    const photo = await media.persistProjectPhoto({ uri: 'file:///cache/pick.jpg', width: 100, height: 100, mimeType: 'image/jpeg' });
    files.delete('file:///cache/pick.jpg');
    assert(files.has(photo.uri), 'Durable image must survive source cache removal.');
    const relocated = photo.uri.replace('new-container', 'old-container');
    assert(media.resolveProjectPhotoUri(relocated) === photo.uri, 'Photo must resolve after container relocation.');
    await media.removePersistedProjectPhoto({ ...photo, uri: relocated });
    assert(!files.has(photo.uri), 'Photo removal must use current container path.');
    files.set('file:///new-container/Documents/private.json', 'keep');
    await media.removePersistedProjectPhoto({ ...photo, uri: 'file:///new-container/Documents/crux/project-media/../../private.json' });
    assert(files.has('file:///new-container/Documents/private.json'), 'Photo cleanup must not delete outside its directory.');
  } finally { Module._load = oldLoad; delete require.cache[mediaPath]; }
}

(async () => {
  await testGradeAndInvariantRules();
  await testSchemaV8Migration();
  await testMalformedDataPreserved();
  await testLifecycleAndConcurrency();
  await testSourceBoundaries();
  for (const test of [testDuplicatePhotoMigration, testVersionGuards, testPartialWriteRecovery, testRestartRapidAndReconciliation, testLargeHistory, testDiagnosticTruthAndIsolation, testPhotoPersistence]) {
    await test();
    console.log(`PASS ${test.name}`);
  }
  console.log('PASS all 12 CRUX safety suites (native APIs mocked where required).');
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
