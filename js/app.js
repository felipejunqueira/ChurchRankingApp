/**
 * ─────────────────────────────────────────────────────────────
 * LÓGICA DE APLICAÇÃO, ENVIO, MODAL, CONFETES E PWA
 * ─────────────────────────────────────────────────────────────
 */

function submitScore() {
  if (!selectedTeenName) {
    alert('Por favor, selecione o seu nome clicando em um dos botões acima!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Data capturada 100% automaticamente
  const now = new Date();
  const dateISO = now.toISOString().slice(0, 10);
  const dateFormatted = now.toLocaleDateString('pt-BR');

  let total = 0;
  const detailedAnswers = questions.map((q, i) => {
    const choice = state[i] || 'no';
    if (choice === 'yes') total += q.value;
    return {
      index: i,
      category: q.category,
      text: q.text,
      value: q.value,
      choice
    };
  });

  // 1. Salvar no banco de dados local
  const record = {
    id: 'sub_' + Date.now(),
    name: selectedTeenName,
    date: dateISO,
    total,
    answers: detailedAnswers,
    submittedAt: now.toISOString()
  };
  TeenDB.save(record);

  // 2. Atualizar ranking
  renderRanking();

  // 3. Disparar confetes festivos! 🎊
  triggerConfetti();

  // 4. Preparar WhatsApp formatado
  const yesItems = detailedAnswers.filter(a => a.choice === 'yes');
  
  let msg = `⭐ *PONTUAÇÃO ESCOLA SABATINA TEENS* ⭐\n`;
  msg += `👤 *Adolescente:* ${selectedTeenName}\n`;
  msg += `📅 *Data:* ${dateFormatted}\n`;
  msg += `🏆 *TOTAL CONQUISTADO:* ${total} PONTOS!\n\n`;
  
  if (yesItems.length > 0) {
    msg += `✅ *Itens cumpridos hoje:*\n`;
    yesItems.forEach(item => {
      msg += `• ${item.text} (+${item.value} pts)\n`;
    });
  } else {
    msg += `Nenhum item marcado com Sim hoje.\n`;
  }

  msg += `\n🎯 _Enviado via Tabela Oficial de Pontos Teens_`;

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;

  // 5. Exibir Modal de Sucesso
  document.getElementById('modalTeenName').textContent = `Parabéns, ${selectedTeenName}!`;
  document.getElementById('modalFinalScore').textContent = `+${total}`;
  document.getElementById('modalWaBtn').href = waUrl;
  document.getElementById('successModal').classList.add('open');
}

function closeModal() {
  document.getElementById('successModal').classList.remove('open');
}

function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
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
      requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(render);
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

function initApp() {
  setupAutoDate();
  setupTeenSelector();
  buildQuestionsUI();
  renderRanking();
}

// Iniciar Aplicação
initApp();
