/**
 * ─────────────────────────────────────────────────────────────
 * BANCO DE DADOS HÍBRIDO (SUPABASE AO VIVO + CACHE LOCAL OFFLINE)
 * ─────────────────────────────────────────────────────────────
 */
const DB_KEY = 'church_ranking_db_v10';
const USER_KEY = 'church_ranking_last_user_v10';

const SUPABASE_CONFIG = {
  url: 'https://akqckxynvvavroiwijxo.supabase.co',
  anonKey: 'sb_publishable_TKCbyuzHCtNvtgWzNXlnwQ_XgLegHFn'
};

let supabaseClient = null;
const pendingCloudWrites = new Map();

/**
 * Normaliza nome para geração determinística de IDs por (data, adolescente).
 */
function slugifyName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'teen';
}

/**
 * Gera objeto descritivo padrão para registros históricos sem checklist individual.
 */
function buildHistoricAnswers(total) {
  const pts = Number(total || 0);
  return [{
    escolha: 'HISTORICO',
    item: 'Registro histórico consolidado',
    pontos: pts,
    choice: 'historic',
    text: 'Registro histórico consolidado',
    value: pts
  }];
}

/**
 * Extrai o código de auditoria embutido em answers ou em campo explícito.
 */
function extractAuditCode(answers, fallbackAuditCode = '') {
  if (fallbackAuditCode) return String(fallbackAuditCode).trim();
  if (!Array.isArray(answers)) return '';
  const found = answers.find(a => a && (a.audit_code || a.auditCode));
  return found ? String(found.audit_code || found.auditCode).trim() : '';
}

/**
 * Extrai flag de confirmação no WhatsApp embutida em answers ou em campo explícito.
 */
function extractWhatsappConfirmed(answers, fallbackConfirmed) {
  if (typeof fallbackConfirmed === 'boolean') return fallbackConfirmed;
  if (!Array.isArray(answers)) return false;
  return answers.some(a => a && (a.whatsapp_confirmed === true || a.whatsappConfirmed === true));
}

/**
 * Formata e ordena answers para persistência no Supabase/cache:
 * - Itens marcados ("yes") vêm PRIMEIRO, com campos claros em português
 * - Itens não marcados ("no") vêm em seguida, preservando todas as perguntas
 * - Metadados (audit_code, whatsapp_confirmed) ficam embutidos no JSONB
 */
function formatAnswersForStorage(answers, auditCode = '', whatsappConfirmed) {
  if (!Array.isArray(answers) || answers.length === 0) return [];

  const resolvedAuditCode = extractAuditCode(answers, auditCode);
  const resolvedWaConfirmed = typeof whatsappConfirmed === 'boolean'
    ? whatsappConfirmed
    : extractWhatsappConfirmed(answers);

  const hasDetailedChoice = answers.some(a => a && (a.choice === 'yes' || a.choice === 'no'));
  if (!hasDetailedChoice) {
    return answers.map(a => {
      const pts = Number((a && (a.pontos ?? a.value)) || 0);
      const label = (a && (a.item || a.text)) || 'Registro histórico consolidado';
      return {
        escolha: (a && a.escolha) || 'HISTORICO',
        item: label,
        pontos: pts,
        choice: (a && a.choice) || 'historic',
        text: (a && a.text) || label,
        value: Number((a && (a.value ?? a.pontos)) ?? pts),
        ...(resolvedAuditCode ? { audit_code: resolvedAuditCode } : {}),
        ...(resolvedWaConfirmed ? { whatsapp_confirmed: true } : {})
      };
    });
  }

  const normalized = answers.map((a, pos) => {
    const choice = a && a.choice === 'yes' ? 'yes' : 'no';
    const text = (a && (a.text || a.item)) || '';
    const value = Number((a && (a.value ?? a.pontos)) || 0);
    const category = (a && (a.category || a.categoria)) || '';
    const index = (a && typeof a.index === 'number') ? a.index : pos;
    return { choice, text, value, category, index };
  });

  const yesItems = normalized
    .filter(a => a.choice === 'yes')
    .sort((a, b) => a.index - b.index);
  const noItems = normalized
    .filter(a => a.choice !== 'yes')
    .sort((a, b) => a.index - b.index);

  const formattedYes = yesItems.map(a => ({
    escolha: 'SIM',
    item: a.text,
    pontos: a.value,
    categoria: a.category,
    index: a.index,
    choice: 'yes',
    text: a.text,
    value: a.value,
    category: a.category,
    ...(resolvedAuditCode ? { audit_code: resolvedAuditCode } : {}),
    ...(resolvedWaConfirmed ? { whatsapp_confirmed: true } : {})
  }));

  const attachMetaToFirstNo = formattedYes.length === 0;
  const formattedNo = noItems.map((a, idx) => ({
    escolha: 'NÃO',
    item: a.text,
    pontos: 0,
    categoria: a.category,
    index: a.index,
    choice: 'no',
    text: a.text,
    value: a.value,
    category: a.category,
    ...(attachMetaToFirstNo && idx === 0 && resolvedAuditCode ? { audit_code: resolvedAuditCode } : {}),
    ...(attachMetaToFirstNo && idx === 0 && resolvedWaConfirmed ? { whatsapp_confirmed: true } : {})
  }));

  return [...formattedYes, ...formattedNo];
}

/**
 * Identifica registros compartilhados do portal administrativo (prefixo `portal_`),
 * que devem permanecer estritamente isolados do ranking dos adolescentes.
 */
function isPortalRecord(item) {
  return Boolean(item && String(item.id || '').startsWith('portal_'));
}

/**
 * Normaliza um registro (local ou vindo da nuvem) com metadados consistentes.
 */
function normalizeRecord(rec) {
  if (!rec || typeof rec !== 'object' || isPortalRecord(rec)) return null;
  const rawAnswers = Array.isArray(rec.answers) ? rec.answers : [];
  const auditCode = extractAuditCode(rawAnswers, rec.auditCode);
  const whatsappConfirmed = extractWhatsappConfirmed(rawAnswers, rec.whatsappConfirmed);
  const isHistoricEmpty = rawAnswers.length === 0 && /^(rec|base)_/i.test(String(rec.id || ''));

  const answers = isHistoricEmpty
    ? buildHistoricAnswers(rec.total)
    : (rawAnswers.length > 0 ? formatAnswersForStorage(rawAnswers, auditCode, whatsappConfirmed) : []);

  const submittedAt = rec.submittedAt || rec.submitted_at || (rec.date ? `${rec.date}T12:00:00.000Z` : '');

  const normalized = {
    ...rec,
    name: (rec.name || '').trim(),
    total: Number(rec.total || 0),
    answers,
    ...(submittedAt ? { submittedAt, submitted_at: rec.submitted_at || submittedAt } : {}),
    ...(auditCode ? { auditCode } : {}),
    ...(whatsappConfirmed ? { whatsappConfirmed: true } : {})
  };
  if (!whatsappConfirmed) delete normalized.whatsappConfirmed;
  return normalized;
}

function getRecordRichnessRank(rec) {
  const answers = Array.isArray(rec && rec.answers) ? rec.answers : [];
  if (answers.some(a => a && (a.choice === 'yes' || a.choice === 'no'))) return 2;
  if (answers.length > 0) return 1;
  return 0;
}

function getRecordTimestamp(rec) {
  const raw = rec && (rec.submitted_at || rec.submittedAt || '');
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function isBetterRecord(candidate, current) {
  const candRank = getRecordRichnessRank(candidate);
  const currRank = getRecordRichnessRank(current);
  if (candRank !== currRank) return candRank > currRank;

  const candWa = Boolean(candidate && candidate.whatsappConfirmed);
  const currWa = Boolean(current && current.whatsappConfirmed);
  if (candWa !== currWa) return candWa;

  const candTs = getRecordTimestamp(candidate);
  const currTs = getRecordTimestamp(current);
  if (candTs !== currTs) return candTs > currTs;

  const candAnsLen = Array.isArray(candidate && candidate.answers) ? candidate.answers.length : 0;
  const currAnsLen = Array.isArray(current && current.answers) ? current.answers.length : 0;
  return candAnsLen > currAnsLen;
}

/**
 * Deduplica registros por (nome normalizado, data) mantendo o mais completo/recente.
 */
function deduplicateRecords(records) {
  if (!Array.isArray(records)) return [];
  const byKey = new Map();

  records.forEach((raw, idx) => {
    if (!raw || isPortalRecord(raw)) return;
    const rec = normalizeRecord(raw);
    if (!rec) return;
    const cleanName = (rec.name || '').trim().toLowerCase();
    const key = (cleanName && rec.date)
      ? `${cleanName}|${rec.date}`
      : `id:${rec.id || idx}`;

    const existing = byKey.get(key);
    if (!existing || isBetterRecord(rec, existing)) {
      byKey.set(key, rec);
    }
  });

  return Array.from(byKey.values()).sort((a, b) => {
    const dateDiff = (b.date || '').localeCompare(a.date || '');
    if (dateDiff !== 0) return dateDiff;
    return getRecordTimestamp(b) - getRecordTimestamp(a);
  });
}

const TeenDB = {
  getAll() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        const seeded = OFFICIAL_SEED_RECORDS.map(normalizeRecord).filter(Boolean);
        localStorage.setItem(DB_KEY, JSON.stringify(seeded));
        return seeded;
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? deduplicateRecords(parsed.filter(item => !isPortalRecord(item)))
        : OFFICIAL_SEED_RECORDS.map(normalizeRecord).filter(Boolean);
    } catch (e) {
      console.error(e);
      return OFFICIAL_SEED_RECORDS.map(normalizeRecord).filter(Boolean);
    }
  },
  save(entry) {
    const list = this.getAll();
    const entryDate = entry.date;
    const cleanName = (entry.name || '').trim();
    const entryNameLower = cleanName.toLowerCase();

    // Se já houver registro deste adolescente na mesma data, preserva o ID original
    const existingIndex = list.findIndex(item =>
      item.date === entryDate && (item.name || '').trim().toLowerCase() === entryNameLower
    );

    const existingRecord = existingIndex >= 0 ? list[existingIndex] : null;
    const deterministicId = (entryDate && cleanName)
      ? `sub_${entryDate}_${slugifyName(cleanName)}`
      : (entry.id || `sub_${Date.now()}`);

    const resolvedId = (existingRecord && existingRecord.id)
      ? existingRecord.id
      : (entry.id && !/^sub_\d+$/.test(String(entry.id)) ? entry.id : deterministicId);

    const resolvedAuditCode = entry.auditCode || (existingRecord && existingRecord.auditCode) || '';
    const resolvedWaConfirmed = Boolean(entry.whatsappConfirmed);
    const formattedAnswers = formatAnswersForStorage(
      entry.answers || [],
      resolvedAuditCode,
      resolvedWaConfirmed
    );
    const submittedAt = entry.submittedAt || entry.submitted_at || new Date().toISOString();

    const finalRecord = {
      ...(existingRecord || {}),
      ...entry,
      id: resolvedId,
      name: cleanName || entry.name,
      date: entryDate,
      total: Number(entry.total || 0),
      answers: formattedAnswers,
      submittedAt,
      submitted_at: submittedAt
    };

    if (resolvedAuditCode) {
      finalRecord.auditCode = resolvedAuditCode;
    } else {
      delete finalRecord.auditCode;
    }

    if (resolvedWaConfirmed) {
      finalRecord.whatsappConfirmed = true;
    } else {
      delete finalRecord.whatsappConfirmed;
    }

    if (existingIndex >= 0) {
      list[existingIndex] = finalRecord;
    } else {
      list.unshift(finalRecord);
    }

    const dedupedList = deduplicateRecords(list);
    localStorage.setItem(DB_KEY, JSON.stringify(dedupedList));
    localStorage.setItem(USER_KEY, JSON.stringify({ name: finalRecord.name }));

    // Sincroniza o registro final (ID preservado + answers priorizadas) com o Supabase
    const cloudPromise = this.saveToCloud(finalRecord).catch(err => {
      console.warn('Supabase sync background notice:', err);
      return false;
    });

    return {
      list: dedupedList,
      savedRecord: finalRecord,
      cloudPromise
    };
  },
  confirmWhatsapp(recordOrId) {
    const targetId = typeof recordOrId === 'string' ? recordOrId : (recordOrId && recordOrId.id);
    if (!targetId) return Promise.resolve(false);

    const list = this.getAll();
    const idx = list.findIndex(item => item.id === targetId);
    if (idx < 0) return Promise.resolve(false);

    const current = list[idx];
    const updated = {
      ...current,
      whatsappConfirmed: true,
      answers: formatAnswersForStorage(current.answers || [], current.auditCode, true)
    };
    list[idx] = updated;
    localStorage.setItem(DB_KEY, JSON.stringify(list));

    return this.saveToCloud(updated).catch(err => {
      console.warn('Supabase WhatsApp confirm sync notice:', err);
      return false;
    });
  },
  async fetchFromCloud() {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/teen_scores?select=*&id=not.like.portal_*&order=date.desc,submitted_at.desc`, {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      });
      if (res.ok) {
        const cloudData = await res.json();
        const filteredCloud = Array.isArray(cloudData)
          ? cloudData.filter(item => !isPortalRecord(item))
          : [];
        if (filteredCloud.length > 0) {
          const deduped = deduplicateRecords(filteredCloud);
          localStorage.setItem(DB_KEY, JSON.stringify(deduped));
          this.updateSyncBadge('online');
          return deduped;
        }
      }
    } catch (e) {
      console.warn('Supabase offline / fallback ativo:', e.message);
    }
    this.updateSyncBadge('local');
    return this.getAll();
  },
  saveToCloud(entry) {
    const id = entry && entry.id ? String(entry.id) : '';
    const prev = id ? (pendingCloudWrites.get(id) || Promise.resolve()) : Promise.resolve();
    const run = prev.catch(() => {}).then(() => this._postToCloud(entry));

    if (id) {
      pendingCloudWrites.set(id, run);
      run.finally(() => {
        if (pendingCloudWrites.get(id) === run) {
          pendingCloudWrites.delete(id);
        }
      });
    }

    return run;
  },
  async _postToCloud(entry) {
    try {
      const rawAnswers = Array.isArray(entry.answers) ? entry.answers : [];
      const isHistoricEmpty = rawAnswers.length === 0 && /^(rec|base)_/i.test(String(entry.id || ''));
      const answers = isHistoricEmpty
        ? buildHistoricAnswers(entry.total)
        : formatAnswersForStorage(rawAnswers, entry.auditCode, entry.whatsappConfirmed);

      // Payload estritamente alinhado às 6 colunas da tabela teen_scores no PostgREST
      const payload = {
        id: entry.id,
        name: (entry.name || '').trim(),
        date: entry.date,
        total: Number(entry.total || 0),
        answers,
        submitted_at: entry.submittedAt || entry.submitted_at || new Date().toISOString()
      };

      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/teen_scores`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        this.updateSyncBadge('online');
        return true;
      }
      console.warn('Supabase saveToCloud HTTP error:', res.status, await res.text());
    } catch (e) {
      console.warn('Erro ao sincronizar com Supabase:', e);
    }
    this.updateSyncBadge('local');
    return false;
  },
  updateSyncBadge(status) {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('cloudSyncBadge');
    if (!badge) return;
    if (status === 'online') {
      badge.innerHTML = '<span class="cloud-dot online"></span> Nuvem Ao Vivo';
      badge.title = 'Conectado ao Supabase em tempo real';
    } else {
      badge.innerHTML = '<span class="cloud-dot local"></span> Sincronizado Local';
      badge.title = 'Armazenamento local ativo';
    }
  },
  initRealtime() {
    const setup = () => {
      if (typeof window !== 'undefined' && window.supabase && !supabaseClient) {
        try {
          supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
          supabaseClient
            .channel('public:teen_scores')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teen_scores' }, async (payload) => {
              if (payload && (isPortalRecord(payload.new) || isPortalRecord(payload.old))) {
                return;
              }
              console.log('⚡ Atualização em tempo real recebida do Supabase!');
              await TeenDB.fetchFromCloud();
              if (typeof renderRanking === 'function') renderRanking();
            })
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                TeenDB.updateSyncBadge('online');
              }
            });
        } catch (e) {
          console.warn('Realtime client init notice:', e);
        }
      }
    };

    if (typeof window === 'undefined') return;
    if (window.supabase) {
      setup();
    } else {
      window.addEventListener('load', setup);
    }
  },
  getLastUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : { name: '' };
    } catch {
      return { name: '' };
    }
  },
  clear() {
    localStorage.removeItem(DB_KEY);
  },
  resetToOfficial() {
    const seeded = OFFICIAL_SEED_RECORDS.map(normalizeRecord).filter(Boolean);
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
    return seeded;
  },
  getLeaderboard() {
    const all = deduplicateRecords(this.getAll().filter(item => !isPortalRecord(item)));
    const grouped = {};

    // Inicializa todos os adolescentes cadastrados com 0 pontos e 0 lançamentos
    if (typeof REGISTERED_TEENS !== 'undefined' && Array.isArray(REGISTERED_TEENS)) {
      REGISTERED_TEENS.forEach(teen => {
        const clean = (teen.name || '').trim();
        if (clean) {
          grouped[clean.toLowerCase()] = {
            name: clean,
            totalPoints: 0,
            count: 0,
            lastDate: ''
          };
        }
      });
    }

    all.forEach(sub => {
      if (!sub || isPortalRecord(sub)) return;
      const cleanName = (sub.name || '').trim();
      if (!cleanName) return;
      const key = cleanName.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          name: cleanName,
          totalPoints: 0,
          count: 0,
          lastDate: sub.date || ''
        };
      }
      grouped[key].totalPoints += Number(sub.total || 0);
      grouped[key].count += 1;
      if (sub.date && sub.date > grouped[key].lastDate) {
        grouped[key].lastDate = sub.date;
      }
    });

    return Object.values(grouped).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }
};

function buildCSVContent(records, formatDateFn) {
  const fmtDate = formatDateFn || (typeof formatDateBR === 'function' ? formatDateBR : (d => d || ''));
  let csv = 'Data;Nome;Pontos Cumpridos;Qtd Itens;Código Auditoria;Itens Cumpridos\n';
  const sorted = deduplicateRecords(records);

  sorted.forEach(sub => {
    const fDate = fmtDate(sub.date);
    const answers = Array.isArray(sub.answers) ? sub.answers : [];
    const yesItems = answers.filter(a => a && a.choice === 'yes');
    const isHistoric = yesItems.length === 0 && answers.some(a => a && a.choice === 'historic');

    const cumpridos = yesItems.length > 0
      ? yesItems.map(a => `${a.text || a.item} (+${Number(a.value ?? a.pontos ?? 0)})`).join(' | ')
      : (isHistoric ? 'Registro histórico consolidado' : '');

    const auditCode = extractAuditCode(answers, sub.auditCode);
    const safeDate = String(fDate || '').replace(/"/g, '""');
    const safeName = String(sub.name || '').replace(/"/g, '""');
    const safeAudit = String(auditCode || '').replace(/"/g, '""');
    const safeCumpridos = String(cumpridos || '').replace(/"/g, '""');

    csv += `"${safeDate}";"${safeName}";${Number(sub.total || 0)};${yesItems.length};"${safeAudit}";"${safeCumpridos}"\n`;
  });

  return csv;
}

function exportCSV() {
  const all = deduplicateRecords(TeenDB.getAll());
  if (!all.length) {
    alert('Nenhum dado registrado para exportar.');
    return;
  }

  const csv = buildCSVContent(all);
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ranking_escola_sabatina_${getLocalDateISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPABASE_CONFIG,
    TeenDB,
    slugifyName,
    buildHistoricAnswers,
    extractAuditCode,
    extractWhatsappConfirmed,
    formatAnswersForStorage,
    isPortalRecord,
    normalizeRecord,
    deduplicateRecords,
    buildCSVContent,
    exportCSV
  };
}
