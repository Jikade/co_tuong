import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { PROJECT_ROOT } from '../src/server/config.js';

const require = createRequire(import.meta.url);
const rootPath = (name) => path.resolve(PROJECT_ROOT, name);
const relative = (name) => path.relative(PROJECT_ROOT, name).split(path.sep).join('/');
const isWithin = (file, directory) => file.startsWith(rootPath(directory) + path.sep);
const { dependencies = {}, devDependencies = {} } = JSON.parse(await readFile(rootPath('package.json'), 'utf8'));
const packages = new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)]);
const serverOnly = process.argv.includes('--server');

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(filename));
    else files.push(filename);
  }
  return files;
}

const sourceFiles = await filesIn(rootPath('src'));
const roots = (await readdir(PROJECT_ROOT)).filter((name) => name.endsWith('.js')).map(rootPath);
const checkedFiles = serverOnly
  ? [...sourceFiles.filter((f) => isWithin(f, 'src/server') || isWithin(f, 'src/shared')), rootPath('server.js')]
  : [...sourceFiles, ...roots, ...await filesIn(rootPath('scripts')), ...await filesIn(rootPath('test')), ...await filesIn(rootPath('e2e'))];
const failures = [];

// The application branch must not reintroduce framework source/config. Exclude
// dependency packages, private user data, build output and local QA/archive files.
const excludedTrees = new Set(['.git', 'node_modules', '.npm-cache', 'artifacts', 'data', 'dist', 'test-results', 'playwright-report', 'coverage', 'certs', '.vs', '.vscode', '.idea']);
const ownedFiles = [];
for (const entry of await readdir(PROJECT_ROOT, { withFileTypes: true })) {
  if (excludedTrees.has(entry.name)) continue;
  if (entry.isDirectory()) ownedFiles.push(...await filesIn(rootPath(entry.name)));
  else ownedFiles.push(rootPath(entry.name));
}
for (const filename of ownedFiles) {
  if (/\.(?:cs|csproj|sln|slnx|razor|resx|props|targets)$/i.test(filename)
      || /(?:^|[\\/])(?:appsettings[^\\/]*\.json|launchSettings\.json|nuget\.config|global\.json)$/i.test(filename)) {
    failures.push(`Framework source/config in application tree: ${relative(filename)}`);
  }
}

for (const filename of [...sourceFiles, ...roots]) {
  if (/\.(?:cs|csproj|razor|slnx|props)$/i.test(filename)) failures.push(`.NET file in runtime: ${relative(filename)}`);
}

for (const filename of checkedFiles.filter((f) => f.endsWith('.js'))) {
  const text = await readFile(filename, 'utf8');
  try { execFileSync(process.execPath, ['--check', filename], { windowsHide: true, stdio: 'pipe' }); }
  catch (error) { failures.push(`Syntax: ${relative(filename)}\n${error.stderr}`); }
  const runtime = isWithin(filename, 'src') || filename === rootPath('server.js');
  if (runtime && /\b(?:dotnet|msbuild|csc)(?:\.exe)?\b/i.test(text)) failures.push(`.NET command in runtime: ${relative(filename)}`);
  for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), specifier);
      try { await access(target); } catch { failures.push(`Missing import: ${relative(filename)} -> ${specifier}`); }
      if (runtime && isWithin(target, 'reference')) failures.push(`Runtime imports legacy: ${relative(filename)}`);
      if (isWithin(filename, 'src/client') && !isWithin(target, 'src/client') && !isWithin(target, 'src/shared')) failures.push(`Client crosses server boundary: ${relative(filename)} -> ${specifier}`);
      if (isWithin(filename, 'src/shared') && !isWithin(target, 'src/shared')) failures.push(`Shared crosses runtime boundary: ${relative(filename)} -> ${specifier}`);
      if (isWithin(filename, 'src/server') && isWithin(target, 'src/client')) failures.push(`Server imports browser UI: ${relative(filename)}`);
    } else if (specifier.startsWith('node:')) {
      if (isWithin(filename, 'src/client') || isWithin(filename, 'src/shared')) failures.push(`Browser/shared imports Node API: ${relative(filename)} -> ${specifier}`);
    } else {
      const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      if (!packages.has(packageName)) failures.push(`Undeclared dependency: ${relative(filename)} -> ${specifier}`);
      try { require.resolve(specifier); } catch { failures.push(`Unresolved dependency: ${relative(filename)} -> ${specifier}`); }
      if ((isWithin(filename, 'src/client') || isWithin(filename, 'src/shared')) && ['ws', 'mssql'].includes(packageName)) failures.push(`Server dependency in browser: ${relative(filename)} -> ${specifier}`);
    }
  }
}

if (!serverOnly) {
  const html = await readFile(rootPath('index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="(\/src\/[^"?#]+)"/g)) {
    const target = rootPath(match[1].slice(1));
    try { await access(target); } catch { failures.push(`Missing HTML entry: ${match[1]}`); }
    if (!isWithin(target, 'src/client')) failures.push(`HTML loads non-client entry: ${match[1]}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  // Linking validates named exports without starting the guarded CLI or a database.
  const entry = await import(pathToFileURL(rootPath('server.js')));
  if (typeof entry.createGameServer !== 'function') throw new Error('Missing createGameServer export');
  console.log(`${serverOnly ? 'Backend' : 'Architecture'}: syntax/imports OK; JavaScript runtime boundaries OK; no .NET/legacy dependency.`);
}
