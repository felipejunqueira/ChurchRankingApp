/**
 * ─────────────────────────────────────────────────────────────
 * BANCO DE DADOS LOCAL (STORAGE) & EXPORTAÇÃO
 * ─────────────────────────────────────────────────────────────
 */
const DB_KEY = 'church_ranking_db_v7';
const USER_KEY = 'church_ranking_last_user_v7';

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
    list.unshift(entry);
    localStorage.setItem(DB_KEY, JSON.stringify(list));
    localStorage.setItem(USER_KEY, JSON.stringify({ name: entry.name }));
    return list;
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
      const cleanName = sub.name.trim();
      const key = cleanName.toLowerCase();
      if (!grouped[key]) {
        grouped[key] = {
          name: cleanName,
          totalPoints: 0,
          count: 0,
          lastDate: sub.date
        };
      }
      grouped[key].totalPoints += Number(sub.total);
      grouped[key].count += 1;
      if (sub.date > grouped[key].lastDate) {
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
    const fDate = sub.date ? sub.date.split('-').reverse().join('/') : '';
    const cumpridos = (sub.answers || [])
      .filter(a => a.choice === 'yes')
      .map(a => `${a.text} (+${a.value})`)
      .join(' | ');
    csv += `"${fDate}";"${sub.name}";${sub.total};"${cumpridos}"\n`;
  });

  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ranking_escola_sabatina_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function confirmClearHistory() {
  if (confirm('Deseja restaurar o ranking para a pontuação oficial atualizada deste sábado?\n\n(OK = Restaurar placar oficial com Jonas, Luiza, Isac, Vítor...)')) {
    TeenDB.resetToOfficial();
    renderRanking();
    alert('Ranking restaurado com sucesso para a pontuação oficial!');
  }
}
