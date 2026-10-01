/**
 * ─────────────────────────────────────────────────────────────
 * INTERFACE DO USUÁRIO, COMPONENTES & ESTADOS
 * ─────────────────────────────────────────────────────────────
 */
const state = new Array(questions.length).fill(null);
let activeCategory = 'all';
let selectedTeenName = '';

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
  
  grid.innerHTML = '';
  select.innerHTML = '<option value="">-- Selecione na lista suspensa --</option>';

  // Lembrar o último usuário
  const lastUser = TeenDB.getLastUser();
  let initialChoice = lastUser.name || (REGISTERED_TEENS[0] ? REGISTERED_TEENS[0].name : '');

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
      const exists = Array.from(select.options).some(o => o.value.toLowerCase() === clean.toLowerCase());
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
    if (select) select.value = selectedTeenName || '';
  }
}

function selectTeen(name, isVisitor = false) {
  selectedTeenName = name;

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
    const match = Array.from(select.options).some(o => o.value === name);
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
  list.innerHTML = '';

  questions.forEach((q, i) => {
    const isVisible = checkCategoryMatch(q.category, activeCategory);
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `card-${i}`;
    if (!isVisible) card.style.display = 'none';

    card.innerHTML = `
      <div class="q-top-row">
        <div style="flex:1">
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

function checkCategoryMatch(cat, filter) {
  if (filter === 'all') return true;
  if (filter === 'Liderança' && cat.includes('Liderança')) return true;
  if (filter === 'Missão' && (cat.includes('Missão') || cat.includes('Competição') || cat.includes('Engajamento'))) return true;
  if (filter === 'Estudo' && cat.includes('Estudo')) return true;
  if (filter === 'Comunidade' && (cat.includes('Comunidade') || cat.includes('Serviço'))) return true;
  if (filter === 'Zelo' && (cat.includes('Zelo') || cat.includes('Generosidade') || cat.includes('Mordomia') || cat.includes('Pontualidade') || cat.includes('Assiduidade') || cat.includes('Compromisso') || cat.includes('Espiritualidade'))) return true;
  return false;
}

function filterCategory(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  questions.forEach((q, i) => {
    const card = document.getElementById(`card-${i}`);
    if (card) {
      card.style.display = checkCategoryMatch(q.category, cat) ? 'flex' : 'none';
    }
  });
}

function answer(index, choice) {
  state[index] = choice;
  
  if (navigator.vibrate) navigator.vibrate(25);

  const card = document.getElementById(`card-${index}`);
  const yesBtn = document.getElementById(`yes-${index}`);
  const noBtn = document.getElementById(`no-${index}`);

  yesBtn.classList.toggle('selected', choice === 'yes');
  noBtn.classList.toggle('selected', choice === 'no');

  card.classList.toggle('answered-yes', choice === 'yes');
  card.classList.toggle('answered-no', choice === 'no');

  updateTotal();
  updateProgress();
}

function updateTotal() {
  let total = 0;
  state.forEach((s, i) => {
    if (s === 'yes') total += questions[i].value;
  });

  const el = document.getElementById('totalScore');
  el.textContent = `${total} pts`;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function updateProgress() {
  const answered = state.filter(s => s !== null).length;
  const total = questions.length;
  const pct = Math.round((answered / total) * 100);

  const label = document.getElementById('progressText');
  const fill = document.getElementById('progressFill');

  if (label) label.textContent = `${answered} de ${total} (${pct}%)`;
  if (fill) fill.style.width = `${pct}%`;
}

function resetAll() {
  if (state.some(s => s !== null)) {
    if (!confirm('Deseja zerar as respostas da pontuação atual?')) return;
  }
  state.fill(null);
  buildQuestionsUI();
  updateTotal();
  updateProgress();
}

function switchTab(tab) {
  const isScore = tab === 'score';
  
  document.getElementById('tabScore').classList.toggle('active', isScore);
  document.getElementById('tabRank').classList.toggle('active', !isScore);

  document.getElementById('tabScoreBtn').classList.toggle('active', isScore);
  document.getElementById('tabRankBtn').classList.toggle('active', !isScore);

  document.getElementById('stickyBar').style.display = isScore ? 'block' : 'none';

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
    podium.innerHTML = '';
    list.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-3);">
        <div style="font-size:2.5rem;margin-bottom:12px;">🏆</div>
        <h4>Nenhum ponto registrado ainda</h4>
        <p>Preencha sua pontuação na aba anterior e clique em "Salvar & Enviar" para inaugurar o ranking!</p>
      </div>
    `;
    recent.innerHTML = '';
    return;
  }

  // PÓDIO DOS 3 PRIMEIROS
  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

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

  // LISTA COMPLETA
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

  // ÚLTIMOS REGISTROS ENVIADOS (ordenados da data mais recente para a mais antiga)
  const all = [...TeenDB.getAll()]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 25);
  recent.innerHTML = '';
  all.forEach(sub => {
    const card = document.createElement('div');
    card.style.cssText = 'background:#ffffff;border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;font-size:0.88rem;box-shadow:var(--shadow-sm);';
    const fDate = sub.date ? sub.date.split('-').reverse().join('/') : '';
    card.innerHTML = `
      <div>
        <strong style="color:var(--text-1);">${sub.name}</strong>
        <span style="color:var(--text-3);font-size:0.78rem;margin-left:6px;">(${fDate})</span>
      </div>
      <div style="font-family:'Outfit',sans-serif;font-weight:800;color:var(--primary);">
        +${sub.total.toLocaleString('pt-BR')} pts
      </div>
    `;
    recent.appendChild(card);
  });
}
