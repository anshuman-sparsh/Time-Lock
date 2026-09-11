import ts from 'typescript';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Compile pure-system tests with the existing compiler; no extra test framework.
const output = path.resolve('.test-artifacts/unit');
async function compile(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await compile(file);
    else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.endsWith('main.ts')) {
      const result = ts.transpileModule(await readFile(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
      const target = path.join(output, file.replace(/\.ts$/, '.js'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, result.outputText);
    }
  }
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'package.json'), '{"type":"commonjs"}');
await compile('src');
await compile('tests');
const files = (await readdir(path.join(output, 'tests'))).filter(file => file.endsWith('.test.js')).map(file => path.join(output, 'tests', file));
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
