// Sürüm yükseltir, sürüm notlarını yazar, web sürümünü derler ve Windows kurulum paketini üretir.
// Kullanım:
//   npm run release -- --patch --notes "Ürün arama hızlandırıldı|Yeni rapor eklendi"
//   npm run release -- --minor --notes-file notes.txt
//   npm run release:same -- --notes "Sadece arayüz düzeltmeleri"
//   npm run release -- --patch --no-installer   (yalnız web)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const packagePath = path.join(root, 'package.json');
const versionPath = path.join(root, 'version.json');
const changelogPath = path.join(root, 'CHANGELOG.md');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const meta = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

const sameVersion = flag('--same-version') || process.env.npm_lifecycle_event === 'release:same';
const level = flag('--major') ? 'major' : flag('--minor') ? 'minor' : 'patch';
const current = pkg.version || meta.version || '1.0.0';
const [major, minor, patch] = current.split('.').map(Number);

function bump(version, kind) {
  const parts = version.split('.').map(Number);
  if (kind === 'major') return `${parts[0] + 1}.0.0`;
  if (kind === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

const version = sameVersion ? current : bump(current, level);
const date = new Date().toISOString().slice(0, 10);
const notesFile = valueOf('--notes-file');
let notes = [];
if (notesFile) {
  notes = fs.readFileSync(path.resolve(root, notesFile), 'utf8').split(/\r?\n/).map((line) => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
} else if (valueOf('--notes')) {
  notes = valueOf('--notes').split('|').map((line) => line.trim()).filter(Boolean);
}
if (!notes.length) {
  notes = sameVersion ? meta.notes || [] : ['Bakım ve iyileştirme sürümü.'];
}

pkg.version = version;
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

meta.version = version;
meta.releasedAt = date;
meta.notes = notes;
meta.installer = {
  file: `StockManager-Setup-${version}.exe`,
  url: `https://github.com/CehennemGibiyim/StockManager/releases/download/v${version}/StockManager-Setup-${version}.exe`
};
fs.writeFileSync(versionPath, `${JSON.stringify(meta, null, 2)}\n`);

// CHANGELOG: aynı sürüm varsa bölümü güncelle, yoksa başa ekle.
const entry = `## [${version}] - ${date}\n\n${notes.map((note) => `- ${note}`).join('\n')}\n`;
let changelog = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Sürüm notları\n';
const existing = changelog.match(new RegExp(`## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][^]*?(?=\\n## \\[|$)`));
if (existing) {
  changelog = changelog.replace(existing[0], entry);
} else {
  const firstEntry = changelog.indexOf('\n## ');
  changelog = firstEntry >= 0
    ? `${changelog.slice(0, firstEntry + 1)}${entry}\n${changelog.slice(firstEntry + 1)}`
    : `${changelog.trimEnd()}\n\n${entry}`;
}
fs.writeFileSync(changelogPath, changelog);

console.log(`\nSürüm: v${version}${sameVersion ? ' (aynı sürüm yeniden paketlendi)' : ` (${level})`}`);
console.log(`Notlar:\n${notes.map((note) => `  • ${note}`).join('\n')}`);

function run(command, commandArgs, cwd = root) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`\nKomut başarısız: ${command} ${commandArgs.join(' ')}`);
    process.exit(result.status || 1);
  }
}

if (!flag('--skip-web')) {
  console.log('\nWeb sürümü derleniyor...');
  run('npm', ['run', 'build:web']);
}

if (!flag('--no-installer')) {
  console.log('\nWindows kurulum paketi hazırlanıyor...');
  run('npx', ['electron-builder', '--win', 'nsis']);
  const artifact = path.join(root, 'release', `StockManager-Setup-${version}.exe`);
  if (!fs.existsSync(artifact)) {
    console.error(`Kurulum paketi bulunamadı: ${path.relative(root, artifact)}`);
    process.exit(1);
  }
  const size = (fs.statSync(artifact).size / 1024 / 1024).toFixed(1);
  fs.writeFileSync(path.join(root, 'release', 'latest.json'), `${JSON.stringify({ version, releasedAt: date, notes, installer: meta.installer }, null, 2)}\n`);
  console.log(`\nKurulum paketi hazır: release/StockManager-Setup-${version}.exe (${size} MB)`);
}

console.log(`
Sonraki adımlar:
  git add -A
  git commit -m "Sürüm v${version}: ${notes[0] || 'güncelleme'}"
  git tag v${version}
  git push origin main --tags

GitHub Actions etiketle birlikte kurulum paketini Releases sayfasına yükler.
Web sürümü main dalına yapılan her push'ta GitHub Pages'e yayınlanır.`);
