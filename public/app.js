let currentEmail = '';

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
  const input = el?.querySelector('input:not([readonly])');
  if (input) setTimeout(() => input.focus(), 100);
}

const identifierInput = document.getElementById('identifier');
const gmailWarning = document.getElementById('gmail-warning');
const spamNotice = document.getElementById('spam-notice');

let warningDismissed = false;
let isSending = false;
let isVerifying = false;

const limitModal = document.getElementById('demo-limit-modal');
const closeLimitModal = document.getElementById('close-limit-modal');

function getVerifyCount() {
  return parseInt(localStorage.getItem('robust_otp_verify_count') || '0', 10);
}

function checkDemoLimit() {
  if (getVerifyCount() >= 5) {
    if (limitModal) limitModal.style.display = 'flex';
    return true;
  }
  return false;
}

if (closeLimitModal) {
  closeLimitModal.addEventListener('click', () => {
    if (limitModal) limitModal.style.display = 'none';
  });
}

function checkGmail() {
  const email = identifierInput.value.trim().toLowerCase();
  const atIdx = email.lastIndexOf('@');
  if (atIdx === -1) {
    gmailWarning.hidden = true;
    warningDismissed = false;
    return;
  }
  const domain = email.substring(atIdx + 1);
  const isGmailPrefix = domain && 'gmail.com'.startsWith(domain);

  if (!isGmailPrefix) {
    gmailWarning.hidden = true;
    warningDismissed = false;
  } else {
    gmailWarning.hidden = warningDismissed;
  }
}

identifierInput.addEventListener('input', checkGmail);

document.getElementById('close-warning-btn').addEventListener('click', () => {
  warningDismissed = true;
  gmailWarning.hidden = true;
});

document.getElementById('try-other-link').addEventListener('click', (e) => {
  e.preventDefault();
  gmailWarning.hidden = true;
  warningDismissed = false;
  identifierInput.value = '';
  identifierInput.focus();
});

document.getElementById('resend-link').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('verify-status').className = 'status';
  document.getElementById('code').value = '';
  document.getElementById('send-form').dispatchEvent(new Event('submit', { cancelable: true }));
});

document.getElementById('send-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (checkDemoLimit()) return;
  if (isSending) return;
  isSending = true;
  const btn = e.target.querySelector('button');
  const status = document.getElementById('send-status');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Sending...';
  status.className = 'status';
  status.textContent = '';
  status.innerHTML = '';

  let success = false;
  try {
    const { status: code, body } = await fetch('/auth/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifierInput.value.trim() }),
    }).then(r => r.json().then(body => ({ status: r.status, body })));

    if (code === 200) {
      currentEmail = identifierInput.value.trim();
      document.getElementById('sent-email').textContent = currentEmail;
      spamNotice.hidden = false;
      showStep('step-code');
      document.getElementById('verify-status').className = 'status';
      document.getElementById('code').value = '';
      success = true;
    } else {
      status.className = 'status error';
      status.textContent = body.message || 'Something went wrong.';
      if (body.details) {
        const detail = document.createElement('div');
        detail.className = 'detail';
        detail.textContent = body.details;
        status.appendChild(detail);
      }
    }
  } catch {
    status.className = 'status error';
    status.textContent = 'Could not reach server. Is it running?';
  } finally {
    if (!success) {
      btn.disabled = false;
      btn.textContent = originalText;
      isSending = false;
    }
  }
});

document.getElementById('verify-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isVerifying) return;
  isVerifying = true;
  const btn = e.target.querySelector('button');
  const status = document.getElementById('verify-status');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Verifying...';
  status.className = 'status';

  try {
    const { status: code, body } = await fetch('/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: currentEmail, code: document.getElementById('code').value.trim() }),
    }).then(r => r.json().then(body => ({ status: r.status, body })));

    if (code === 200) {
      document.getElementById('token-display').value = body.session_token;
      showStep('step-done');
      const nextCount = getVerifyCount() + 1;
      localStorage.setItem('robust_otp_verify_count', nextCount.toString());
      setTimeout(checkDemoLimit, 800);
    } else {
      status.className = 'status error';
      status.textContent = body.message || 'Invalid code.';
    }
  } catch {
    status.className = 'status error';
    status.textContent = 'Could not reach server.';
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    isVerifying = false;
  }
});

document.getElementById('back-link').addEventListener('click', (e) => {
  e.preventDefault();
  spamNotice.hidden = true;
  const sendBtn = document.querySelector('#send-form button');
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Verification Code';
  }
  isSending = false;
  showStep('step-email');
});

document.getElementById('done-btn').addEventListener('click', () => {
  currentEmail = '';
  identifierInput.value = '';
  document.getElementById('send-status').className = 'status';
  document.getElementById('send-status').textContent = '';
  document.getElementById('send-status').innerHTML = '';
  gmailWarning.hidden = true;
  spamNotice.hidden = true;
  const sendBtn = document.querySelector('#send-form button');
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send Verification Code';
  }
  isSending = false;
  showStep('step-email');
});

// ponytail: minimal inline fetch to verify health and update dynamic status pills in footer.
async function checkHealth() {
  const sysBadge = document.getElementById('system-health');
  const emailBadge = document.getElementById('email-health');
  
  try {
    const r = await fetch('/health').then(res => res.json());
    if (r.status === 'ok') {
      sysBadge.textContent = 'System: Online';
      sysBadge.className = 'health-badge ok';
    } else {
      sysBadge.textContent = 'System: Error';
      sysBadge.className = 'health-badge error';
    }
  } catch {
    sysBadge.textContent = 'System: Offline';
    sysBadge.className = 'health-badge error';
  }

  try {
    const r = await fetch('/health/email').then(res => res.json());
    if (r.configured && r.senderConfigured) {
      emailBadge.textContent = 'Email: Ready';
      emailBadge.className = 'health-badge ok';
      const box = document.getElementById('smtp-notice-box');
      if (box) box.style.display = 'none';
    } else {
      emailBadge.textContent = 'Email: Error';
      emailBadge.className = 'health-badge error';
      const box = document.getElementById('smtp-notice-box');
      if (box) box.style.display = 'block';
    }
  } catch {
    emailBadge.textContent = 'Email: Error';
    emailBadge.className = 'health-badge error';
    const box = document.getElementById('smtp-notice-box');
    if (box) box.style.display = 'block';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  showStep('step-email');
  checkHealth();
  checkDemoLimit();
});
