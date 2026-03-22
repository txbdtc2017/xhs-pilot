import { spawn } from 'node:child_process';

const DEFAULT_PORT = '17789';

export type NextCommand = 'dev' | 'start';

export interface NextLaunchConfig {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export function createNextLaunchConfig(
  nextCommand: NextCommand,
  env: NodeJS.ProcessEnv = process.env,
): NextLaunchConfig {
  return {
    command: 'next',
    args: [nextCommand],
    env: {
      ...env,
      PORT: env.PORT?.trim() || DEFAULT_PORT,
    },
  };
}

function isNextCommand(value?: string): value is NextCommand {
  return value === 'dev' || value === 'start';
}

function run(): void {
  const nextCommand = process.argv[2];

  if (!isNextCommand(nextCommand)) {
    throw new Error('run-next.ts expects either "dev" or "start" as the first argument.');
  }

  const config = createNextLaunchConfig(nextCommand);
  const child = spawn(config.command, config.args, {
    stdio: 'inherit',
    env: config.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

if (require.main === module) {
  run();
}
