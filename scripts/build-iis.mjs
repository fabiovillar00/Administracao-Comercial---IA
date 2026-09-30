import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, unlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cli = fileURLToPath(new URL('../node_modules/vinext/dist/cli.js', import.meta.url));
const root = fileURLToPath(new URL('..', import.meta.url));
const marker = join(root, 'outputs/release-build.json');
if (existsSync(marker)) unlinkSync(marker);
const preparation = spawnSync('python', [join(root, 'scripts/release-source.py')], { cwd: root, encoding: 'utf8' });
if (preparation.error) throw preparation.error;
if (preparation.status !== 0) throw new Error(preparation.stderr || 'Falha ao preparar fontes da atualizacao.');
const release = JSON.parse(preparation.stdout);
symlinkSync(join(root, 'node_modules'), join(release.stage, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const result = spawnSync(process.execPath, [cli, 'build'], {
  cwd: release.stage,
  env: { ...process.env, PULSO_DEPLOY_TARGET: 'node' },
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status === 0) writeFileSync(marker, JSON.stringify(release, null, 2));
process.exit(result.status ?? 1);
