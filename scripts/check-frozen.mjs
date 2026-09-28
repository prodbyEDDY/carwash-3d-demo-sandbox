// Проверка замороженной зоны: файлы из frozen.sha256 должны совпадать байт в байт
// с тем, что выдал владелец основного репо. Запуск: pnpm check:frozen.
// Манифест обновляет только владелец основного репо.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = readFileSync(resolve(root, 'frozen.sha256'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

let failed = 0;
for (const line of manifest) {
  const [expected, file] = line.split(/\s+\*?/);
  let actual;
  try {
    // CRLF/LF нормализуем: git на Windows может переписать окончания строк.
    const bytes = readFileSync(resolve(root, file));
    const text = file.match(/\.(glb|jpg|png|webp)$/) ? bytes : Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    actual = createHash('sha256').update(text).digest('hex');
  } catch {
    console.error(`MISSING  ${file}`);
    failed += 1;
    continue;
  }
  if (actual !== expected) {
    console.error(`CHANGED  ${file}`);
    failed += 1;
  }
}
if (failed) {
  console.error(
    `\nЗамороженная зона нарушена: ${failed} файл(ов). Эти файлы в основной репо не возвращаются — верните их командой git checkout -- <файл>.`,
  );
  process.exit(1);
}
console.log(`Замороженная зона цела: ${manifest.length} файл(ов).`);
