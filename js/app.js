/**
 * ─────────────────────────────────────────────────────────────
 * LÓGICA DE APLICAÇÃO, GATE DO WHATSAPP, MODAL, CONFETES E PWA
 * ─────────────────────────────────────────────────────────────
 */

const ModalGateState = {
  isOpen: false,
  waTriggered: false,
  waOpened: false,
  waReturned: false,
  confirmed: false,
  cloudSynced: false,
  launchTimestamp: 0,
  currentWaUrl: '',
  currentWaText: '',
  savedRecordId: '',
  savedRecordName: '',
  savedRecordDate: ''
};

async function submitScore() {
  if (AppState.isSubmitting || ModalGateState.isOpen) return;

  if (!AppState.selectedTeenName) {
    showActionToast('Selecione o seu nome antes de salvar!');
    const studentCard = document.querySelector('.student-card');
    if (studentCard) {
      studentCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    const teenName = AppState.selectedTeenName;
    const auditCode = generateAuditCode(teenName, dateISO, total);
    const yesItems = detailedAnswers.filter(a => a.choice === 'yes');

    const record = {
      id: 'sub_' + Date.now(),
      name: teenName,
      date: dateISO,
      total,
      answers: detailedAnswers,
      auditCode,
      submittedAt: new Date().toISOString()
    };

    const saveResult = TeenDB.save(record);
    const savedRecord = (saveResult && saveResult.savedRecord) ? saveResult.savedRecord : record;
    cloudPromise = saveResult && saveResult.cloudPromise ? saveResult.cloudPromise : null;

    const waParams = {
      name: teenName,
      date: dateISO,
      total,
      yesItems,
      auditCode,
      isHistoric: false
    };
    const waText = buildWhatsAppMessage(waParams);
    const waUrl = buildWhatsAppShareUrl(waParams);

    const resolvedId = savedRecord && savedRecord.id ? String(savedRecord.id) : record.id;
    AppState.recentSavedRecordId = resolvedId;

    ModalGateState.isOpen = true;
    ModalGateState.confirmed = false;
    ModalGateState.waOpened = false;
    ModalGateState.waReturned = false;
    ModalGateState.waTriggered = false;
    ModalGateState.cloudSynced = false;
    ModalGateState.launchTimestamp = Date.now();
    ModalGateState.currentWaUrl = waUrl;
    ModalGateState.currentWaText = waText;
    ModalGateState.savedRecordId = resolvedId;
    ModalGateState.savedRecordName = teenName;
    ModalGateState.savedRecordDate = dateISO;

    // Tenta abrir o WhatsApp dentro do gesto de clique sem perder detecção de bloqueio de popup
    let popupOpened = false;
    try {
      const popup = window.open(waUrl, '_blank');
      if (popup) {
        popupOpened = true;
        try {
          popup.opener = null;
        } catch (_) {
          // Cross-origin opener cleanup ignored if restricted
        }
      }
    } catch (err) {
      console.warn('Não foi possível abrir o WhatsApp automaticamente:', err);
    }
    ModalGateState.waTriggered = popupOpened;

    renderRanking();
    openVerificationGateModal({
      teenName,
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
      ModalGateState.cloudSynced = Boolean(ok);
      updateModalSyncStatus(Boolean(ok));
      renderRanking();
    } catch (err) {
      console.warn('Falha ao aguardar sincronização na nuvem:', err);
      ModalGateState.cloudSynced = false;
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
  const modalCopyBtn = document.getElementById('modalCopyWaBtn');
  const modalSync = document.getElementById('modalSyncStatus');
  const gateWarning = document.getElementById('modalGateWarning');

  if (modalName) modalName.textContent = `Parabéns, ${teenName}!`;
  if (modalScore) modalScore.textContent = `+${Number(total || 0)}`;
  if (modalAuditCode) modalAuditCode.textContent = auditCode;
  if (modalItemsCount) modalItemsCount.textContent = `${yesItems.length} de ${questions.length} itens`;
  if (modalWa) modalWa.href = waUrl;
  if (modalCopyBtn) modalCopyBtn.textContent = 'Copiar mensagem para o WhatsApp';
  if (gateWarning) gateWarning.classList.remove('visible');

  if (modalItemsList) {
    if (yesItems.length > 0) {
      modalItemsList.innerHTML = yesItems.map(item => `
        <li>
          <span class="modal-item-left">
            ${item.category ? `<span class="modal-item-cat">${escapeHtml(item.category)}</span>` : ''}
            <span>${escapeHtml(item.text)}</span>
          </span>
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
      modalSync.textContent = 'Salvo neste dispositivo';
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
    modalSync.textContent = 'Salvo na nuvem! Respostas e ranking atualizados.';
  } else {
    modalSync.classList.add('local');
    modalSync.textContent = 'Salvo no aparelho — sincronizará quando online.';
  }
}

function updateModalGateUI() {
  const stepWa = document.getElementById('gateStepWa');
  const stepWaIcon = document.getElementById('gateStepWaIcon');
  const stepWaText = document.getElementById('gateStepWaText');
  const stepConfirm = document.getElementById('gateStepConfirm');
  const stepConfirmIcon = document.getElementById('gateStepConfirmIcon');
  const stepConfirmText = document.getElementById('gateStepConfirmText');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  const gateWarning = document.getElementById('modalGateWarning');

  const canConfirm = Boolean(ModalGateState.waTriggered || ModalGateState.waOpened);

  if (stepWa && stepWaIcon && stepWaText) {
    if (ModalGateState.waOpened && ModalGateState.waReturned) {
      stepWa.className = 'check-step done';
      stepWaIcon.textContent = '✓';
      stepWaText.textContent = 'Você voltou do WhatsApp! Confirme abaixo para finalizar';
    } else if (ModalGateState.waOpened) {
      stepWa.className = 'check-step done';
      stepWaIcon.textContent = '✓';
      stepWaText.textContent = 'WhatsApp aberto! Envie no grupo e confirme abaixo';
    } else if (ModalGateState.waTriggered && ModalGateState.waReturned) {
      stepWa.className = 'check-step done';
      stepWaIcon.textContent = '✓';
      stepWaText.textContent = 'WhatsApp acionado! Se já enviou no grupo, confirme abaixo';
    } else if (ModalGateState.waTriggered) {
      stepWa.className = 'check-step active';
      stepWaIcon.textContent = '1';
      stepWaText.textContent = 'WhatsApp aberto em outra janela! Envie ou use o botão verde';
    } else {
      stepWa.className = 'check-step active';
      stepWaIcon.textContent = '1';
      stepWaText.textContent = 'Seu navegador bloqueou a abertura automática — toque no botão verde abaixo';
    }
  }

  if (confirmBtn) {
    confirmBtn.disabled = !canConfirm;
    confirmBtn.classList.toggle('ready-to-confirm', Boolean(canConfirm && (ModalGateState.waOpened || ModalGateState.waReturned)));
  }

  if (stepConfirm) {
    stepConfirm.className = canConfirm ? 'check-step active' : 'check-step pending';
  }
  if (stepConfirmIcon) {
    stepConfirmIcon.textContent = '2';
  }
  if (stepConfirmText) {
    stepConfirmText.textContent = canConfirm
      ? 'Confirme abaixo após enviar no grupo para ver na Auditoria'
      : 'Libera após tocar no botão verde do WhatsApp acima';
  }

  if (gateWarning && !canConfirm && !ModalGateState.waTriggered) {
    gateWarning.textContent = 'Toque primeiro no botão verde "Abrir e Enviar no WhatsApp" acima.';
  }
}

function showGateWarning() {
  const gateWarning = document.getElementById('modalGateWarning');
  if (gateWarning) {
    gateWarning.textContent = 'Conclua o envio no WhatsApp e toque em confirmar para fechar esta janela.';
    gateWarning.classList.add('visible');
  }
}

function copyModalWhatsAppText() {
  if (!ModalGateState.currentWaText) return;
  const copyBtn = document.getElementById('modalCopyWaBtn');
  copyTextToClipboard(ModalGateState.currentWaText).then(ok => {
    if (ok) {
      if (copyBtn) copyBtn.textContent = '✓ Mensagem copiada!';
      showActionToast('Texto copiado! Cole no grupo do WhatsApp e confirme.');
    } else {
      showActionToast('Não foi possível copiar automaticamente.');
    }
  });
}

function confirmWhatsAppGate() {
  if (!(ModalGateState.waTriggered || ModalGateState.waOpened)) {
    showGateWarning();
    return;
  }

  const confirmedId = ModalGateState.savedRecordId;
  const confirmedRef = {
    id: ModalGateState.savedRecordId,
    name: ModalGateState.savedRecordName,
    date: ModalGateState.savedRecordDate
  };

  ModalGateState.confirmed = true;
  ModalGateState.isOpen = false;

  if ((confirmedRef.id || (confirmedRef.name && confirmedRef.date)) && typeof TeenDB.confirmWhatsapp === 'function') {
    Promise.resolve(TeenDB.confirmWhatsapp(confirmedRef))
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

  // Garante visibilidade imediata das respostas recém-salvas na aba Ranking & Auditoria
  AppState.auditSearch = '';
  AppState.auditDate = 'all';
  AppState.auditQuickFilter = 'all';
  const searchInput = document.getElementById('auditSearchInput');
  const dateSelect = document.getElementById('auditDateFilter');
  if (searchInput) searchInput.value = '';
  if (dateSelect) dateSelect.value = 'all';

  if (confirmedId) {
    AppState.recentSavedRecordId = confirmedId;
  }

  switchTab('rank', { skipScrollTop: true });

  requestAnimationFrame(() => {
    const escapedKey = (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
      ? CSS.escape(confirmedId)
      : String(confirmedId).replace(/"/g, '\\"');
    const savedCard = confirmedId
      ? document.querySelector(`.history-card[data-record-key="${escapedKey}"]`)
      : null;
    const targetEl = savedCard || document.getElementById('peerAuditSection');
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  showActionToast('Pontuação salva e confirmada! Suas respostas estão visíveis na Auditoria.');
}

function handleReturnFromWhatsApp() {
  if (!ModalGateState.isOpen) return;

  if (document.visibilityState === 'hidden') {
    // Se a página foi colocada em segundo plano logo após enviar, o OS realmente abriu o app externo
    if (Date.now() - ModalGateState.launchTimestamp < 15000) {
      ModalGateState.waTriggered = true;
    }
    return;
  }

  if (ModalGateState.waTriggered || ModalGateState.waOpened) {
    ModalGateState.waReturned = true;
    updateModalGateUI();
  }

  if (!ModalGateState.cloudSynced && typeof TeenDB.syncPending === 'function') {
    Promise.resolve(TeenDB.syncPending())
      .then((res) => {
        if (res && res.remaining === 0) {
          ModalGateState.cloudSynced = true;
          updateModalSyncStatus(true);
          renderRanking();
        }
      })
      .catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('successModal');
  const modalWaBtn = document.getElementById('modalWaBtn');

  if (modalWaBtn) {
    modalWaBtn.addEventListener('click', () => {
      ModalGateState.waOpened = true;
      ModalGateState.launchTimestamp = Date.now();
      const gateWarning = document.getElementById('modalGateWarning');
      if (gateWarning) gateWarning.classList.remove('visible');
      updateModalGateUI();
    });
  }

  if (modal) {
    modal.addEventListener('cancel', (e) => {
      if (!ModalGateState.confirmed) {
        e.preventDefault();
        showGateWarning();
      }
    });

    modal.addEventListener('close', () => {
      if (ModalGateState.isOpen && !ModalGateState.confirmed) {
        if (typeof modal.showModal === 'function' && !modal.open) {
          modal.showModal();
          showGateWarning();
        }
      }
    });
  }

  document.addEventListener('visibilitychange', handleReturnFromWhatsApp);
  window.addEventListener('focus', handleReturnFromWhatsApp);
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
      .catch(err => console.error('Erro no SW:', err));
  });
}

async function initApp() {
  setupAutoDate();
  setupTeenSelector();
  buildQuestionsUI();
  updateTotal();
  updateProgress();
  setupAuditControls();
  renderRanking();

  // Conectar com a Nuvem Supabase e habilitar Realtime
  TeenDB.initRealtime();
  await TeenDB.fetchFromCloud();
  renderRanking();
  updateTodaySubmissionBanner();
}

// Iniciar Aplicação
initApp();
