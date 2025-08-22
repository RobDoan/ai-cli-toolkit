# Command Converter

Universal command converter for Claude Code, GitHub Copilot, and Gemini CLI slash commands.

## Features

- 🔄 **Universal Format**: Write commands once in YAML, convert to all platforms
- 📁 **Subfolder Support**: Organize commands in folders with intelligent handling
- 🎯 **Platform-Specific**: Each platform gets optimized format and structure
- 📦 **Bundled Commands**: Ships with pre-built commands ready to use
- 🔍 **Dry Run**: Preview conversions before executing
- ⚙️ **Flexible**: Customizable source and target directories

## Supported Platforms

| Platform | Format | Structure |
|----------|--------|-----------|
| **Claude Code** | `.md` | Preserves subfolders |
| **GitHub Copilot** | `.prompt.md` | Prefix naming (e.g., `kiro_commit.prompt.md`) |
| **Gemini CLI** | `.toml` | Preserves subfolders |

## Installation

```bash
npm install -g @quydoan/command-converter
```

## Usage

### Basic Usage

```bash
# Convert bundled commands
convert-commands

# Preview what will be converted
convert-commands --dry-run

# Use custom source directory
convert-commands --source ./my-commands

# Custom output directories
convert-commands --claude ./claude-output --copilot ./copilot-output --gemini ./gemini-output
```

### Command Line Options

```bash
Options:
  -s, --source   Source directory containing YAML command files (defaults to bundled)
  -c, --claude   Output directory for Claude Code commands (default: ./.claude/commands)
  -p, --copilot  Output directory for GitHub Copilot prompts (default: ./.github/prompts)
  -g, --gemini   Output directory for Gemini CLI commands (default: ./.gemini/commands)
  -d, --dry-run  Show what would be done without making changes
  -h, --help     Show help
```

## YAML Command Format

Create commands using this universal YAML format:

```yaml
name: commit
description: Create a git commit with a descriptive message
prompt: |
  Create a git commit with the following message: $ARGUMENTS

  First run git status to see what files are staged, then create the commit.
arguments: "[message]"
tools:
  - "Bash(git add:*)"
  - "Bash(git commit:*)"
model: "claude-3-sonnet"  # optional
```

## Subfolder Organization

Commands in subfolders are handled differently per platform:

```
commands/
├── commit.yaml
└── git/
    └── advanced-commit.yaml
```

**Results:**
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

The package includes pre-built commands for common development tasks:

- Code review and analysis
- Project requirements and specifications
- Implementation guidance
- And more...

Run `convert-commands --dry-run` to see all available bundled commands.

## License

MIT © Quy Doan