const { loadDbConfig } = require('../src/config');

const localEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'tasks',
  DB_USER: 'app',
  DB_PASSWORD: 'local-only',
};

describe('loadDbConfig', () => {
  test('reads settings from environment variables on a laptop', async () => {
    const config = await loadDbConfig(localEnv);

    expect(config).toEqual({
      host: 'localhost',
      port: 5432,
      database: 'tasks',
      user: 'app',
      password: 'local-only',
    });
  });

  test('reads the username and password from Secrets Manager on AWS', async () => {
    const fakeClient = {
      send: jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ username: 'dbadmin', password: 'from-secret' }),
      }),
    };
    const env = {
      DB_SECRET_NAME: 'devops-app/db',
      DB_HOST: 'db.internal',
      DB_NAME: 'tasks',
      AWS_REGION: 'us-east-1',
    };

    const config = await loadDbConfig(env, fakeClient);

    expect(fakeClient.send).toHaveBeenCalledTimes(1);
    expect(config.user).toBe('dbadmin');
    expect(config.password).toBe('from-secret');
    expect(config.host).toBe('db.internal');
    expect(config.database).toBe('tasks');
  });

  test('fails with a clear message when settings are missing', async () => {
    await expect(loadDbConfig({ DB_HOST: 'localhost' })).rejects.toThrow(
      'Missing database settings: database, user, password',
    );
  });

  test('turns on SSL with the RDS certificate bundle when DB_SSL is true', async () => {
    const config = await loadDbConfig({ ...localEnv, DB_SSL: 'true' });
    expect(config.ssl.ca).toContain('BEGIN CERTIFICATE');
  });
});
