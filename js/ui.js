/**
 * ─────────────────────────────────────────────────────────────
 * ESTADO CENTRALIZADO & UTILITÁRIOS DE AUDITORIA / WHATSAPP
 * ─────────────────────────────────────────────────────────────
 */
const APP_PUBLIC_URL = 'https://felipejunqueira.github.io/ChurchRankingApp/';

const AppState = {
  answers: new Array(questions.length).fill(null),
  activeCategory: 'all',
  selectedTeenName: '',
  isSubmitting: false,
  showAllHistory: false,
  auditSearch: '',
  auditDate: 'all',
  expandedAuditKeys: new Set(),

  setAnswer(index, choice) {
    this.answers[index] = choice;
  },
  getAnswer(index) {
    return this.answers[index];
  },
  calculateTotal() {
    return this.answers.reduce((acc, choice, idx) => {
      return choice === 'yes' ? acc + questions[idx].value : acc;
    }, 0);
  },
  getYesCount() {
    return this.answers.filter(a => a === 'yes').length;
  },
  getAnsweredCount() {
    return this.answers.filter(a => a !== null).length;
  },
  hasAnyAnswer() {
    return this.answers.some(a => a !== null);
  },
  reset() {
    this.answers.fill(null);
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function generateAuditCode(name, dateISO, total) {
  const parts = String(dateISO || '').split('-');
  const ddmm = parts.length === 3 ? `${parts[2]}${parts[1]}` : '0000';

  const cleanName = String(name || '').trim();
  const matched = typeof REGISTERED_TEENS !== 'undefined' && Array.isArray(REGISTERED_TEENS)
    ? REGISTERED_TEENS.find(t => normalizeText(t.name) === normalizeText(cleanName))
    : null;

  let initials = matched && matched.initial ? matched.initial.toUpperCase() : '';
  if (!initials) {
    const asciiLetters = cleanName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toUpperCase();
    initials = (asciiLetters.slice(0, 2) || 'VS').padEnd(2, 'X');
  }

  const totalNum = Math.max(0, Math.round(Number(total || 0)));
  return `#AUD-${ddmm}-${initials}-${totalNum}`;
}

function getRecordAuditCode(sub) {
  if (!sub) return '';
  if (sub.auditCode) return String(sub.auditCode);
  if (sub.audit_code) return String(sub.audit_code);
  if (typeof extractAuditCode === 'function') {
    return extractAuditCode(sub.answers, '');
  }
  const answers = Array.isArray(sub.answers) ? sub.answers : [];
  for (const ans of answers) {
    if (ans && (ans.audit_code || ans.auditCode)) {
      return String(ans.audit_code || ans.auditCode);
    }
  }
  return '';
}

function isRecordWhatsappConfirmed(sub) {
  if (!sub) return false;
  if (sub.whatsappConfirmed === true) return true;
  if (typeof extractWhatsappConfirmed === 'function') {
    return extractWhatsappConfirmed(sub.answers);
  }
  return Array.isArray(sub.answers) && sub.answers.some(a => a && a.whatsapp_confirmed === true);
}

function getYesItems(sub) {
  const answers = Array.isArray(sub && sub.answers) ? sub.answers : [];
  return answers
    .filter(a => a && (a.choice === 'yes' || a.escolha === 'SIM'))
    .map(a => ({
      text: a.text || a.item || '',
      value: Number(a.value ?? a.pontos ?? 0),
      category: a.category || a.categoria || ''
    }));
}

function isHistoricRecord(sub) {
  const answers = Array.isArray(sub && sub.answers) ? sub.answers : [];
  if (answers.length === 0) return true;
  const hasDetailedChoice = answers.some(
    a => a && (a.choice === 'yes' || a.choice === 'no' || a.escolha === 'SIM' || a.escolha === 'NAO')
  );
  if (hasDetailedChoice) return false;
  return answers.some(a => a && (a.choice === 'historic' || a.escolha === 'HISTORICO'));
}

function buildWhatsAppMessage({ name, date, total, yesItems = [], auditCode = '', isHistoric = false }) {
  const dateFormatted = formatDateBR(date);
  const totalNum = Number(total || 0);

  let msg = `*ESCOLA SABATINA DOS ADOLESCENTES*\n`;
  msg += `*Adolescente:* ${name}\n`;
  msg += `*Data:* ${dateFormatted}\n`;
  msg += `*Pontuação da semana:* +${totalNum} pontos\n`;
  if (auditCode) {
    msg += `*Código de Auditoria:* ${auditCode}\n`;
  }
  msg += `\n`;

  if (isHistoric) {
    msg += `Registro histórico consolidado (anterior ao detalhamento por item).\n`;
  } else if (yesItems.length > 0) {
    msg += `*Atividades cumpridas (${yesItems.length} de ${questions.length} itens):*\n`;
    yesItems.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.text} (+${item.value} pts)\n`;
    });
  } else {
    msg += `Nenhum item marcado nesta rodada (0 de ${questions.length} itens).\n`;
  }

  msg += `\nConferência e auditoria no Ranking:\n${APP_PUBLIC_URL}`;
  return msg;
}

function buildWhatsAppShareUrl(params) {
  const msg = buildWhatsAppMessage(params);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
}

/**
 * ─────────────────────────────────────────────────────────────
 * INTERFACE DO USUÁRIO & COMPONENTES VISUAIS
 * ─────────────────────────────────────────────────────────────
 */

function setupAutoDate() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dateFormatted = now.toLocaleDateString('pt-BR', options);
  const capitalized = dateFormatted.charAt(0).toUpperCase() + dateFormatted.slice(1);

  const displayEl = document.getElementById('displayCurrentDate');
  if (displayEl) {
    displayEl.textContent = capitalized;
  }
}

function setupTeenSelector() {
  const grid = document.getElementById('teenGrid');
  const select = document.getElementById('teenSelect');

  if (!grid || !select) return;

  grid.innerHTML = '';
  select.innerHTML = '<option value="">-- Selecione na lista suspensa --</option>';

  const lastUser = TeenDB.getLastUser();
  const initialChoice = lastUser.name || (REGISTERED_TEENS[0] ? REGISTERED_TEENS[0].name : '');

  REGISTERED_TEENS.forEach(teen => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'teen-chip';
    chip.id = `teen-chip-${teen.name.replace(/\s+/g, '_')}`;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => selectTeen(teen.name));

    chip.innerHTML = `
      <div class="teen-avatar">${escapeHtml(teen.initial)}</div>
      <div class="teen-name-text">${escapeHtml(teen.name)}</div>
    `;
    grid.appendChild(chip);

    const opt = document.createElement('option');
    opt.value = teen.name;
    opt.textContent = teen.name;
    select.appendChild(opt);
  });

  const visitorChip = document.createElement('button');
  visitorChip.type = 'button';
  visitorChip.className = 'teen-chip teen-chip-visitor';
  visitorChip.id = 'teen-chip-visitor';
  visitorChip.setAttribute('aria-pressed', 'false');
  visitorChip.addEventListener('click', () => promptCustomVisitor());
  visitorChip.innerHTML = `
    <div class="teen-avatar">+</div>
    <div class="teen-name-text">Visitante</div>
  `;
  grid.appendChild(visitorChip);

  const visitorOpt = document.createElement('option');
  visitorOpt.value = '__custom__';
  visitorOpt.textContent = '+ Adicionar Visitante';
  select.appendChild(visitorOpt);

  if (initialChoice) {
    selectTeen(initialChoice);
  }
}

function promptCustomVisitor() {
  const custom = prompt('Digite o nome do visitante ou novo adolescente:');
  if (custom && custom.trim()) {
    const clean = custom.trim().replace(/["<>]/g, '').slice(0, 30);
    if (!clean) return;

    const select = document.getElementById('teenSelect');
    if (select) {
      const optionsArr = Array.from(select.options || []);
      const exists = optionsArr.some(o => (o.value || '').toLowerCase() === clean.toLowerCase());
      if (!exists) {
        const newOpt = document.createElement('option');
        newOpt.value = clean;
        newOpt.textContent = `${clean} (Visitante)`;
        const customOpt = select.querySelector('option[value="__custom__"]');
        if (customOpt) select.insertBefore(newOpt, customOpt);
        else select.appendChild(newOpt);
      }
    }

    selectTeen(clean, true);
  } else {
    const select = document.getElementById('teenSelect');
    if (select) select.value = AppState.selectedTeenName || '';
  }
}

function selectTeen(name, isVisitor = false) {
  if (AppState.selectedTeenName && AppState.selectedTeenName !== name && AppState.hasAnyAnswer()) {
    AppState.reset();
    buildQuestionsUI();
    updateTotal();
    updateProgress();
  }

  AppState.selectedTeenName = name;

  document.querySelectorAll('.teen-chip').forEach(chip => {
    chip.classList.remove('selected');
    chip.setAttribute('aria-pressed', 'false');
  });

  const safeId = `teen-chip-${name.replace(/\s+/g, '_')}`;
  let activeChip = document.getElementById(safeId);

  if (!activeChip && isVisitor) {
    activeChip = document.getElementById('teen-chip-visitor');
    if (activeChip) {
      const nameText = activeChip.querySelector('.teen-name-text');
      if (nameText) nameText.textContent = name;
    }
  }
  if (activeChip) {
    activeChip.classList.add('selected');
    activeChip.setAttribute('aria-pressed', 'true');
  }

  const select = document.getElementById('teenSelect');
  if (select) {
    const optionsArr = Array.from(select.options || []);
    const match = optionsArr.some(o => o.value === name);
    select.value = match ? name : '';
  }

  const preview = document.getElementById('selectedNamePreview');
  if (preview) {
    preview.textContent = name ? (isVisitor ? `${name} (Visitante)` : name) : 'Selecione seu nome acima';
  }
}

function onSelectChange(val) {
  if (!val) return;
  if (val === '__custom__') {
    promptCustomVisitor();
    return;
  }
  selectTeen(val);
}

function buildQuestionsUI() {
  const list = document.getElementById('questionsList');
  if (!list) return;
  list.innerHTML = '';

  questions.forEach((q, i) => {
    const currentChoice = AppState.getAnswer(i);
    const isVisible = checkCategoryMatch(q, AppState.activeCategory);
    const card = document.createElement('div');
    card.className = 'question-card';
    if (currentChoice === 'yes') card.classList.add('answered-yes');
    if (currentChoice === 'no') card.classList.add('answered-no');
    card.id = `card-${i}`;
    if (!isVisible) card.style.display = 'none';

    card.innerHTML = `
      <div class="q-top-row">
        <div class="q-body">
          <span class="q-cat-tag">${escapeHtml(q.category)}</span>
          <div class="q-text">${escapeHtml(q.text)}</div>
          ${q.note ? `<div class="q-note">${escapeHtml(q.note)}</div>` : ''}
        </div>
        <span class="q-points-badge">+${q.value} pts</span>
      </div>
      <div class="btn-group">
        <button type="button" class="btn-choice btn-yes${currentChoice === 'yes' ? ' selected' : ''}" id="yes-${i}" onclick="answer(${i}, 'yes')">
          Sim (+${q.value})
        </button>
        <button type="button" class="btn-choice btn-no${currentChoice === 'no' ? ' selected' : ''}" id="no-${i}" onclick="answer(${i}, 'no')">
          Não (0 pts)
        </button>
      </div>
    `;
    list.appendChild(card);
  });

  updateStickySummary();
}

function checkCategoryMatch(question, filter) {
  return filter === 'all' || question.group === filter;
}

function filterCategory(cat, btn) {
  AppState.activeCategory = cat;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  questions.forEach((q, i) => {
    const card = document.getElementById(`card-${i}`);
    if (card) {
      card.style.display = checkCategoryMatch(q, cat) ? 'flex' : 'none';
    }
  });
}

function answer(index, choice) {
  AppState.setAnswer(index, choice);

  if (navigator.vibrate) navigator.vibrate(25);

  const card = document.getElementById(`card-${index}`);
  const yesBtn = document.getElementById(`yes-${index}`);
  const noBtn = document.getElementById(`no-${index}`);

  if (yesBtn) yesBtn.classList.toggle('selected', choice === 'yes');
  if (noBtn) noBtn.classList.toggle('selected', choice === 'no');

  if (card) {
    card.classList.toggle('answered-yes', choice === 'yes');
    card.classList.toggle('answered-no', choice === 'no');
  }

  updateTotal();
  updateProgress();
}

function updateStickySummary() {
  const badge = document.getElementById('selectedItemsBadge');
  const textEl = document.getElementById('selectedItemsText');
  if (!badge || !textEl) return;

  const yesCount = AppState.getYesCount();
  const answered = AppState.getAnsweredCount();

  badge.classList.toggle('has-items', yesCount > 0);
  if (yesCount === 0) {
    textEl.textContent = answered > 0
      ? `0 atividades marcadas (${answered}/${questions.length} respondidas)`
      : '0 atividades marcadas';
  } else if (yesCount === 1) {
    textEl.textContent = `1 atividade marcada (${answered}/${questions.length} respondidas)`;
  } else {
    textEl.textContent = `${yesCount} atividades marcadas (${answered}/${questions.length} respondidas)`;
  }
}

function updateTotal() {
  const total = AppState.calculateTotal();
  const el = document.getElementById('totalScore');
  if (el) {
    el.textContent = `${total} pts`;
    if (typeof el.animate === 'function') {
      el.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.18)' },
        { transform: 'scale(1)' }
      ], {
        duration: 220,
        easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      });
    }
  }
  updateStickySummary();
}

function updateProgress() {
  const answered = AppState.getAnsweredCount();
  const total = questions.length;
  const pct = Math.round((answered / total) * 100);

  const label = document.getElementById('progressText');
  const fill = document.getElementById('progressFill');

  if (label) label.textContent = `${answered} de ${total} (${pct}%)`;
  if (fill) fill.style.width = `${pct}%`;

  updateStickySummary();
}

function resetAll() {
  if (AppState.hasAnyAnswer()) {
    if (!confirm('Deseja zerar as respostas da pontuação atual?')) return;
  }
  AppState.reset();
  buildQuestionsUI();
  updateTotal();
  updateProgress();
}

function switchTab(tab) {
  const isScore = tab === 'score';

  const tabScore = document.getElementById('tabScore');
  const tabRank = document.getElementById('tabRank');
  const tabScoreBtn = document.getElementById('tabScoreBtn');
  const tabRankBtn = document.getElementById('tabRankBtn');
  const stickyBar = document.getElementById('stickyBar');

  if (tabScore) {
    tabScore.classList.toggle('active', isScore);
    tabScore.hidden = !isScore;
  }
  if (tabRank) {
    tabRank.classList.toggle('active', !isScore);
    tabRank.hidden = isScore;
  }

  if (tabScoreBtn) {
    tabScoreBtn.classList.toggle('active', isScore);
    tabScoreBtn.setAttribute('aria-selected', String(isScore));
  }
  if (tabRankBtn) {
    tabRankBtn.classList.toggle('active', !isScore);
    tabRankBtn.setAttribute('aria-selected', String(!isScore));
  }

  if (stickyBar) stickyBar.style.display = isScore ? 'block' : 'none';

  if (!isScore) {
    renderRanking();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function getRecordKey(sub, idx) {
  if (sub && sub.id) return String(sub.id);
  return `${sub?.date || ''}_${normalizeText(sub?.name)}_${idx}`;
}

function renderRanking() {
  const leaderboard = TeenDB.getLeaderboard();
  const podium = document.getElementById('podiumArea');
  const list = document.getElementById('leaderboardList');

  if (!leaderboard.length) {
    if (podium) podium.innerHTML = '';
    if (list) {
      list.innerHTML = `
        <div class="empty-ranking">
          <div class="empty-ranking-icon">🏆</div>
          <h4 class="empty-ranking-title">Nenhum ponto registrado ainda</h4>
          <p class="empty-ranking-desc">Preencha sua pontuação na aba anterior e salve para inaugurar o ranking!</p>
        </div>
      `;
    }
    renderAuditHistory();
    return;
  }

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  if (podium) {
    const buildPodiumSpot = (spotClass, rankNum, medal, user, hasCrown = false) => {
      if (!user) {
        return `<div class="podium-spot ${spotClass} empty-spot" aria-hidden="true"></div>`;
      }
      return `
        <button type="button" class="podium-spot ${spotClass}" data-teen-name="${escapeHtml(user.name)}" title="Ver lançamentos de ${escapeHtml(user.name)} na auditoria">
          <div class="podium-avatar">
            ${hasCrown ? '<span class="podium-crown" aria-hidden="true">👑</span>' : ''}
            ${medal}
          </div>
          <div class="podium-name">${escapeHtml(user.name)}</div>
          <div class="podium-pts">${Number(user.totalPoints || 0).toLocaleString('pt-BR')} pts</div>
          <div class="podium-pillar">${rankNum}</div>
        </button>
      `;
    };

    podium.innerHTML = `
      ${buildPodiumSpot('second', 2, '🥈', top2)}
      ${buildPodiumSpot('first', 1, '🥇', top1, true)}
      ${buildPodiumSpot('third', 3, '🥉', top3)}
    `;
  }

  if (list) {
    list.innerHTML = '';
    leaderboard.forEach((user, index) => {
      const pos = index + 1;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'leader-row';
      row.dataset.teenName = user.name;
      row.title = `Filtrar lançamentos de ${user.name} na auditoria`;

      let rankClass = '';
      let medal = `#${pos}`;
      if (pos === 1) { rankClass = 'top-1'; medal = '🥇'; }
      else if (pos === 2) { rankClass = 'top-2'; medal = '🥈'; }
      else if (pos === 3) { rankClass = 'top-3'; medal = '🥉'; }

      row.innerHTML = `
        <div class="leader-rank ${rankClass}">${medal}</div>
        <div class="leader-info">
          <div class="leader-name">${escapeHtml(user.name)}</div>
          <div class="leader-sub">${user.count} lançamento(s) somados</div>
        </div>
        <div class="leader-right">
          <span class="leader-score">${Number(user.totalPoints || 0).toLocaleString('pt-BR')} pts</span>
          <span class="leader-audit-hint">Auditar ▸</span>
        </div>
      `;
      list.appendChild(row);
    });
  }

  renderAuditHistory();
}

function populateAuditDateOptions(allRecords) {
  const dateSelect = document.getElementById('auditDateFilter');
  if (!dateSelect) return;

  const dateCounts = {};
  allRecords.forEach(sub => {
    if (sub && sub.date) {
      dateCounts[sub.date] = (dateCounts[sub.date] || 0) + 1;
    }
  });

  const sortedDates = Object.keys(dateCounts).sort((a, b) => b.localeCompare(a));
  if (AppState.auditDate !== 'all' && !dateCounts[AppState.auditDate]) {
    AppState.auditDate = 'all';
  }

  dateSelect.innerHTML = `<option value="all">Todas as datas (${allRecords.length})</option>`;
  sortedDates.forEach(dateISO => {
    const opt = document.createElement('option');
    opt.value = dateISO;
    opt.textContent = `${formatDateBR(dateISO)} (${dateCounts[dateISO]})`;
    dateSelect.appendChild(opt);
  });

  dateSelect.value = AppState.auditDate;
}

function renderAuditHistory() {
  const recent = document.getElementById('recentHistoryList');
  const totalBadge = document.getElementById('auditTotalBadge');
  const activeFilterBar = document.getElementById('auditActiveFilterBar');
  const toggleWrap = document.getElementById('historyToggleWrap');
  if (!recent) return;

  const all = [...TeenDB.getAll()].sort((a, b) => {
    const dCmp = (b.date || '').localeCompare(a.date || '');
    if (dCmp !== 0) return dCmp;
    const tCmp = (b.submitted_at || b.submittedAt || '').localeCompare(a.submitted_at || a.submittedAt || '');
    if (tCmp !== 0) return tCmp;
    return (a.name || '').localeCompare(b.name || '', 'pt-BR');
  });

  populateAuditDateOptions(all);

  if (totalBadge) {
    totalBadge.textContent = `${all.length} registro${all.length === 1 ? '' : 's'}`;
  }

  const queryNorm = normalizeText(AppState.auditSearch);
  const selectedDate = AppState.auditDate;
  const isFiltered = Boolean(queryNorm) || selectedDate !== 'all';

  const filtered = all.filter(sub => {
    if (selectedDate !== 'all' && sub.date !== selectedDate) return false;
    if (queryNorm) {
      const nameNorm = normalizeText(sub.name);
      const codeNorm = normalizeText(getRecordAuditCode(sub));
      if (!nameNorm.includes(queryNorm) && !codeNorm.includes(queryNorm)) {
        return false;
      }
    }
    return true;
  });

  if (activeFilterBar) {
    if (isFiltered) {
      activeFilterBar.hidden = false;
      const parts = [];
      if (AppState.auditSearch.trim()) parts.push(`"${AppState.auditSearch.trim()}"`);
      if (selectedDate !== 'all') parts.push(formatDateBR(selectedDate));
      activeFilterBar.innerHTML = `
        <span>Filtro ativo (${parts.join(' · ')}): ${filtered.length} de ${all.length}</span>
        <button type="button" class="btn-clear-audit-filter" onclick="clearAuditFilters()">Limpar filtro ✕</button>
      `;
    } else {
      activeFilterBar.hidden = true;
      activeFilterBar.innerHTML = '';
    }
  }

  recent.innerHTML = '';

  if (filtered.length === 0) {
    recent.innerHTML = `
      <div class="audit-empty-state">
        <p>Nenhum lançamento encontrado para os filtros aplicados.</p>
        ${isFiltered ? '<button type="button" class="btn-clear-audit-filter" style="margin-top:8px;" onclick="clearAuditFilters()">Mostrar todos os lançamentos</button>' : ''}
      </div>
    `;
    if (toggleWrap) toggleWrap.style.display = 'none';
    return;
  }

  const limit = (AppState.showAllHistory || isFiltered) ? filtered.length : 25;
  const itemsToShow = filtered.slice(0, limit);

  itemsToShow.forEach((sub, idx) => {
    const recKey = getRecordKey(sub, idx);
    const isExpanded = AppState.expandedAuditKeys.has(recKey);
    const yesItems = getYesItems(sub);
    const historic = isHistoricRecord(sub);
    const auditCode = getRecordAuditCode(sub);
    const waConfirmed = isRecordWhatsappConfirmed(sub);
    const fDate = formatDateBR(sub.date);

    let metaSummary = '';
    if (historic) {
      metaSummary = 'Registro histórico consolidado';
    } else {
      const countLabel = `${yesItems.length} ${yesItems.length === 1 ? 'atividade' : 'atividades'}`;
      metaSummary = auditCode ? `${countLabel} · ${auditCode}` : countLabel;
      if (waConfirmed) metaSummary += ' · ✓ WhatsApp';
    }

    const shareAuditCode = auditCode || (!historic ? generateAuditCode(sub.name, sub.date, sub.total) : '');
    const waUrl = buildWhatsAppShareUrl({
      name: sub.name,
      date: sub.date,
      total: sub.total,
      yesItems,
      auditCode: shareAuditCode,
      isHistoric: historic
    });

    let bodyContent = '';
    if (historic) {
      bodyContent = `<p class="audit-historic-note">Registro histórico consolidado (anterior ao detalhamento item a item).</p>`;
    } else if (yesItems.length > 0) {
      const listHtml = yesItems.map(item => `
        <li>
          <span class="audit-ans-left">
            <span class="audit-ans-check" aria-hidden="true">✅</span>
            <span>${escapeHtml(item.text)}</span>
          </span>
          <span class="audit-ans-pts">+${Number(item.value || 0)} pts</span>
        </li>
      `).join('');
      bodyContent = `<ul class="audit-answers-list">${listHtml}</ul>`;
    } else {
      bodyContent = `<p class="audit-historic-note">Nenhum item marcado como "Sim" nesta rodada (0 de ${questions.length} itens).</p>`;
    }

    const card = document.createElement('div');
    card.className = `history-card${isExpanded ? ' expanded' : ''}`;
    card.innerHTML = `
      <button
        type="button"
        class="history-card-header"
        data-audit-key="${escapeHtml(recKey)}"
        aria-expanded="${isExpanded ? 'true' : 'false'}"
      >
        <div class="history-card-main">
          <div class="history-card-top">
            <span class="history-card-name">${escapeHtml(sub.name)}</span>
            <span class="history-card-date">(${escapeHtml(fDate)})</span>
          </div>
          <div class="history-card-meta">${escapeHtml(metaSummary)}</div>
        </div>
        <div class="history-card-right">
          <span class="history-card-score">+${Number(sub.total || 0).toLocaleString('pt-BR')} pts</span>
          <span class="history-card-toggle">${isExpanded ? 'Ocultar ▴' : 'Ver respostas ▾'}</span>
        </div>
      </button>
      <div class="history-card-body" ${isExpanded ? '' : 'hidden'}>
        ${bodyContent}
        <div class="audit-card-actions">
          ${auditCode ? `<code class="audit-code-chip">${escapeHtml(auditCode)}</code>` : ''}
          <a class="btn-audit-wa" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener">
            📲 Reenviar / Conferir no WhatsApp
          </a>
        </div>
      </div>
    `;
    recent.appendChild(card);
  });

  if (toggleWrap) {
    if (!isFiltered && filtered.length > 25) {
      toggleWrap.style.display = 'block';
      toggleWrap.innerHTML = `
        <button type="button" class="btn-toggle-history" onclick="toggleHistoryView()">
          ${AppState.showAllHistory ? '▲ Mostrar apenas os 25 mais recentes' : `▼ Ver todos os lançamentos (${filtered.length})`}
        </button>
      `;
    } else {
      toggleWrap.style.display = 'none';
    }
  }
}

function toggleAuditCard(recordKey) {
  if (!recordKey) return;
  if (AppState.expandedAuditKeys.has(recordKey)) {
    AppState.expandedAuditKeys.delete(recordKey);
  } else {
    AppState.expandedAuditKeys.add(recordKey);
  }
  renderAuditHistory();
}

function filterAuditByTeen(name) {
  if (!name) return;
  AppState.auditSearch = name;
  AppState.auditDate = 'all';

  const searchInput = document.getElementById('auditSearchInput');
  const dateSelect = document.getElementById('auditDateFilter');
  if (searchInput) searchInput.value = name;
  if (dateSelect) dateSelect.value = 'all';

  // Expande automaticamente o lançamento mais recente desse adolescente para facilitar conferência
  const matches = [...TeenDB.getAll()]
    .filter(sub => normalizeText(sub.name).includes(normalizeText(name)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (matches.length > 0) {
    AppState.expandedAuditKeys.add(getRecordKey(matches[0], 0));
  }

  renderAuditHistory();

  const section = document.getElementById('peerAuditSection');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function clearAuditFilters() {
  AppState.auditSearch = '';
  AppState.auditDate = 'all';

  const searchInput = document.getElementById('auditSearchInput');
  const dateSelect = document.getElementById('auditDateFilter');
  if (searchInput) searchInput.value = '';
  if (dateSelect) dateSelect.value = 'all';

  renderAuditHistory();
}

function setupAuditControls() {
  const searchInput = document.getElementById('auditSearchInput');
  const dateSelect = document.getElementById('auditDateFilter');
  const historyList = document.getElementById('recentHistoryList');
  const leaderboardList = document.getElementById('leaderboardList');
  const podiumArea = document.getElementById('podiumArea');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.auditSearch = e.target.value || '';
      renderAuditHistory();
    });
  }

  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      AppState.auditDate = e.target.value || 'all';
      renderAuditHistory();
    });
  }

  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const headerBtn = e.target.closest('.history-card-header');
      if (headerBtn && headerBtn.dataset.auditKey) {
        toggleAuditCard(headerBtn.dataset.auditKey);
      }
    });
  }

  const handleTeenJump = (e) => {
    const trigger = e.target.closest('[data-teen-name]');
    if (trigger && trigger.dataset.teenName) {
      filterAuditByTeen(trigger.dataset.teenName);
    }
  };

  if (leaderboardList) leaderboardList.addEventListener('click', handleTeenJump);
  if (podiumArea) podiumArea.addEventListener('click', handleTeenJump);
}

function toggleHistoryView() {
  AppState.showAllHistory = !AppState.showAllHistory;
  renderAuditHistory();
}

let toastTimer = null;
function showActionToast(message) {
  const toast = document.getElementById('appToast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}
