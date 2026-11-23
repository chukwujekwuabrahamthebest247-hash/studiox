import JSZip from 'jszip';
import { CodeState } from '../types';

export async function downloadProjectZip(code: CodeState, projectName = 'studiox-app'): Promise<void> {
  const zip = new JSZip();

  // 1. Prepare standalone index.html linking to style.css and app.js
  let standaloneHtml = code.html;

  // If code.html doesn't contain standard doc structure, wrap it cleanly
  const hasDocStructure = /<!DOCTYPE html>/i.test(standaloneHtml) || /<html/i.test(standaloneHtml);

  let finalIndexHtml = '';
  if (hasDocStructure) {
    // Inject link to style.css in head and script app.js before </body>
    if (/<head[\s\S]*?>/i.test(standaloneHtml)) {
      finalIndexHtml = standaloneHtml.replace(/<head[\s\S]*?>/i, (m) => `${m}\n  <link rel="stylesheet" href="style.css">\n`);
    } else {
      finalIndexHtml = `<link rel="stylesheet" href="style.css">\n${standaloneHtml}`;
    }

    if (/<\/body>/i.test(finalIndexHtml)) {
      finalIndexHtml = finalIndexHtml.replace(/<\/body>/i, `  <script src="app.js"></script>\n</body>`);
    } else {
      finalIndexHtml = `${finalIndexHtml}\n<script src="app.js"></script>`;
    }
  } else {
    finalIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
${standaloneHtml}
  <script src="app.js"></script>
</body>
</html>`;
  }

  // 2. Add files to zip
  zip.file('index.html', finalIndexHtml);
  zip.file('style.css', code.css);
  zip.file('app.js', code.js);

  // 3. Add README.md
  const readmeContent = `# ${projectName}

Generated with **StudioX AI Code Generator & Live Sandbox IDE**.

## 🚀 How to Run Locally

You can run this project with any standard web browser or local static server:

### Option 1: Direct File
Double-click \`index.html\` to open it directly in your browser.

### Option 2: Live Server (Recommended)
Using Node.js:
\`\`\`bash
npx serve .
\`\`\`
Or using Python:
\`\`\`bash
python3 -m http.server 8000
\`\`\`
Then visit \`http://localhost:8000\` in your browser.

## 📂 Project Structure
- \`index.html\` - The semantic HTML document
- \`style.css\` - Custom styling and responsive design
- \`app.js\` - Vanilla JavaScript logic and event handlers
- \`README.md\` - Documentation and instructions
`;

  zip.file('README.md', readmeContent);

  // 4. Generate zip blob and initiate browser download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  a.href = url;
  a.download = `${safeName}-${Date.now()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadSingleFile(filename: string, content: string): void {
  const cleanName = filename.split('/').pop()?.trim() || 'edited-file.txt';
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
