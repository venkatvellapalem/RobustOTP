'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const btnWin = document.getElementById('btn-win');
  const btnMac = document.getElementById('btn-mac');
  const btnLinux = document.getElementById('btn-linux');

  if (btnWin) btnWin.addEventListener('click', () => switchTab('win'));
  if (btnMac) btnMac.addEventListener('click', () => switchTab('mac'));
  if (btnLinux) btnLinux.addEventListener('click', () => switchTab('linux'));
});

function switchTab(os) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  const btn = document.getElementById('btn-' + os);
  const tab = document.getElementById('tab-' + os);
  if (btn) btn.classList.add('active');
  if (tab) tab.classList.add('active');
}
