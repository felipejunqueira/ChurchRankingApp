/**
 * Script de Sincronização e Migração Inicial para o Supabase
 */
const fs = require('fs');
const path = require('path');

// Carregar variáveis de .env se existir
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://akqckxynvvavroiwijxo.supabase.co';
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || process.argv[2];

if (!SUPABASE_SECRET) {
  console.error('Erro: SUPABASE_SECRET_KEY não fornecida. Configure em .env ou passe como argumento.');
  process.exit(1);
}

// Carregar OFFICIAL_SEED_RECORDS de js/data.js
const dataCode = fs.readFileSync('js/data.js', 'utf8');
const scope = {};
new Function('scope', `${dataCode}; scope.OFFICIAL_SEED_RECORDS = OFFICIAL_SEED_RECORDS;`)(scope);

const records = scope.OFFICIAL_SEED_RECORDS.map(r => ({
  id: r.id,
  name: r.name,
  date: r.date,
  total: r.total,
  answers: r.answers || [],
  submitted_at: new Date(`${r.date}T12:00:00Z`).toISOString()
}));

async function checkAndSync() {
  console.log(`Verificando tabela 'teen_scores' no Supabase (${records.length} registros)...`);
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/teen_scores?select=count`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SECRET,
        'Authorization': `Bearer ${SUPABASE_SECRET}`,
        'Range-Unit': 'items',
        'Range': '0-0',
        'Prefer': 'count=exact'
      }
    });

    if (res.status === 404 || !res.ok) {
      const err = await res.text();
      console.log('Tabela ainda não criada no Supabase:', res.status, err);
      return false;
    }

    console.log('Tabela encontrada! Inserindo/atualizando registros oficiais...');
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/teen_scores`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SECRET,
        'Authorization': `Bearer ${SUPABASE_SECRET}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(records)
    });

    if (!insertRes.ok) {
      console.error('Erro ao sincronizar registros:', insertRes.status, await insertRes.text());
      return false;
    }

    console.log(`Sucesso! ${records.length} registros oficiais sincronizados com o Supabase.`);
    return true;
  } catch (e) {
    console.error('Erro na requisição:', e.message);
    return false;
  }
}

if (require.main === module) {
  checkAndSync();
}

module.exports = { checkAndSync };
