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

function checkGmail() {
  const email = identifierInput.value.trim().toLowerCase();
  if (email.endsWith('@gmail.com')) {
    gmailWarning.hidden = false;
  } else {
    gmailWarning.hidden = true;
  }
}

identifierInput.addEventListener('input', checkGmail);

document.getElementById('try-other-link').addEventListener('click', (e) => {
  e.preventDefault();
  gmailWarning.hidden = true;
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
  const btn = e.target.querySelector('button');
  const status = document.getElementById('send-status');
  btn.disabled = true;
  status.className = 'status';
  status.textContent = '';
  status.innerHTML = '';

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
    btn.disabled = false;
  }
});

document.getElementById('verify-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const status = document.getElementById('verify-status');
  btn.disabled = true;
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
    } else {
      status.className = 'status error';
      status.textContent = body.message || 'Invalid code.';
    }
  } catch {
    status.className = 'status error';
    status.textContent = 'Could not reach server.';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('back-link').addEventListener('click', (e) => {
  e.preventDefault();
  spamNotice.hidden = true;
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
  showStep('step-email');
});
