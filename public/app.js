let currentEmail = '';

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => {
    s.classList.remove('active');
  });
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    const input = el.querySelector('input:not([readonly])');
    if (input) setTimeout(() => input.focus(), 150);
  }
}

const identifierInput = document.getElementById('identifier');
const gmailNotice = document.getElementById('gmail-notice');
const spamNotice = document.getElementById('spam-notice');
const sendStatus = document.getElementById('send-status');
const verifyStatus = document.getElementById('verify-status');

function checkGmail() {
  const email = identifierInput.value.trim().toLowerCase();
  gmailNotice.classList.toggle('visible', email.includes('@g'));
}

identifierInput.addEventListener('input', checkGmail);

document.getElementById('try-other-link').addEventListener('click', (e) => {
  e.preventDefault();
  gmailNotice.classList.remove('visible');
  identifierInput.value = '';
  identifierInput.focus();
});

document.getElementById('resend-link').addEventListener('click', (e) => {
  e.preventDefault();
  verifyStatus.className = 'status';
  verifyStatus.classList.remove('visible');
  document.getElementById('code').value = '';
  document.getElementById('send-form').dispatchEvent(new Event('submit', { cancelable: true }));
});

document.getElementById('send-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  sendStatus.className = 'status';
  sendStatus.classList.remove('visible');
  sendStatus.textContent = '';
  sendStatus.innerHTML = '';

  try {
    const { status: code, body } = await fetch('/auth/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifierInput.value.trim() }),
    }).then(r => r.json().then(body => ({ status: r.status, body })));

    if (code === 200) {
      currentEmail = identifierInput.value.trim();
      document.getElementById('sent-email').textContent = currentEmail;
      spamNotice.classList.add('visible');
      showStep('step-code');
      verifyStatus.className = 'status';
      verifyStatus.classList.remove('visible');
      document.getElementById('code').value = '';
    } else {
      sendStatus.className = 'status error visible';
      sendStatus.textContent = body.message || 'Something went wrong.';
      if (body.details) {
        const detail = document.createElement('div');
        detail.style.marginTop = '6px';
        detail.style.fontSize = '12px';
        detail.style.opacity = '.8';
        detail.textContent = body.details;
        sendStatus.appendChild(detail);
      }
    }
  } catch {
    sendStatus.className = 'status error visible';
    sendStatus.textContent = 'Could not reach server. Is it running?';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('verify-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  verifyStatus.className = 'status';
  verifyStatus.classList.remove('visible');

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
      verifyStatus.className = 'status error visible';
      verifyStatus.textContent = body.message || 'Invalid code.';
    }
  } catch {
    verifyStatus.className = 'status error visible';
    verifyStatus.textContent = 'Could not reach server.';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('back-link').addEventListener('click', (e) => {
  e.preventDefault();
  spamNotice.classList.remove('visible');
  showStep('step-email');
});

document.getElementById('done-btn').addEventListener('click', () => {
  currentEmail = '';
  identifierInput.value = '';
  sendStatus.className = 'status';
  sendStatus.classList.remove('visible');
  sendStatus.textContent = '';
  sendStatus.innerHTML = '';
  gmailNotice.classList.remove('visible');
  spamNotice.classList.remove('visible');
  showStep('step-email');
});
