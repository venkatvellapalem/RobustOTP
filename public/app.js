let currentEmail = '';

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.style.display = 'none');
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
  const input = el?.querySelector('input:not([readonly])');
  if (input) setTimeout(() => input.focus(), 100);
}

document.getElementById('send-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const status = document.getElementById('send-status');
  btn.disabled = true;
  status.className = 'status';

  try {
    const { status: code, body } = await fetch('/auth/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: document.getElementById('identifier').value.trim() }),
    }).then(r => r.json().then(body => ({ status: r.status, body })));

    if (code === 200) {
      currentEmail = document.getElementById('identifier').value.trim();
      document.getElementById('sent-email').textContent = currentEmail;
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
  showStep('step-email');
});

document.getElementById('done-btn').addEventListener('click', () => {
  currentEmail = '';
  document.getElementById('identifier').value = '';
  document.getElementById('send-status').className = 'status';
  showStep('step-email');
});
