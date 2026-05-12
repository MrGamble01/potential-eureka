/* ============================================
   ORG CHART — Clean DOM tree of the account-
   management org. Click a person to see what
   they're working on.
   ============================================ */

const OrgChart = (() => {
  // status: 'active' (named project) | 'proposed' (italicized TBD) | 'ownership' (day-to-day scope)
  const PEOPLE = [
    { id: 'matthew', name: 'Matthew Gamble', role: 'Head of Account Management',
      pod: 'root', parent: null,
      tasks: [
        { title: 'Org design & pod leadership', status: 'ownership',
          detail: 'Oversees Steven, Bryce, and Sara\'s pods across AM, OS, and CM.' },
        { title: 'Confirming named-project model', status: 'proposed',
          detail: 'Open question: does each pod need exactly one named project per person, or are some ICs intentionally focused only on book-of-business work?' },
      ] },

    // Steven's pod (AMs)
    { id: 'steven', name: 'Steven', role: 'Lead AM',
      pod: 'steven', parent: 'matthew',
      tasks: [{ title: 'Commission structure', status: 'active',
        detail: 'Owns the AM-facing comp model.' }] },
    { id: 'musarrat', name: 'Musarrat', role: 'AM', pod: 'steven', parent: 'steven',
      tasks: [{ title: 'AM SOPs & PM-facing documentation', status: 'active',
        detail: 'Building the playbooks the team and PMs use day-to-day.' }] },
    { id: 'kashvi', name: 'Kashvi', role: 'AM', pod: 'steven', parent: 'steven',
      tasks: [{ title: 'Product knowledge & upsell talk tracks', status: 'active',
        detail: 'Owning the cross-sell motion for Pet Damage Waiver, SDA, and the Resident Kit.' }] },
    { id: 'walt', name: 'Walt', role: 'AM', pod: 'steven', parent: 'steven',
      tasks: [{ title: 'Renewal motion / churn diagnostics', status: 'proposed',
        detail: 'Project TBD — starting point, not an assignment.' }] },
    { id: 'john', name: 'John', role: 'AM', pod: 'steven', parent: 'steven',
      tasks: [{ title: 'PMS-specific playbook', status: 'proposed',
        detail: 'Project TBD — e.g. Yardi or RealPage. Starting point, not an assignment.' }] },

    // Bryce's pod (AMs + OS)
    { id: 'bryce', name: 'Bryce', role: 'Lead AM · OS Lead',
      pod: 'bryce', parent: 'matthew',
      tasks: [{ title: 'Integration & permission guides', status: 'active',
        detail: 'Wears two hats: leading a half-pod of AMs and owning the onboarding specialist team.' }] },
    { id: 'adam', name: 'Adam', role: 'AM', pod: 'bryce', parent: 'bryce',
      tasks: [{ title: 'Named-account expansion', status: 'proposed',
        detail: 'Project TBD — starting point, not an assignment.' }] },
    { id: 'patrick', name: 'Patrick', role: 'AM', pod: 'bryce', parent: 'bryce',
      tasks: [{ title: 'Discovery / pre-launch QBRs', status: 'proposed',
        detail: 'Project TBD — starting point, not an assignment.' }] },
    { id: 'arjun', name: 'Arjun', role: 'OS', pod: 'bryce', parent: 'bryce',
      tasks: [{ title: 'OS SOPs', status: 'active',
        detail: 'Owning the onboarding-side playbooks and process documentation.' }] },
    { id: 'ben', name: 'Ben', role: 'OS', pod: 'bryce', parent: 'bryce',
      tasks: [{ title: 'PMS data-mapping checklists', status: 'proposed',
        detail: 'Project TBD — starting point, not an assignment.' }] },

    // Sara's pod (Backend / Charge Management)
    { id: 'sara', name: 'Sara', role: 'Backend Lead', pod: 'sara', parent: 'matthew',
      tasks: [{ title: 'Backend / OS / charge-management docs & SOPs', status: 'active',
        detail: 'Sits between AMs and CS as the operational connective tissue.' }] },
    { id: 'tom', name: 'Tom', role: 'Lead CM', pod: 'sara', parent: 'sara',
      tasks: [{ title: 'PMS audit automation', status: 'active',
        detail: 'Audit processes across all PMS. Partnering with Hammond (cross-department) to build a tool that automates the audit once the reports are pulled.' }] },
    { id: 'paula', name: 'Paula', role: 'CM', pod: 'sara', parent: 'tom',
      tasks: [{ title: 'Claims-side reconciliation', status: 'proposed',
        detail: 'Project TBD — starting point, not an assignment.' }] },
    { id: 'david', name: 'David', role: 'CM', pod: 'sara', parent: 'tom',
      tasks: [{ title: 'PM billing dispute workflow', status: 'proposed',
        detail: 'Project TBD — starting point, not an assignment.' }] },
  ];

  const POD_COLORS = {
    root:   '#8B83FF',
    steven: '#58A6FF',
    bryce:  '#3FB950',
    sara:   '#F778BA',
  };

  const POD_LABELS = {
    root:   'Org Head',
    steven: "Steven's pod — AMs",
    bryce:  "Bryce's pod — AMs + OS",
    sara:   "Sara's pod — Backend / CM",
  };

  let tree, panel;
  let selectedId = null;
  let searchTerm = '';

  function init() {
    tree  = document.getElementById('orgchart-tree');
    panel = document.getElementById('orgchart-panel');
    if (!tree || !panel) return;
    renderTree();
    bindToolbar();
    renderPanel(null);
    applyHashSelection();
    window.addEventListener('hashchange', applyHashSelection);
  }

  function childrenOf(id) {
    return PEOPLE.filter(p => p.parent === id);
  }

  function renderTree() {
    const root = PEOPLE.find(p => !p.parent);
    tree.innerHTML = `<ul class="tree-root">${nodeHtml(root)}</ul>`;
    tree.querySelectorAll('.org-node').forEach(el => {
      el.addEventListener('click', () => selectNode(el.dataset.id));
    });
  }

  function nodeHtml(p) {
    const kids = childrenOf(p.id);
    const tagText = p.tasks.find(t => t.status === 'active') ? 'in flight'
                  : p.tasks.find(t => t.status === 'proposed') ? 'proposed'
                  : '';
    const tagClass = p.tasks.find(t => t.status === 'active') ? 'status-active'
                   : p.tasks.find(t => t.status === 'proposed') ? 'status-proposed'
                   : '';
    return `
      <li>
        <button class="org-node ${p.id === 'matthew' ? 'is-root' : ''}" data-id="${p.id}" style="--c:${POD_COLORS[p.pod]}">
          <div class="org-node-init">${initials(p.name)}</div>
          <div class="org-node-text">
            <div class="org-node-name">${escapeHtml(p.name)}</div>
            <div class="org-node-role">${escapeHtml(p.role)}</div>
            ${tagText ? `<div class="org-node-tag ${tagClass}">${tagText}</div>` : ''}
          </div>
        </button>
        ${kids.length ? `<ul>${kids.map(nodeHtml).join('')}</ul>` : ''}
      </li>
    `;
  }

  function bindToolbar() {
    const search = document.getElementById('orgchart-search');
    if (!search) return;
    search.addEventListener('input', e => {
      searchTerm = e.target.value.trim().toLowerCase();
      tree.querySelectorAll('.org-node').forEach(el => {
        const p = PEOPLE.find(x => x.id === el.dataset.id);
        const match = searchTerm && p.name.toLowerCase().includes(searchTerm);
        el.classList.toggle('is-match', !!match);
      });
    });
    search.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const m = PEOPLE.find(p => searchTerm && p.name.toLowerCase().includes(searchTerm));
        if (m) selectNode(m.id);
      } else if (e.key === 'Escape') {
        search.value = ''; searchTerm = '';
        tree.querySelectorAll('.org-node.is-match').forEach(el => el.classList.remove('is-match'));
      }
    });
  }

  function applyHashSelection() {
    const m = (location.hash || '').match(/orgchart=([a-z0-9_-]+)/i);
    if (m && PEOPLE.find(p => p.id === m[1])) selectNode(m[1], { skipHash: true });
  }

  function selectNode(id, opts = {}) {
    selectedId = id;
    tree.querySelectorAll('.org-node').forEach(el => {
      el.classList.toggle('is-selected', el.dataset.id === id);
    });
    renderPanel(id);
    if (!opts.skipHash && id && history.replaceState) {
      history.replaceState(null, '', `#orgchart=${id}`);
    }
    const el = tree.querySelector(`.org-node[data-id="${id}"]`);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }

  // ---- Side panel ----
  function renderPanel(id) {
    if (!id) {
      const total    = PEOPLE.length;
      const active   = PEOPLE.reduce((s, n) => s + n.tasks.filter(t => t.status === 'active').length, 0);
      const proposed = PEOPLE.reduce((s, n) => s + n.tasks.filter(t => t.status === 'proposed').length, 0);
      panel.innerHTML = `
        <div class="orgchart-panel-empty">
          <span class="pulse-icon">◉</span>
          Click anyone to see what they're working on.
        </div>
        <div class="org-meta">
          <div class="org-meta-cell"><div class="org-meta-label">People</div><div class="org-meta-value">${total}</div></div>
          <div class="org-meta-cell"><div class="org-meta-label">In Flight</div><div class="org-meta-value">${active}</div></div>
          <div class="org-meta-cell"><div class="org-meta-label">Proposed</div><div class="org-meta-value">${proposed}</div></div>
          <div class="org-meta-cell"><div class="org-meta-label">Pods</div><div class="org-meta-value">3</div></div>
        </div>
        <div class="org-section-title"><span class="dot"></span> Notes & Open Questions</div>
        <div class="org-tasks">
          <div class="org-task status-progress">
            <div class="org-task-header"><span class="org-task-title">Italicized projects are starting points, not assignments</span></div>
            <div class="org-task-meta"><span>Most ICs don't have a named project yet</span></div>
          </div>
          <div class="org-task status-review">
            <div class="org-task-header"><span class="org-task-title">One named project per IC?</span></div>
            <div class="org-task-meta"><span>Or are some ICs intentionally focused only on book-of-business work?</span></div>
          </div>
          <div class="org-task status-done">
            <div class="org-task-header"><span class="org-task-title">Hammond removed from this roster</span></div>
            <div class="org-task-meta"><span>Sits in another department but supports NPS work</span></div>
          </div>
        </div>
      `;
      return;
    }

    const p = PEOPLE.find(n => n.id === id);
    if (!p) return;
    const color = POD_COLORS[p.pod];

    const taskHtml = p.tasks.map(t => {
      const cls = t.status === 'active' ? 'status-progress'
                : t.status === 'proposed' ? 'status-review'
                : 'status-done';
      const tag = t.status === 'active' ? 'IN FLIGHT'
                : t.status === 'proposed' ? 'PROPOSED'
                : 'OWNERSHIP';
      return `
        <div class="org-task ${cls}">
          <div class="org-task-header">
            <span class="org-task-title">${escapeHtml(t.title)}</span>
            <span class="org-task-tag">${tag}</span>
          </div>
          <div class="org-task-meta"><span>${escapeHtml(t.detail || '')}</span></div>
        </div>
      `;
    }).join('');

    const reports = childrenOf(p.id);
    const reportsHtml = reports.length ? `
      <div class="org-section-title"><span class="dot"></span> Direct Reports (${reports.length})</div>
      <div class="org-reports">
        ${reports.map(r => `
          <button class="org-report-chip" data-id="${r.id}" style="--c:${POD_COLORS[r.pod]}">
            <span class="org-report-init">${initials(r.name)}</span>
            <span class="org-report-name">${escapeHtml(r.name)}</span>
            <span class="org-report-role">${escapeHtml(r.role)}</span>
          </button>
        `).join('')}
      </div>
    ` : '';

    panel.innerHTML = `
      <div class="org-card-header">
        <div class="org-avatar" style="color:${color}">${initials(p.name)}</div>
        <div class="org-id">
          <div class="org-name">${escapeHtml(p.name)}</div>
          <div class="org-role">${escapeHtml(p.role)}</div>
        </div>
      </div>
      <div class="org-meta">
        <div class="org-meta-cell">
          <div class="org-meta-label">Pod</div>
          <div class="org-meta-value">${escapeHtml(POD_LABELS[p.pod] || '—')}</div>
        </div>
        <div class="org-meta-cell">
          <div class="org-meta-label">Reports To</div>
          <div class="org-meta-value">${p.parent ? escapeHtml(PEOPLE.find(n => n.id === p.parent).name) : '—'}</div>
        </div>
      </div>
      <div class="org-section-title"><span class="dot"></span> Current Projects</div>
      <div class="org-tasks">${taskHtml}</div>
      ${reportsHtml}
    `;

    panel.querySelectorAll('.org-report-chip').forEach(b => {
      b.addEventListener('click', () => selectNode(b.dataset.id));
    });
  }

  function initials(name) {
    return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  return { init };
})();
