// MCP Server Configurations
// Add new MCP servers here to make them available in the setup script

export const mcpServers = {
  github: {
    name: 'GitHub',
    description: 'GitHub repository management and operations',
    type: 'docker', // docker, sse, npm, binary
    requiredTokens: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    config: {
      claudeCode: {
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
      claudeDesktop: {
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
      vscode: {
        url: 'https://api.githubcopilot.com/mcp/',
        authorization_token: 'Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}'
      }
    }
  },

  notionApi: {
    name: 'Notion',
    description: 'Notion API MCP server connection',
    type: 'mcp',
    command: 'npx',
    requiredTokens: ['NOTION_TOKEN'],
    config: {
      claudeCode: {
        "command": "npx",
        "args": ["-y", "@notionhq/notion-mcp-server"],
        "env": {
          "NOTION_TOKEN": '${NOTION_TOKEN}'
        }
      },
      claudeDesktop: {
        "command": "npx",
        "args": ["-y", "@notionhq/notion-mcp-server"],
        "env": {
          "NOTION_TOKEN": '${NOTION_TOKEN}'
        }
      },
      vscode: {
        "command": "npx",
        "args": ["-y", "@notionhq/notion-mcp-server"],
        "env": {
          "NOTION_TOKEN": '${NOTION_TOKEN}'
        }
      }
    }
  },

  linear: {
    name: 'Linear',
    description: 'Linear issue tracking and project management',
    type: 'sse',
    requiredTokens: [],
    config: {
      claudeCode: {
        // For SSE servers in Claude Code, we use mcp-remote
        command: 'npx',
        args: ['mcp-remote', 'https://mcp.linear.app/sse'],
      },
      claudeDesktop: {
        command: 'npx',
        args: ['mcp-remote', 'https://mcp.linear.app/sse']
      },
      vscode: {
        "command": "npx",
        "args": ["-y", "mcp-remote", "https://mcp.linear.app/sse"]
      }
    }
  },

  figma: {
    name: 'Figma',
    description: 'Figma design file management and operations',
    type: 'sse',
    requiredTokens: [],
    config: {
      claudeCode: {
        type: 'sse',
        url: 'http://127.0.0.1:3845/sse',
      },
      claudeDesktop: {
        type: 'sse',
        url: 'http://127.0.0.1:3845/sse',
      },
      vscode: {
        command: 'npx',
        args: ['-y', 'mcp-remote', 'http://127.0.0.1:3845/sse']
      }
    }
  },

  filesystem: {
    name: 'Filesystem',
    description: 'Read, write, and manage files and directories',
    type: 'npm',
    requiredTokens: [], // No tokens required for filesystem
    config: {
      claudeCode: {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '${WORKSPACE_FOLDER}' // This will be substituted with actual workspace path
        ]
      },
      claudeDesktop: {
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '${WORKSPACE_FOLDER}'
        ]
      },
      docker: {
        command: 'docker',
        args: [
          'run',
          '-i',
          '--rm',
          '--mount',
          'type=bind,src=${WORKSPACE_FOLDER},dst=/projects/workspace',
          'mcp/filesystem',
          '/projects'
        ]
      }
    }
  },

  context7: {
    name: 'Context7',
    description: 'Context7 MCP server for enhanced context management',
    type: 'npm',
    requiredTokens: [],
    config: {
      claudeCode: {
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp']
      },
      claudeDesktop: {
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp']
      },
      vscode: {
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp']
      }
    }
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