function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return val.toFixed(1) + ' ' + units[i];
}

function buildDigitBoxes(container, idLength, onComplete) {
  container.innerHTML = '';
  const boxes = [];
  for (let i = 0; i < idLength; i += 1) {
    const box = document.createElement('input');
    box.type = 'text';
    box.inputMode = 'numeric';
    box.maxLength = 1;
    box.className = 'digit-box';
    box.dataset.index = i;
    container.appendChild(box);
    boxes.push(box);
  }

  function currentValue() {
    return boxes.map((b) => b.value).join('');
  }

  boxes.forEach((box, idx) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      if (box.value && idx < boxes.length - 1) {
        boxes[idx + 1].focus();
      }
      if (currentValue().length === idLength) {
        onComplete(currentValue());
      }
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        boxes[idx - 1].focus();
      }
      if (e.key === 'Enter' && currentValue().length === idLength) {
        onComplete(currentValue());
      }
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
      if (!text) return;
      for (let i = 0; i < boxes.length; i += 1) {
        boxes[i].value = text[i] || '';
      }
      const filled = boxes[Math.min(text.length, boxes.length) - 1];
      if (filled) filled.focus();
      if (currentValue().length === idLength) {
        onComplete(currentValue());
      }
    });
  });

  return { getValue: currentValue, boxes };
}

function renderInfoCard(recordId, info) {
  const card = document.createElement('div');
  card.className = 'info-card';

  const idLine = document.createElement('div');
  idLine.className = 'info-id';
  idLine.textContent = `ID ${recordId}`;
  card.appendChild(idLine);

  const name = document.createElement('h2');
  name.className = 'info-name';
  name.textContent = (info && info.name) || 'Unnamed machine';
  card.appendChild(name);

  if (info && info.make) {
    const make = document.createElement('p');
    make.className = 'info-make';
    make.textContent = info.make;
    card.appendChild(make);
  }

  const sections = document.createElement('div');
  sections.className = 'info-sections';
  const fields = [
    ['purpose', 'Purpose / use'],
    ['working', 'How it works'],
    ['applications', 'Applications'],
  ];
  let any = false;
  fields.forEach(([key, label]) => {
    if (info && info[key]) {
      any = true;
      const block = document.createElement('div');
      const lbl = document.createElement('div');
      lbl.className = 'info-section-label';
      lbl.textContent = label;
      const text = document.createElement('div');
      text.className = 'info-section-text';
      text.textContent = info[key];
      block.appendChild(lbl);
      block.appendChild(text);
      sections.appendChild(block);
    }
  });
  if (any) card.appendChild(sections);

  return card;
}

function renderMediaCard(recordId, file, allFiles, index) {
  const card = document.createElement('div');
  card.className = 'media-card';

  const thumb = document.createElement('div');
  thumb.className = 'media-thumb';
  if (file.kind === 'video') {
    const video = document.createElement('video');
    video.src = file.view_url;
    video.controls = true;
    video.preload = 'metadata';
    thumb.appendChild(video);
  } else if (file.kind === 'document') {
    thumb.classList.add('zoomable', 'doc-thumb');
    const badge = document.createElement('div');
    badge.className = 'doc-badge';
    badge.textContent = 'PDF';
    thumb.appendChild(badge);
    thumb.addEventListener('click', () => openLightbox(allFiles, index));
  } else {
    thumb.classList.add('zoomable');
    const img = document.createElement('img');
    img.src = file.view_url;
    img.alt = file.name;
    img.loading = 'lazy';
    thumb.appendChild(img);
    thumb.addEventListener('click', () => openLightbox(allFiles, index));
  }

  const info = document.createElement('div');
  info.className = 'media-info';

  const name = document.createElement('div');
  name.className = 'media-name';
  name.textContent = file.name;

  const meta = document.createElement('div');
  meta.className = 'media-meta';
  meta.innerHTML = `<span>${file.kind}</span><span>${formatBytes(file.size)}</span>`;

  const actions = document.createElement('div');
  actions.className = 'media-actions';

  const viewBtn = document.createElement('button');
  viewBtn.className = 'icon-btn';
  viewBtn.textContent = 'View';
  viewBtn.addEventListener('click', () => openLightbox(allFiles, index));
  actions.appendChild(viewBtn);

  const dl = document.createElement('a');
  dl.className = 'icon-btn';
  dl.href = file.download_url;
  dl.textContent = 'Download';
  actions.appendChild(dl);

  info.appendChild(name);
  info.appendChild(meta);
  info.appendChild(actions);

  card.appendChild(thumb);
  card.appendChild(info);
  return card;
}

// ---- Lightbox: view a photo/video full-size without downloading it ----
let _lightboxFiles = [];
let _lightboxIndex = 0;

function _lightboxEl() {
  let el = document.getElementById('lightbox-overlay');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'lightbox-overlay';
  el.className = 'lightbox-overlay';
  el.innerHTML = `
    <button class="lightbox-close" aria-label="Close">&times;</button>
    <button class="lightbox-nav lightbox-prev" aria-label="Previous">&#10094;</button>
    <div class="lightbox-content"></div>
    <button class="lightbox-nav lightbox-next" aria-label="Next">&#10095;</button>
    <div class="lightbox-caption"></div>
  `;
  document.body.appendChild(el);

  el.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  el.addEventListener('click', (e) => {
    if (e.target === el) closeLightbox();
  });
  el.querySelector('.lightbox-prev').addEventListener('click', () => stepLightbox(-1));
  el.querySelector('.lightbox-next').addEventListener('click', () => stepLightbox(1));

  document.addEventListener('keydown', (e) => {
    if (!el.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  });

  return el;
}

function _renderLightbox() {
  const el = _lightboxEl();
  const file = _lightboxFiles[_lightboxIndex];
  const content = el.querySelector('.lightbox-content');
  content.innerHTML = '';

  if (file.kind === 'video') {
    const video = document.createElement('video');
    video.src = file.view_url;
    video.controls = true;
    video.autoplay = true;
    content.appendChild(video);
  } else if (file.kind === 'document') {
    const iframe = document.createElement('iframe');
    iframe.src = file.view_url;
    iframe.className = 'lightbox-iframe';
    content.appendChild(iframe);
  } else {
    const img = document.createElement('img');
    img.src = file.view_url;
    img.alt = file.name;
    content.appendChild(img);
  }

  el.querySelector('.lightbox-caption').textContent =
    `${file.name} (${_lightboxIndex + 1} / ${_lightboxFiles.length})`;

  const multi = _lightboxFiles.length > 1;
  el.querySelector('.lightbox-prev').style.display = multi ? 'flex' : 'none';
  el.querySelector('.lightbox-next').style.display = multi ? 'flex' : 'none';
}

function openLightbox(files, index) {
  _lightboxFiles = files;
  _lightboxIndex = index;
  const el = _lightboxEl();
  _renderLightbox();
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const el = document.getElementById('lightbox-overlay');
  if (!el) return;
  el.classList.remove('open');
  el.querySelector('.lightbox-content').innerHTML = '';
  document.body.style.overflow = '';
}

function stepLightbox(delta) {
  const n = _lightboxFiles.length;
  _lightboxIndex = (_lightboxIndex + delta + n) % n;
  _renderLightbox();
}

function initLookup({ idLength, resultsMount }) {
  const container = document.getElementById('digit-row');
  const statusEl = document.getElementById('lookup-status');
  const lookupBtn = document.getElementById('lookup-btn');

  async function runLookup(recordId) {
    statusEl.textContent = 'Searching…';
    statusEl.className = 'lookup-status';
    resultsMount.innerHTML = '';

    try {
      const res = await fetch(`/api/public/${recordId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Lookup failed');
      }
      const data = await res.json();

      if (!data.found) {
        statusEl.textContent = 'No machine found with that ID';
        statusEl.className = 'lookup-status err';
        resultsMount.innerHTML = '<div class="empty-state">Nothing is registered against this ID yet.</div>';
        return;
      }

      statusEl.textContent = 'Found';
      statusEl.className = 'lookup-status ok';

      resultsMount.appendChild(renderInfoCard(recordId, data.info));

      const head = document.createElement('div');
      head.className = 'results-head';
      head.innerHTML = `
        <h2 class="results-title">Photos &amp; videos</h2>
        <span class="results-count">${data.files.length} file(s)</span>
      `;

      if (data.files.length > 0) {
        const dlAll = document.createElement('a');
        dlAll.className = 'btn secondary';
        dlAll.style.width = 'auto';
        dlAll.textContent = 'Download all as .zip';
        dlAll.href = `/api/public/${recordId}/download-all`;
        head.appendChild(dlAll);
      }
      resultsMount.appendChild(head);

      if (data.files.length === 0) {
        resultsMount.innerHTML += '<div class="empty-state">No photos or videos uploaded for this machine yet.</div>';
      } else {
        const grid = document.createElement('div');
        grid.className = 'media-grid';
        data.files.forEach((file, idx) => grid.appendChild(renderMediaCard(recordId, file, data.files, idx)));
        resultsMount.appendChild(grid);
      }
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'lookup-status err';
    }
  }

  const { getValue, boxes } = buildDigitBoxes(container, idLength, runLookup);

  lookupBtn.addEventListener('click', () => {
    const val = getValue();
    if (val.length === idLength) {
      runLookup(val);
    } else {
      statusEl.textContent = `Enter all ${idLength} digits`;
      statusEl.className = 'lookup-status err';
    }
  });

  // Deep-link support: opening /?id=1234567890 pre-fills the digits and
  // searches automatically — handy for a QR code printed on the machine.
  const params = new URLSearchParams(window.location.search);
  const preset = (params.get('id') || '').replace(/\D/g, '');
  if (preset.length === idLength) {
    boxes.forEach((b, i) => {
      b.value = preset[i];
    });
    runLookup(preset);
  }
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}
