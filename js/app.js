/**
 * ─────────────────────────────────────────────────────────────
 * LÓGICA DE APLICAÇÃO, ENVIO, MODAL, CONFETES E PWA
 * ─────────────────────────────────────────────────────────────
 */

function submitScore() {
  if (AppState.isSubmitting) return;

  if (!AppState.selectedTeenName) {
    alert('Por favor, selecione o seu nome clicando em um dos botões acima!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Data capturada localmente (sem viés UTC de fuso horário)
  const dateISO = getLocalDateISO();
  const dateFormatted = formatDateBR(dateISO);

  let total = 0;
  const detailedAnswers = questions.map((q, i) => {
    const choice = AppState.getAnswer(i) || 'no';
    if (choice === 'yes') total += q.value;
    return {
      index: i,
      category: q.category,
      text: q.text,
      value: q.value,
      choice
    };
  });

  // Proteção se bater o dedo e enviar com 0 pontos sem querer
  if (total === 0) {
    const confirmZero = confirm('Você não marcou nenhum item com "Sim" (pontuação 0). Deseja salvar mesmo assim?');
    if (!confirmZero) return;
  }

  // Trava temporária contra duplo clique / spam
  AppState.isSubmitting = true;
  setTimeout(() => { AppState.isSubmitting = false; }, 1500);

  // 1. Salvar no banco de dados local com prevenção automática de duplicatas na mesma data
  const record = {
    id: 'sub_' + Date.now(),
    name: AppState.selectedTeenName,
    date: dateISO,
    total,
    answers: detailedAnswers,
    submittedAt: new Date().toISOString()
  };
  TeenDB.save(record);

  // 2. Atualizar ranking em tempo real
  renderRanking();

  // 3. Disparar confetes festivos com controle de ciclo de vida
  triggerConfetti();

  // 4. Preparar mensagem formatada para WhatsApp
  const yesItems = detailedAnswers.filter(a => a.choice === 'yes');
  
  let msg = `*ESCOLA SABATINA DOS ADOLESCENTES*\n`;
  msg += `*Adolescente:* ${AppState.selectedTeenName}\n`;
  msg += `*Data:* ${dateFormatted}\n`;
  msg += `*Pontuação da semana:* +${total} pontos\n\n`;
  
  if (yesItems.length > 0) {
    msg += `*Atividades cumpridas:*\n`;
    yesItems.forEach(item => {
      msg += `• ${item.text} (+${item.value} pts)\n`;
    });
  } else {
    msg += `Nenhum item marcado nesta rodada.\n`;
  }

  msg += `\n_Registro enviado via Tabela de Pontos dos Adolescentes_`;

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;

  // 5. Exibir Modal de Sucesso
  const modalName = document.getElementById('modalTeenName');
  const modalScore = document.getElementById('modalFinalScore');
  const modalWa = document.getElementById('modalWaBtn');
  const modal = document.getElementById('successModal');

  if (modalName) modalName.textContent = `Parabéns, ${AppState.selectedTeenName}!`;
  if (modalScore) modalScore.textContent = `+${total}`;
  if (modalWa) modalWa.href = waUrl;
  if (modal) modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('successModal');
  if (modal) modal.classList.remove('open');
  // Prepara o formulário limpo para a próxima avaliação
  AppState.reset();
  buildQuestionsUI();
  updateTotal();
  updateProgress();
}

// Fechar modal ao clicar fora ou apertar Escape (prevenção de toque acidental)
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Animação de confetes com cancelamento do frame anterior (previne vazamento de CPU)
let confettiAnimId = null;

function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (confettiAnimId) {
    cancelAnimationFrame(confettiAnimId);
    confettiAnimId = null;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#c88226', '#15803d', '#7c4424', '#f59e0b', '#dc2626', '#b45309'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.7) * 18,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: (Math.random() - 0.5) * 12,
      alpha: 1
    });
  }

  let frame = 0;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.rotation += p.rSpeed;
      p.alpha -= 0.012;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    frame++;
    if (alive && frame < 120) {
      confettiAnimId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettiAnimId = null;
    }
  }
  confettiAnimId = requestAnimationFrame(render);
}

// ─── PWA & Service Worker ───
let deferredPrompt = null;
const banner = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissBanner');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (banner) banner.classList.add('visible');
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (banner) banner.classList.remove('visible');
  });
}

if (dismissBtn) {
  dismissBtn.addEventListener('click', () => {
    if (banner) banner.classList.remove('visible');
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => console.log('SW ativo:', reg.scope))
      .catch(err => console.error('Erro no SW:', err));
  });
}

async function initApp() {
  setupAutoDate();
  setupTeenSelector();
  buildQuestionsUI();
  renderRanking();

  // Conectar com a Nuvem Supabase e habilitar Realtime
  TeenDB.initRealtime();
  await TeenDB.fetchFromCloud();
  renderRanking();
}

// Iniciar Aplicação
initApp();
