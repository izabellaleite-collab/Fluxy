// Cria (ou atualiza) as tabelas do Fluxy no PostgreSQL.
// Uso:
//   node backend/database/migrate.js          -> so cria o schema
//   node backend/database/migrate.js --seed    -> schema + dados de exemplo

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { DATABASE_URL } = require('../src/config');

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const schemaPath = path.join(__dirname, 'schema.sql');
  const seedPath = path.join(__dirname, 'seed.sql');

  console.log('[Fluxy] conectando em', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

  try {
    console.log('[Fluxy] aplicando schema.sql...');
    await pool.query(fs.readFileSync(schemaPath, 'utf8'));
    console.log('[Fluxy] schema pronto.');

    if (process.argv.includes('--seed')) {
      console.log('[Fluxy] inserindo dados de exemplo...');
      await pool.query(fs.readFileSync(seedPath, 'utf8'));
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
