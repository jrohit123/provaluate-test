/**
 * Run from React project root: node scripts/fix-base-url-assets.cjs
 * Rewrites absolute public paths to use import.meta.env.BASE_URL (Vite).
 */
const fs = require('fs');
const path = require('path');

function getAllFiles(dir, ext) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  fs.readdirSync(dir).forEach((file) => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory() && file !== 'node_modules' && file !== 'dist') {
      files = files.concat(getAllFiles(full, ext));
    } else if (ext.some((e) => file.endsWith(e))) {
      files.push(full);
    }
  });
  return files;
}

const srcDir = path.join(process.cwd(), 'src');
const files = getAllFiles(srcDir, ['.tsx', '.ts', '.jsx', '.js']);
let totalFixed = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(/src="\/([^"]+)"/g, (_, p) => `src={\`\${import.meta.env.BASE_URL}${p}\`}`);

  content = content.replace(/src='\/([^']+)'/g, (_, p) => `src={\`\${import.meta.env.BASE_URL}${p}\`}`);

  content = content.replace(/fetch\('\/([^']+)'\)/g, (_, p) => `fetch(\`\${import.meta.env.BASE_URL}${p}\`)`);

  content = content.replace(/fetch\("\/([^"]+)"\)/g, (_, p) => `fetch(\`\${import.meta.env.BASE_URL}${p}\`)`);

  content = content.replace(/videoSrc:\s*'\/([^']+)'/g, (_, p) => `videoSrc: \`\${import.meta.env.BASE_URL}${p}\``);

  if (content !== original) {
    fs.writeFileSync(file, content);
    totalFixed++;
    console.log('Fixed: ' + path.relative(process.cwd(), file));
  }
});

console.log('Done. Fixed ' + totalFixed + ' files.');
