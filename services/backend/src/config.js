const fs = require('node:fs');
const path = require('node:path');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const CA_BUNDLE = path.join(__dirname, '..', 'certs', 'rds-global-bundle.pem');

// On AWS, DB_SECRET_NAME is set and the username and password come from
// Secrets Manager. The instance role supplies temporary credentials.
// On a laptop, DB_SECRET_NAME is unset and the other variables are used.
async function loadDbConfig(env = process.env, secretsClient = null) {
  let secret = {};
  if (env.DB_SECRET_NAME) {
    const client = secretsClient || new SecretsManagerClient({ region: env.AWS_REGION });
    const result = await client.send(new GetSecretValueCommand({ SecretId: env.DB_SECRET_NAME }));
    secret = JSON.parse(result.SecretString);
  }

  const config = {
    host: secret.host || env.DB_HOST,
    port: Number(secret.port || env.DB_PORT || 5432),
    database: secret.dbname || env.DB_NAME,
    user: secret.username || env.DB_USER,
    password: secret.password || env.DB_PASSWORD,
  };

  const missing = ['host', 'database', 'user', 'password'].filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing database settings: ${missing.join(', ')}`);
  }

  if (env.DB_SSL === 'true') {
    config.ssl = { ca: fs.readFileSync(CA_BUNDLE, 'utf8') };
  }

  return config;
}

module.exports = { loadDbConfig };
