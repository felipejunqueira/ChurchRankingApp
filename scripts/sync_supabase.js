/**
 * Script de Sincronização, Auditoria e Migração para o Supabase
 */
const fs = require('fs');
const path = require('path');
const {
  SUPABASE_CONFIG,
  formatAnswersForStorage,
  buildHistoricAnswers,
  extractAuditCode,
  extractWhatsappConfirmed,
  isDetailedAnswer,
  isYesAnswer,
  isNoAnswer,
  isPortalRecord
} = require('../js/db');

const ROOT_DIR = path.resolve(__dirname, '..');

// Carregar variáveis de .env se existir
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
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

const cliArgs = process.argv.slice(2);
const cliFlags = new Set(cliArgs.filter(a => a.startsWith('--')));
const cliKey = cliArgs.find(a => !a.startsWith('--'));

const SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_CONFIG.url;
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  cliKey ||
  SUPABASE_CONFIG.anonKey;

function loadOfficialSeedRecords() {
  const dataPath = path.join(ROOT_DIR, 'js', 'data.js');
  const dataCode = fs.readFileSync(dataPath, 'utf8');
  const scope = {};
  new Function('scope', `${dataCode}; scope.OFFICIAL_SEED_RECORDS = OFFICIAL_SEED_RECORDS;`)(scope);

  return scope.OFFICIAL_SEED_RECORDS.map(r => ({
    id: r.id,
    name: r.name,
    date: r.date,
    total: r.total,
    answers: (Array.isArray(r.answers) && r.answers.length > 0)
      ? formatAnswersForStorage(r.answers, r.auditCode, r.whatsappConfirmed)
      : buildHistoricAnswers(r.total),
    submitted_at: new Date(`${r.date}T12:00:00Z`).toISOString()
  }));
}

function buildHeaders(apiKey, extra = {}) {
  return {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    ...extra
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function auditCloudRows(apiKey = SUPABASE_KEY) {
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/teen_scores?select=*&order=date.desc,submitted_at.desc`, {
    method: 'GET',
    headers: buildHeaders(apiKey)
  });

  if (!getRes.ok) {
    const errText = await getRes.text();
    console.error('Erro ao auditar registros:', getRes.status, errText);
    return { ok: false, status: getRes.status, body: errText };
  }

  const rows = await getRes.json();
  const teenRows = rows.filter(r => !isPortalRecord(r));
  const portalRows = rows.filter(isPortalRecord);
  const byNameDate = new Map();
  const missingAnswers = [];

  for (const r of teenRows) {
    const ans = Array.isArray(r.answers) ? r.answers : [];
    if (ans.length === 0) missingAnswers.push(r.id);
    const key = `${(r.name || '').trim().toLowerCase()}|${r.date}`;
    if (!byNameDate.has(key)) byNameDate.set(key, []);
    byNameDate.get(key).push(r.id);
  }

  const duplicates = Array.from(byNameDate.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));

  console.log(`Auditoria Supabase: ${teenRows.length} registros de adolescentes, ${portalRows.length} registros portal_ isolados.`);
  console.log(`Sem answers: ${missingAnswers.length}, Duplicatas (nome|data): ${duplicates.length}`);

  teenRows.slice(0, 10).forEach(r => {
    const ans = Array.isArray(r.answers) ? r.answers : [];
    const yesCount = ans.filter(isYesAnswer).length;
    const noCount = ans.filter(isNoAnswer).length;
    const audit = extractAuditCode(ans);
    const wa = extractWhatsappConfirmed(ans);
    console.log(`  - ${r.date} | ${r.name} (${r.id}) | ${r.total} pts | SIM=${yesCount}, NÃO=${noCount} | WA=${wa} | ${audit || '-'}`);
  });

  return {
    ok: true,
    totalRows: rows.length,
    teenRows: teenRows.length,
    portalRows: portalRows.length,
    missingAnswers,
    duplicates
  };
}

async function checkAndSync(apiKey = SUPABASE_KEY) {
  const records = loadOfficialSeedRecords();
  console.log(`Verificando tabela 'teen_scores' no Supabase (${records.length} registros oficiais)...`);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/teen_scores?select=count`, {
      method: 'GET',
      headers: buildHeaders(apiKey, {
        'Range-Unit': 'items',
        'Range': '0-0',
        'Prefer': 'count=exact'
      })
    });

    if (res.status === 404 || !res.ok) {
      const err = await res.text();
      console.log('Erro ao acessar tabela no Supabase:', res.status, err);
      return false;
    }

    console.log('Tabela encontrada! Inserindo/atualizando registros oficiais enriquecidos...');
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/teen_scores`, {
      method: 'POST',
      headers: buildHeaders(apiKey, {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }),
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

async function enrichExistingCloudRows(apiKey = SUPABASE_KEY) {
  console.log('Buscando todos os registros atuais de adolescentes em teen_scores para migração/enriquecimento...');
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/teen_scores?select=*&id=not.ilike.portal_*&order=date.desc,submitted_at.desc`, {
    method: 'GET',
    headers: buildHeaders(apiKey)
  });

  if (!getRes.ok) {
    const errText = await getRes.text();
    console.error('Erro ao buscar registros:', getRes.status, errText);
    return { ok: false, status: getRes.status, body: errText };
  }

  const rows = await getRes.json();
  console.log(`Encontrados ${rows.length} registros no Supabase.`);

  let updatedSub = 0;
  let updatedHist = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isPortalRecord(row)) {
      skipped++;
      continue;
    }
    const currentAnswers = Array.isArray(row.answers) ? row.answers : [];
    const hasDetailed = currentAnswers.some(isDetailedAnswer);

    let nextAnswers;
    let kind;

    if (hasDetailed) {
      nextAnswers = formatAnswersForStorage(
        currentAnswers,
        extractAuditCode(currentAnswers),
        extractWhatsappConfirmed(currentAnswers)
      );
      kind = 'sub';
    } else if (currentAnswers.length === 0) {
      nextAnswers = buildHistoricAnswers(row.total);
      kind = 'hist';
    } else {
      nextAnswers = formatAnswersForStorage(
        currentAnswers,
        extractAuditCode(currentAnswers),
        extractWhatsappConfirmed(currentAnswers)
      );
      kind = 'hist';
    }

    if (canonicalJson(currentAnswers) === canonicalJson(nextAnswers)) {
      skipped++;
      continue;
    }

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/teen_scores?id=eq.${encodeURIComponent(row.id)}`,
      {
        method: 'PATCH',
        headers: buildHeaders(apiKey, {
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }),
        body: JSON.stringify({ answers: nextAnswers })
      }
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      console.error(`Falha ao atualizar ${row.id}:`, patchRes.status, errBody);
      return { ok: false, status: patchRes.status, body: errBody, failedId: row.id };
    }

    if (kind === 'sub') updatedSub++;
    else updatedHist++;
  }

  console.log(`Migração concluída: ${updatedSub} detalhados reordenados, ${updatedHist} históricos enriquecidos, ${skipped} já atualizados.`);
  return { ok: true, total: rows.length, updatedSub, updatedHist, skipped };
}

if (require.main === module) {
  (async () => {
    if (cliFlags.has('--audit')) {
      const result = await auditCloudRows(SUPABASE_KEY);
      if (!result.ok) process.exit(1);
    } else if (cliFlags.has('--enrich-cloud')) {
      const result = await enrichExistingCloudRows(SUPABASE_KEY);
      if (!result.ok) process.exit(1);
    } else {
      const ok = await checkAndSync(SUPABASE_KEY);
      if (!ok) process.exit(1);
    }
  })();
}

module.exports = {
  loadOfficialSeedRecords,
  auditCloudRows,
  checkAndSync,
  enrichExistingCloudRows
};
