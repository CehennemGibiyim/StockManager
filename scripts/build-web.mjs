// Statik web sürümünü dist/web içine hazırlar (GitHub Pages ve Electron aynı çıktıyı kullanır).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'web');

const files = ['index.html', 'styles.css', 'main.js', 'help.js', 'version.json'];
const directories = ['assets', 'help', 'locales', 'vendor'];

function copy(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) copy(path.join(source, entry), path.join(target, entry));
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) {
    console.error(`Eksik dosya: ${file}. Önce "npm run build:js" çalıştırın.`);
    process.exit(1);
  }
  copy(source, path.join(out, file));
}
for (const directory of directories) {
  const source = path.join(root, directory);
  if (!fs.existsSync(source)) continue;
  copy(source, path.join(out, directory));
}

// GitHub Pages: Jekyll işlemesini kapat ve bilinmeyen yolları uygulama kabuğuna yönlendir.
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.copyFileSync(path.join(root, 'index.html'), path.join(out, '404.html'));

const sizeOf = (directory) => fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
  const full = path.join(directory, entry.name);
  return total + (entry.isDirectory() ? sizeOf(full) : fs.statSync(full).size);
}, 0);

const bytes = sizeOf(out);
const version = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
console.log(`Web sürümü hazır: dist/web (${(bytes / 1024).toFixed(0)} KB, v${version.version})`);
