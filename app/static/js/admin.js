function fieldRow(id, label, kind, value) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const lbl = document.createElement('label');
  lbl.setAttribute('for', id);
  lbl.textContent = label;
  const input = document.createElement(kind === 'textarea' ? 'textarea' : 'input');
  input.id = id;
  if (kind === 'textarea') {
    input.rows = 3;
  } else {
    input.type = 'text';
  }
  input.value = value || '';
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return { wrap, input };
}

function buildRecordDetailBody(recordId, detail, onChanged) {
  const body = document.createElement('div');
  body.className = 'record-card-body hidden';

  const heading1 = document.createElement('div');
  heading1.className = 'record-section-heading';
  heading1.textContent = 'Machine information';
  body.appendChild(heading1);

  const grid = document.createElement('div');
  grid.className = 'record-edit-grid';

  const info = detail.info || {};
  const nameField = fieldRow(`edit-name-${recordId}`, 'Name', 'input', info.name);
  const makeField = fieldRow(`edit-make-${recordId}`, 'Make / manufacturer', 'input', info.make);
  const purposeField = fieldRow(`edit-purpose-${recordId}`, 'Purpose / use', 'textarea', info.purpose);
  const workingField = fieldRow(`edit-working-${recordId}`, 'How it works', 'textarea', info.working);
  const appsField = fieldRow(`edit-applications-${recordId}`, 'Applications', 'textarea', info.applications);

  [nameField, makeField, purposeField, workingField, appsField].forEach((f) => grid.appendChild(f.wrap));
  body.appendChild(grid);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn secondary';
  saveBtn.style.width = 'auto';
  saveBtn.textContent = 'Save changes';
  const saveStatus = document.createElement('span');
  saveStatus.className = 'lookup-status';
  saveStatus.style.marginLeft = '12px';

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const payload = {
      name: nameField.input.value.trim(),
      make: makeField.input.value.trim(),
      purpose: purposeField.input.value.trim(),
      working: workingField.input.value.trim(),
      applications: appsField.input.value.trim(),
    };
    try {
      const res = await fetch(`/api/admin/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const respBody = await res.json().catch(() => ({}));
      if (res.ok) {
        saveStatus.textContent = 'Saved';
        saveStatus.className = 'lookup-status ok';
        onChanged(payload);
      } else {
        saveStatus.textContent = respBody.detail || 'Could not save';
        saveStatus.className = 'lookup-status err';
      }
    } finally {
      saveBtn.disabled = false;
    }
  });

  body.appendChild(saveBtn);
  body.appendChild(saveStatus);

  // ---- Media management ----
  const heading2 = document.createElement('div');
  heading2.className = 'record-section-heading';
  heading2.textContent = 'Photos & videos';
  body.appendChild(heading2);

  const uploadZone = document.createElement('div');
  uploadZone.className = 'upload-zone';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = 'image/*,video/*,application/pdf';
  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'btn secondary';
  uploadBtn.style.width = 'auto';
  uploadBtn.style.marginLeft = '8px';
  uploadBtn.textContent = 'Upload';
  uploadZone.appendChild(fileInput);
  uploadZone.appendChild(uploadBtn);

  const chipList = document.createElement('div');
  chipList.className = 'file-chip-list';

  function renderChips(files) {
    chipList.innerHTML = '';
    if (!files.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No media uploaded yet.';
      chipList.appendChild(empty);
      return;
    }
    files.forEach((f) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      const label = document.createElement('span');
      label.textContent = `${f.name} (${f.kind})`;
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete ${f.name}?`)) return;
        const res = await fetch(`/api/admin/records/${recordId}/files/${encodeURIComponent(f.name)}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          chip.remove();
          onChanged({});
        } else {
          alert('Could not delete that file.');
        }
      });
      chip.appendChild(label);
      chip.appendChild(delBtn);
      chipList.appendChild(chip);
    });
  }
  renderChips(detail.files || []);

  uploadBtn.addEventListener('click', async () => {
    if (!fileInput.files.length) return;
    const fd = new FormData();
    Array.from(fileInput.files).forEach((f) => fd.append('files', f));
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading…';
    try {
      const res = await fetch(`/api/admin/records/${recordId}/upload`, { method: 'POST', body: fd });
      const respBody = await res.json().catch(() => ({}));
      if (respBody.skipped && respBody.skipped.length) {
        alert(`Skipped (unsupported type or too large): ${respBody.skipped.join(', ')}`);
      }
      fileInput.value = '';
      const fresh = await fetch(`/api/admin/records/${recordId}`).then((r) => r.json());
      renderChips(fresh.files || []);
      onChanged({});
    } catch (e) {
      alert('Upload failed.');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload';
    }
  });

  body.appendChild(uploadZone);
  body.appendChild(chipList);

  // ---- QR code ----
  const heading2b = document.createElement('div');
  heading2b.className = 'record-section-heading';
  heading2b.textContent = 'QR code';
  body.appendChild(heading2b);

  const qrBlock = document.createElement('div');
  qrBlock.className = 'qr-block';

  const qrImg = document.createElement('img');
  qrImg.className = 'qr-image';
  qrImg.src = `/api/admin/records/${recordId}/qrcode`;
  qrImg.alt = `QR code for record ${recordId}`;

  const qrSide = document.createElement('div');
  qrSide.className = 'qr-side';
  const qrHint = document.createElement('p');
  qrHint.className = 'qr-hint';
  qrHint.textContent = 'Print this and stick it on the machine — scanning it opens this record directly, no typing needed.';
  const qrDownload = document.createElement('a');
  qrDownload.className = 'btn secondary';
  qrDownload.style.width = 'auto';
  qrDownload.href = `/api/admin/records/${recordId}/qrcode?download=1`;
  qrDownload.textContent = 'Download QR code';
  qrSide.appendChild(qrHint);
  qrSide.appendChild(qrDownload);

  qrBlock.appendChild(qrImg);
  qrBlock.appendChild(qrSide);
  body.appendChild(qrBlock);

  // ---- Delete whole record ----
  const heading3 = document.createElement('div');
  heading3.className = 'record-section-heading';
  heading3.textContent = 'Danger zone';
  body.appendChild(heading3);

  const delRecordBtn = document.createElement('button');
  delRecordBtn.className = 'btn danger';
  delRecordBtn.textContent = 'Delete this record (info + all media)';
  delRecordBtn.addEventListener('click', async () => {
    if (!confirm(`Permanently delete record ${recordId} and all its media? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/records/${recordId}`, { method: 'DELETE' });
    if (res.ok) {
      onChanged({ deleted: true });
    } else {
      alert('Could not delete this record.');
    }
  });
  body.appendChild(delRecordBtn);

  return body;
}

function initAdmin({ idLength }) {
  const form = document.getElementById('create-record-form');
  const createStatus = document.getElementById('create-status');
  const listMount = document.getElementById('records-list-mount');
  const countEl = document.getElementById('records-count');
  const searchInput = document.getElementById('records-search');

  let allRecords = [];

  async function loadRecords() {
    const res = await fetch('/api/admin/records');
    const data = await res.json();
    allRecords = data.records;
    applyFilter();
  }

  function applyFilter() {
    const q = (searchInput.value || '').trim().toLowerCase();
    const filtered = q
      ? allRecords.filter((r) =>
          [r.record_id, r.name, r.make].some((v) => (v || '').toLowerCase().includes(q))
        )
      : allRecords;

    countEl.textContent = q
      ? `${filtered.length} of ${allRecords.length} record(s)`
      : `${allRecords.length} record(s)`;
    renderList(filtered);
  }

  searchInput.addEventListener('input', applyFilter);

  function renderList(records) {
    if (records.length === 0) {
      const msg = allRecords.length === 0 ? 'No records yet. Create one above.' : 'No records match your search.';
      listMount.innerHTML = `<div class="empty-state">${msg}</div>`;
      return;
    }
    listMount.innerHTML = '';
    records.forEach((rec) => {
      const card = document.createElement('div');
      card.className = 'record-card';

      const header = document.createElement('div');
      header.className = 'record-card-header';

      const idBlock = document.createElement('div');
      const idLine = document.createElement('div');
      idLine.className = 'record-card-id';
      idLine.textContent = rec.record_id;
      const nameLine = document.createElement('div');
      nameLine.className = 'record-card-name';
      nameLine.textContent = [rec.name, rec.make].filter(Boolean).join(' — ') || 'No info yet';
      idBlock.appendChild(idLine);
      idBlock.appendChild(nameLine);

      const meta = document.createElement('div');
      meta.className = 'record-card-meta';
      meta.textContent = `${rec.file_count} file(s)`;

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'btn secondary';
      toggleBtn.style.width = 'auto';
      toggleBtn.textContent = 'Manage';

      header.appendChild(idBlock);
      header.appendChild(meta);
      header.appendChild(toggleBtn);
      card.appendChild(header);

      let bodyEl = null;
      toggleBtn.addEventListener('click', async () => {
        if (bodyEl) {
          bodyEl.classList.toggle('hidden');
          toggleBtn.textContent = bodyEl.classList.contains('hidden') ? 'Manage' : 'Close';
          return;
        }
        toggleBtn.disabled = true;
        try {
          const detail = await fetch(`/api/admin/records/${rec.record_id}`).then((r) => r.json());
          bodyEl = buildRecordDetailBody(rec.record_id, detail, (change) => {
            if (change.deleted) {
              loadRecords();
              return;
            }
            if (change.name !== undefined || change.make !== undefined) {
              nameLine.textContent = [change.name, change.make].filter(Boolean).join(' — ') || 'No info yet';
            }
            fetch(`/api/admin/records/${rec.record_id}`)
              .then((r) => r.json())
              .then((fresh) => {
                meta.textContent = `${(fresh.files || []).length} file(s)`;
              });
          });
          card.appendChild(bodyEl);
          bodyEl.classList.remove('hidden');
          toggleBtn.textContent = 'Close';
        } finally {
          toggleBtn.disabled = false;
        }
      });

      listMount.appendChild(card);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('new-record-id').value.trim();
    if (!/^\d+$/.test(id) || id.length !== idLength) {
      createStatus.textContent = `Enter exactly ${idLength} digits for the ID`;
      createStatus.className = 'lookup-status err';
      return;
    }

    const fd = new FormData();
    fd.append('name', document.getElementById('new-name').value.trim());
    fd.append('make', document.getElementById('new-make').value.trim());
    fd.append('purpose', document.getElementById('new-purpose').value.trim());
    fd.append('working', document.getElementById('new-working').value.trim());
    fd.append('applications', document.getElementById('new-applications').value.trim());

    const filesInput = document.getElementById('new-files');
    Array.from(filesInput.files || []).forEach((f) => fd.append('files', f));

    const res = await fetch(`/api/admin/records/${id}`, { method: 'POST', body: fd });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      const fileNote = body.saved && body.saved.length ? ` with ${body.saved.length} file(s)` : '';
      createStatus.textContent = `Record created${fileNote}`;
      createStatus.className = 'lookup-status ok';
      if (body.skipped && body.skipped.length) {
        alert(`Skipped (unsupported type or too large): ${body.skipped.join(', ')}`);
      }
      form.reset();
      loadRecords();
    } else {
      createStatus.textContent = body.detail || 'Could not create record';
      createStatus.className = 'lookup-status err';
    }
  });

  loadRecords();
}

function initChangePassword() {
  const form = document.getElementById('change-password-form');
  const status = document.getElementById('change-password-status');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current_password = document.getElementById('current-password').value;
    const new_password = document.getElementById('new-password-self').value;

    const res = await fetch('/api/admin/me/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      status.textContent = 'Password updated';
      status.className = 'lookup-status ok';
      form.reset();
    } else {
      status.textContent = body.detail || 'Could not update password';
      status.className = 'lookup-status err';
    }
  });
}

function initUserManagement() {
  const form = document.getElementById('create-user-form');
  const status = document.getElementById('create-user-status');
  const tableMount = document.getElementById('users-table-mount');
  const countEl = document.getElementById('users-count');

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    countEl.textContent = `${data.users.length} admin(s)`;
    renderTable(data.users);
  }

  function renderTable(users) {
    if (users.length === 0) {
      tableMount.innerHTML = '<div class="empty-state">No admins yet.</div>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML = '<thead><tr><th>Username</th><th>Created</th><th></th></tr></thead>';
    const tbody = document.createElement('tbody');

    users.forEach((u) => {
      const tr = document.createElement('tr');

      const nameTd = document.createElement('td');
      nameTd.className = 'record-id-cell';
      nameTd.textContent = u.username;

      const createdTd = document.createElement('td');
      createdTd.textContent = u.created_at || '';

      const actionsTd = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'btn danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        if (!confirm(`Delete admin "${u.username}"?`)) return;
        const res = await fetch(`/api/admin/users/${encodeURIComponent(u.username)}`, { method: 'DELETE' });
        if (res.ok) {
          loadUsers();
        } else {
          const body = await res.json().catch(() => ({}));
          alert(body.detail || 'Could not delete this admin.');
        }
      });
      actionsTd.appendChild(delBtn);

      tr.appendChild(nameTd);
      tr.appendChild(createdTd);
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableMount.innerHTML = '';
    tableMount.appendChild(table);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      status.textContent = 'Admin created';
      status.className = 'lookup-status ok';
      form.reset();
      loadUsers();
    } else {
      status.textContent = body.detail || 'Could not create admin';
      status.className = 'lookup-status err';
    }
  });

  loadUsers();
}

function initAnalytics() {
  const statsMount = document.getElementById('analytics-stats');
  const tableMount = document.getElementById('analytics-table-mount');
  const periodSelect = document.getElementById('analytics-period');
  if (!statsMount) return;

  function statCard(value, label) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const val = document.createElement('div');
    val.className = 'stat-value';
    val.textContent = value;
    const lbl = document.createElement('div');
    lbl.className = 'stat-label';
    lbl.textContent = label;
    card.appendChild(val);
    card.appendChild(lbl);
    return card;
  }

  async function load() {
    statsMount.innerHTML = '<div class="empty-state">Loading…</div>';
    tableMount.innerHTML = '';
    const days = periodSelect.value;
    const res = await fetch(`/api/admin/analytics/top-records?days=${days}&limit=10`);
    const data = await res.json();

    statsMount.innerHTML = '';
    statsMount.appendChild(statCard(data.totals.lookups || 0, 'ID lookups'));
    statsMount.appendChild(statCard(data.totals.distinct_records || 0, 'Distinct machines'));
    statsMount.appendChild(statCard(data.totals.views || 0, 'Media views'));
    statsMount.appendChild(statCard(data.totals.downloads || 0, 'Downloads'));

    if (!data.top_records.length) {
      tableMount.innerHTML = '<div class="empty-state">No lookups recorded in this period yet.</div>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML = '<thead><tr><th>#</th><th>Record ID</th><th>Name</th><th>Lookups</th></tr></thead>';
    const tbody = document.createElement('tbody');

    data.top_records.forEach((row, i) => {
      const tr = document.createElement('tr');

      const rankTd = document.createElement('td');
      rankTd.textContent = `${i + 1}`;

      const idTd = document.createElement('td');
      idTd.className = 'record-id-cell';
      idTd.textContent = row.record_id;

      const nameTd = document.createElement('td');
      nameTd.textContent = [row.name, row.make].filter(Boolean).join(' — ') || '—';

      const countTd = document.createElement('td');
      countTd.textContent = row.lookups;

      tr.appendChild(rankTd);
      tr.appendChild(idTd);
      tr.appendChild(nameTd);
      tr.appendChild(countTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableMount.appendChild(table);
  }

  periodSelect.addEventListener('change', load);
  load();
}

function initActivityLog() {
  const mount = document.getElementById('logs-table-mount');
  const refreshBtn = document.getElementById('refresh-logs-btn');

  async function loadLogs() {
    mount.innerHTML = '<div class="empty-state">Loading…</div>';
    const res = await fetch('/api/admin/logs');
    const data = await res.json();
    renderTable(data.logs);
  }

  function renderTable(logs) {
    if (logs.length === 0) {
      mount.innerHTML = '<div class="empty-state">No activity recorded yet.</div>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'records-table';
    table.innerHTML =
      '<thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Record</th><th>File</th><th>Detail</th></tr></thead>';
    const tbody = document.createElement('tbody');

    logs.forEach((l) => {
      const tr = document.createElement('tr');
      const who = l.username ? `${l.username} (${l.role || 'admin'})` : 'customer (public)';
      [l.timestamp, who, l.action, l.record_id || '—', l.filename || '—', l.detail || ''].forEach((val) => {
        const td = document.createElement('td');
        td.textContent = val;
        td.style.fontSize = '12px';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    mount.innerHTML = '';
    mount.appendChild(table);
  }

  refreshBtn.addEventListener('click', loadLogs);
  loadLogs();
}
