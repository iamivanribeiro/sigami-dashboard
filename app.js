// SIGAMI Dashboard - Client-side only
// Requirements: Chart.js, SheetJS (xlsx.full.min.js)

(function () {
  const palette = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function formatDateDisplay(date) {
    if (!date || isNaN(date.getTime())) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }

  function normalizeKey(key) {
    return String(key || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  function parseToDate(value) {
    if (!value) return null;
    // If already a Date
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    // Excel serial date (number)
    if (typeof value === 'number') {
      const o = XLSX.SSF.parse_date_code(value);
      if (!o) return null;
      return new Date(o.y, o.m - 1, o.d);
    }
    // String parsing: try multiple formats
    const str = String(value).trim();
    // ISO-like
    const iso = new Date(str);
    if (!isNaN(iso.getTime())) return iso;
    // DD/MM/YYYY
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10) - 1;
      const y = parseInt(m[3], 10);
      const dt = new Date(y, mo, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
  }

  function distribution(arr, key) {
    const map = {};
    arr.forEach((r) => {
      const v = (r[key] || 'Não informado').toString();
      map[v] = (map[v] || 0) + 1;
    });
    return map;
  }

  function uniqueValues(arr, key) {
    return Array.from(new Set(arr.map((r) => r[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  function downloadCSV(filename, rows) {
    if (!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(',')].concat(
      rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  class Dashboard {
    constructor() {
      this.records = []; // normalized
      this.filtered = [];
      this.charts = { status: null, subsecretaria: null, assuntos: null, geo: null };
      this.filters = { status: '', subsecretaria: '', search: '', start: null, end: null };
      this.activeGeo = 'cidade';
      this.sortState = { column: '', dir: 'asc' };
      this.dateInitialized = false;

      // UI refs
      this.ui = {
        fileInput: $('#fileInput'),
        refreshBtn: $('#refreshBtn'),
        uploadInstructions: $('#uploadInstructions'),
        dashboardContent: $('#dashboardContent'),
        dateStart: $('#dataInicio'),
        dateEnd: $('#dataFim'),
        statusFilter: $('#statusFilter'),
        subsecretariaFilter: $('#subsecretariaFilter'),
        searchInput: $('#searchInput'),
        exportBtn: $('#exportBtn'),
        geoTabs: $$('.geo-tab'),
        total: $('#totalSolicitacoes'),
        concluidas: $('#concluidas'),
        andamento: $('#emAndamento'),
        naoIniciadas: $('#naoIniciadas'),
        taxa: $('#taxaConclusao'),
        analistasTbody: $('#analistasTable tbody'),
        solicitacoesTbody: $('#solicitacoesTable tbody'),
        sortableHeaders: $$('#solicitacoesTable thead th[data-sort]')
      };
    }

    init() {
      this.bindEvents();
      // Provide an example loader button inside the instructions
      this.injectExampleButton();
    }

    bindEvents() {
      // Upload handler
      this.ui.fileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          await this.loadFromXLSX(file);
          this.onDataLoaded();
        } catch (err) {
          console.error(err);
          alert('Não foi possível ler o arquivo. Verifique o formato (XLSX) e tente novamente.');
        }
      });

      // Filters
      this.ui.statusFilter.addEventListener('change', () => {
        this.filters.status = this.ui.statusFilter.value;
        this.applyFiltersRender();
      });
      this.ui.subsecretariaFilter.addEventListener('change', () => {
        this.filters.subsecretaria = this.ui.subsecretariaFilter.value;
        this.applyFiltersRender();
      });
      this.ui.searchInput.addEventListener('input', () => {
        this.filters.search = this.ui.searchInput.value.trim().toLowerCase();
        this.applyFiltersRender();
      });
      
      // Date filters - fix the issue with date inputs
      this.ui.dateStart.addEventListener('change', (e) => {
        this.filters.start = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
        this.applyFiltersRender();
      });
      this.ui.dateEnd.addEventListener('change', (e) => {
        this.filters.end = e.target.value ? new Date(e.target.value + 'T23:59:59') : null;
        this.applyFiltersRender();
      });

      // Metric cards quick filters
      $$('.metric-card[data-filter]').forEach((card) => {
        card.addEventListener('click', () => {
          const filterData = card.getAttribute('data-filter');
          if (filterData === 'all') {
            this.clearFilters();
            return;
          }
          // If multiple statuses listed, pick the first available that exists in options
          const candidates = filterData.split(',');
          const options = Array.from(this.ui.statusFilter.options).map((o) => o.value);
          const found = candidates.find((c) => options.includes(c)) || candidates[0];
          this.ui.statusFilter.value = found;
          this.filters.status = found;
          this.applyFiltersRender();
        });
      });

      // Sorting
      this.ui.sortableHeaders.forEach((th) => {
        th.addEventListener('click', () => {
          const col = th.getAttribute('data-sort');
          const current = this.sortState.column === col ? this.sortState.dir : 'asc';
          const next = current === 'asc' ? 'desc' : 'asc';
          this.sortState = { column: col, dir: next };
          this.ui.sortableHeaders.forEach((h) => h.classList.remove('sort-asc', 'sort-desc'));
          th.classList.add(next === 'asc' ? 'sort-asc' : 'sort-desc');
          this.renderTable();
        });
      });

      // Export
      this.ui.exportBtn.addEventListener('click', () => {
        const rows = this.filtered.map((r) => ({
          protocolo: r.protocolo,
          assunto: r.assunto,
          subsecretaria: r.subsecretaria,
          status: r.status,
          abertura: formatDateDisplay(r.abertura),
          prazo: formatDateDisplay(r.prazo),
          analista: r.analista,
          cidade: r.cidade,
          bairro: r.bairro,
          uf: r.uf,
        }));
        downloadCSV(`sigami_solicitacoes_${new Date().toISOString().slice(0,10)}.csv`, rows);
      });

      // Refresh / Clear
      this.ui.refreshBtn.addEventListener('click', () => {
        this.clearFilters();
      });

      // Geo tabs
      this.ui.geoTabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.ui.geoTabs.forEach((b) => b.classList.remove('geo-tab--active'));
          btn.classList.add('geo-tab--active');
          this.activeGeo = btn.getAttribute('data-tab');
          this.renderGeoChart();
        });
      });
    }

    injectExampleButton() {
      const container = document.createElement('div');
      container.style.marginTop = '16px';
      const btn = document.createElement('button');
      btn.className = 'btn btn--primary';
      btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> Carregar Exemplo';
      btn.addEventListener('click', () => {
        this.loadSample();
        this.onDataLoaded();
      });
      container.appendChild(btn);
      const card = document.querySelector('.instruction-card .instruction-content');
      if (card) card.appendChild(container);
    }

    loadSample() {
      // Minimal realistic dataset (12 linhas)
      const sample = [
        { protocolo:'2025-0001', assunto:'Chegada de Processo Judicial', subsecretaria:'SUBEXEC', status:'Não Iniciado', abertura:'15/09/2025', prazo:'25/09/2025', analista:'Analista 1', cidade:'Belford Roxo', bairro:'Centro', uf:'RJ' },
        { protocolo:'2025-0002', assunto:'Emergência Ambiental', subsecretaria:'SUBCLAM', status:'Em Atendimento', abertura:'16/09/2025', prazo:'26/09/2025', analista:'Analista 2', cidade:'Belford Roxo', bairro:'Areia Branca', uf:'RJ' },
        { protocolo:'2025-0003', assunto:'Licenciamento', subsecretaria:'SUBINFRAS', status:'Aguardando Solicitante', abertura:'18/09/2025', prazo:'28/09/2025', analista:'Analista 3', cidade:'Belford Roxo', bairro:'Heliópolis', uf:'RJ' },
        { protocolo:'2025-0004', assunto:'Ouvidoria SEMAS', subsecretaria:'SUBCLAM', status:'Concluída', abertura:'20/09/2025', prazo:'27/09/2025', analista:'Analista 4', cidade:'Belford Roxo', bairro:'Centro', uf:'RJ' },
        { protocolo:'2025-0005', assunto:'Agenda SM', subsecretaria:'SUBEXEC', status:'Não Iniciado', abertura:'22/09/2025', prazo:'29/09/2025', analista:'Analista 5', cidade:'Belford Roxo', bairro:'Barro Vermelho', uf:'RJ' },
        { protocolo:'2025-0006', assunto:'Emergência Ambiental', subsecretaria:'SUBEXEC', status:'Em Atendimento', abertura:'24/09/2025', prazo:'30/09/2025', analista:'Analista 6', cidade:'Nova Iguaçu', bairro:'Centro', uf:'RJ' },
        { protocolo:'2025-0007', assunto:'Licenciamento', subsecretaria:'SUBINFRAS', status:'Não Iniciado', abertura:'25/09/2025', prazo:'05/10/2025', analista:'Analista 7', cidade:'Nova Iguaçu', bairro:'Posse', uf:'RJ' },
        { protocolo:'2025-0008', assunto:'Ouvidoria SEMAS', subsecretaria:'SUBCLAM', status:'Concluída', abertura:'26/09/2025', prazo:'06/10/2025', analista:'Analista 8', cidade:'Rio de Janeiro', bairro:'Tijuca', uf:'RJ' },
        { protocolo:'2025-0009', assunto:'Emergência Ambiental', subsecretaria:'SUBEXEC', status:'Em Atendimento', abertura:'27/09/2025', prazo:'07/10/2025', analista:'Analista 9', cidade:'Rio de Janeiro', bairro:'Méier', uf:'RJ' },
        { protocolo:'2025-0010', assunto:'Agenda SM', subsecretaria:'SUBEXEC', status:'Não Iniciado', abertura:'28/09/2025', prazo:'08/10/2025', analista:'Analista 10', cidade:'São João de Meriti', bairro:'Centro', uf:'RJ' },
        { protocolo:'2025-0011', assunto:'Chegada de Processo Judicial', subsecretaria:'SUBCLAM', status:'Aguardando Solicitante', abertura:'29/09/2025', prazo:'09/10/2025', analista:'Analista 11', cidade:'São João de Meriti', bairro:'Coelho da Rocha', uf:'RJ' },
        { protocolo:'2025-0012', assunto:'Licenciamento', subsecretaria:'SUBINFRAS', status:'Concluída', abertura:'30/09/2025', prazo:'10/10/2025', analista:'Analista 4', cidade:'Belford Roxo', bairro:'Centro', uf:'RJ' }
      ];
      this.records = sample.map((r) => this.normalizeRecord(r));
    }

    async loadFromXLSX(file) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { raw: true });
      if (!rows || !rows.length) throw new Error('Planilha vazia');

      // Build a key map from the first row's keys
      const rawKeys = Object.keys(rows[0]);
      const map = this.buildKeyMap(rawKeys);

      this.records = rows.map((row) => {
        const obj = {};
        for (const stdKey in map) {
          const srcKey = map[stdKey];
          obj[stdKey] = row[srcKey];
        }
        return this.normalizeRecord(obj);
      }).filter((r) => r.protocolo || r.assunto);
    }

    buildKeyMap(keys) {
      const norm = keys.reduce((acc, k) => { acc[normalizeKey(k)] = k; return acc; }, {});
      const pick = (...cands) => cands.find((c) => norm[c]) ? norm[cands.find((c) => norm[c])] : null;
      // Standard keys we need
      const mapping = {
        protocolo: pick('protocolo', 'nprotocolo', 'numero', 'id', 'idprotocolo'),
        assunto: pick('assunto', 'assunt o', 'tema', 'titul o', 'titulo'),
        subsecretaria: pick('subsecretaria', 'secretaria', 'orga o', 'orgao', 'setor'),
        status: pick('status', 'situacao', 'situa o'),
        abertura: pick('abertura', 'dataabertura', 'dataabert ura', 'data', 'datadeabertura', 'abert ura'),
        prazo: pick('prazo', 'dataprazo', 'datafinal', 'datafechamento', 'conclusao', 'dataconclusao'),
        analista: pick('analista', 'responsavel', 'responsaveltecnico'),
        cidade: pick('cidade', 'municipio', 'localizacao', 'cidadeuf'),
        bairro: pick('bairro', 'distrito', 'regiao'),
        uf: pick('uf', 'estado', 'sigla'),
      };
      // Validate at least essential fields
      if (!mapping.abertura) {
        // allow data field fallback named 'data'
        const asData = pick('data');
        if (asData) mapping.abertura = asData;
      }
      return mapping;
    }

    normalizeRecord(r) {
      const rec = {
        protocolo: String(r.protocolo ?? '').trim(),
        assunto: String(r.assunto ?? '').trim(),
        subsecretaria: String(r.subsecretaria ?? '').trim(),
        status: String(r.status ?? '').trim(),
        abertura: parseToDate(r.abertura),
        prazo: parseToDate(r.prazo),
        analista: String(r.analista ?? '').trim(),
        cidade: String(r.cidade ?? '').trim(),
        bairro: String(r.bairro ?? '').trim(),
        uf: String(r.uf ?? '').trim(),
      };
      // Sanitizers
      if (!rec.cidade) rec.cidade = 'Não informado';
      if (!rec.bairro) rec.bairro = 'Não informado';
      if (!rec.uf) rec.uf = '';
      return rec;
    }

    onDataLoaded() {
      this.ui.uploadInstructions.style.display = 'none';
      this.ui.dashboardContent.style.display = '';
      this.populateFilterOptions();
      this.autoSetDateBounds();
      this.applyFiltersRender();
    }

    populateFilterOptions() {
      // Status
      const statuses = uniqueValues(this.records, 'status');
      this.ui.statusFilter.innerHTML = '<option value="">Todos os Status</option>' +
        statuses.map((s) => `<option value="${s}">${s}</option>`).join('');
      // Subsecretaria
      const subs = uniqueValues(this.records, 'subsecretaria');
      this.ui.subsecretariaFilter.innerHTML = '<option value="">Todas as Subsecretarias</option>' +
        subs.map((s) => `<option value="${s}">${s}</option>`).join('');
    }

    autoSetDateBounds() {
      if (this.dateInitialized) return;
      
      const dates = this.records.map((r) => r.abertura).filter((d) => d instanceof Date && !isNaN(d));
      if (!dates.length) return;
      
      const min = new Date(Math.min.apply(null, dates));
      const max = new Date(Math.max.apply(null, dates));
      // Set inputs min/max and defaults
      const toInput = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      
      this.ui.dateStart.min = toInput(min);
      this.ui.dateStart.max = toInput(max);
      this.ui.dateEnd.min = toInput(min);
      this.ui.dateEnd.max = toInput(max);
      
      // Set default values without triggering events
      this.ui.dateStart.value = toInput(min);
      this.ui.dateEnd.value = toInput(max);
      
      // Set internal filter state
      this.filters.start = new Date(min.getTime());
      this.filters.start.setHours(0, 0, 0, 0);
      this.filters.end = new Date(max.getTime());
      this.filters.end.setHours(23, 59, 59, 999);
      
      this.dateInitialized = true;
    }

    clearFilters() {
      this.filters = { status: '', subsecretaria: '', search: '', start: null, end: null };
      this.ui.statusFilter.value = '';
      this.ui.subsecretariaFilter.value = '';
      this.ui.searchInput.value = '';
      this.ui.dateStart.value = '';
      this.ui.dateEnd.value = '';
      
      // Reset date bounds if data exists
      if (this.records.length > 0) {
        this.dateInitialized = false;
        this.autoSetDateBounds();
      }
      
      this.applyFiltersRender();
    }

    applyFiltersRender() {
      // Apply filters to records
      this.filtered = this.records.filter((r) => {
        if (this.filters.status && r.status !== this.filters.status) return false;
        if (this.filters.subsecretaria && r.subsecretaria !== this.filters.subsecretaria) return false;
        if (this.filters.search) {
          const blob = `${r.protocolo} ${r.assunto} ${r.analista}`.toLowerCase();
          if (!blob.includes(this.filters.search)) return false;
        }
        if (this.filters.start && r.abertura && r.abertura < this.filters.start) return false;
        if (this.filters.end && r.abertura && r.abertura > this.filters.end) return false;
        return true;
      });

      this.renderAll();
    }

    renderAll() {
      this.renderMetrics();
      this.renderStatusChart();
      this.renderSubsecretariaChart();
      this.renderAssuntosChart();
      this.renderGeoChart();
      this.renderAnalistasTable();
      this.renderTable();
    }

    renderMetrics() {
      const total = this.filtered.length;
      const concluidas = this.filtered.filter((r) => r.status === 'Concluída').length;
      const andamento = this.filtered.filter((r) => ['Em Atendimento', 'Aguardando Solicitante'].includes(r.status)).length;
      const naoIni = this.filtered.filter((r) => r.status === 'Não Iniciado').length;
      const taxa = total > 0 ? (concluidas / total) * 100 : 0;
      this.ui.total.textContent = total;
      this.ui.concluidas.textContent = concluidas;
      this.ui.andamento.textContent = andamento;
      this.ui.naoIniciadas.textContent = naoIni;
      this.ui.taxa.textContent = `${taxa.toFixed(1)}%`;
    }

    destroyChart(ref) {
      if (this.charts[ref]) {
        this.charts[ref].destroy();
        this.charts[ref] = null;
      }
    }

    renderStatusChart() {
      const el = document.getElementById('statusChart').getContext('2d');
      this.destroyChart('status');
      const dist = distribution(this.filtered, 'status');
      this.charts.status = new Chart(el, {
        type: 'pie',
        data: {
          labels: Object.keys(dist),
          datasets: [{
            data: Object.values(dist),
            backgroundColor: palette,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } }
          }
        }
      });
    }

    renderSubsecretariaChart() {
      const el = document.getElementById('subsecretariaChart').getContext('2d');
      this.destroyChart('subsecretaria');
      const dist = distribution(this.filtered, 'subsecretaria');
      this.charts.subsecretaria = new Chart(el, {
        type: 'bar',
        data: {
          labels: Object.keys(dist),
          datasets: [{
            label: 'Solicitações',
            data: Object.values(dist),
            backgroundColor: palette[0],
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    renderAssuntosChart() {
      const el = document.getElementById('assuntosChart').getContext('2d');
      this.destroyChart('assuntos');
      const dist = distribution(this.filtered, 'assunto');
      const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 5);
      this.charts.assuntos = new Chart(el, {
        type: 'bar',
        data: {
          labels: sorted.map((x) => x[0]),
          datasets: [{
            label: 'Quantidade',
            data: sorted.map((x) => x[1]),
            backgroundColor: palette.slice(0, Math.max(1, sorted.length)),
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    renderGeoChart() {
      const el = document.getElementById('geograficaChart').getContext('2d');
      this.destroyChart('geo');
      const key = this.activeGeo === 'bairro' ? 'bairro' : 'cidade';
      const dist = distribution(this.filtered, key);
      this.charts.geo = new Chart(el, {
        type: 'doughnut',
        data: {
          labels: Object.keys(dist),
          datasets: [{
            data: Object.values(dist),
            backgroundColor: palette,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
            title: { display: false }
          }
        }
      });
    }

    renderAnalistasTable() {
      this.ui.analistasTbody.innerHTML = '';
      const dist = distribution(this.filtered, 'analista');
      Object.entries(dist).forEach(([name, cnt]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${name}</td>
          <td>${cnt}</td>
          <td><span class="status-badge status-badge--andamento">Ativo</span></td>
        `;
        this.ui.analistasTbody.appendChild(tr);
      });
    }

    renderTable() {
      this.ui.solicitacoesTbody.innerHTML = '';
      let rows = [...this.filtered];
      const col = this.sortState.column;
      const dir = this.sortState.dir;
      if (col) {
        rows.sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          let res = 0;
          if (av instanceof Date || bv instanceof Date) {
            const at = av ? av.getTime() : 0;
            const bt = bv ? bv.getTime() : 0;
            res = at - bt;
          } else {
            res = String(av ?? '').localeCompare(String(bv ?? ''));
          }
          return dir === 'asc' ? res : -res;
        });
      }

      rows.forEach((r) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.protocolo}</td>
          <td>${r.assunto}</td>
          <td>${r.subsecretaria}</td>
          <td>${this.statusBadgeHTML(r.status)}</td>
          <td>${formatDateDisplay(r.abertura)}</td>
          <td>${formatDateDisplay(r.prazo)}</td>
          <td>${r.analista}</td>
          <td>${r.cidade}</td>
          <td>${r.bairro}</td>
        `;
        this.ui.solicitacoesTbody.appendChild(tr);
      });
    }

    statusBadgeHTML(status) {
      const map = {
        'Concluída': 'status-badge--concluida',
        'Em Atendimento': 'status-badge--andamento',
        'Aguardando Solicitante': 'status-badge--aguardando',
        'Não Iniciado': 'status-badge--nao-iniciado'
      };
      const cls = map[status] || 'status-badge--andamento';
      return `<span class="status-badge ${cls}">${status || '—'}</span>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const app = new Dashboard();
    app.init();
  });
})();