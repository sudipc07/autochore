'use strict';
// Tap the user avatar to reveal full name / designation (useful on mobile
// where the name text is hidden in the top bar).
document.addEventListener('click', (e) => {
  const menu = document.getElementById('userMenu');
  if (!menu) return;
  const pop = menu.querySelector('.user-pop');
  const avatar = menu.querySelector('.avatar');
  if (avatar && avatar.contains(e.target)) {
    pop.classList.toggle('show');
  } else if (!pop.contains(e.target)) {
    pop.classList.remove('show');
  }
});
