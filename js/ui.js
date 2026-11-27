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
  auditQuickFilter: 'all', // 'all' | 'latest' | 'detailed'
  expandedAuditKeys: new Set(),
  hasInitializedDefaultExpand: false,
  recentSavedRecordId: '',

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
  getNoCount() {
    return this.answers.filter(a => a === 'no').length;
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

function getTeenInitials(name) {
  const cleanName = String(name || '').trim();
  const matched = typeof REGISTERED_TEENS !== 'undefined' && Array.isArray(REGISTERED_TEENS)
    ? REGISTERED_TEENS.find(t => normalizeText(t.name) === normalizeText(cleanName))
    : null;

  if (matched && matched.initial) return matched.initial.toUpperCase();

  const asciiLetters = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase();
  return (asciiLetters.slice(0, 2) || 'VS').padEnd(2, 'X');
}

function generateAuditCode(name, dateISO, total) {
  const parts = String(dateISO || '').split('-');
  const ddmm = parts.length === 3 ? `${parts[2]}${parts[1]}` : '0000';
  const initials = getTeenInitials(name);
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
  return Array.isArray(sub.answers) && sub.answers.some(
    a => a && (a.whatsapp_confirmed === true || a.whatsappConfirmed === true)
  );
}

function getYesItems(sub) {
  const answers = Array.isArray(sub && sub.answers) ? sub.answers : [];
  return answers
    .filter(a => a && (a.choice === 'yes' || a.escolha === 'SIM'))
    .map(a => ({
      index: typeof a.index === 'number' ? a.index : 999,
      text: a.text || a.item || '',
      value: Number(a.value ?? a.pontos ?? 0),
      category: a.category || a.categoria || ''
    }))
    .sort((a, b) => a.index - b.index);
}

function getNoItems(sub) {
  const answers = Array.isArray(sub && sub.answers) ? sub.answers : [];
  return answers
    .filter(a => {
      if (!a) return false;
      const esc = String(a.escolha || '').toUpperCase();
      return a.choice === 'no' || esc === 'NÃO' || esc === 'NAO';
    })
    .map(a => ({
      index: typeof a.index === 'number' ? a.index : 999,
      text: a.text || a.item || '',
      value: Number(a.value ?? a.pontos ?? 0),
      category: a.category || a.categoria || ''
    }))
    .sort((a, b) => a.index - b.index);
}

function isHistoricRecord(sub) {
  const answers = Array.isArray(sub && sub.answers) ? sub.answers : [];
  if (answers.length === 0) return true;
  const hasDetailedChoice = answers.some(a => {
    if (!a) return false;
    const esc = String(a.escolha || '').toUpperCase();
    return a.choice === 'yes' || a.choice === 'no' || esc === 'SIM' || esc === 'NÃO' || esc === 'NAO';
  });
  if (hasDetailedChoice) return false;
  return answers.some(a => a && (a.choice === 'historic' || a.escolha === 'HISTORICO'));
}

function formatDateWeekdayBR(dateISO) {
  if (!dateISO) return '';
  const parts = String(dateISO).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return formatDateBR(dateISO);
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  const weekday = dt.toLocaleDateString('pt-BR', { weekday: 'long' });
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capWeekday}, ${formatDateBR(dateISO)}`;
}

function formatSubmittedTimeBR(sub) {
  if (!sub || isHistoricRecord(sub)) return '';
  const raw = sub.submitted_at || sub.submittedAt || '';
  if (!raw) return '';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

function findTeenRecordForDate(name, dateISO) {
  if (!name || !dateISO) return null;
  if (typeof TeenDB.findRecord === 'function') {
    return TeenDB.findRecord(name, dateISO);
  }
  const targetName = normalizeText(name);
  return TeenDB.getAll().find(
    r => r && r.date === dateISO && normalizeText(r.name) === targetName
  ) || null;
}

function copyTextToClipboard(text) {
  if (!text) return Promise.resolve(false);
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopyText(text));
  }
  return Promise.resolve(fallbackCopyText(text));
}

function fallbackCopyText(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return Boolean(ok);
  } catch {
    return false;
  }
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
  select.innerHTML = '<option value="">-- Escolher na lista --</option>';

  const lastUser = TeenDB.getLastUser();
  const initialChoice = (lastUser && lastUser.name) ? String(lastUser.name).trim() : '';

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
      <span class="teen-chip-check" aria-hidden="true">✓</span>
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
    <span class="teen-chip-check" aria-hidden="true">✓</span>
  `;
  grid.appendChild(visitorChip);

  const visitorOpt = document.createElement('option');
  visitorOpt.value = '__custom__';
  visitorOpt.textContent = '+ Adicionar Visitante';
  select.appendChild(visitorOpt);

  const visitorInput = document.getElementById('visitorNameInput');
  if (visitorInput && !visitorInput.dataset.bound) {
    visitorInput.dataset.bound = 'true';
    visitorInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmVisitorInline();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelVisitorInline();
      }
    });
  }

  if (initialChoice) {
    const isRegistered = REGISTERED_TEENS.some(t => normalizeText(t.name) === normalizeText(initialChoice));
    if (!isRegistered) {
      ensureVisitorOption(initialChoice);
    }
    selectTeen(initialChoice, !isRegistered);
  } else {
    updateStickyTeenBadge();
    updateTodaySubmissionBanner();
  }
}

function ensureVisitorOption(cleanName) {
  const select = document.getElementById('teenSelect');
  if (!select || !cleanName) return;
  const optionsArr = Array.from(select.options || []);
  const exists = optionsArr.some(o => normalizeText(o.value) === normalizeText(cleanName));
  if (!exists) {
    const newOpt = document.createElement('option');
    newOpt.value = cleanName;
    newOpt.textContent = `${cleanName} (Visitante)`;
    const customOpt = select.querySelector('option[value="__custom__"]');
    if (customOpt) select.insertBefore(newOpt, customOpt);
    else select.appendChild(newOpt);
  }
}

function promptCustomVisitor() {
  const wrap = document.getElementById('visitorInputWrap');
  const input = document.getElementById('visitorNameInput');
  if (wrap && input) {
    wrap.hidden = false;
    input.value = '';
    input.focus();
    return;
  }

  const custom = prompt('Digite o nome do visitante ou novo adolescente:');
  if (custom && custom.trim()) {
    const clean = custom.trim().replace(/["<>]/g, '').slice(0, 30);
    if (!clean) return;
    ensureVisitorOption(clean);
    selectTeen(clean, true);
  }
}

function confirmVisitorInline() {
  const wrap = document.getElementById('visitorInputWrap');
  const input = document.getElementById('visitorNameInput');
  if (!input) return;

  const clean = (input.value || '').trim().replace(/["<>]/g, '').slice(0, 30);
  if (!clean) {
    input.focus();
    showActionToast('Digite o nome do visitante para continuar.');
    return;
  }

  ensureVisitorOption(clean);
  if (wrap) wrap.hidden = true;
  selectTeen(clean, true);
}

function cancelVisitorInline() {
  const wrap = document.getElementById('visitorInputWrap');
  if (wrap) wrap.hidden = true;
  const select = document.getElementById('teenSelect');
  if (select) select.value = AppState.selectedTeenName || '';
}

function selectTeen(name, isVisitor = false) {
  if (AppState.selectedTeenName && normalizeText(AppState.selectedTeenName) !== normalizeText(name) && AppState.hasAnyAnswer()) {
    AppState.reset();
    buildQuestionsUI();
    updateTotal();
    updateProgress();
  }

  AppState.selectedTeenName = name;

  const visitorWrap = document.getElementById('visitorInputWrap');
  if (visitorWrap) visitorWrap.hidden = true;

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
  } else if (activeChip) {
    const visitorChip = document.getElementById('teen-chip-visitor');
    if (visitorChip) {
      const nameText = visitorChip.querySelector('.teen-name-text');
      if (nameText) nameText.textContent = 'Visitante';
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
    preview.textContent = name ? (isVisitor ? `${name} (Visitante)` : name) : 'Nenhum nome selecionado';
  }

  updateStickyTeenBadge();
  updateTodaySubmissionBanner();
}

function updateStickyTeenBadge() {
  const pill = document.getElementById('selectedTeenStickyBadge');
  const label = document.getElementById('selectedTeenStickyName');
  if (!pill || !label) return;

  if (AppState.selectedTeenName) {
    pill.classList.remove('is-missing');
    label.textContent = AppState.selectedTeenName;
  } else {
    pill.classList.add('is-missing');
    label.textContent = 'Escolha seu nome';
  }
}

function updateTodaySubmissionBanner() {
  const banner = document.getElementById('todaySubmissionBanner');
  if (!banner) return;

  if (!AppState.selectedTeenName) {
    banner.hidden = true;
    return;
  }

  const todayISO = getLocalDateISO();
  const todayRec = findTeenRecordForDate(AppState.selectedTeenName, todayISO);
  if (!todayRec || isHistoricRecord(todayRec)) {
    banner.hidden = true;
    return;
  }

  const yesItems = getYesItems(todayRec);
  const auditCode = getRecordAuditCode(todayRec);
  const waConfirmed = isRecordWhatsappConfirmed(todayRec);

  const titleEl = document.getElementById('todaySavedTitle');
  const metaEl = document.getElementById('todaySavedMeta');
  const ptsEl = document.getElementById('todaySavedPts');

  if (titleEl) {
    titleEl.textContent = `Lançamento de hoje salvo (${AppState.selectedTeenName})`;
  }
  if (metaEl) {
    const parts = [
      `${yesItems.length} de ${questions.length} atividades`,
      auditCode || null,
      waConfirmed ? '✓ WhatsApp confirmado' : 'Aguardando confirmação WhatsApp'
    ].filter(Boolean);
    metaEl.textContent = parts.join(' · ');
  }
  if (ptsEl) {
    ptsEl.textContent = `+${Number(todayRec.total || 0)} pts`;
  }

  banner.hidden = false;
}

function loadTodaySubmissionIntoForm() {
  if (!AppState.selectedTeenName) return;
  const todayISO = getLocalDateISO();
  const todayRec = findTeenRecordForDate(AppState.selectedTeenName, todayISO);
  if (!todayRec || isHistoricRecord(todayRec)) {
    showActionToast('Nenhum lançamento detalhado encontrado para hoje.');
    return;
  }

  const answers = Array.isArray(todayRec.answers) ? todayRec.answers : [];
  questions.forEach((q, idx) => {
    const match = answers.find(a =>
      a && ((typeof a.index === 'number' && a.index === idx) || normalizeText(a.text || a.item) === normalizeText(q.text))
    );
    if (match) {
      const isYes = match.choice === 'yes' || match.escolha === 'SIM';
      AppState.setAnswer(idx, isYes ? 'yes' : 'no');
    } else {
      AppState.setAnswer(idx, 'no');
    }
  });

  buildQuestionsUI();
  updateTotal();
  updateProgress();
  showActionToast(`Respostas de hoje de ${AppState.selectedTeenName} carregadas!`);
}

function viewSelectedTeenTodayInAudit() {
  if (!AppState.selectedTeenName) return;
  const targetName = AppState.selectedTeenName;
  const todayISO = getLocalDateISO();
  const todayRec = findTeenRecordForDate(targetName, todayISO);

  switchTab('rank', { skipScrollTop: true });
  if (todayRec) {
    const recKey = getRecordKey(todayRec, 0);
    AppState.expandedAuditKeys.add(recKey);
    AppState.recentSavedRecordId = recKey;
  }
  filterAuditByTeen(targetName);
}

function onSelectChange(val) {
  if (!val) return;
  if (val === '__custom__') {
    promptCustomVisitor();
    return;
  }
  const isRegistered = REGISTERED_TEENS.some(t => normalizeText(t.name) === normalizeText(val));
  selectTeen(val, !isRegistered);
}

function updateCategoryPillsCounts() {
  const pills = document.querySelectorAll('#filterPills .pill-btn');
  if (!pills.length) return;

  pills.forEach(btn => {
    const cat = btn.dataset.category || 'all';
    const matchingIndices = [];
    questions.forEach((q, idx) => {
      if (cat === 'all' || q.group === cat) matchingIndices.push(idx);
    });
    const yesInCat = matchingIndices.filter(idx => AppState.getAnswer(idx) === 'yes').length;
    const baseLabel = cat === 'all'
      ? 'Todos'
      : (cat === 'Zelo' ? 'Zelo & Oferta' : cat);
    btn.textContent = yesInCat > 0
      ? `${baseLabel} (${matchingIndices.length} · ✓${yesInCat})`
      : `${baseLabel} (${matchingIndices.length})`;
  });
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

  updateCategoryPillsCounts();
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

  if (navigator.vibrate) navigator.vibrate(20);

  const card = document.getElementById(`card-${index}`);
  const yesBtn = document.getElementById(`yes-${index}`);
  const noBtn = document.getElementById(`no-${index}`);

  if (yesBtn) yesBtn.classList.toggle('selected', choice === 'yes');
  if (noBtn) noBtn.classList.toggle('selected', choice === 'no');

  if (card) {
    card.classList.toggle('answered-yes', choice === 'yes');
    card.classList.toggle('answered-no', choice === 'no');
  }

  updateCategoryPillsCounts();
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
      ? `0 atividades marcadas (${answered}/${questions.length})`
      : '0 atividades marcadas';
  } else if (yesCount === 1) {
    textEl.textContent = `1 atividade marcada (${answered}/${questions.length})`;
  } else {
    textEl.textContent = `${yesCount} atividades marcadas (${answered}/${questions.length})`;
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
        { transform: 'scale(1.16)' },
        { transform: 'scale(1)' }
      ], {
        duration: 210,
        easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      });
    }
  }
  updateStickySummary();
}

function updateProgress() {
  const answered = AppState.getAnsweredCount();
  const yesCount = AppState.getYesCount();
  const noCount = AppState.getNoCount();
  const blankCount = Math.max(0, questions.length - answered);
  const total = questions.length;
  const pct = Math.round((answered / total) * 100);

  const label = document.getElementById('progressText');
  const fill = document.getElementById('progressFill');
  const breakdown = document.getElementById('progressBreakdown');

  if (label) label.textContent = `${answered} de ${total} (${pct}%)`;
  if (fill) fill.style.width = `${pct}%`;

  if (breakdown) {
    breakdown.innerHTML = `
      <span class="breakdown-chip yes">${yesCount} Sim</span>
      <span class="breakdown-chip no">${noCount} Não</span>
      <span class="breakdown-chip blank">${blankCount} em branco (contam como Não)</span>
    `;
  }

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

function switchTab(tab, options = {}) {
  const isScore = tab === 'score';

  const tabScore = document.getElementById('tabScore');
  const tabRank = document.getElementById('tabRank');
  const tabScoreBtn = document.getElementById('tabScoreBtn');
  const tabRankBtn = document.getElementById('tabRankBtn');
  const stickyBar = document.getElementById('stickyBar');

  document.body.classList.toggle('tab-rank-active', !isScore);

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
    if (!options.skipScrollTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } else {
    updateTodaySubmissionBanner();
  }
}

function scrollToRankSection(sectionId, btnEl) {
  document.querySelectorAll('.rank-quick-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getRecordKey(sub, idx) {
  if (sub && sub.id) return String(sub.id);
  return `${sub?.date || ''}_${normalizeText(sub?.name)}_${idx}`;
}

function getSortedAllRecords() {
  return [...TeenDB.getAll()].sort((a, b) => {
    const dCmp = (b.date || '').localeCompare(a.date || '');
    if (dCmp !== 0) return dCmp;
    const tCmp = (b.submitted_at || b.submittedAt || '').localeCompare(a.submitted_at || a.submittedAt || '');
    if (tCmp !== 0) return tCmp;
    return (a.name || '').localeCompare(b.name || '', 'pt-BR');
  });
}

function renderLatestAuditSpotlight(allRecords) {
  const spotlight = document.getElementById('latestAuditSpotlight');
  if (!spotlight) return;

  const detailed = allRecords.filter(sub => !isHistoricRecord(sub));
  if (!detailed.length) {
    spotlight.hidden = true;
    return;
  }

  const latestDate = detailed[0].date;
  const onLatest = detailed.filter(sub => sub.date === latestDate);
  const namesList = onLatest.map(s => `${s.name} (+${Number(s.total || 0)})`).slice(0, 4);
  const extraCount = Math.max(0, onLatest.length - namesList.length);
  const summaryNames = namesList.join(', ') + (extraCount > 0 ? ` e +${extraCount}` : '');

  spotlight.hidden = false;
  spotlight.innerHTML = `
    <div class="audit-spotlight-text">
      <div class="audit-spotlight-kicker">Auditoria Rápida · Últimos envios detalhados</div>
      <div class="audit-spotlight-title">${escapeHtml(formatDateWeekdayBR(latestDate))} (${onLatest.length} ${onLatest.length === 1 ? 'adolescente' : 'adolescentes'})</div>
      <div class="audit-spotlight-sub">${escapeHtml(summaryNames)}</div>
    </div>
    <button type="button" class="audit-spotlight-btn" id="btnSpotlightOpenAudit">
      Ver respostas de ${escapeHtml(formatDateBR(latestDate))}
    </button>
  `;

  const btn = document.getElementById('btnSpotlightOpenAudit');
  if (btn) {
    btn.addEventListener('click', () => {
      onLatest.forEach((sub, i) => AppState.expandedAuditKeys.add(getRecordKey(sub, i)));
      AppState.auditDate = latestDate;
      AppState.auditSearch = '';
      AppState.auditQuickFilter = 'latest';
      const searchInput = document.getElementById('auditSearchInput');
      if (searchInput) searchInput.value = '';
      renderAuditHistory();
      const section = document.getElementById('peerAuditSection');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

function renderRanking() {
  const leaderboard = TeenDB.getLeaderboard();
  const allRecords = getSortedAllRecords();
  const podium = document.getElementById('podiumArea');
  const list = document.getElementById('leaderboardList');
  const tabCountPill = document.getElementById('tabAuditCountPill');

  if (tabCountPill) {
    const detailedCount = allRecords.filter(sub => !isHistoricRecord(sub)).length;
    if (detailedCount > 0) {
      tabCountPill.textContent = String(detailedCount);
      tabCountPill.hidden = false;
    } else {
      tabCountPill.hidden = true;
    }
  }

  renderLatestAuditSpotlight(allRecords);

  if (!leaderboard.length) {
    if (podium) podium.innerHTML = '';
    if (list) {
      list.innerHTML = `
        <div class="empty-ranking">
          
          <h4 class="empty-ranking-title">Nenhum ponto registrado ainda</h4>
          <p class="empty-ranking-desc">Preencha sua pontuação na aba anterior e salve para inaugurar o ranking!</p>
        </div>
      `;
    }
    renderAuditHistory(allRecords);
    return;
  }

  const latestByTeen = new Map();
  allRecords.forEach(sub => {
    const key = normalizeText(sub.name);
    if (key && !latestByTeen.has(key)) {
      latestByTeen.set(key, sub);
    }
  });

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
            
            ${medal}
          </div>
          <div class="podium-name">${escapeHtml(user.name)}</div>
          <div class="podium-pts">${Number(user.totalPoints || 0).toLocaleString('pt-BR')} pts</div>
          <div class="podium-sub">${user.count} ${user.count === 1 ? 'envio' : 'envios'}</div>
          <div class="podium-pillar">${rankNum}</div>
        </button>
      `;
    };

    podium.innerHTML = `
      ${buildPodiumSpot('second', 2, '2', top2)}
      ${buildPodiumSpot('first', 1, '1', top1, true)}
      ${buildPodiumSpot('third', 3, '3', top3)}
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
      row.title = `Ver respostas de ${user.name} na auditoria`;

      let rankClass = '';
      let medal = `#${pos}`;
      if (pos === 1) { rankClass = 'top-1'; medal = `#${pos}`; }
      else if (pos === 2) { rankClass = 'top-2'; medal = `#${pos}`; }
      else if (pos === 3) { rankClass = 'top-3'; medal = `#${pos}`; }

      const latestRec = latestByTeen.get(normalizeText(user.name));
      let latestBadgeHtml = '';
      if (latestRec) {
        const latestYes = getYesItems(latestRec).length;
        const latestTag = isHistoricRecord(latestRec)
          ? `Último: ${formatDateBR(latestRec.date)} (+${Number(latestRec.total || 0)})`
          : `Último: ${formatDateBR(latestRec.date)} (+${Number(latestRec.total || 0)} · ${latestYes} ${latestYes === 1 ? 'item' : 'itens'})`;
        latestBadgeHtml = `<span class="leader-latest-pill">${escapeHtml(latestTag)}</span>`;
      }

      row.innerHTML = `
        <div class="leader-rank ${rankClass}">${medal}</div>
        <div class="leader-avatar" aria-hidden="true">${escapeHtml(getTeenInitials(user.name))}</div>
        <div class="leader-info">
          <div class="leader-name">${escapeHtml(user.name)}</div>
          <div class="leader-sub">
            <span>${user.count} ${user.count === 1 ? 'lançamento' : 'lançamentos'}</span>
            ${latestBadgeHtml}
          </div>
        </div>
        <div class="leader-right">
          <span class="leader-score">${Number(user.totalPoints || 0).toLocaleString('pt-BR')} pts</span>
          <span class="leader-audit-hint">Respostas</span>
        </div>
      `;
      list.appendChild(row);
    });
  }

  renderAuditHistory(allRecords);
  updateTodaySubmissionBanner();
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

  const todayISO = getLocalDateISO();
  dateSelect.innerHTML = `<option value="all">Todas as datas (${allRecords.length})</option>`;
  sortedDates.forEach(dateISO => {
    const opt = document.createElement('option');
    opt.value = dateISO;
    const todaySuffix = dateISO === todayISO ? ' · Hoje' : '';
    opt.textContent = `${formatDateBR(dateISO)}${todaySuffix} (${dateCounts[dateISO]})`;
    dateSelect.appendChild(opt);
  });

  dateSelect.value = AppState.auditDate;
}

function syncQuickFilterChipsUI() {
  document.querySelectorAll('#auditQuickChips .audit-qchip[data-qfilter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.qfilter === AppState.auditQuickFilter);
  });
}

function setAuditQuickFilter(mode) {
  AppState.auditQuickFilter = mode || 'all';
  if (mode === 'latest') {
    const all = getSortedAllRecords();
    const firstDetailed = all.find(sub => !isHistoricRecord(sub)) || all[0];
    if (firstDetailed && firstDetailed.date) {
      AppState.auditDate = firstDetailed.date;
      all.filter(sub => sub.date === firstDetailed.date && !isHistoricRecord(sub))
        .forEach((sub, idx) => AppState.expandedAuditKeys.add(getRecordKey(sub, idx)));
    }
  } else if (mode === 'all') {
    AppState.auditDate = 'all';
  }
  syncQuickFilterChipsUI();
  renderAuditHistory();
}

function getFilteredAuditRecords(all) {
  const queryNorm = normalizeText(AppState.auditSearch);
  const selectedDate = AppState.auditDate;
  const quickMode = AppState.auditQuickFilter;
  const latestDetailed = all.find(sub => !isHistoricRecord(sub)) || all[0];
  const latestDate = latestDetailed ? latestDetailed.date : '';

  return all.filter(sub => {
    if (selectedDate !== 'all' && sub.date !== selectedDate) return false;
    if (quickMode === 'latest' && latestDate && sub.date !== latestDate) return false;
    if (quickMode === 'detailed' && isHistoricRecord(sub)) return false;

    if (queryNorm) {
      const nameNorm = normalizeText(sub.name);
      const codeNorm = normalizeText(getRecordAuditCode(sub));
      const yesMatch = getYesItems(sub).some(it => normalizeText(it.text).includes(queryNorm));
      if (!nameNorm.includes(queryNorm) && !codeNorm.includes(queryNorm) && !yesMatch) {
        return false;
      }
    }
    return true;
  });
}

function toggleExpandAllAudit() {
  const all = getSortedAllRecords();
  const filtered = getFilteredAuditRecords(all);
  const isFiltered = Boolean(normalizeText(AppState.auditSearch)) || AppState.auditDate !== 'all' || AppState.auditQuickFilter !== 'all';
  const limit = (AppState.showAllHistory || isFiltered) ? filtered.length : 25;
  const visible = filtered.slice(0, limit);
  const visibleKeys = visible.map((sub, idx) => getRecordKey(sub, idx));
  const allExpanded = visibleKeys.length > 0 && visibleKeys.every(k => AppState.expandedAuditKeys.has(k));

  if (allExpanded) {
    visibleKeys.forEach(k => AppState.expandedAuditKeys.delete(k));
  } else {
    visibleKeys.forEach(k => AppState.expandedAuditKeys.add(k));
  }
  renderAuditHistory(all);
}

function renderAuditHistory(preloadedAll) {
  const recent = document.getElementById('recentHistoryList');
  const totalBadge = document.getElementById('auditTotalBadge');
  const activeFilterBar = document.getElementById('auditActiveFilterBar');
  const toggleWrap = document.getElementById('historyToggleWrap');
  const expandAllBtn = document.getElementById('btnToggleExpandAll');
  if (!recent) return;

  const all = Array.isArray(preloadedAll) ? preloadedAll : getSortedAllRecords();

  // Auto-expande os 3 lançamentos detalhados mais recentes na primeira carga com registros detalhados
  // para que as respostas salvas já fiquem imediatamente visíveis sem precisar adivinhar
  if (!AppState.hasInitializedDefaultExpand && all.length > 0) {
    const recentDetailed = all.filter(sub => !isHistoricRecord(sub)).slice(0, 3);
    if (recentDetailed.length > 0) {
      recentDetailed.forEach((sub, idx) => {
        AppState.expandedAuditKeys.add(getRecordKey(sub, idx));
      });
      AppState.hasInitializedDefaultExpand = true;
    }
  }

  populateAuditDateOptions(all);
  syncQuickFilterChipsUI();

  if (totalBadge) {
    totalBadge.textContent = `${all.length} registro${all.length === 1 ? '' : 's'}`;
  }

  const queryRaw = AppState.auditSearch.trim();
  const queryNorm = normalizeText(queryRaw);
  const selectedDate = AppState.auditDate;
  const quickMode = AppState.auditQuickFilter;
  const isFiltered = Boolean(queryNorm) || selectedDate !== 'all' || quickMode !== 'all';

  const filtered = getFilteredAuditRecords(all);

  if (activeFilterBar) {
    if (isFiltered) {
      activeFilterBar.hidden = false;
      const parts = [];
      if (queryRaw) parts.push(`"${escapeHtml(queryRaw)}"`);
      if (selectedDate !== 'all') parts.push(escapeHtml(formatDateBR(selectedDate)));
      if (quickMode === 'detailed') parts.push('Só com respostas');
      else if (quickMode === 'latest' && selectedDate === 'all') parts.push('Última data');
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
    if (expandAllBtn) expandAllBtn.disabled = true;
    return;
  }

  const limit = (AppState.showAllHistory || isFiltered) ? filtered.length : 25;
  const itemsToShow = filtered.slice(0, limit);

  if (expandAllBtn) {
    expandAllBtn.disabled = false;
    const allExpanded = itemsToShow.every((sub, idx) => AppState.expandedAuditKeys.has(getRecordKey(sub, idx)));
    expandAllBtn.textContent = allExpanded ? '▴ Recolher visíveis' : '▾ Expandir visíveis';
  }

  const dateGroupCounts = {};
  itemsToShow.forEach(s => {
    const d = s.date || 'sem-data';
    dateGroupCounts[d] = (dateGroupCounts[d] || 0) + 1;
  });

  let lastGroupDate = '';
  const todayISO = getLocalDateISO();

  itemsToShow.forEach((sub, idx) => {
    const recKey = getRecordKey(sub, idx);
    const isExpanded = AppState.expandedAuditKeys.has(recKey);
    const isNew = Boolean(AppState.recentSavedRecordId && AppState.recentSavedRecordId === recKey);
    const yesItems = getYesItems(sub);
    const noItems = getNoItems(sub);
    const historic = isHistoricRecord(sub);
    const auditCode = getRecordAuditCode(sub);
    const waConfirmed = isRecordWhatsappConfirmed(sub);
    const fDate = formatDateBR(sub.date);
    const timeStr = formatSubmittedTimeBR(sub);

    if (sub.date && sub.date !== lastGroupDate) {
      lastGroupDate = sub.date;
      const groupHeader = document.createElement('div');
      groupHeader.className = 'audit-date-group-header';
      const todayBadge = sub.date === todayISO ? ' · Hoje' : '';
      const grpCount = dateGroupCounts[sub.date] || 1;
      groupHeader.innerHTML = `
        <span>${escapeHtml(formatDateWeekdayBR(sub.date))}${escapeHtml(todayBadge)}</span>
        <span class="audit-date-group-count">${grpCount} ${grpCount === 1 ? 'lançamento' : 'lançamentos'}</span>
      `;
      recent.appendChild(groupHeader);
    }

    const computedSum = yesItems.reduce((acc, item) => acc + Number(item.value || 0), 0);
    const totalNum = Number(sub.total || 0);
    const hasSumMismatch = !historic && yesItems.length > 0 && computedSum !== totalNum;

    const shareAuditCode = auditCode || (!historic ? generateAuditCode(sub.name, sub.date, sub.total) : '');
    const waUrl = buildWhatsAppShareUrl({
      name: sub.name,
      date: sub.date,
      total: sub.total,
      yesItems,
      auditCode: shareAuditCode,
      isHistoric: historic
    });

    const badgesHtml = historic
      ? `<span class="audit-pill historic">Histórico consolidado</span>`
      : `
        <span class="audit-pill items-count">${yesItems.length} de ${questions.length} Sim</span>
        <span class="audit-pill ${waConfirmed ? 'wa-ok' : 'wa-pending'}">
          ${waConfirmed ? '✓ WhatsApp confirmado' : 'Aguardando WhatsApp'}
        </span>
        ${hasSumMismatch ? '<span class="audit-pill integrity-warn">Soma divergente</span>' : ''}
      `;

    let previewHtml = '';
    if (!historic && yesItems.length > 0) {
      const topPreview = yesItems.slice(0, 3).map(it =>
        `<span class="audit-preview-chip">✓ ${escapeHtml(it.text)} (+${Number(it.value || 0)})</span>`
      ).join('');
      const rem = yesItems.length - 3;
      const moreChip = rem > 0 ? `<span class="audit-preview-chip more">+${rem} mais</span>` : '';
      previewHtml = `<div class="audit-preview-strip">${topPreview}${moreChip}</div>`;
    }

    let bodyContent = '';
    if (historic) {
      bodyContent = `<p class="audit-historic-note">Registro histórico consolidado (anterior ao detalhamento item a item).</p>`;
    } else {
      const metaSummaryText = `${yesItems.length} marcadas (Sim) · ${noItems.length} não marcadas (Não)${timeStr ? ` · Enviado às ${timeStr}` : ''}`;
      const integrityHtml = hasSumMismatch
        ? `<span class="audit-integrity-warn">Soma dos itens (${computedSum}) ≠ ${totalNum} pts</span>`
        : `<span class="audit-integrity-ok">✓ Soma conferida: +${totalNum} pts</span>`;

      const yesListHtml = yesItems.length > 0
        ? `
          <div class="audit-section-title">Atividades Cumpridas (${yesItems.length} de ${questions.length})</div>
          <ul class="audit-answers-list">
            ${yesItems.map(item => `
              <li>
                <span class="audit-ans-left">
                  <span class="audit-ans-check" aria-hidden="true">✓</span>
                  <span class="audit-ans-text-wrap">
                    ${item.category ? `<span class="audit-ans-cat">${escapeHtml(item.category)}</span>` : ''}
                    <span>${escapeHtml(item.text)}</span>
                  </span>
                </span>
                <span class="audit-ans-pts">+${Number(item.value || 0)} pts</span>
              </li>
            `).join('')}
          </ul>
        `
        : `<p class="audit-historic-note">Nenhum item marcado como "Sim" nesta rodada (0 de ${questions.length} itens).</p>`;

      const noDetailsHtml = noItems.length > 0
        ? `
          <details class="audit-no-details">
            <summary class="audit-no-summary">
              <span>Ver itens não marcados (${noItems.length} itens como Não)</span>
              <span>▾</span>
            </summary>
            <ul class="audit-no-list">
              ${noItems.map(item => `
                <li>
                  <span>${item.category ? `<strong>[${escapeHtml(item.category)}]</strong> ` : ''}${escapeHtml(item.text)}</span>
                  <span class="audit-no-pts">Não (0 pts)</span>
                </li>
              `).join('')}
            </ul>
          </details>
        `
        : '';

      bodyContent = `
        <div class="audit-meta-strip">
          <span class="audit-meta-summary">${escapeHtml(metaSummaryText)}</span>
          ${integrityHtml}
        </div>
        ${yesListHtml}
        ${noDetailsHtml}
      `;
    }

    const card = document.createElement('div');
    card.className = `history-card${isExpanded ? ' expanded' : ''}${isNew ? ' newly-saved' : ''}`;
    card.dataset.recordKey = recKey;
    card.innerHTML = `
      <button
        type="button"
        class="history-card-header"
        data-audit-key="${escapeHtml(recKey)}"
        aria-expanded="${isExpanded ? 'true' : 'false'}"
      >
        <div class="history-card-left">
          <div class="history-card-avatar" aria-hidden="true">${escapeHtml(getTeenInitials(sub.name))}</div>
          <div class="history-card-main">
            <div class="history-card-top">
              <span class="history-card-name">${escapeHtml(sub.name)}</span>
              <span class="history-card-date">${escapeHtml(fDate)}${timeStr ? ` · ${escapeHtml(timeStr)}` : ''}</span>
              ${isNew ? '<span class="history-new-pill">Recém salvo</span>' : ''}
            </div>
            <div class="history-card-badges">${badgesHtml}</div>
            ${!isExpanded ? previewHtml : ''}
          </div>
        </div>
        <div class="history-card-right">
          <span class="history-card-score">+${totalNum.toLocaleString('pt-BR')} pts</span>
          <span class="history-card-toggle">${isExpanded ? 'Ocultar ▴' : 'Ver tudo ▾'}</span>
        </div>
      </button>
      <div class="history-card-body" ${isExpanded ? '' : 'hidden'}>
        ${bodyContent}
        <div class="audit-card-actions">
          ${auditCode ? `<code class="audit-code-chip">${escapeHtml(auditCode)}</code>` : ''}
          <div class="audit-action-btns">
            <button type="button" class="btn-audit-copy" data-copy-key="${escapeHtml(recKey)}">
              Copiar resumo
            </button>
            <a class="btn-audit-wa" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener">
              Enviar / Conferir no WhatsApp
            </a>
          </div>
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
  AppState.auditQuickFilter = 'all';

  const searchInput = document.getElementById('auditSearchInput');
  const dateSelect = document.getElementById('auditDateFilter');
  if (searchInput) searchInput.value = name;
  if (dateSelect) dateSelect.value = 'all';

  const targetNorm = normalizeText(name);
  const matches = getSortedAllRecords().filter(sub => normalizeText(sub.name) === targetNorm);
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
  AppState.auditQuickFilter = 'all';

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
      if (AppState.auditDate !== 'all' && AppState.auditQuickFilter === 'latest') {
        AppState.auditQuickFilter = 'all';
      }
      renderAuditHistory();
    });
  }

  if (historyList) {
    historyList.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.btn-audit-copy');
      if (copyBtn && copyBtn.dataset.copyKey) {
        const key = copyBtn.dataset.copyKey;
        const all = getSortedAllRecords();
        const found = all.find((sub, idx) => getRecordKey(sub, idx) === key);
        if (found) {
          const yesItems = getYesItems(found);
          const historic = isHistoricRecord(found);
          const auditCode = getRecordAuditCode(found) || (!historic ? generateAuditCode(found.name, found.date, found.total) : '');
          const text = buildWhatsAppMessage({
            name: found.name,
            date: found.date,
            total: found.total,
            yesItems,
            auditCode,
            isHistoric: historic
          });
          copyTextToClipboard(text).then(ok => {
            showActionToast(ok ? 'Resumo copiado para a área de transferência!' : 'Não foi possível copiar automaticamente.');
          });
        }
        return;
      }

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
  }, 3800);
}
