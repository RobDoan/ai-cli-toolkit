#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CommandConverter {
  constructor(options = {}) {
    // Default to package bundled commands if no source specified
    this.sourceDir = options.sourceDir || this.getDefaultCommandsDir();
    this.claudeDir = options.claudeDir || './.claude/commands';
    this.copilotDir = options.copilotDir || './.copilot';
    this.geminiDir = options.geminiDir || './.gemini/commands';
    this.isUsingBundledCommands = !options.sourceDir;
  }

  // Get the default commands directory (bundled with package)
  getDefaultCommandsDir() {
    const packageCommandsDir = path.join(__dirname, 'commands');
    const localCommandsDir = './commands';
    
    // Check if package bundled commands exist
    if (fs.existsSync(packageCommandsDir)) {
      return packageCommandsDir;
    }
    
    // Fallback to local commands directory
    return localCommandsDir;
  }

  // Ensure target directories exist
  ensureDirectories() {
    [this.claudeDir, this.copilotDir, this.geminiDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Load all JSON command files from source directory
  loadSourceCommands() {
    const commands = [];

    if (!fs.existsSync(this.sourceDir)) {
      console.log(`❌ Source commands directory not found: ${this.sourceDir}`);
      return commands;
    }

    const files = fs.readdirSync(this.sourceDir);

    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const filePath = path.join(this.sourceDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const command = yaml.load(content);
          commands.push(command);
        } catch (error) {
          console.error(`Error loading ${file}:`, error.message);
        }
      }
    }

    return commands;
  }

  // Convert to Claude Code format (.md)
  convertToClaudeFormat(command) {
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

    const filename = `${command.name}.md`;
    const filepath = path.join(this.claudeDir, filename);

    fs.writeFileSync(filepath, content);
    console.log(`✓ Created Claude command: ${filename}`);
  }

  // Convert to GitHub Copilot format (.prompt.md)
  convertToCopilotFormat(command) {
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
      metadata.push(`tools: [${copilotTools.map(t => `'${t}'`).join(', ')}]`);
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

    const filename = `${command.name}.prompt.md`;
    const filepath = path.join(this.copilotDir, filename);

    fs.writeFileSync(filepath, content);
    console.log(`✓ Created Copilot prompt: ${filename}`);
  }

  // Convert to Gemini CLI format (.toml)
  convertToGeminiFormat(command) {
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

    const filename = `${command.name}.toml`;
    const filepath = path.join(this.geminiDir, filename);

    fs.writeFileSync(filepath, content);
    console.log(`✓ Created Gemini command: ${filename}`);
  }

  // Dry run - show what would be done
  dryRun() {
    console.log('🔍 Dry run mode - showing what would be converted...\n');
    console.log(`Source directory: ${this.sourceDir}${this.isUsingBundledCommands ? ' (bundled)' : ''}`);
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
      console.log(`📄 ${command.name}`);
      console.log(`  → ${command.name}.md (Claude Code)`);
      console.log(`  → ${command.name}.prompt.md (GitHub Copilot)`);
      console.log(`  → ${command.name}.toml (Gemini CLI)\n`);
    }

    console.log('💡 Run without --dry-run to perform the conversion');
  }

  // Main conversion function
  convertAll() {
    console.log('🔄 Starting command conversion...\n');
    console.log(`Source directory: ${this.sourceDir}${this.isUsingBundledCommands ? ' (bundled)' : ''}`);
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
        this.convertToClaudeFormat(command);
        this.convertToCopilotFormat(command);
        this.convertToGeminiFormat(command);
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
}

// CLI configuration
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('source', {
    alias: 's',
    type: 'string',
    description: 'Source directory containing YAML command files (defaults to bundled commands)'
  })
  .option('claude', {
    alias: 'c',
    type: 'string',
    description: 'Output directory for Claude Code commands',
    default: './.claude/commands'
  })
  .option('copilot', {
    alias: 'p',
    type: 'string',
    description: 'Output directory for GitHub Copilot prompts',
    default: './.copilot'
  })
  .option('gemini', {
    alias: 'g',
    type: 'string',
    description: 'Output directory for Gemini CLI commands',
    default: './.gemini/commands'
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Show what would be done without making changes',
    default: false
  })
  .help()
  .alias('help', 'h')
  .example('$0', 'Convert commands using default directories')
  .example('$0 --source ./my-commands --claude ./output/claude', 'Use custom directories')
  .example('$0 --dry-run', 'Preview changes without executing')
  .argv;

// Run the converter
if (import.meta.url === `file://${process.argv[1]}`) {
  const converter = new CommandConverter({
    sourceDir: argv.source,
    claudeDir: argv.claude,
    copilotDir: argv.copilot,
    geminiDir: argv.gemini
  });
  
  if (argv.dryRun) {
    converter.dryRun();
  } else {
    converter.convertAll();
  }
}

export default CommandConverter;