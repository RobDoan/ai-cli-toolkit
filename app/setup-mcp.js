import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
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
        const { value } = await inquirer.prompt([{
          type: 'password',
          name: 'value',
          message: `Enter your ${token} (press Enter to use existing value):`,
          default: envValue,
          validate: input => input.trim() !== '' || 'Token cannot be empty'
        }]);
        this.tokens[token] = value;
        if (value === envValue) {
          this.log.success(`Using ${token} from environment`);
        }
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
    this.log.info('Setting up Claude Code with local scope...');

    try {
      const config = { mcpServers: {} };

      // Add selected servers to config
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
          serverConfig = substituteTokens(server.config.claudeCode, tokensWithWorkspace);
        } else {
          serverConfig = substituteTokens(server.config.claudeCode, this.tokens);
        }

        config.mcpServers[serverName] = serverConfig;
        this.log.success(`${server.name} added to local Claude Code config`);
      }

      // Write .mcp.json file in current directory
      const configPath = path.join(process.cwd(), '.mcp.json');
      if (this.dryRun) {
        this.log.info(`[DRY RUN] Would write config to: ${configPath}`);
        this.log.info(`[DRY RUN] Config content:`);
        console.log(JSON.stringify(config, null, 2));
      } else {
        await fs.writeJson(configPath, config, { spaces: 2 });
      }
      this.log.success(`Claude Code local config ${this.dryRun ? 'would be' : ''} saved to: ${configPath}`);
      return true;
    } catch (error) {
      this.log.error(`Failed to setup Claude Code: ${error.message}`);
      return false;
    }
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
          // First substitute tokens, then convert to VS Code input format
          let serverConfig = substituteTokens(server.config.vscode, this.tokens);

          // Convert {{token}} placeholders to ${input:token} format for VS Code
          const configStr = JSON.stringify(serverConfig);
          const convertedStr = configStr.replace(/\{\{([^}]+)\}\}/g, '${input:$1}');
          serverConfig = JSON.parse(convertedStr);

          config.mcpServers[serverName] = serverConfig;
          this.log.success(`${server.name} added to VS Code config`);
        }
      }

      const configPath = path.join(process.cwd(), '.vscode', 'mcp.json');
      if (this.dryRun) {
        this.log.info(`[DRY RUN] Would write config to: ${configPath}`);
        this.log.info(`[DRY RUN] Config content:`);
        console.log(JSON.stringify(config, null, 2));
      } else {
        await fs.ensureDir(path.dirname(configPath));
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

  async setupGeminiCLI() {
    this.log.info('Setting up Gemini CLI...');

    try {
      // Determine config path - check current directory first, then user home
      let configPath = path.join(process.cwd(), '.gemini', 'settings.json');
      const homeConfigPath = path.join(os.homedir(), '.gemini', 'settings.json');

      // Check if local .gemini exists, otherwise use home directory
      const useLocalConfig = await fs.pathExists(path.join(process.cwd(), '.gemini'));
      if (!useLocalConfig) {
        configPath = homeConfigPath;
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(configPath));

      // Read existing config or create new one
      let config = {};
      if (await fs.pathExists(configPath)) {
        config = await fs.readJson(configPath);
      }

      // Initialize mcpServers if not exists
      if (!config.mcpServers) {
        config.mcpServers = {};
      }

      // Add selected servers to config
      for (const serverName of this.selectedServers) {
        const server = getServerConfig(serverName);
        if (!server.config.gemini) {
          this.log.warning(`${server.name} does not have Gemini CLI configuration`);
          continue;
        }

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
          serverConfig = substituteTokens(server.config.gemini, tokensWithWorkspace);
        } else {
          serverConfig = substituteTokens(server.config.gemini, this.tokens);
        }

        config.mcpServers[serverName] = serverConfig;
        this.log.success(`${server.name} added to Gemini CLI config`);
      }

      // Write config file
      if (this.dryRun) {
        this.log.info(`[DRY RUN] Would write config to: ${configPath}`);
        this.log.info(`[DRY RUN] Config content:`);
        console.log(JSON.stringify(config, null, 2));
      } else {
        await fs.writeJson(configPath, config, { spaces: 2 });
      }
      this.log.success(`Gemini CLI config ${this.dryRun ? 'would be' : ''} saved to: ${configPath}`);
      return true;
    } catch (error) {
      this.log.error(`Failed to setup Gemini CLI: ${error.message}`);
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
        { name: 'VS Code GitHub Copilot', value: 'vscode' },
        { name: 'Gemini CLI', value: 'gemini' }
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

    if (this.selectedClients.includes('gemini')) {
      results.gemini = await this.setupGeminiCLI();
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

export const setupMcpCommand = {
  command: 'setup [options]',
  describe: 'Set up MCP servers for AI CLI clients',
  builder: (yargs) => {
    return yargs
      .option('dry-run', {
        type: 'boolean',
        description: 'Preview changes without applying them',
        default: false
      })
      .option('config', {
        type: 'string',
        description: 'Path to custom configuration file'
      });
  },
  handler: async (argv) => {
    const setup = new MCPSetup({
      dryRun: argv.dryRun,
      config: argv.config
    });

    try {
      await setup.run();
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error.message);
      process.exit(1);
    }
  }
};