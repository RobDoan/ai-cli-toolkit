#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import {
  mcpServers,
  getAvailableServers,
  getServerConfig,
  validateServerTokens,
  substituteTokens
} from './mcp-servers.config.js';

class MCPSetup {
  constructor(options = {}) {
    this.tokens = {};
    this.selectedServers = [];
    this.selectedClients = [];
    this.dryRun = options.dryRun || false;
  }

  log = {
    success: (msg) => console.log(chalk.green('✓') + ' ' + msg),
    error: (msg) => console.log(chalk.red('✗') + ' ' + msg),
    warning: (msg) => console.log(chalk.yellow('⚠') + ' ' + msg),
    info: (msg) => console.log(chalk.blue('ℹ') + ' ' + msg),
    title: (msg) => console.log(chalk.cyan.bold('\n' + msg + '\n'))
  };

  async collectTokens() {
    this.log.title('🔑 Collecting API Tokens');

    const allRequiredTokens = new Set();
    this.selectedServers.forEach(serverName => {
      const server = getServerConfig(serverName);
      if (server.requiredTokens && server.requiredTokens.length > 0) {
        server.requiredTokens.forEach(token => allRequiredTokens.add(token));
      }
    });

    for (const token of allRequiredTokens) {
      // Check if token exists in environment
      const envValue = process.env[token];
      if (envValue) {
        this.tokens[token] = envValue;
        this.log.success(`Using ${token} from environment`);
      } else {
        const { value } = await inquirer.prompt([{
          type: 'password',
          name: 'value',
          message: `Enter your ${token}:`,
          validate: input => input.trim() !== '' || 'Token cannot be empty'
        }]);
        this.tokens[token] = value;
      }
    }
  }

  async setupClaudeCode() {
    this.log.info('Setting up Claude Code...');

    // Check if claude command exists
    try {
      execSync('which claude', { stdio: 'ignore' });
    } catch {
      this.log.error('Claude CLI not found. Please install Claude Code first.');
      return false;
    }

    let success = true;
    for (const serverName of this.selectedServers) {
      const server = getServerConfig(serverName);
      let config = server.config.claudeCode;

      // Handle workspace folder substitution for filesystem server
      if (serverName === 'filesystem') {
        const { workspaceFolder } = await inquirer.prompt([{
          type: 'input',
          name: 'workspaceFolder',
          message: 'Enter the workspace folder path for filesystem access:',
          default: process.cwd(),
          validate: input => fs.pathExistsSync(input) || 'Path does not exist'
        }]);

        const tokensWithWorkspace = { ...this.tokens, WORKSPACE_FOLDER: workspaceFolder };
        config = substituteTokens(config, tokensWithWorkspace);
      } else {
        config = substituteTokens(config, this.tokens);
      }

      try {
        // For SSE servers, we might need to install mcp-remote
        if (server.type === 'sse') {
          this.log.info(`Installing mcp-remote for ${server.name}...`);
          try {
            execSync('npm list -g mcp-remote', { stdio: 'ignore' });
          } catch {
            if (this.dryRun) {
              this.log.info('[DRY RUN] Would install mcp-remote globally');
            } else {
              this.log.info('Installing mcp-remote globally...');
              execSync('npm install -g mcp-remote', { stdio: 'inherit' });
            }
          }
        }

        const configJson = JSON.stringify(config);
        if (this.dryRun) {
          this.log.info(`[DRY RUN] Would execute: claude mcp add-json ${serverName}`);
          this.log.info(`[DRY RUN] Config: ${configJson}`);
        } else {
          execSync(`claude mcp add-json ${serverName} '${configJson}'`, { stdio: 'inherit' });
        }
        this.log.success(`${server.name} configured for Claude Code`);
      } catch (error) {
        this.log.error(`Failed to configure ${server.name} for Claude Code: ${error.message}`);
        success = false;
      }
    }
    return success;
  }

  async setupClaudeDesktop() {
    this.log.info('Setting up Claude Desktop...');

    // Determine config path based on OS
    let configPath;
    if (os.platform() === 'darwin') {
      configPath = path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
    } else if (os.platform() === 'linux') {
      configPath = path.join(os.homedir(), '.config/Claude/claude_desktop_config.json');
    } else {
      this.log.error('Unsupported operating system for Claude Desktop');
      return false;
    }

    try {
      // Ensure directory exists
      await fs.ensureDir(path.dirname(configPath));

      // Read existing config or create new one
      let config = { mcpServers: {} };
      if (await fs.pathExists(configPath)) {
        const existingConfig = await fs.readJson(configPath);
        config = { ...existingConfig, mcpServers: existingConfig.mcpServers || {} };
      }

      // Add selected servers
      for (const serverName of this.selectedServers) {
        const server = getServerConfig(serverName);
        let serverConfig;

        // Handle workspace folder substitution for filesystem server
        if (serverName === 'filesystem') {
          const { workspaceFolder } = await inquirer.prompt([{
            type: 'input',
            name: 'workspaceFolder',
            message: 'Enter the workspace folder path for filesystem access:',
            default: process.cwd(),
            validate: input => fs.pathExistsSync(input) || 'Path does not exist'
          }]);

          const tokensWithWorkspace = { ...this.tokens, WORKSPACE_FOLDER: workspaceFolder };
          serverConfig = substituteTokens(server.config.claudeDesktop, tokensWithWorkspace);
        } else {
          serverConfig = substituteTokens(server.config.claudeDesktop, this.tokens);
        }

        config.mcpServers[serverName] = serverConfig;
        this.log.success(`${server.name} added to Claude Desktop config`);
      }

      // Write config file
      if (this.dryRun) {
        this.log.info(`[DRY RUN] Would write config to: ${configPath}`);
        this.log.info(`[DRY RUN] Config content:`);
        console.log(JSON.stringify(config, null, 2));
      } else {
        await fs.writeJson(configPath, config, { spaces: 2 });
      }
      this.log.success(`Claude Desktop config ${this.dryRun ? 'would be' : ''} saved to: ${configPath}`);
      return true;
    } catch (error) {
      this.log.error(`Failed to setup Claude Desktop: ${error.message}`);
      return false;
    }
  }

  async setupVSCode() {
    this.log.info('Setting up VS Code GitHub Copilot...');

    try {
      const config = { mcpServers: {} };

      for (const serverName of this.selectedServers) {
        const server = getServerConfig(serverName);
        if (server.config.vscode) {
          const serverConfig = substituteTokens(server.config.vscode, this.tokens);
          config.mcpServers[serverName] = serverConfig;
          this.log.success(`${server.name} added to VS Code config`);
        }
      }

      const configPath = path.join(process.cwd(), 'mcp.json');
      if (this.dryRun) {
        this.log.info(`[DRY RUN] Would write config to: ${configPath}`);
        this.log.info(`[DRY RUN] Config content:`);
        console.log(JSON.stringify(config, null, 2));
      } else {
        await fs.writeJson(configPath, config, { spaces: 2 });
      }
      this.log.success(`VS Code MCP config ${this.dryRun ? 'would be' : ''} saved to: ${configPath}`);
      this.log.warning('Make sure to configure VS Code to use this mcp.json file');
      return true;
    } catch (error) {
      this.log.error(`Failed to setup VS Code: ${error.message}`);
      return false;
    }
  }

  async run() {
    console.log(chalk.cyan.bold('🚀 MCP Server Setup Tool\n'));

    // Select MCP servers
    const serverChoices = getAvailableServers().map(name => ({
      name: `${mcpServers[name].name} - ${mcpServers[name].description}`,
      value: name
    }));

    const { selectedServers } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedServers',
      message: 'Select MCP servers to configure:',
      choices: serverChoices,
      validate: input => input.length > 0 || 'Please select at least one server'
    }]);

    this.selectedServers = selectedServers;

    // Select clients
    const { selectedClients } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedClients',
      message: 'Select clients to configure:',
      choices: [
        { name: 'Claude Code', value: 'claudeCode' },
        { name: 'Claude Desktop', value: 'claudeDesktop' },
        { name: 'VS Code GitHub Copilot', value: 'vscode' }
      ],
      validate: input => input.length > 0 || 'Please select at least one client'
    }]);

    this.selectedClients = selectedClients;

    // Collect tokens
    await this.collectTokens();

    // Validate tokens
    let allValid = true;
    for (const serverName of this.selectedServers) {
      const validation = validateServerTokens(serverName, this.tokens);
      if (!validation.valid) {
        this.log.error(`Missing tokens for ${serverName}: ${validation.missing.join(', ')}`);
        allValid = false;
      }
    }

    if (!allValid) {
      this.log.error('Please provide all required tokens');
      return;
    }

    // Setup selected clients
    const results = {};

    if (this.selectedClients.includes('claudeCode')) {
      results.claudeCode = await this.setupClaudeCode();
    }

    if (this.selectedClients.includes('claudeDesktop')) {
      results.claudeDesktop = await this.setupClaudeDesktop();
    }

    if (this.selectedClients.includes('vscode')) {
      results.vscode = await this.setupVSCode();
    }

    // Summary
    this.log.title('📋 Setup Summary');
    Object.entries(results).forEach(([client, success]) => {
      if (success) {
        this.log.success(`${client} configured successfully`);
      } else {
        this.log.error(`${client} configuration failed`);
      }
    });

    this.log.title('🎉 Setup Complete!');
    this.log.info('Next steps:');
    console.log('  • Restart your Claude applications to use the new MCP servers');
    console.log('  • Keep your API tokens secure and never commit them to version control');
    console.log('  • Add more MCP servers by editing mcp-servers.config.js');
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node setup-mcp.js [options]

Options:
  --dry-run    Show what would be configured without making any changes
  --help, -h   Show this help message
`);
      process.exit(0);
    }
  }

  return options;
}

// Run the setup
const options = parseArgs();
const setup = new MCPSetup(options);

if (options.dryRun) {
  console.log(chalk.yellow('🔍 Running in DRY RUN mode - no changes will be made\n'));
}

setup.run().catch(console.error);