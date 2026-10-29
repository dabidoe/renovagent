const form = document.querySelector('.landing-prompt');
const idea = document.querySelector('#project-idea');
const error = document.querySelector('#prompt-error');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const brief = idea.value.trim();
  if (!brief) {
    idea.setCustomValidity('Describe the project you have in mind.');
    idea.reportValidity();
    return;
  }
  try {
    // Keep the brief out of URLs and carry it only into this tab's creation form.
    sessionStorage.setItem('unpermitted.project-brief', brief);
    window.location.assign(form.action);
  } catch {
    error.textContent =
      'Your browser could not carry this draft over. Copy your idea, then open your workspace below.';
    error.hidden = false;
  }
});
idea.addEventListener('input', () => idea.setCustomValidity(''));

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
}
for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectTab(tabs[next], true);
    }
  });
}
