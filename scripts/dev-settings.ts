// Local preview networking must not inherit Railway hosting/cookie settings.
// Database/provider settings remain exactly as resolved from the project config.
export function developmentEnv(source: NodeJS.ProcessEnv, accounts: boolean) {
  const env: NodeJS.ProcessEnv = {
    ...source,
    RENOVAGENT_HOST: '127.0.0.1',
    PORT: '4000',
    RENOVAGENT_PORT: '4000',
    RENOVAGENT_MCP_PORT: '4010',
  };
  for (const name of [
    'RENOVAGENT_PUBLIC_URL',
    'RENOVAGENT_STATIC_DIR',
    'RENOVAGENT_MCP_PUBLIC_URL',
  ])
    delete env[name];
  if (!accounts)
    for (const name of [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_CALLBACK_URL',
      'META_APP_ID',
      'META_APP_SECRET',
      'META_REDIRECT_URI',
    ])
      delete env[name];
  return env;
}
