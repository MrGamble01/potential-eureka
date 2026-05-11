/* ============================================
   ORG CHART — Interactive spider-web visualization
   Real account-management org as of May 2026.
   Click a person to see their current projects.
   ============================================ */

const OrgChart = (() => {
  // ---- Data ----
  // status: 'active' (named project) | 'proposed' (italicized TBD suggestion) | 'ownership' (day-to-day scope)
  const PEOPLE = [
    {
      id: 'matthew', name: 'Matthew Gamble', role: 'Head of Account Management',
      pod: 'root', parent: null,
      tasks: [
        { title: 'Org design & pod leadership', status: 'ownership',
          detail: 'Oversees Steven, Bryce, and Sara\'s pods across AM, OS, and CM.' },
        { title: 'Confirming named-project model', status: 'proposed',
          detail: 'Open question: does each pod need exactly one named project per person, or are some ICs intentionally focused only on book-of-business work?' },
      ],
    },

    // ---- Steven's pod (AMs) ----
    {
      id: 'steven', name: 'Steven', role: 'Lead AM',
      pod: 'steven', parent: 'matthew',
      tasks: [
        { title: 'Commission structure', status: 'active',
          detail: 'Owns the AM-facing comp model.' },
      ],
    },
    {
      id: 'musarrat', name: 'Musarrat', role: 'AM',
      pod: 'steven', parent: 'steven',
      tasks: [
        { title: 'AM SOPs & PM-facing documentation', status: 'active',
          detail: 'Building the playbooks the team and PMs use day-to-day.' },
      ],
    },
    {
      id: 'kashvi', name: 'Kashvi', role: 'AM',
      pod: 'steven', parent: 'steven',
      tasks: [
        { title: 'Product knowledge & upsell talk tracks', status: 'active',
          detail: 'Owning the cross-sell motion for Pet Damage Waiver, SDA, and the Resident Kit.' },
      ],
    },
    {
      id: 'walt', name: 'Walt', role: 'AM',
      pod: 'steven', parent: 'steven',
      tasks: [
        { title: 'Renewal motion / churn diagnostics', status: 'proposed',
          detail: 'Project TBD — starting point, not an assignment.' },
      ],
    },
    {
      id: 'john', name: 'John', role: 'AM',
      pod: 'steven', parent: 'steven',
      tasks: [
        { title: 'PMS-specific playbook', status: 'proposed',
          detail: 'Project TBD — e.g. Yardi or RealPage. Starting point, not an assignment.' },
      ],
    },

    // ---- Bryce's pod (AMs + OS) ----
    {
      id: 'bryce', name: 'Bryce', role: 'Lead AM · OS Lead',
      pod: 'bryce', parent: 'matthew',
      tasks: [
        { title: 'Integration & permission guides', status: 'active',
          detail: 'Wears two hats: leading a half-pod of AMs and owning the onboarding specialist team.' },
      ],
    },
    {
      id: 'adam', name: 'Adam', role: 'AM',
      pod: 'bryce', parent: 'bryce',
      tasks: [
        { title: 'Named-account expansion', status: 'proposed',
          detail: 'Project TBD — starting point, not an assignment.' },
      ],
    },
    {
      id: 'patrick', name: 'Patrick', role: 'AM',
      pod: 'bryce', parent: 'bryce',
      tasks: [
        { title: 'Discovery / pre-launch QBRs', status: 'proposed',
          detail: 'Project TBD — starting point, not an assignment.' },
      ],
    },
    {
      id: 'arjun', name: 'Arjun', role: 'OS',
      pod: 'bryce', parent: 'bryce',
      tasks: [
        { title: 'OS SOPs', status: 'active',
          detail: 'Owning the onboarding-side playbooks and process documentation.' },
      ],
    },
    {
      id: 'ben', name: 'Ben', role: 'OS',
      pod: 'bryce', parent: 'bryce',
      tasks: [
        { title: 'PMS data-mapping checklists', status: 'proposed',
          detail: 'Project TBD — starting point, not an assignment.' },
      ],
    },

    // ---- Sara's pod (Backend / Charge Management) ----
    {
      id: 'sara', name: 'Sara', role: 'Backend Lead',
      pod: 'sara', parent: 'matthew',
      tasks: [
        { title: 'Backend / OS / charge-management docs & SOPs', status: 'active',
          detail: 'Sits between AMs and CS as the operational connective tissue.' },
      ],
    },
    {
      id: 'tom', name: 'Tom', role: 'Lead CM',
      pod: 'sara', parent: 'sara',
      tasks: [
        { title: 'PMS audit automation', status: 'active',
          detail: 'Audit processes across all PMS. Partnering with Hammond (cross-department) to build a tool that automates the audit once the reports are pulled.' },
      ],
    },
    {
      id: 'paula', name: 'Paula', role: 'CM',
      pod: 'sara', parent: 'tom',
      tasks: [
        { title: 'Claims-side reconciliation', status: 'proposed',
          detail: 'Project TBD — starting point, not an assignment.' },
      ],
    },
    {
      id: 'david', name: 'David', role: 'CM',
      pod: 'sara', parent: 'tom',
      tasks: [
        { title: 'PM billing dispute workflow', status: 'proposed',
          detail: 'Project TBD — starting point, not an assignment.' },
      ],
    },
  ];

  // Cross-pod collaboration edges for the spider-web feel (lighter lines).
  const COLLAB = [
    ['steven', 'bryce'], ['bryce', 'sara'], ['steven', 'sara'],     // pod leads peer ring
    ['musarrat', 'arjun'],                                          // SOPs across AM + OS
    ['kashvi', 'adam'], ['kashvi', 'patrick'],                      // cross-sell affects all AMs
    ['arjun', 'ben'],                                               // OS pair
    ['tom', 'sara'],                                                // already linear, reinforced
    ['walt', 'john'], ['paula', 'david'],                           // peer support
  ];

  const POD_COLORS = {
    root:   '#8B83FF',  // indigo
    steven: '#58A6FF',  // blue
    bryce:  '#3FB950',  // green
    sara:   '#F778BA',  // pink/purple
  };

  // ---- State ----
  let canvas, ctx, panel;
  let width = 0, height = 0, dpr = 1, scale = 1;
  const REF_SIZE = 620;             // reference viewport the layout was designed for
  let nodes = [];                 // { ...person, x, y, vx, vy, r }
  let edges = [];                 // { a, b, kind: 'report' | 'collab' }
  let selectedId = null;
  let hoverId = null;
  let dragNode = null;
  let dragOffset = { x: 0, y: 0 };
  let rafId = null;
  let mouse = { x: 0, y: 0 };
  let searchTerm = '';

  function init() {
    canvas = document.getElementById('orgchart-canvas');
    panel  = document.getElementById('orgchart-panel');
    if (!canvas || !panel) return;
    ctx = canvas.getContext('2d');

    buildGraph();
    seedLayout();
    bindEvents();
    bindToolbar();
    resize();
    renderPanel(null);

    // Deep-link: #orgchart=tom selects Tom on load.
    applyHashSelection();
    window.addEventListener('hashchange', applyHashSelection);

    window.addEventListener('resize', resize);
    loop();
  }

  function applyHashSelection() {
    const m = (location.hash || '').match(/orgchart=([a-z0-9_-]+)/i);
    if (m && nodes.find(n => n.id === m[1])) selectNode(m[1], { skipHash: true });
  }

  function bindToolbar() {
    const search = document.getElementById('orgchart-search');
    const reset  = document.getElementById('orgchart-reset');
    if (search) {
      search.addEventListener('input', e => { searchTerm = e.target.value.trim().toLowerCase(); });
      search.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const match = nodes.find(n => searchTerm && n.name.toLowerCase().includes(searchTerm));
          if (match) selectNode(match.id);
        } else if (e.key === 'Escape') {
          search.value = ''; searchTerm = '';
        }
      });
    }
    if (reset) {
      reset.addEventListener('click', () => {
        seedLayout();
        for (const n of nodes) { n.vx = 0; n.vy = 0; }
        selectedId = null;
        renderPanel(null);
        if (search) { search.value = ''; searchTerm = ''; }
        if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      });
    }
  }

  function buildGraph() {
    nodes = PEOPLE.map(p => ({
      ...p,
      x: 0, y: 0, vx: 0, vy: 0,
      r: p.id === 'matthew' ? 28 : (p.parent === 'matthew' || p.id === 'tom' ? 22 : 18),
    }));
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    edges = [];
    for (const n of nodes) {
      if (n.parent && byId[n.parent]) {
        edges.push({ a: byId[n.parent], b: n, kind: 'report' });
      }
    }
    for (const [a, b] of COLLAB) {
      if (byId[a] && byId[b]) edges.push({ a: byId[a], b: byId[b], kind: 'collab' });
    }
  }

  function seedLayout() {
    // Radial seed: Matthew at center, pod leads on inner ring, ICs on outer arcs.
    const root = nodes.find(n => n.id === 'matthew');
    root.x = 0; root.y = 0;

    const podLeads = nodes.filter(n => n.parent === 'matthew');
    const ringInner = 170;
    podLeads.forEach((n, i) => {
      const angle = (-Math.PI / 2) + (i / podLeads.length) * Math.PI * 2;
      n.x = Math.cos(angle) * ringInner;
      n.y = Math.sin(angle) * ringInner;
      n._baseAngle = angle;
    });

    // Place each pod's reports in an arc around their lead, away from center.
    const ringOuter = 150;
    for (const lead of podLeads) {
      const reports = nodes.filter(n => n.parent === lead.id);
      const spread = Math.PI * 0.7;
      reports.forEach((n, i) => {
        const t = reports.length === 1 ? 0.5 : i / (reports.length - 1);
        const a = lead._baseAngle - spread / 2 + spread * t;
        n.x = lead.x + Math.cos(a) * ringOuter;
        n.y = lead.y + Math.sin(a) * ringOuter;
      });
    }

    // Tom's reports nest under Tom.
    const tom = nodes.find(n => n.id === 'tom');
    if (tom) {
      const tomReports = nodes.filter(n => n.parent === 'tom');
      const baseAngle = Math.atan2(tom.y, tom.x);
      tomReports.forEach((n, i) => {
        const t = tomReports.length === 1 ? 0.5 : i / (tomReports.length - 1);
        const a = baseAngle - 0.45 + 0.9 * t;
        n.x = tom.x + Math.cos(a) * 110;
        n.y = tom.y + Math.sin(a) * 110;
      });
    }
  }

  function bindEvents() {
    canvas.addEventListener('mousemove', e => {
      const p = mousePos(e);
      mouse = p;
      if (dragNode) {
        dragNode.x = p.x - dragOffset.x;
        dragNode.y = p.y - dragOffset.y;
        dragNode.vx = 0; dragNode.vy = 0;
      } else {
        const n = pick(p);
        const nextHover = n ? n.id : null;
        if (nextHover !== hoverId) {
          hoverId = nextHover;
          canvas.style.cursor = hoverId ? 'pointer' : 'grab';
        }
      }
    });
    canvas.addEventListener('mousedown', e => {
      const p = mousePos(e);
      const n = pick(p);
      if (n) {
        dragNode = n;
        dragOffset = { x: p.x - n.x, y: p.y - n.y };
        canvas.classList.add('dragging');
      }
    });
    canvas.addEventListener('mouseup', e => {
      const p = mousePos(e);
      if (dragNode) {
        const moved = Math.hypot(p.x - (dragNode.x + dragOffset.x), p.y - (dragNode.y + dragOffset.y));
        // Treat near-zero movement as a click → select.
        if (moved < 4) selectNode(dragNode.id);
      } else {
        const n = pick(p);
        if (n) selectNode(n.id);
      }
      dragNode = null;
      canvas.classList.remove('dragging');
    });
    canvas.addEventListener('mouseleave', () => {
      dragNode = null;
      hoverId = null;
      canvas.classList.remove('dragging');
    });
    // Basic touch support
    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0]; if (!t) return;
      const p = mousePos(t);
      const n = pick(p);
      if (n) { dragNode = n; dragOffset = { x: p.x - n.x, y: p.y - n.y }; }
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      const t = e.touches[0]; if (!t || !dragNode) return;
      const p = mousePos(t);
      dragNode.x = p.x - dragOffset.x;
      dragNode.y = p.y - dragOffset.y;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      if (dragNode) selectNode(dragNode.id);
      dragNode = null;
    });
  }

  function mousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) - width / 2) / scale,
      y: ((e.clientY - rect.top) - height / 2) / scale,
    };
  }

  function pick(p) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (Math.hypot(p.x - n.x, p.y - n.y) <= n.r + 4) return n;
    }
    return null;
  }

  function selectNode(id, opts = {}) {
    selectedId = id;
    renderPanel(id);
    if (!opts.skipHash && id && history.replaceState) {
      history.replaceState(null, '', `#orgchart=${id}`);
    }
  }

  // Set of node ids "related" to the selected node: the node itself,
  // its parent chain, its descendants, and its direct collab peers.
  function relatedIds(id) {
    if (!id) return null;
    const set = new Set([id]);
    // Descendants (BFS over parent links).
    let frontier = [id];
    while (frontier.length) {
      const next = [];
      for (const f of frontier) {
        for (const n of nodes) {
          if (n.parent === f && !set.has(n.id)) { set.add(n.id); next.push(n.id); }
        }
      }
      frontier = next;
    }
    // Ancestors.
    let cur = nodes.find(n => n.id === id);
    while (cur && cur.parent) { set.add(cur.parent); cur = nodes.find(n => n.id === cur.parent); }
    // Collaboration peers.
    for (const [a, b] of COLLAB) {
      if (a === id) set.add(b);
      else if (b === id) set.add(a);
    }
    return set;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Fit the graph (designed at ~REF_SIZE) to whatever container we have.
    scale = Math.max(0.5, Math.min(1.2, Math.min(width, height) / REF_SIZE));
  }

  // ---- Physics: gentle web breathing ----
  function step() {
    const cx = 0, cy = 0;

    // Repulsion between all nodes (keeps things readable).
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d2 = 1; }
        const d = Math.sqrt(d2);
        const minDist = a.r + b.r + 24;
        if (d < 220) {
          const f = (220 - d) * 0.0009 + (d < minDist ? (minDist - d) * 0.02 : 0);
          const nx = dx / d, ny = dy / d;
          a.vx -= nx * f; a.vy -= ny * f;
          b.vx += nx * f; b.vy += ny * f;
        }
      }
    }

    // Spring along reporting edges (stronger). Collab edges = softer spring.
    for (const e of edges) {
      const a = e.a, b = e.b;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const rest = e.kind === 'report' ? 130 : 200;
      const k = e.kind === 'report' ? 0.008 : 0.0015;
      const f = (d - rest) * k;
      const nx = dx / d, ny = dy / d;
      a.vx += nx * f; a.vy += ny * f;
      b.vx -= nx * f; b.vy -= ny * f;
    }

    // Mild pull toward origin so the graph doesn't drift off-screen.
    for (const n of nodes) {
      if (n.id === 'matthew') {
        // Pin Matthew softly to center.
        n.vx += (cx - n.x) * 0.05;
        n.vy += (cy - n.y) * 0.05;
      } else {
        n.vx += (cx - n.x) * 0.0008;
        n.vy += (cy - n.y) * 0.0008;
      }
    }

    // Integrate with damping. Skip the node being dragged.
    for (const n of nodes) {
      if (n === dragNode) continue;
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
    }
  }

  // ---- Rendering ----
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);

    drawWebBackdrop();
    drawEdges();
    drawNodes();

    ctx.restore();
  }

  function drawWebBackdrop() {
    // Concentric rings + radial spokes for the spider-web aesthetic.
    // Drawn in graph-space, sized to cover the visible canvas after scaling.
    const reach = Math.max(width, height) / scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1 / scale;
    for (let r = 80; r < reach; r += 90) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    const spokes = 12;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
      ctx.stroke();
    }
  }

  function drawEdges() {
    const related = relatedIds(selectedId);
    for (const e of edges) {
      const a = e.a, b = e.b;
      const focused = selectedId && (a.id === selectedId || b.id === selectedId);
      const hovered = hoverId && (a.id === hoverId || b.id === hoverId);
      // Edge is "in focus" only if both endpoints belong to the related set.
      const dim = related && !(related.has(a.id) && related.has(b.id));
      const dimAlpha = dim ? 0.25 : 1;

      if (e.kind === 'collab') {
        const baseAlpha = focused || hovered ? 0.22 : 0.06;
        ctx.strokeStyle = `rgba(255,255,255,${baseAlpha * dimAlpha})`;
        ctx.lineWidth = focused ? 1.4 : 0.8;
        ctx.setLineDash([4, 5]);
      } else {
        const c = POD_COLORS[b.pod] || '#8B83FF';
        const base = focused ? 0.95 : hovered ? 0.55 : 0.28;
        ctx.strokeStyle = hexToRgba(c, base * dimAlpha);
        ctx.lineWidth = focused ? 2 : 1.2;
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawNodes() {
    const related = relatedIds(selectedId);
    const t = performance.now() / 1000;
    for (const n of nodes) {
      const c = POD_COLORS[n.pod] || '#8B83FF';
      const isSel = n.id === selectedId;
      const isHov = n.id === hoverId;
      const isMatch = searchTerm && n.name.toLowerCase().includes(searchTerm);
      const dim = related && !related.has(n.id);
      const alpha = dim && !isMatch ? 0.3 : 1;
      const pulse = isMatch ? 3 + Math.sin(t * 4) * 2 : 0;
      const r = n.r + (isSel ? 4 : isHov ? 2 : 0) + pulse;

      ctx.globalAlpha = alpha;

      // Outer glow
      const glowAlpha = (isSel || isMatch) ? 0.55 : 0.25;
      const glow = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, r * 2.4);
      glow.addColorStop(0, hexToRgba(c, glowAlpha));
      glow.addColorStop(1, hexToRgba(c, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = 'rgba(13, 17, 23, 0.92)';
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.strokeStyle = isMatch ? '#FFFFFF' : c;
      ctx.lineWidth = isSel ? 3 : (isHov || isMatch) ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Initials
      ctx.fillStyle = '#E6EDF3';
      ctx.font = `600 ${n.id === 'matthew' ? 13 : 11}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials(n.name), n.x, n.y);

      // Name label below
      ctx.fillStyle = isSel ? '#E6EDF3' : '#9aa3ad';
      ctx.font = `${isSel ? 600 : 500} 11px 'Inter', sans-serif`;
      ctx.fillText(n.name.split(' ')[0], n.x, n.y + r + 14);
      if (isSel || isHov || n.id === 'matthew') {
        ctx.fillStyle = '#7D8590';
        ctx.font = `500 10px 'JetBrains Mono', monospace`;
        ctx.fillText(n.role, n.x, n.y + r + 28);
      }
    }
    ctx.globalAlpha = 1;
  }

  function initials(name) {
    return name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const v = h.length === 3
      ? h.split('').map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return `rgba(${v[0]}, ${v[1]}, ${v[2]}, ${a})`;
  }

  function loop() {
    step();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // ---- Side panel ----
  function renderPanel(id) {
    if (!id) {
      const total = nodes.length;
      const active = nodes.reduce((s, n) => s + n.tasks.filter(t => t.status === 'active').length, 0);
      const proposed = nodes.reduce((s, n) => s + n.tasks.filter(t => t.status === 'proposed').length, 0);
      panel.innerHTML = `
        <div class="orgchart-panel-empty">
          <span class="pulse-icon">◉</span>
          Click a node to see what they're working on.<br>
          Drag nodes to rearrange the web.
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
            <div class="org-task-header">
              <span class="org-task-title">Italicized projects are starting points, not assignments</span>
            </div>
            <div class="org-task-meta"><span>Most ICs don't have a named project yet</span></div>
          </div>
          <div class="org-task status-review">
            <div class="org-task-header">
              <span class="org-task-title">One named project per IC?</span>
            </div>
            <div class="org-task-meta"><span>Or are some ICs intentionally focused only on book-of-business work?</span></div>
          </div>
          <div class="org-task status-done">
            <div class="org-task-header">
              <span class="org-task-title">Hammond removed from this roster</span>
            </div>
            <div class="org-task-meta"><span>Sits in another department but supports NPS work</span></div>
          </div>
        </div>
      `;
      return;
    }

    const p = nodes.find(n => n.id === id);
    if (!p) return;
    const color = POD_COLORS[p.pod];
    const podLabel = ({
      root: 'Org Head',
      steven: "Steven's pod — AMs",
      bryce: "Bryce's pod — AMs + OS",
      sara: "Sara's pod — Backend / CM",
    })[p.pod];

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

    const reports = nodes.filter(n => n.parent === p.id);
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
          <div class="org-meta-value">${escapeHtml(podLabel || '—')}</div>
        </div>
        <div class="org-meta-cell">
          <div class="org-meta-label">Reports To</div>
          <div class="org-meta-value">${p.parent ? escapeHtml(nodes.find(n => n.id === p.parent).name) : '—'}</div>
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  return { init };
})();
