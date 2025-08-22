# AI CLI Toolkit

Universal toolkit for AI CLI tools, featuring MCP server setup and command conversion.

## Features

- **MCP Server Setup**: Interactively configure MCP servers for Claude Code, Claude Desktop, and VS Code.
- **Universal Command Format**: Write commands once in YAML, convert them for all supported platforms.
- **Platform-Specific Optimization**: Each platform receives an optimized format and structure.
- **Bundled Commands**: Comes with a set of pre-built commands for immediate use.
- **Flexible Configuration**: Customize source and output directories for commands.
- **Dry Run Mode**: Preview changes and conversions before they are executed.

## Supported Platforms

### MCP Server Setup
- Claude Code
- Claude Desktop
- VS Code (GitHub Copilot)

### Command Conversion
| Platform | Format | Structure |
|----------|--------|-----------|
| **Claude Code** | `.md` | Preserves subfolders |
| **GitHub Copilot** | `.prompt.md` | Prefix naming (e.g., `kiro_commit.prompt.md`) |
| **Gemini CLI** | `.toml` | Preserves subfolders |

## Installation

```bash
npm install -g ai-cli-toolkit
```

## Usage

The toolkit is available under two aliases: `ai-cli-toolkit` and `ait`.

### `setup` Command

Interactively set up and configure MCP servers for your AI CLI clients.

```bash
# Start the interactive setup process
ait setup

# Preview the setup without making changes
ait setup --dry-run
```

### `convert` Command

Convert YAML commands to formats compatible with different AI CLI platforms.

```bash
# Convert bundled commands
ait convert

# Preview the conversion process
ait convert --dry-run

# Use a custom source directory for your commands
ait convert --source ./my-commands

# Specify custom output directories
ait convert --claude-dir ./claude --copilot-dir ./copilot --gemini-dir ./gemini
```

## Command Line Options

### `setup`
```bash
Options:
  --dry-run  Preview changes without applying them
  --config   Path to a custom configuration file
  --help     Show help
```

### `convert`
```bash
Options:
  --source       Source directory for YAML command files (defaults to bundled commands)
  --claude-dir   Output directory for Claude Code commands (default: ./.claude/commands)
  --copilot-dir  Output directory for GitHub Copilot prompts (default: ./.github/prompts)
  --gemini-dir   Output directory for Gemini CLI commands (default: ./.gemini/commands)
  --dry-run      Show what would be done without making changes
  --help         Show help
```

## YAML Command Format

Create your commands using this universal YAML format:

```yaml
name: commit
description: Create a git commit with a descriptive message
prompt: |
  Create a git commit with the following message: $ARGUMENTS

  First, run git status to see what files are staged, then create the commit.
arguments: "[message]"
tools:
  - "Bash(git add:*)"
  - "Bash(git commit:*)"
model: "claude-3-sonnet"  # optional
```

## Subfolder Organization

Commands in subfolders are handled differently per platform during conversion:

```
commands/
├── commit.yaml
└── git/
    └── advanced-commit.yaml
```

**Conversion Results:**
- **Claude**: `commit.md`, `git/advanced-commit.md`
- **Copilot**: `commit.prompt.md`, `git_advanced-commit.prompt.md`
- **Gemini**: `commit.toml`, `git/advanced-commit.toml`

## Platform Formats

### Claude Code (.md)
```markdown
---
allowed-tools: Bash(git add:*), Bash(git commit:*)
argument-hint: [message]
description: Create a git commit with a descriptive message
---

Create a git commit with the following message: $ARGUMENTS
```

### GitHub Copilot (.prompt.md)
```markdown
---
mode: 'agent'
tools: ['terminal', 'terminal']
description: 'Create a git commit with a descriptive message'
---

Create a git commit with the following message: ${args}
```

### Gemini CLI (.toml)
```toml
description = "Create a git commit with a descriptive message"

prompt = """
Create a git commit with the following message: {{args}}
"""
```

## Bundled Commands

The toolkit includes pre-built commands for various development tasks, such as code review, project specification, and implementation guidance.

Run `ait convert --dry-run` to see a list of all available bundled commands.

## License

MIT © Quy Doan