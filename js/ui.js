/**
 * ─────────────────────────────────────────────────────────────
 * ESTADO CENTRALIZADO DA APLICAÇÃO (SEM VARIÁVEIS SOLTAS)
 * ─────────────────────────────────────────────────────────────
 */
const AppState = {
  answers: new Array(questions.length).fill(null),
  activeCategory: 'all',
  selectedTeenName: '',
  isSubmitting: false,

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

/**
 * ─────────────────────────────────────────────────────────────
 * INTERFACE DO USUÁRIO & COMPONENTES VISUAIS
 * ─────────────────────────────────────────────────────────────
 */

function setupAutoDate() {
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dateFormatted = now.toLocaleDateString('pt-BR', options);
  
  // Capitalizar primeira letra do dia da semana
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

  // Lembrar o último usuário selecionado
  const lastUser = TeenDB.getLastUser();
  const initialChoice = lastUser.name || (REGISTERED_TEENS[0] ? REGISTERED_TEENS[0].name : '');

  // 1. Chips dos Adolescentes Cadastrados
  REGISTERED_TEENS.forEach(teen => {
    const chip = document.createElement('div');
    chip.className = 'teen-chip';
    chip.id = `teen-chip-${teen.name.replace(/\s+/g, '_')}`;
    chip.onclick = () => selectTeen(teen.name);

    chip.innerHTML = `
      <div class="teen-avatar">${teen.initial}</div>
      <div class="teen-name-text">${teen.name}</div>
    `;
    grid.appendChild(chip);

    const opt = document.createElement('option');
    opt.value = teen.name;
    opt.textContent = teen.name;
    select.appendChild(opt);
  });

  // 2. Chip Clicável de Visitante na Grade
  const visitorChip = document.createElement('div');
  visitorChip.className = 'teen-chip teen-chip-visitor';
  visitorChip.id = 'teen-chip-visitor';
  visitorChip.onclick = () => promptCustomVisitor();
  visitorChip.innerHTML = `
    <div class="teen-avatar">+</div>
    <div class="teen-name-text">Visitante</div>
  `;
  grid.appendChild(visitorChip);

  // 3. Opção de Visitante / Novo Aluno no Dropdown
  const visitorOpt = document.createElement('option');
  visitorOpt.value = "__custom__";
  visitorOpt.textContent = "+ Adicionar Visitante";
  select.appendChild(visitorOpt);

  // Selecionar o inicial
  if (initialChoice) {
    selectTeen(initialChoice);
  }
}

function promptCustomVisitor() {
  const custom = prompt('Digite o nome do visitante ou novo adolescente:');
  if (custom && custom.trim()) {
    const clean = custom.trim().replace(/["<>]/g, '').slice(0, 30);
    if (!clean) return;

    // Adiciona ao select se ainda não estiver listado
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
    // Se cancelou ou deixou vazio, restaura o dropdown
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

  // Atualizar classe visual nos chips
  document.querySelectorAll('.teen-chip').forEach(chip => chip.classList.remove('selected'));
  const safeId = `teen-chip-${name.replace(/\s+/g, '_')}`;
  let activeChip = document.getElementById(safeId);
  
  if (!activeChip && isVisitor) {
    activeChip = document.getElementById('teen-chip-visitor');
    if (activeChip) {
      const nameText = activeChip.querySelector('.teen-name-text');
      if (nameText) nameText.textContent = name;
    }
  }
  if (activeChip) activeChip.classList.add('selected');

  // Atualizar Dropdown
  const select = document.getElementById('teenSelect');
  if (select) {
    const optionsArr = Array.from(select.options || []);
    const match = optionsArr.some(o => o.value === name);
    select.value = match ? name : '';
  }

  // Atualizar Preview
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
    const isVisible = checkCategoryMatch(q, AppState.activeCategory);
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `card-${i}`;
    if (!isVisible) card.style.display = 'none';

    card.innerHTML = `
      <div class="q-top-row">
        <div class="q-body">
          <span class="q-cat-tag">${q.category}</span>
          <div class="q-text">${q.text}</div>
          ${q.note ? `<div class="q-note">${q.note}</div>` : ''}
        </div>
        <span class="q-points-badge">+${q.value} pts</span>
      </div>
      <div class="btn-group">
        <button class="btn-choice btn-yes" id="yes-${i}" onclick="answer(${i}, 'yes')">
          Sim (+${q.value})
        </button>
        <button class="btn-choice btn-no" id="no-${i}" onclick="answer(${i}, 'no')">
          Não (0 pts)
        </button>
      </div>
    `;
    list.appendChild(card);
  });
}

function checkCategoryMatch(question, filter) {
  return filter === 'all' || question.group === filter;
}

function filterCategory(cat, btn) {
  AppState.activeCategory = cat;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

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

function updateTotal() {
  const total = AppState.calculateTotal();
  const el = document.getElementById('totalScore');
  if (!el) return;

  el.textContent = `${total} pts`;

  // Animação suave nativa via Web Animations API (elimina hack de reflow forçado)
  if (typeof el.animate === 'function') {
    el.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.2)' },
      { transform: 'scale(1)' }
    ], {
      duration: 220,
      easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });
  }
}

function updateProgress() {
  const answered = AppState.getAnsweredCount();
  const total = questions.length;
  const pct = Math.round((answered / total) * 100);

  const label = document.getElementById('progressText');
  const fill = document.getElementById('progressFill');

  if (label) label.textContent = `${answered} de ${total} (${pct}%)`;
  if (fill) fill.style.width = `${pct}%`;
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

  if (tabScore) tabScore.classList.toggle('active', isScore);
  if (tabRank) tabRank.classList.toggle('active', !isScore);

  if (tabScoreBtn) tabScoreBtn.classList.toggle('active', isScore);
  if (tabRankBtn) tabRankBtn.classList.toggle('active', !isScore);

  if (stickyBar) stickyBar.style.display = isScore ? 'block' : 'none';

  if (!isScore) {
    renderRanking();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function renderRanking() {
  const leaderboard = TeenDB.getLeaderboard();
  const podium = document.getElementById('podiumArea');
  const list = document.getElementById('leaderboardList');
  const recent = document.getElementById('recentHistoryList');

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
    if (recent) recent.innerHTML = '';
    return;
  }

  // PÓDIO DOS 3 PRIMEIROS
  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  if (podium) {
    podium.innerHTML = `
      <!-- 2º LUGAR -->
      <div class="podium-spot second">
        ${top2 ? `
          <div class="podium-avatar">🥈</div>
          <div class="podium-name">${top2.name}</div>
          <div class="podium-pts">${top2.totalPoints.toLocaleString('pt-BR')} pts</div>
          <div class="podium-pillar">2</div>
        ` : ''}
      </div>

      <!-- 1º LUGAR -->
      <div class="podium-spot first">
        <div class="podium-avatar">
          <span class="podium-crown">👑</span>
          🥇
        </div>
        <div class="podium-name">${top1.name}</div>
        <div class="podium-pts">${top1.totalPoints.toLocaleString('pt-BR')} pts</div>
        <div class="podium-pillar">1</div>
      </div>

      <!-- 3º LUGAR -->
      <div class="podium-spot third">
        ${top3 ? `
          <div class="podium-avatar">🥉</div>
          <div class="podium-name">${top3.name}</div>
          <div class="podium-pts">${top3.totalPoints.toLocaleString('pt-BR')} pts</div>
          <div class="podium-pillar">3</div>
        ` : ''}
      </div>
    `;
  }

  // LISTA COMPLETA
  if (list) {
    list.innerHTML = '';
    leaderboard.forEach((user, index) => {
      const pos = index + 1;
      const row = document.createElement('div');
      row.className = 'leader-row';

      let rankClass = '';
      let medal = `#${pos}`;
      if (pos === 1) { rankClass = 'top-1'; medal = '🥇'; }
      else if (pos === 2) { rankClass = 'top-2'; medal = '🥈'; }
      else if (pos === 3) { rankClass = 'top-3'; medal = '🥉'; }

      row.innerHTML = `
        <div class="leader-rank ${rankClass}">${medal}</div>
        <div class="leader-info">
          <div class="leader-name">${user.name}</div>
          <div class="leader-sub">${user.count} lançamento(s) somados</div>
        </div>
        <div class="leader-score">${user.totalPoints.toLocaleString('pt-BR')} pts</div>
      `;
      list.appendChild(row);
    });
  }

  // ÚLTIMOS REGISTROS ENVIADOS
  if (recent) {
    const all = [...TeenDB.getAll()]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 25);
    recent.innerHTML = '';
    all.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'history-card';
      const fDate = formatDateBR(sub.date);
      card.innerHTML = `
        <div>
          <span class="history-card-name">${sub.name}</span>
          <span class="history-card-date">(${fDate})</span>
        </div>
        <div class="history-card-score">
          +${Number(sub.total).toLocaleString('pt-BR')} pts
        </div>
      `;
      recent.appendChild(card);
    });
  }
}
