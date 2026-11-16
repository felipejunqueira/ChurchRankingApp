/**
 * ─────────────────────────────────────────────────────────────
 * LÓGICA DE APLICAÇÃO, GATE DO WHATSAPP, MODAL, CONFETES E PWA
 * ─────────────────────────────────────────────────────────────
 */

const ModalGateState = {
  isOpen: false,
  waTriggered: false,
  waOpened: false,
  confirmed: false,
  currentWaUrl: '',
  savedRecordId: ''
};

async function submitScore() {
  if (AppState.isSubmitting || ModalGateState.isOpen) return;

  if (!AppState.selectedTeenName) {
    alert('Por favor, selecione o seu nome clicando em um dos botões acima!');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const dateISO = getLocalDateISO();
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

  if (total === 0) {
    const confirmZero = confirm('Você não marcou nenhum item com "Sim" (pontuação 0). Deseja salvar e enviar mesmo assim?');
    if (!confirmZero) return;
  }

  const submitBtn = document.getElementById('btnSubmitScore');
  const submitLabel = submitBtn ? submitBtn.querySelector('.btn-submit-label') : null;
  AppState.isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('is-saving');
  }
  if (submitLabel) submitLabel.textContent = 'Salvando...';

  let cloudPromise = null;
  try {
    const auditCode = generateAuditCode(AppState.selectedTeenName, dateISO, total);
    const yesItems = detailedAnswers.filter(a => a.choice === 'yes');

    const record = {
      id: 'sub_' + Date.now(),
      name: AppState.selectedTeenName,
      date: dateISO,
      total,
      answers: detailedAnswers,
      auditCode,
      submittedAt: new Date().toISOString()
    };

    const saveResult = TeenDB.save(record);
    const savedRecord = (saveResult && saveResult.savedRecord) ? saveResult.savedRecord : record;
    cloudPromise = saveResult && saveResult.cloudPromise ? saveResult.cloudPromise : null;

    const waUrl = buildWhatsAppShareUrl({
      name: AppState.selectedTeenName,
      date: dateISO,
      total,
      yesItems,
      auditCode,
      isHistoric: false
    });

    ModalGateState.isOpen = true;
    ModalGateState.confirmed = false;
    ModalGateState.waOpened = false;
    ModalGateState.waTriggered = false;
    ModalGateState.currentWaUrl = waUrl;
    ModalGateState.savedRecordId = savedRecord && savedRecord.id ? savedRecord.id : record.id;

    // Abre o WhatsApp sincronamente dentro do clique antes de qualquer await
    try {
      window.open(waUrl, '_blank', 'noopener');
      ModalGateState.waTriggered = true;
    } catch (err) {
      console.warn('Não foi possível abrir o WhatsApp automaticamente:', err);
    }

    renderRanking();
    openVerificationGateModal({
      teenName: AppState.selectedTeenName,
      total,
      auditCode,
      yesItems,
      waUrl,
      hasCloudPromise: Boolean(cloudPromise)
    });
    triggerConfetti();
  } finally {
    AppState.isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-saving');
    }
    if (submitLabel) submitLabel.textContent = 'Salvar & Enviar no WhatsApp';
  }

  if (cloudPromise) {
    try {
      const ok = await cloudPromise;
      updateModalSyncStatus(Boolean(ok));
      renderRanking();
    } catch (err) {
      console.warn('Falha ao aguardar sincronização na nuvem:', err);
      updateModalSyncStatus(false);
    }
  }
}

function openVerificationGateModal({ teenName, total, auditCode, yesItems, waUrl, hasCloudPromise }) {
  const modal = document.getElementById('successModal');
  const modalName = document.getElementById('modalTeenName');
  const modalScore = document.getElementById('modalFinalScore');
  const modalAuditCode = document.getElementById('modalAuditCode');
  const modalItemsCount = document.getElementById('modalItemsCount');
  const modalItemsList = document.getElementById('modalMarkedItemsList');
  const modalWa = document.getElementById('modalWaBtn');
  const modalSync = document.getElementById('modalSyncStatus');
  const gateWarning = document.getElementById('modalGateWarning');

  if (modalName) modalName.textContent = `Parabéns, ${teenName}!`;
  if (modalScore) modalScore.textContent = `+${Number(total || 0)}`;
  if (modalAuditCode) modalAuditCode.textContent = auditCode;
  if (modalItemsCount) modalItemsCount.textContent = `${yesItems.length} de ${questions.length} itens`;
  if (modalWa) modalWa.href = waUrl;
  if (gateWarning) gateWarning.classList.remove('visible');

  if (modalItemsList) {
    if (yesItems.length > 0) {
      modalItemsList.innerHTML = yesItems.map(item => `
        <li>
          <span>✅ ${escapeHtml(item.text)}</span>
          <span class="modal-item-pts">+${Number(item.value || 0)} pts</span>
        </li>
      `).join('');
    } else {
      modalItemsList.innerHTML = `<li class="modal-items-empty"><span>Nenhum item marcado nesta rodada (0 pts).</span></li>`;
    }
  }

  if (modalSync) {
    modalSync.className = 'modal-sync-status';
    if (hasCloudPromise) {
      modalSync.innerHTML = '<span class="sync-spinner" aria-hidden="true"></span> Salvando na nuvem...';
    } else {
      modalSync.classList.add('local');
      modalSync.textContent = '📱 Salvo neste dispositivo';
    }
  }

  updateModalGateUI();

  if (modal) {
    if (typeof modal.showModal === 'function') {
      if (!modal.open) modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }
}

function updateModalSyncStatus(synced) {
  const modalSync = document.getElementById('modalSyncStatus');
  if (!modalSync) return;
  modalSync.className = 'modal-sync-status';
  if (synced) {
    modalSync.classList.add('synced');
    modalSync.textContent = '☁️ Salvo na nuvem! Ranking atualizado.';
  } else {
    modalSync.classList.add('local');
    modalSync.textContent = '📱 Salvo no aparelho — sincronizará quando online.';
  }
}

function updateModalGateUI() {
  const stepWa = document.getElementById('gateStepWa');
  const stepWaIcon = document.getElementById('gateStepWaIcon');
  const stepWaText = document.getElementById('gateStepWaText');
  const stepConfirm = document.getElementById('gateStepConfirm');
  const confirmBtn = document.getElementById('modalConfirmBtn');

  if (stepWa && stepWaIcon && stepWaText) {
    if (ModalGateState.waOpened) {
      stepWa.className = 'check-step done';
      stepWaIcon.textContent = '✓';
      stepWaText.textContent = 'WhatsApp aberto! Envie no grupo e confirme abaixo';
    } else if (ModalGateState.waTriggered) {
      stepWa.className = 'check-step active';
      stepWaIcon.textContent = '📲';
      stepWaText.textContent = 'WhatsApp acionado! Se não abriu, use o botão verde';
    } else {
      stepWa.className = 'check-step active';
      stepWaIcon.textContent = '1';
      stepWaText.textContent = 'Envie a mensagem no grupo do WhatsApp';
    }
  }

  const canConfirm = Boolean(ModalGateState.waTriggered || ModalGateState.waOpened);
  if (confirmBtn) {
    confirmBtn.disabled = !canConfirm;
  }
  if (stepConfirm) {
    stepConfirm.className = canConfirm ? 'check-step active' : 'check-step pending';
  }
}

function showGateWarning() {
  const gateWarning = document.getElementById('modalGateWarning');
  if (gateWarning) gateWarning.classList.add('visible');
}

function confirmWhatsAppGate() {
  if (!(ModalGateState.waTriggered || ModalGateState.waOpened)) {
    showGateWarning();
    return;
  }

  ModalGateState.confirmed = true;
  ModalGateState.isOpen = false;

  if (ModalGateState.savedRecordId && typeof TeenDB.confirmWhatsapp === 'function') {
    Promise.resolve(TeenDB.confirmWhatsapp(ModalGateState.savedRecordId))
      .then(() => renderRanking())
      .catch(err => console.warn('Aviso ao confirmar WhatsApp na nuvem:', err));
  }

  const modal = document.getElementById('successModal');
  if (modal) {
    if (typeof modal.close === 'function') {
      if (modal.open) modal.close('confirmed');
    } else {
      modal.removeAttribute('open');
    }
  }

  AppState.reset();
  buildQuestionsUI();
  updateTotal();
  updateProgress();
  renderRanking();
  showActionToast('Envio confirmado no WhatsApp! Formulário pronto.');
}

function closeModal() {
  if (!ModalGateState.confirmed) {
    showGateWarning();
    return;
  }
  confirmWhatsAppGate();
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('successModal');
  const modalWaBtn = document.getElementById('modalWaBtn');

  if (modalWaBtn) {
    modalWaBtn.addEventListener('click', () => {
      ModalGateState.waOpened = true;
      const gateWarning = document.getElementById('modalGateWarning');
      if (gateWarning) gateWarning.classList.remove('visible');
      updateModalGateUI();
    });
  }

  if (modal) {
    // Impede fechar com Escape enquanto a confirmação obrigatória no WhatsApp não ocorrer
    modal.addEventListener('cancel', (e) => {
      if (!ModalGateState.confirmed) {
        e.preventDefault();
        showGateWarning();
      }
    });

    // Proteção extra em navegadores antigos caso tentem fechar antes de confirmar
    modal.addEventListener('close', () => {
      if (ModalGateState.isOpen && !ModalGateState.confirmed) {
        if (typeof modal.showModal === 'function' && !modal.open) {
          modal.showModal();
          showGateWarning();
        }
      }
    });
  }
});

// Animação de confetes com cancelamento do frame anterior (previne vazamento de CPU)
let confettiAnimId = null;

function triggerConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

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
  setupAuditControls();
  renderRanking();

  // Conectar com a Nuvem Supabase e habilitar Realtime
  TeenDB.initRealtime();
  await TeenDB.fetchFromCloud();
  renderRanking();
}

// Iniciar Aplicação
initApp();
