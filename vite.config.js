import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  build: {
    target: 'node18',
    outDir: 'dist',
    ssr: true,
    rollupOptions: {
      input: resolve(__dirname, 'cli.js'),
      output: {
        format: 'es',
        entryFileNames: 'cli.js',
      },
      external: [
        // Keep these external to avoid bundling issues
        'inquirer',
        'chalk',
        'fs-extra',
        'js-yaml',
        'yargs',
        'child_process',
        'fs',
        'path',
        'os',
        'https',
        'url'
      ],
    },
    minify: false,
    copyPublicDir: false,
  },
  plugins: [
    // Custom plugin to copy additional files and set permissions
    {
      name: 'copy-files-and-set-permissions',
      writeBundle() {
        // Copy mcp-servers.config.js
        fs.copyFileSync('mcp-servers.config.js', 'dist/mcp-servers.config.js');
        
        // Make CLI executable
        fs.chmodSync('dist/cli.js', '755');
        
        console.log('✅ Additional files copied and permissions set');
      }
    }
  ]
});