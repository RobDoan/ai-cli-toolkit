#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';

// Import command modules
import { setupMcpCommand } from './app/setup-mcp.js';
import { convertCommandsCommand } from './app/convert-commands.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('ai-cli-toolkit')
  .usage('$0 <command> [options]')
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .demandCommand(1, 'You must specify a command')
  .strict()
  .fail((msg, err, yargs) => {
    if (err) throw err;
    console.error(chalk.red('Error:'), msg);
    console.error('\n' + yargs.help());
    process.exit(1);
  });

// Add subcommands
cli.command(setupMcpCommand);
cli.command(convertCommandsCommand);

// Parse and execute
cli.parse();