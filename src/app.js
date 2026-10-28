import { technicalWorkup } from './technical.js';
import { fields, emptyFacts, nextField, replyTo, briefMarkdown } from './intake.js';

const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  arrowRight: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  paperclip: '<path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9m-1 7-6 6a1 1 0 0 0 2 2l7-7"/>',
  brief: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
  house: '<path d="m3 10 9-7 9 7v10H3Zm6 10v-7h6v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  edit: '<path d="m14 5 5 5M4 20l5-1L20 8a2 2 0 0 0-5-5L4 14Z"/>',
  chat: '<path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.house}</svg>`;
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const KEY = 'unpermitted-opening-v1';
const fresh = () => ({ facts: emptyFacts(), messages: [], photos: [], asked: 'goal' });
let state = fresh();
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && saved.facts && Array.isArray(saved.messages) && Array.isArray(saved.photos)) state = { ...fresh(), ...saved, facts: { ...emptyFacts(), ...saved.facts } };
} catch { /* A fresh workspace remains available if local storage is unavailable. */ }
let pendingPhotos = [];
let processing = false;
let sending = false;
let briefOpen = false;
let lastFocus = null;

const blueprint = `<svg class="blueprint" viewBox="0 0 210 170" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1.1"><path d="M38 142V38h134v104h-42m-45 0H38M43 137V43h124v94h-37m-45 0H43"/><path d="M85 142v-45a45 45 0 0 1 45 45" stroke-dasharray="2 3"/><path d="M85 141V97m45 45H85M125 43v39h42M129 47v31h34"/><rect x="51" y="54" width="39" height="61" rx="2"/><path d="M56 70h29m-25-11h19v7H60Z"/><circle cx="146" cy="60" r="9"/><path d="M20 38v104m-4-104h8m-8 104h8M38 22h134m-134-4v8m134-8v8" opacity=".4"/><path d="M105 35v11m-5-6h10M167 105h10m-5-5v10" opacity=".4"/></g></svg>`;

document.querySelector('#app').innerHTML = `
  <aside class="sidebar">
    <a class="wordmark" href="./" aria-label="Unpermitted home">unpermitted<span class="brand-dot">.</span><span class="brand-ai">ai</span></a>
    <button class="new-project" data-action="new">${icon('plus')} New project</button>
    <p class="nav-label">YOUR WORKSPACE</p>
    <button class="project-nav active" data-action="conversation">${icon('chat')}<span id="nav-title">A new possibility</span></button>
    <div class="sidebar-story">${blueprint}<p>Measure twice.<br>Plan once.</p><span>Know the constraints.<br>Then make your next move.</span></div>
    <div class="sidebar-footer"><span class="local-dot"></span><span id="save-status">Saved on this device</span><button class="icon-button" data-action="about" aria-label="About this prototype">${icon('info')}</button></div>
  </aside>
  <div class="workspace">
    <header class="workspace-header">
      <div class="breadcrumb"><span class="mobile-brand">unpermitted<span>.</span></span><span class="desktop-crumb">Your workspace <span class="slash">/</span> <span id="header-title">New project</span></span><span class="demo-badge">Guided demo</span></div>
      <div class="header-actions"><button class="icon-button mobile-new" data-action="new" aria-label="Start a new project">${icon('plus')}</button><button class="text-button how-button" data-action="about">How it works</button><button class="brief-toggle" data-action="brief" aria-expanded="false" aria-controls="brief-panel">${icon('brief')}<span>Project brief</span><span class="brief-count" id="brief-count">0</span></button></div>
    </header>
    <main id="main-content" class="main-content">
      <section class="welcome" id="welcome">
        <div class="welcome-mark">${icon('house')}<span>YOUR PROJECT. DOWN TO THE DETAILS.</span></div>
        <h1>Know what works.<br><em>Before you build.</em></h1>
        <p class="welcome-copy">The codes that govern it. The systems behind the walls.<br class="wide-only"> Turn your renovation into a plan that holds up to the details.</p>
      </section>
      <section id="conversation" class="conversation" aria-label="Project conversation" aria-live="polite" aria-relevant="additions" hidden></section>
      <div class="composer-area" id="composer-area">
        <form id="composer" class="composer">
          <div class="pending-photos" id="pending-photos" hidden></div>
          <label class="sr-only" for="message-input">Describe your project or answer a question</label>
          <textarea id="message-input" rows="2" maxlength="4000" placeholder="What are you planning—and where is the property?" spellcheck="true"></textarea>
          <div class="composer-tools"><button type="button" class="attach-button" data-action="attach">${icon('plus')}<span>Add a photo</span></button><span class="composer-hint">Start with the work you have in mind.</span><button type="submit" class="send-button" id="send-button" aria-label="Send message" disabled>${icon('arrow')}</button></div>
          <input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden />
        </form>
        <div class="composer-caption"><span id="composer-caption">Specific to your building. Grounded in evidence. Clear about what’s unknown.</span><span class="key-hint">Enter to send <kbd>↵</kbd></span></div>
        <div class="starters" id="starters"><span class="starter-label">A place to start</span><button data-starter="I’d like to add a half bath to my Philadelphia rowhouse.">${icon('house')}<span>Add a half bath</span>${icon('arrowRight')}</button><button data-starter="I want to renovate my kitchen, but I’m not sure where to start.">${icon('house')}<span>Rethink my kitchen</span>${icon('arrowRight')}</button></div>
      </div>
      <section class="journey" id="journey" aria-label="From idea to plan"><div><span class="step-number">01</span><div><h2>Establish the constraints</h2><p>Your building, scope, and existing systems.</p></div></div><div><span class="step-number">02</span><div><h2>Trace the requirements</h2><p>Adopted codes, amendments, and evidence.</p></div></div><div><span class="step-number">03</span><div><h2>Sequence the work</h2><p>Decisions, materials, and inspection gates.</p></div></div></section>
      <footer class="welcome-footer" id="welcome-footer"><span>Questionable name. Serious about the details.</span><button class="text-button" data-action="about">Why the details matter ${icon('arrowRight')}</button></footer>
    </main>
  </div>
  <div class="brief-backdrop" id="brief-backdrop" hidden></div>
  <aside class="brief-panel" id="brief-panel" aria-label="Project brief" hidden>
    <header class="brief-header"><span>${icon('brief')} THE PROJECT BRIEF</span><button class="icon-button" data-action="close-brief" aria-label="Close project brief">${icon('close')}</button></header>
    <div class="brief-scroll" id="brief-content"></div>
    <footer class="brief-footer"><button class="secondary-button" data-action="edit">${icon('edit')} Edit details</button><button class="primary-button" data-action="download">${icon('download')} Download</button></footer>
  </aside>
  <dialog id="about-dialog" class="about-dialog"><button class="icon-button dialog-close" data-action="close-about" aria-label="Close explanation">${icon('close')}</button><div class="welcome-mark">${icon('house')} MEET UNPERMITTED</div><h2>The details make<br>the difference.</h2><p class="dialog-intro">A layout is only useful if the building, the systems, and the applicable requirements support it.</p><div class="about-steps"><div><span>01</span><div><h3>Establish what governs this job.</h3><p>Jurisdiction, building use, adopted editions, and local amendments. The right code path comes before a confident answer.</p></div></div><div><span>02</span><div><h3>Connect requirements to the actual building.</h3><p>Fixture clearances need a measured layout. Drainage needs a route, elevations, and a vent strategy. Each conclusion should cite its basis and the evidence that supports it.</p></div></div><div><span>03</span><div><h3>Turn the findings into an order of work.</h3><p>Resolve feasibility before purchasing. Tie materials to tasks, and later work to the decisions and inspections it depends on. This is the intended planning workflow.</p></div></div></div><div class="demo-note"><strong>What you can try today</strong><p>This frontend records your details and builds a technical investigation checklist. A curated Philadelphia adoption reference is available when relevant. Section-level code retrieval, applicability review, engineering, and AI/photo analysis are not connected yet.</p></div><button class="primary-button about-start" data-action="close-about">Start with the scope ${icon('arrowRight')}</button></dialog>
  <dialog id="edit-dialog" class="edit-dialog"><form id="edit-form"><div class="edit-header"><div><p class="eyebrow">YOUR WORDS, YOUR PROJECT</p><h2>Edit your brief</h2></div><button class="icon-button" type="button" data-action="close-edit" aria-label="Close edit form">${icon('close')}</button></div><p class="muted">Keep it rough. You can refine these details as you learn more.</p><div id="edit-fields"></div><div class="edit-actions"><button type="button" class="secondary-button" data-action="close-edit">Cancel</button><button class="primary-button" type="submit">Save details</button></div></form></dialog>
  <dialog id="reset-dialog" class="reset-dialog"><h2>Room for a new idea?</h2><p>Starting a new project replaces the conversation, brief, and photos saved on this device. Download your brief first if you’d like to keep it.</p><div class="edit-actions"><button class="secondary-button" data-action="close-reset">Keep this project</button><button class="primary-button" data-action="confirm-new">Start new project</button></div></dialog>
  <div class="toast" id="toast" role="status" hidden></div>
`;

const $ = id => document.getElementById(id);
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); $('save-status').textContent = 'Saved on this device'; }
  catch { $('save-status').textContent = 'Session only · storage unavailable'; toast('Browser storage is full or unavailable. Your project is still here in this tab; download your brief to keep a copy.'); }
}
function renderBrief() {
  const count = fields.filter(([key]) => state.facts[key]).length;
  $('brief-count').textContent = count;
  const next = nextField(state.facts);
  const workup = technicalWorkup(state.facts);
  $('brief-content').innerHTML = `<div class="brief-title"><p class="eyebrow">${count ? 'TAKING SHAPE' : 'A BLANK PAGE, FOR NOW'}</p><h2>${esc(state.facts.goal || 'Your next chapter.')}</h2><p>${count ? 'A little clearer with every conversation.' : 'The useful details will land here as we talk.'}</p></div><div class="brief-progress"><span>${count} of ${fields.length} starting details</span><span>Preliminary</span></div><div class="brief-meter"><span style="width:${count / fields.length * 100}%"></span></div><dl class="brief-facts">${fields.map(([key, label]) => `<div><dt>${label}</dt><dd class="${state.facts[key] ? '' : 'unanswered'}">${esc(state.facts[key] || 'Not discussed yet')}${state.facts[key] && state.facts[key] !== 'To be confirmed' ? '<span class="fact-source">Provided by you</span>' : ''}</dd></div>`).join('')}</dl>${state.photos.length ? `<section class="brief-photos"><p class="eyebrow">YOUR SPACE · ${state.photos.length} PHOTO${state.photos.length > 1 ? 'S' : ''}</p><div class="photo-grid">${state.photos.map((p, i) => `<figure><img src="${esc(p.dataUrl)}" alt="${esc(p.name)}"><button class="photo-remove" data-remove-photo="${i}" aria-label="Remove ${esc(p.name)}">${icon('close')}</button></figure>`).join('')}</div><p class="small muted">Visual references only. Photos haven’t been analyzed.</p></section>` : ''}<details class="technical-detail" ${state.facts.goal ? 'open' : ''}><summary>Code & feasibility <span>Investigation</span></summary><p class="technical-basis">${esc(workup.basis)}</p>${workup.source ? `<div class="source-card"><span class="eyebrow">ADOPTION REFERENCE · NOT APPLIED</span><a href="${workup.source.url}" target="_blank" rel="noopener noreferrer">${esc(workup.source.title)} ↗</a><p>${esc(workup.source.note)}</p><small>Source checked ${workup.source.checked}</small></div>` : '<div class="source-card"><span class="eyebrow">CODE BASIS UNRESOLVED</span><p>No jurisdiction-specific adoption source is established yet.</p></div>'}${workup.checks.map((check, i) => `<div class="technical-check"><span class="technical-index">0${i + 1}</span><div><h3>${esc(check.title)}</h3><p>${esc(check.need)}</p><span class="evidence-label">Evidence to obtain</span><p>${esc(check.evidence)}</p><span class="evidence-label">Code research still needed</span><p>${esc(check.research)}</p></div></div>`).join('')}<p class="technical-footnote">These are investigation topics. No section-level requirement has been verified or applied to this project.</p></details><details class="technical-detail sequence-detail"><summary>Order of investigation</summary><ol>${workup.sequence.map(([title, detail]) => `<li><strong>${esc(title)}</strong><p>${esc(detail)}</p></li>`).join('')}</ol></details><section class="next-question"><span class="eyebrow">${next ? 'THE NEXT PIECE' : 'BEFORE YOU BUILD'}</span><p>${esc(next?.[2] || 'Confirm site conditions, explore feasibility, and get professional input before estimating or starting work.')}</p></section><p class="brief-disclaimer">A starting brief based on your answers. Details, feasibility, and requirements haven’t been independently verified.</p>`;
  $('nav-title').textContent = state.facts.goal || (state.messages.length ? 'Your renovation idea' : 'A new possibility');
  $('header-title').textContent = state.facts.goal || 'New project';
}
function renderMessages() {
  const active = state.messages.length > 0;
  document.body.classList.toggle('has-conversation', active);
  $('welcome').hidden = active;
  $('conversation').hidden = !active;
  $('starters').hidden = active;
  $('journey').hidden = active;
  $('welcome-footer').hidden = active;
  $('message-input').placeholder = active ? 'Tell Dwang a little more…' : 'What are you planning—and where is the property?';
  $('composer-caption').textContent = active ? 'Guided demo · your answers stay on this device. Photos are not analyzed.' : 'Specific to your building. Grounded in evidence. Clear about what’s unknown.';
  $('conversation').innerHTML = state.messages.map(m => `<article class="message ${m.role}">${m.role === 'assistant' ? `<div class="assistant-avatar">d<span>.</span></div>` : ''}<div class="message-body"><div class="message-author">${m.role === 'assistant' ? 'Dwang <span>Your planning guide</span>' : 'You'}</div>${m.photos?.length ? `<div class="message-photos">${m.photos.map(p => `<img src="${esc(p.dataUrl)}" alt="${esc(p.name)}">`).join('')}</div>` : ''}<div class="message-text">${esc(m.text)}</div>${m.changed?.length ? `<button class="brief-update" data-action="brief">${icon('check')} Brief updated <span>· ${m.changed.map(key => fields.find(f => f[0] === key)?.[1]).join(', ')}</span>${icon('chevron')}</button>` : ''}</div></article>`).join('');
}
function updateSend() { $('send-button').disabled = processing || sending || (!$('message-input').value.trim() && !pendingPhotos.length); }
function renderPending() {
  $('pending-photos').hidden = !pendingPhotos.length;
  $('pending-photos').innerHTML = pendingPhotos.map((p, i) => `<div class="pending-photo"><img src="${esc(p.dataUrl)}" alt="${esc(p.name)}"><span>${esc(p.name)}</span><button type="button" class="icon-button" data-remove-pending="${i}" aria-label="Remove ${esc(p.name)}">${icon('close')}</button></div>`).join('');
  updateSend();
}
function toggleBrief(open) {
  briefOpen = open;
  $('brief-panel').hidden = !open;
  $('brief-backdrop').hidden = !open;
  document.body.classList.toggle('brief-is-open', open);
  document.querySelector('.brief-toggle').setAttribute('aria-expanded', String(open));
  if (open) {
    lastFocus = document.activeElement;
    if (matchMedia('(max-width: 1100px)').matches) {
      $('brief-panel').setAttribute('role', 'dialog'); $('brief-panel').setAttribute('aria-modal', 'true');
      document.querySelector('.workspace').inert = true; document.querySelector('.sidebar').inert = true;
    }
    $('brief-panel').querySelector('button').focus();
  } else {
    $('brief-panel').removeAttribute('role'); $('brief-panel').removeAttribute('aria-modal');
    document.querySelector('.workspace').inert = false; document.querySelector('.sidebar').inert = false;
    lastFocus?.focus();
  }
}
function scrollToEnd() { requestAnimationFrame(() => $('main-content').scrollTo({ top: $('main-content').scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })); }
function submitMessage(text, photos = pendingPhotos) {
  if (sending || processing || (!text.trim() && !photos.length)) return;
  sending = true;
  const attached = [...photos];
  state.photos.push(...attached);
  state.messages.push({ role: 'user', text: text.trim() || 'Here’s the space I have in mind.', photos: attached });
  const response = replyTo(text.trim(), state.facts, state.asked, attached.length > 0);
  const changed = Object.keys(response.updates).filter(key => response.updates[key] !== state.facts[key]);
  Object.assign(state.facts, response.updates);
  state.asked = response.asked;
  state.messages.push({ role: 'assistant', text: response.text, changed });
  pendingPhotos = [];
  $('message-input').value = ''; $('message-input').style.height = '';
  save(); renderMessages(); renderBrief(); renderPending();
  sending = false; updateSend(); scrollToEnd(); $('message-input').focus();
}
async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw Error('Choose a JPG, PNG, WebP, or GIF photo.');
  if (file.size > 20 * 1024 * 1024) throw Error('That photo is over 20 MB. Choose a smaller file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1100 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  return { name: file.name, dataUrl: canvas.toDataURL('image/jpeg', .72) };
}
async function addPhotos(files) {
  if (processing) return;
  processing = true; updateSend();
  $('composer-caption').textContent = 'Preparing your photos…';
  for (const file of files) {
    if (state.photos.length + pendingPhotos.length >= 4) { toast('Up to four photos per project in this demo. Remove one from the brief to add another.'); break; }
    try { pendingPhotos.push(await preparePhoto(file)); }
    catch (e) { toast(e.message || 'We couldn’t open that photo. Try a JPG or PNG.'); }
  }
  processing = false; renderPending(); $('photo-input').value = '';
  $('composer-caption').textContent = 'Photo references stay on this device. They aren’t analyzed in this demo.';
  $('message-input').focus();
}
function downloadBrief() {
  const url = URL.createObjectURL(new Blob([briefMarkdown(state)], { type: 'text/markdown' }));
  const a = document.createElement('a'); a.href = url; a.download = 'unpermitted-project-brief.md'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your project brief is downloaded.');
}
function openEdit() {
  $('edit-fields').innerHTML = fields.map(([key, label]) => `<label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" maxlength="280" value="${esc(state.facts[key])}" placeholder="Not discussed yet">`).join('');
  $('edit-dialog').showModal();
}
const actions = {
  about: () => $('about-dialog').showModal(),
  'close-about': () => $('about-dialog').close(),
  brief: () => toggleBrief(!briefOpen),
  'close-brief': () => toggleBrief(false),
  attach: () => $('photo-input').click(),
  download: downloadBrief,
  edit: openEdit,
  'close-edit': () => $('edit-dialog').close(),
  new: () => { if (state.messages.length || state.photos.length || Object.values(state.facts).some(Boolean) || pendingPhotos.length) $('reset-dialog').showModal(); else $('message-input').focus(); },
  'close-reset': () => $('reset-dialog').close(),
  'confirm-new': () => { $('reset-dialog').close(); state = fresh(); pendingPhotos = []; if (briefOpen) toggleBrief(false); $('message-input').value = ''; save(); renderMessages(); renderBrief(); renderPending(); $('message-input').focus(); },
  conversation: () => { if (briefOpen) toggleBrief(false); $('message-input').focus(); },
};
document.addEventListener('click', e => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (actions[action]) actions[action]();
  const starter = e.target.closest('[data-starter]'); if (starter) submitMessage(starter.dataset.starter);
  const pending = e.target.closest('[data-remove-pending]'); if (pending) { pendingPhotos.splice(+pending.dataset.removePending, 1); renderPending(); }
  const photo = e.target.closest('[data-remove-photo]'); if (photo) {
    const removed = state.photos.splice(+photo.dataset.removePhoto, 1)[0];
    state.messages.forEach(m => { if (m.photos) m.photos = m.photos.filter(p => p.dataUrl !== removed.dataUrl); });
    save(); renderMessages(); renderBrief(); toast('Photo removed from this project.');
  }
});
$('composer').addEventListener('submit', e => { e.preventDefault(); submitMessage($('message-input').value); });
$('message-input').addEventListener('input', () => { $('message-input').style.height = 'auto'; $('message-input').style.height = Math.min(180, $('message-input').scrollHeight) + 'px'; updateSend(); });
$('message-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitMessage($('message-input').value); } });
$('photo-input').addEventListener('change', e => addPhotos([...e.target.files]));
$('message-input').addEventListener('paste', e => { const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); addPhotos(files); } });
let dragDepth = 0;
$('composer').addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; $('composer').classList.add('drag-over'); });
$('composer').addEventListener('dragover', e => e.preventDefault());
$('composer').addEventListener('dragleave', () => { if (--dragDepth <= 0) $('composer').classList.remove('drag-over'); });
$('composer').addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; $('composer').classList.remove('drag-over'); addPhotos([...e.dataTransfer.files]); });
$('brief-backdrop').addEventListener('click', () => toggleBrief(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && briefOpen && !document.querySelector('dialog[open]')) toggleBrief(false);
  if (e.key === 'Tab' && briefOpen && $('brief-panel').getAttribute('aria-modal') === 'true' && !document.querySelector('dialog[open]')) {
    const focusable = [...$('brief-panel').querySelectorAll('button')]; const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('edit-form').addEventListener('submit', e => {
  e.preventDefault(); const form = new FormData(e.target); const changed = [];
  fields.forEach(([key]) => { const value = form.get(key).trim(); if (value !== state.facts[key]) changed.push(key); state.facts[key] = value; });
  state.asked = nextField(state.facts)?.[0] || null;
  if (changed.length) state.messages.push({ role: 'assistant', text: `Your edits are saved in the brief.\n\n${nextField(state.facts)?.[2] || 'Your starting details are in place. You can download the brief when you’re ready.'}`, changed });
  save(); renderMessages(); renderBrief(); $('edit-dialog').close(); scrollToEnd();
});
matchMedia('(max-width: 1100px)').addEventListener('change', () => { if (briefOpen) { toggleBrief(false); toggleBrief(true); } });
renderMessages(); renderBrief(); renderPending();
if (state.messages.length) scrollToEnd();
