import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import https from 'https';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CommandConverter {
  constructor(options = {}) {
    this.options = options;
    this.claudeDir = options.claudeDir || './.claude/commands';
    this.copilotDir = options.copilotDir || './.github/prompts';
    this.geminiDir = options.geminiDir || './.gemini/commands';
    this.isUsingBundledCommands = !options.sourceDir;
    this.sourceDir = null; // Will be set asynchronously
  }

  // Initialize source directory (async)
  async initialize() {
    if (this.options.sourceDir) {
      this.sourceDir = this.options.sourceDir;
    } else {
      this.sourceDir = await this.getDefaultCommandsDir();
    }
  }

  // Get the default commands directory (download from GitHub if needed)
  async getDefaultCommandsDir() {
    const cacheDir = path.join(process.env.HOME || process.env.USERPROFILE, '.command-converter');
    const commandsDir = path.join(cacheDir, 'commands');
    const packageCommandsDir = path.join(__dirname, '..', 'commands');
    const localCommandsDir = './commands';

    // Priority order: local -> cached -> package -> download
    if (fs.existsSync(localCommandsDir)) {
      return localCommandsDir;
    }

    if (fs.existsSync(commandsDir)) {
      return commandsDir;
    }

    if (fs.existsSync(packageCommandsDir)) {
      return packageCommandsDir;
    }

    // Download commands from GitHub releases
    console.log('📥 Downloading latest commands from GitHub...');
    await this.downloadCommands(cacheDir);

    if (fs.existsSync(commandsDir)) {
      return commandsDir;
    }

    throw new Error('Could not find or download commands');
  }

  // Download commands from GitHub releases
  async downloadCommands(cacheDir) {
    try {
      // Ensure cache directory exists
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const archivePath = path.join(cacheDir, 'commands.tar.gz');
      const url = process.env.COMMANDS_DOWNLOAD_URL || 'https://github.com/RobDoan/ai-cli-toolkit/releases/latest/download/commands.tar.gz';

      // Download the archive
      await this.downloadFile(url, archivePath);

      // Extract the archive
      await this.extractArchive(archivePath, cacheDir);

      // Clean up archive
      fs.unlinkSync(archivePath);

      console.log('✅ Commands downloaded successfully');
    } catch (error) {
      console.warn('⚠️  Failed to download commands:', error.message);
      throw error;
    }
  }

  // Download file from URL
  downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);

      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          return https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', reject);

      file.on('error', (err) => {
        fs.unlink(outputPath, () => { });
        reject(err);
      });
    });
  }

  // Extract tar.gz archive
  extractArchive(archivePath, extractDir) {
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', archivePath, '-C', extractDir]);

      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar extraction failed with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  }

  // Ensure target directories exist
  ensureDirectories() {
    [this.claudeDir, this.copilotDir, this.geminiDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Load all YAML command files from source directory (including subdirectories)
  loadSourceCommands() {
    const commands = [];

    if (!fs.existsSync(this.sourceDir)) {
      console.log(`❌ Source commands directory not found: ${this.sourceDir}`);
      return commands;
    }

    this.loadCommandsFromDirectory(this.sourceDir, '', commands);
    return commands;
  }

  // Recursively load commands from directory
  loadCommandsFromDirectory(dirPath, relativePath, commands) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const currentRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        this.loadCommandsFromDirectory(fullPath, currentRelativePath, commands);
      } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const command = yaml.load(content);

          // Add metadata about file location
          command._filePath = currentRelativePath;
          command._subfolder = relativePath;
          command._fileName = path.parse(entry.name).name;

          commands.push(command);
        } catch (error) {
          console.error(`Error loading ${currentRelativePath}:`, error.message);
        }
      }
    }
  }

  // Convert to Claude Code format (.md) - preserves subfolder structure
  async convertToClaudeFormat(command) {
    let content = '';

    // Add frontmatter if metadata exists
    const metadata = [];
    if (command.tools && command.tools.length > 0) {
      metadata.push(`allowed-tools: ${command.tools.join(', ')}`);
    }
    if (command.arguments) {
      metadata.push(`argument-hint: ${command.arguments}`);
    }
    if (command.description) {
      metadata.push(`description: ${command.description}`);
    }
    if (command.model) {
      metadata.push(`model: ${command.model}`);
    }

    if (metadata.length > 0) {
      content += '---\n';
      content += metadata.join('\n') + '\n';
      content += '---\n\n';
    }

    // Add prompt content
    content += command.prompt;

    // Preserve subfolder structure for Claude
    const filename = `${command.name}.md`;
    let targetDir = this.claudeDir;

    if (command._subfolder) {
      targetDir = path.join(this.claudeDir, command._subfolder);
      // Ensure subfolder exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    const filepath = path.join(targetDir, filename);
    const displayPath = command._subfolder ? `${command._subfolder}/${filename}` : filename;

    if (fs.existsSync(filepath)) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: `Command ${displayPath} already exists. What do you want to do?`,
          choices: [
            { name: 'Override', value: 'override' },
            { name: 'Skip', value: 'skip' }
          ]
        }
      ]);
      if (action === 'skip') {
        console.log(`⏭️  Skipped Claude command: ${displayPath}`);
        return;
      }
    }

    fs.writeFileSync(filepath, content);
    console.log(`✓ Created Claude command: ${displayPath}`);
  }

  // Convert to GitHub Copilot format (.prompt.md) - uses prefix naming for subfolders
  async convertToCopilotFormat(command) {
    let content = '';

    // Add frontmatter
    const metadata = [];
    metadata.push(`mode: 'agent'`);

    if (command.model) {
      metadata.push(`model: '${command.model}'`);
    }
    if (command.tools && command.tools.length > 0) {
      // Convert tool names to simpler format for Copilot
      const copilotTools = command.tools.map(tool => {
        if (tool.includes('Bash')) return 'terminal';
        if (tool.includes('Edit')) return 'edit';
        if (tool.includes('Read')) return 'read';
        return tool.toLowerCase();
      });
      const toolsString = copilotTools.map(t => `'${t}'`).join(', ');
      metadata.push(`tools: [${toolsString}]`);
    }
    if (command.description) {
      metadata.push(`description: '${command.description}'`);
    }

    if (metadata.length > 0) {
      content += '---\n';
      content += metadata.join('\n') + '\n';
      content += '---\n\n';
    }

    // Convert prompt format: $ARGUMENTS -> ${args}
    let prompt = command.prompt.replace(/\$ARGUMENTS/g, '${args}');
    content += prompt;

    // Use prefix naming for subfolders (e.g., kiro_commit.prompt.md)
    let filename;
    if (command._subfolder) {
      const prefix = command._subfolder.replace(/\//g, '_');
      filename = `${prefix}_${command.name}.prompt.md`;
    } else {
      filename = `${command.name}.prompt.md`;
    }

    const filepath = path.join(this.copilotDir, filename);

    if (fs.existsSync(filepath)) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: `Copilot prompt ${filename} already exists. What do you want to do?`,
          choices: [
            { name: 'Override', value: 'override' },
            { name: 'Skip', value: 'skip' }
          ]
        }
      ]);
      if (action === 'skip') {
        console.log(`⏭️  Skipped Copilot prompt: ${filename}`);
        return;
      }
    }

    fs.writeFileSync(filepath, content);
    console.log(`✓ Created Copilot prompt: ${filename}`);
  }

  // Convert to Gemini CLI format (.toml) - preserves subfolder structure
  async convertToGeminiFormat(command) {
    let content = '';

    // Add description
    if (command.description) {
      content += `description = "${command.description}"\n\n`;
    }

    // Convert prompt format: $ARGUMENTS -> {{args}}
    let prompt = command.prompt.replace(/\$ARGUMENTS/g, '{{args}}');

    // Add prompt as multi-line string
    content += 'prompt = """\n';
    content += prompt;
    content += '\n"""';

    // Preserve subfolder structure for Gemini
    const filename = `${command.name}.toml`;
    let targetDir = this.geminiDir;

    if (command._subfolder) {
      targetDir = path.join(this.geminiDir, command._subfolder);
      // Ensure subfolder exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    const filepath = path.join(targetDir, filename);
    const displayPath = command._subfolder ? `${command._subfolder}/${filename}` : filename;

    if (fs.existsSync(filepath)) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: `Gemini command ${displayPath} already exists. What do you want to do?`,
          choices: [
            { name: 'Override', value: 'override' },
            { name: 'Skip', value: 'skip' }
          ]
        }
      ]);
      if (action === 'skip') {
        console.log(`⏭️  Skipped Gemini command: ${displayPath}`);
        return;
      }
    }

    fs.writeFileSync(filepath, content);
    console.log(`✓ Created Gemini command: ${displayPath}`);
  }

  // Dry run - show what would be done
  async dryRun() {
    await this.initialize();
    console.log('🔍 Dry run mode - showing what would be converted...\n');
    console.log(`Source directory: ${this.sourceDir}${this.isUsingBundledCommands ? ' (downloaded)' : ''}`);
    console.log(`Claude output: ${this.claudeDir}`);
    console.log(`Copilot output: ${this.copilotDir}`);
    console.log(`Gemini output: ${this.geminiDir}\n`);

    const commands = this.loadSourceCommands();

    if (commands.length === 0) {
      console.log('No commands found to convert');
      return;
    }

    console.log(`Found ${commands.length} command(s) that would be converted:\n`);

    for (const command of commands) {
      const displayName = command._subfolder ? `${command._subfolder}/${command.name}` : command.name;
      console.log(`📄 ${displayName}`);

      // Claude Code output
      const claudePath = command._subfolder ? `${command._subfolder}/${command.name}.md` : `${command.name}.md`;
      console.log(`  → ${claudePath} (Claude Code)`);

      // GitHub Copilot output (with prefix for subfolders)
      let copilotName;
      if (command._subfolder) {
        const prefix = command._subfolder.replace(/[/\\]/g, '_');
        copilotName = `${prefix}_${command.name}.prompt.md`;
      } else {
        copilotName = `${command.name}.prompt.md`;
      }
      console.log(`  → ${copilotName} (GitHub Copilot)`);

      // Gemini CLI output
      const geminiPath = command._subfolder ? `${command._subfolder}/${command.name}.toml` : `${command.name}.toml`;
      console.log(`  → ${geminiPath} (Gemini CLI)\n`);
    }

    console.log('💡 Run without --dry-run to perform the conversion');
  }

  // Main conversion function
  async convertAll() {
    await this.initialize();

    console.log('🔄 Starting command conversion...\n');
    console.log(`Source directory: ${this.sourceDir}${this.isUsingBundledCommands ? ' (downloaded)' : ''}`);
    console.log(`Claude output: ${this.claudeDir}`);
    console.log(`Copilot output: ${this.copilotDir}`);
    console.log(`Gemini output: ${this.geminiDir}\n`);

    this.ensureDirectories();
    const commands = this.loadSourceCommands();

    if (commands.length === 0) {
      console.log('No commands found to convert');
      return;
    }

    console.log(`Found ${commands.length} command(s) to convert\n`);

    for (const command of commands) {
      console.log(`Converting: ${command.name}`);

      try {
        await this.convertToClaudeFormat(command);
        await this.convertToCopilotFormat(command);
        await this.convertToGeminiFormat(command);
        console.log('');
      } catch (error) {
        console.error(`Error converting ${command.name}:`, error.message);
      }
    }

    console.log('✅ Command conversion completed!');
    console.log('\nTarget directories:');
    console.log(`  Claude Code: ${this.claudeDir}`);
    console.log(`  GitHub Copilot: ${this.copilotDir}`);
    console.log(`  Gemini CLI: ${this.geminiDir}`);
  }

  async run() {
    if (this.options.dryRun) {
      await this.dryRun();
    } else {
      await this.convertAll();
    }
  }
}

export const convertCommandsCommand = {
  command: 'convert [options]',
  describe: 'Convert commands between AI CLI platforms',
  builder: (yargs) => {
    return yargs
      .option('source', {
        type: 'string',
        description: 'Source directory containing commands to convert'
      })
      .option('claude-dir', {
        type: 'string',
        description: 'Claude commands output directory',
        default: './.claude/commands'
      })
      .option('copilot-dir', {
        type: 'string',
        description: 'GitHub Copilot prompts output directory',
        default: './.github/prompts'
      })
      .option('gemini-dir', {
        type: 'string',
        description: 'Gemini commands output directory',
        default: './.gemini/commands'
      })
      .option('dry-run', {
        type: 'boolean',
        description: 'Preview changes without applying them',
        default: false
      });
  },
  handler: async (argv) => {
    const converter = new CommandConverter({
      sourceDir: argv.source,
      claudeDir: argv.claudeDir,
      copilotDir: argv.copilotDir,
      geminiDir: argv.geminiDir,
      dryRun: argv.dryRun
    });
    
    try {
      await converter.initialize();
      await converter.run();
    } catch (error) {
      console.error('Conversion failed:', error.message);
      process.exit(1);
    }
  }
};