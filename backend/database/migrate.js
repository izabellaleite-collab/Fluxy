// Cria (ou atualiza) as tabelas do Fluxy no PostgreSQL.
// Uso:
//   npm run db:migrate   -> so cria o schema
//   npm run db:seed      -> schema + dados de exemplo

const { pool } = require('../src/lib/db');
const { DATABASE_URL } = require('../src/config');
const { applySchema, applySeed } = require('./apply-schema');

async function run() {
  console.log('[Fluxy] conectando em', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  try {
    console.log('[Fluxy] aplicando schema.sql...');
    await applySchema(pool);
    console.log('[Fluxy] schema pronto.');

    if (process.argv.includes('--seed')) {
      console.log('[Fluxy] inserindo dados de exemplo...');
      await applySeed(pool);
      console.log('[Fluxy] dados de exemplo inseridos.');
    }
  } catch (error) {
    console.error('[Fluxy] falha ao configurar o banco:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
