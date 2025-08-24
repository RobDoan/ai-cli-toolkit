// MCP Server Configurations
// Add new MCP servers here to make them available in the setup script

// Default configuration generators for each client type
const defaultConfigGenerators = {
  claudeCode: (transport) => {
    if (transport.command) {
      return { ...transport };
    } else if (transport.url) {
      return { type: 'sse', url: transport.url };
    } else if (transport.httpUrl) {
      return { type: 'http', url: transport.httpUrl, ...transport };
    }
    return null;
  },

  claudeDesktop: (transport) => {
    if (transport.command) {
      return { ...transport };
    } else if (transport.url) {
      return { type: 'sse', url: transport.url };
    } else if (transport.httpUrl) {
      return { type: 'http', url: transport.httpUrl, ...transport };
    }
    return null;
  },

  vscode: (transport) => {
    if (transport.url) {
      return { type: 'sse', url: transport.url };
    } else if (transport.httpUrl) {
      return { type: 'http', url: transport.httpUrl, ...transport };
    }
    return null;
  },

  gemini: (transport) => {
    if (transport.command) {
      return { ...transport };
    } else if (transport.url) {
      // Gemini uses httpUrl for all URL-based configurations
      return { httpUrl: transport.url };
    } else if (transport.httpUrl) {
      return { httpUrl: transport.httpUrl, ...transport };
    }
    return null;
  }
};

// Helper function to build configuration using callbacks or defaults
const buildConfig = (transport, customGenerators = {}) => {
  const config = {};
  const generators = { ...defaultConfigGenerators, ...customGenerators };

  Object.entries(generators).forEach(([client, generator]) => {
    const clientConfig = generator(transport);
    if (clientConfig) {
      config[client] = clientConfig;
    }
  });

  return config;
};

export const mcpServers = {
  github: {
    name: 'GitHub',
    description: 'GitHub repository management and operations',
    type: 'docker',
    requiredTokens: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    config: buildConfig(
      {
        command: 'docker',
        args: [
          'run',
          '-i',
          '--rm',
          '-e',
          'GITHUB_PERSONAL_ACCESS_TOKEN',
          'ghcr.io/github/github-mcp-server'
        ],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}'
        }
      },
      {
        // Custom generator for VS Code - uses different endpoint
        vscode: () => ({
          url: 'https://api.githubcopilot.com/mcp/',
          authorization_token: 'Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}'
        })
      }
    )
  },

  notionApi: {
    name: 'Notion',
    description: 'Notion API MCP server connection',
    type: 'mcp',
    command: 'npx',
    requiredTokens: ['NOTION_TOKEN'],
    config: buildConfig({
      url: 'https://mcp.notion.app/sse' // Note: This should be the actual Notion MCP URL
    })
  },

  linear: {
    name: 'Linear',
    description: 'Linear issue tracking and project management',
    type: 'sse',
    requiredTokens: [],
    config: buildConfig({
      url: 'https://mcp.linear.app/sse'
    })
  },

  figma: {
    name: 'Figma',
    description: 'Figma design file management and operations',
    type: 'sse',
    requiredTokens: [],
    config: buildConfig({
      url: 'http://127.0.0.1:3845/sse'
    })
  },

  filesystem: {
    name: 'Filesystem',
    description: 'Read, write, and manage files and directories',
    type: 'npm',
    requiredTokens: ['WORKSPACE_FOLDER'],
    config: buildConfig(
      {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '${WORKSPACE_FOLDER}'
        ]
      }
    )
  },

  context7: {
    name: 'Context7',
    description: 'Context7 MCP server for enhanced context management',
    type: 'npm',
    requiredTokens: ['CONTEXT7_API_KEY'],
    config: (() => {
      const baseHeaders = {
        CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}'
      };

      // Using custom generators for all clients since they all need headers
      return buildConfig(
        {
          type: 'http',
          url: 'https://mcp.context7.com/mcp',
          headers: baseHeaders
        }
      );
    })()
  },

  // More servers with simple configurations
  slack: {
    name: 'Slack',
    description: 'Slack workspace integration',
    type: 'sse',
    requiredTokens: ['SLACK_BOT_TOKEN'],
    config: buildConfig({
      url: 'https://mcp.slack.com/sse'
    })
  },

  postgresql: {
    name: 'PostgreSQL',
    description: 'PostgreSQL database operations',
    type: 'npm',
    requiredTokens: ['POSTGRES_CONNECTION_STRING'],
    config: buildConfig({
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-postgres',
        '${POSTGRES_CONNECTION_STRING}'
      ]
    })
  },

  puppeteer: {
    name: 'Puppeteer',
    description: 'Browser automation and web scraping',
    type: 'npm',
    requiredTokens: [],
    config: buildConfig({
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-puppeteer'
      ]
    })
  },

  sqlite: {
    name: 'SQLite',
    description: 'SQLite database operations',
    type: 'npm',
    requiredTokens: [],
    config: buildConfig({
      command: 'npx',
      args: [
        '-y',
        '@modelcontextprotocol/server-sqlite',
        '${DATABASE_PATH}'
      ]
    })
  },

  // Example of a server with mixed transports for different clients
  customServer: {
    name: 'Custom Server',
    description: 'Example of custom configuration per client',
    type: 'mixed',
    requiredTokens: ['CUSTOM_API_KEY'],
    config: buildConfig(
      {}, // No default transport
      {
        claudeCode: () => ({
          command: 'node',
          args: ['./custom-server.js'],
          env: { CUSTOM_API_KEY: '${CUSTOM_API_KEY}' }
        }),
        claudeDesktop: () => ({
          type: 'sse',
          url: 'https://custom.example.com/sse'
        }),
        vscode: () => ({
          type: 'http',
          url: 'https://custom.example.com/http',
          headers: { 'X-API-Key': '${CUSTOM_API_KEY}' }
        }),
        gemini: () => ({
          httpUrl: 'https://custom.example.com/stream',
          headers: { Authorization: 'Bearer ${CUSTOM_API_KEY}' }
        })
      }
    )
  }
};

// Helper function to get available servers
export function getAvailableServers() {
  return Object.keys(mcpServers);
}

// Helper function to get server config
export function getServerConfig(serverName) {
  return mcpServers[serverName];
}

// Helper function to validate server tokens
export function validateServerTokens(serverName, tokens) {
  const server = mcpServers[serverName];
  if (!server) return { valid: false, missing: [] };

  const requiredTokens = server.requiredTokens || [];
  const missing = requiredTokens.filter(token => !tokens[token]);
  return {
    valid: missing.length === 0,
    missing
  };
}

// Helper function to substitute token values in config
export function substituteTokens(config, tokens) {
  const configStr = JSON.stringify(config);
  let substituted = configStr;

  for (const [key, value] of Object.entries(tokens)) {
    const pattern = new RegExp(`\\$\\{${key}\\}`, 'g');
    substituted = substituted.replace(pattern, value);
  }

  return JSON.parse(substituted);
}

// Helper function to add a new server dynamically
export function addServer(name, serverConfig) {
  if (mcpServers[name]) {
    throw new Error(`Server ${name} already exists`);
  }

  // If config is not provided, build it using the transport and generators
  if (!serverConfig.config && serverConfig.transport) {
    serverConfig.config = buildConfig(
      serverConfig.transport,
      serverConfig.customGenerators
    );
  }

  mcpServers[name] = serverConfig;
}

// Helper function to get server configuration for a specific client
export function getClientConfig(serverName, clientName) {
  const server = mcpServers[serverName];
  return server?.config?.[clientName] || null;
}

// Export server types for reference
export const SERVER_TYPES = {
  DOCKER: 'docker',
  SSE: 'sse',
  NPM: 'npm',
  BINARY: 'binary',
  HTTP: 'http',
  MIXED: 'mixed'
};

// Export client types for reference
export const CLIENT_TYPES = {
  CLAUDE_CODE: 'claudeCode',
  CLAUDE_DESKTOP: 'claudeDesktop',
  VSCODE: 'vscode',
  GEMINI: 'gemini'
};

// Export default generators for external use
export { defaultConfigGenerators, buildConfig };

// Example usage for adding a new server dynamically:
// addServer('myServer', {
//   name: 'My Server',
//   description: 'My custom MCP server',
//   type: 'npm',
//   requiredTokens: ['MY_TOKEN'],
//   transport: {
//     command: 'npx',
//     args: ['my-mcp-server']
//   },
//   customGenerators: {
//     vscode: (transport) => ({
//       // Custom VS Code configuration
//       type: 'special',
//       endpoint: 'wss://my-server.com/vscode'
//     })
//   }
// });