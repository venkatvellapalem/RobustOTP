'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const btnWin = document.getElementById('btn-win');
  const btnMac = document.getElementById('btn-mac');
  const btnLinux = document.getElementById('btn-linux');

  if (btnWin) btnWin.addEventListener('click', () => switchTab('win'));
  if (btnMac) btnMac.addEventListener('click', () => switchTab('mac'));
  if (btnLinux) btnLinux.addEventListener('click', () => switchTab('linux'));

  // Copy to clipboard functionality
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      
      const textToCopy = targetEl.textContent.trim();
      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalSVG = btn.innerHTML;
        btn.innerHTML = `<svg class="check-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        btn.style.color = '#10b981';
        
        setTimeout(() => {
          btn.innerHTML = originalSVG;
          btn.style.color = '';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    });
  });
});

function switchTab(os) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  const btn = document.getElementById('btn-' + os);
  const tab = document.getElementById('tab-' + os);
  if (btn) btn.classList.add('active');
  if (tab) tab.classList.add('active');
}
