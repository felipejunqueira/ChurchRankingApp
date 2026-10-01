/**
 * ─────────────────────────────────────────────────────────────
 * BANCO DE DADOS HÍBRIDO (SUPABASE AO VIVO + CACHE LOCAL OFFLINE)
 * ─────────────────────────────────────────────────────────────
 */
const DB_KEY = 'church_ranking_db_v9';
const USER_KEY = 'church_ranking_last_user_v9';

const SUPABASE_CONFIG = {
  url: 'https://akqckxynvvavroiwijxo.supabase.co',
  anonKey: 'sb_publishable_TKCbyuzHCtNvtgWzNXlnwQ_XgLegHFn'
};

let supabaseClient = null;

const TeenDB = {
  getAll() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        localStorage.setItem(DB_KEY, JSON.stringify(OFFICIAL_SEED_RECORDS));
        return [...OFFICIAL_SEED_RECORDS];
      }
      return JSON.parse(raw);
    } catch (e) {
      console.error(e);
      return [...OFFICIAL_SEED_RECORDS];
    }
  },
  save(entry) {
    const list = this.getAll();
    const entryDate = entry.date;
    const entryName = (entry.name || '').trim().toLowerCase();

    // Se já houver registro deste adolescente na mesma data, atualiza com os novos dados
    const existingIndex = list.findIndex(item => 
      item.date === entryDate && (item.name || '').trim().toLowerCase() === entryName
    );

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...entry,
        id: list[existingIndex].id // Preserva ID original
      };
    } else {
      list.unshift(entry);
    }

    localStorage.setItem(DB_KEY, JSON.stringify(list));
    localStorage.setItem(USER_KEY, JSON.stringify({ name: entry.name }));

    // Sincroniza em segundo plano com a Nuvem Supabase
    this.saveToCloud(entry).catch(err => console.warn('Supabase sync background notice:', err));

    return list;
  },
  async fetchFromCloud() {
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/teen_scores?select=*&order=date.desc`, {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      });
      if (res.ok) {
        const cloudData = await res.json();
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          localStorage.setItem(DB_KEY, JSON.stringify(cloudData));
          this.updateSyncBadge('online');
          return cloudData;
        }
      }
    } catch (e) {
      console.warn('Supabase offline / fallback ativo:', e.message);
    }
    this.updateSyncBadge('local');
    return this.getAll();
  },
  async saveToCloud(entry) {
    try {
      const payload = {
        id: entry.id,
        name: entry.name,
        date: entry.date,
        total: entry.total,
        answers: entry.answers || [],
        submitted_at: entry.submittedAt || new Date().toISOString()
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
    } catch (e) {
      console.warn('Erro ao sincronizar com Supabase:', e);
    }
    return false;
  },
  updateSyncBadge(status) {
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
      if (window.supabase && !supabaseClient) {
        try {
          supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
          supabaseClient
            .channel('public:teen_scores')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teen_scores' }, async () => {
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
    localStorage.setItem(DB_KEY, JSON.stringify(OFFICIAL_SEED_RECORDS));
  },
  getLeaderboard() {
    const all = this.getAll();
    const grouped = {};
    all.forEach(sub => {
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
    return Object.values(grouped).sort((a, b) => b.totalPoints - a.totalPoints);
  }
};

function exportCSV() {
  const all = TeenDB.getAll();
  if (!all.length) {
    alert('Nenhum dado registrado para exportar.');
    return;
  }

  let csv = 'Data;Nome;Pontos Cumpridos;Itens Cumpridos\n';
  const sorted = [...all].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  sorted.forEach(sub => {
    const fDate = formatDateBR(sub.date);
    const cumpridos = (sub.answers || [])
      .filter(a => a.choice === 'yes')
      .map(a => `${a.text} (+${a.value})`)
    const safeName = (sub.name || '').replace(/"/g, '""');
    const safeCumpridos = cumpridos.replace(/"/g, '""');
    csv += `"${fDate}";"${safeName}";${Number(sub.total || 0)};"${safeCumpridos}"\n`;
  });

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
