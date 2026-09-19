import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const requireCondition = (condition, message) => { if (!condition) failures.push(message); };

requireCondition(exists('app/add-boulder.tsx'), 'Add Boulder screen is missing');
requireCondition(read('app/add-boulder.tsx').includes('addBoulderToSession'), 'Add Boulder must use the real storage API');
requireCondition(!exists('app/modal.tsx'), 'Starter modal route must remain removed');
requireCondition(exists('app/developer-diagnostics.tsx'), 'Developer Diagnostics screen is missing');
requireCondition(read('app/developer-diagnostics.tsx').includes('Run Full Lifecycle Test'), 'Developer Diagnostics must expose the lifecycle test button');
requireCondition(read('app/(tabs)/settings.tsx').includes("router.push('/developer-diagnostics')"), 'Settings must link to Developer Diagnostics');

requireCondition(read('data/persistence/storage-keys.ts').includes('CURRENT_STORAGE_SCHEMA_VERSION = 8'), 'Storage schema must be v8');
requireCondition(read('data/persistence/storage-keys.ts').includes('crux_storage_backup_before_v8'), 'Schema v8 migration backup is missing');
requireCondition(read('data/persistence/schema.ts').includes('crux_storage_recovery_snapshot') || read('data/persistence/storage-keys.ts').includes('crux_storage_recovery_snapshot'), 'Recovery snapshot support is missing');
requireCondition(read('data/repositories/crux-repository.ts').includes('MutationSerializationQueue'), 'Repository must use the serialized save queue');
requireCondition(read('utils/id.ts').includes('createId'), 'Central ID generator is missing');

const sourceFiles = [];
for (const rootName of ['app','components','core','data','domain','features','utils']) {
  const start = path.join(root, rootName);
  if (!fs.existsSync(start)) continue;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
    }
  }
}

const asyncStorageUsers = sourceFiles.filter((file) => fs.readFileSync(file,'utf8').includes('@react-native-async-storage/async-storage'));
requireCondition(asyncStorageUsers.length === 1 && asyncStorageUsers[0].endsWith(path.join('data','persistence','async-storage-engine.ts')), `AsyncStorage may only be imported by async-storage-engine.ts. Found: ${asyncStorageUsers.map((f)=>path.relative(root,f)).join(', ')}`);

for (const file of sourceFiles) {
  const text = fs.readFileSync(file,'utf8');
  const relative = path.relative(root,file).replaceAll('\\','/');
  if (/import\s*\{[^}]*\bSafeAreaView\b[^}]*\}\s*from\s*['"]react-native['"]/s.test(text)) failures.push(`${relative} imports deprecated SafeAreaView from react-native`);
  if (relative !== 'utils/id.ts' && /Math\.random\(\)/.test(text) && /(?:session|boulder|project|goal|photo|milestone)[-_]/i.test(text)) failures.push(`${relative} contains scattered random ID generation`);
}

const settings = read('app/(tabs)/settings.tsx');
requireCondition(!settings.includes("'Sport',") && !settings.includes("'Both',"), 'Settings must not expose unfinished Sport/Both mode toggles');
requireCondition(!settings.includes('autoHealthImport') && !settings.includes('Strava'), 'Settings must not expose hollow health/sync integrations');

const appButton = read('components/core/AppButton.tsx');
requireCondition(appButton.includes('ActivityIndicator'), 'AppButton loading must use ActivityIndicator');
requireCondition(!read('components/core/Skeleton.tsx').includes('Animated.loop'), 'Skeleton loading must remain static');

const appJson = JSON.parse(read('app.json'));
const packageJson = JSON.parse(read('package.json'));
requireCondition(appJson.expo?.userInterfaceStyle === 'light', 'CRUX must remain light-first');
requireCondition(appJson.expo?.version === '1.0.1', 'app.json version must be 1.0.1');
requireCondition(packageJson.version === '1.0.1', 'package.json version must be 1.0.1');
requireCondition(packageJson.dependencies?.['expo-file-system'] === '~19.0.24', 'Durable project media dependency is missing');

if (failures.length) {
  console.error('\nCRUX source verification FAILED:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('CRUX recovered v1.0.1 source verification passed.');
