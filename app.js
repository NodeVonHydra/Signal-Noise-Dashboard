const STORAGE_KEY = 'signal-noise-dashboard-v1';

const state = {
  items: loadItems(),
};

const els = {
  itemForm: document.getElementById('itemForm'),
  title: document.getElementById('title'),
  source: document.getElementById('source'),
  topic: document.getElementById('topic'),
  date: document.getElementById('date'),
  summary: document.getElementById('summary'),
  importance: document.getElementById('importance'),
  noise: document.getElementById('noise'),
  importanceValue: document.getElementById('importanceValue'),
  noiseValue: document.getElementById('noiseValue'),
  stats: document.getElementById('stats'),
  itemsList: document.getElementById('itemsList'),
  trendTable: document.getElementById('trendTable'),
  briefing: document.getElementById('briefing'),
  searchInput: document.getElementById('searchInput'),
  topicFilter: document.getElementById('topicFilter'),
  sourceFilter: document.getElementById('sourceFilter'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  bulkInput: document.getElementById('bulkInput'),
  bulkImportBtn: document.getElementById('bulkImportBtn'),
  generateBriefingBtn: document.getElementById('generateBriefingBtn'),
  autofillScoreBtn: document.getElementById('autofillScoreBtn'),
};

init();

function init() {
  const today = new Date().toISOString().slice(0, 10);
  els.date.value = today;

  els.importance.addEventListener('input', () => els.importanceValue.textContent = els.importance.value);
  els.noise.addEventListener('input', () => els.noiseValue.textContent = els.noise.value);

  els.itemForm.addEventListener('submit', addItemFromForm);
  els.searchInput.addEventListener('input', render);
  els.topicFilter.addEventListener('input', render);
  els.sourceFilter.addEventListener('change', render);
  els.exportBtn.addEventListener('click', exportJson);
  els.importInput.addEventListener('change', importJson);
  els.bulkImportBtn.addEventListener('click', bulkImport);
  els.generateBriefingBtn.addEventListener('click', renderBriefing);
  els.autofillScoreBtn.addEventListener('click', autoScoreText);

  render();
  registerServiceWorker();
}

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || seedItems();
  } catch {
    return seedItems();
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function seedItems() {
  return [
    makeItem({title:'Cold exposure timing debate', source:'Signal', topic:'Recovery', summary:'People disagree whether late evening cold exposure hurts sleep or improves recovery.', importance:7, noise:4, date:daysAgo(2)}),
    makeItem({title:'NAD supplement hype', source:'Newsletter', topic:'Supplements', summary:'Several claims, some useful, much repetition, growing interest from optimization crowd.', importance:6, noise:6, date:daysAgo(5)}),
    makeItem({title:'Creators discuss ugly but effective hooks', source:'Twitter/X', topic:'Marketing', summary:'A useful thread on ad hooks, retention, and why simple UGC often beats polished editing.', importance:8, noise:3, date:daysAgo(7)}),
  ];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function makeItem({title, source, topic, summary, importance, noise, date}) {
  return {
    id: crypto.randomUUID(),
    title,
    source,
    topic,
    summary,
    importance: Number(importance),
    noise: Number(noise),
    signal: Math.max(1, Math.min(10, Number(importance) - Math.floor(Number(noise)/2) + 3)),
    date,
    createdAt: new Date().toISOString()
  };
}

function addItemFromForm(e) {
  e.preventDefault();
  const item = makeItem({
    title: els.title.value.trim(),
    source: els.source.value,
    topic: els.topic.value.trim(),
    summary: els.summary.value.trim(),
    importance: els.importance.value,
    noise: els.noise.value,
    date: els.date.value
  });
  state.items.unshift(item);
  saveItems();
  els.itemForm.reset();
  const today = new Date().toISOString().slice(0, 10);
  els.date.value = today;
  els.importance.value = 5;
  els.noise.value = 5;
  els.importanceValue.textContent = '5';
  els.noiseValue.textContent = '5';
  render();
}

function autoScoreText() {
  const text = `${els.title.value} ${els.summary.value}`.toLowerCase();
  if (!text.trim()) return;
  const usefulWords = ['study','data','evidence','results','framework','strategy','protocol','experiment','case study','retention','conversion'];
  const noisyWords = ['drama','hot take','crazy','insane','everyone','always','never','fight','beef','outrage'];

  let importance = 4;
  let noise = 4;

  usefulWords.forEach(w => { if (text.includes(w)) importance += 1; });
  noisyWords.forEach(w => { if (text.includes(w)) noise += 1; });

  if (text.length > 240) importance += 1;
  if (text.includes('?')) noise += 1;

  importance = clamp(importance, 1, 10);
  noise = clamp(noise, 1, 10);

  els.importance.value = importance;
  els.noise.value = noise;
  els.importanceValue.textContent = String(importance);
  els.noiseValue.textContent = String(noise);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.items, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'signal-noise-dashboard-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error('Invalid file');
      state.items = parsed.concat(state.items).filter(Boolean);
      saveItems();
      render();
      alert('Imported successfully.');
    } catch {
      alert('Could not import this JSON file.');
    }
  };
  reader.readAsText(file);
}

function bulkImport() {
  const lines = els.bulkInput.value.split('\n').map(x => x.trim()).filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  const imported = lines.map(line => {
    const [topic='General', source='Manual note', title='Untitled item', summary=''] = line.split('|').map(s => s.trim());
    const importance = clamp(4 + (summary.length > 80 ? 2 : 0), 1, 10);
    const noise = clamp(5 - (summary.toLowerCase().includes('data') ? 1 : 0), 1, 10);
    return makeItem({topic, source, title, summary, importance, noise, date: today});
  });
  state.items = imported.concat(state.items);
  saveItems();
  els.bulkInput.value = '';
  render();
}

function getFilteredItems() {
  const q = els.searchInput.value.trim().toLowerCase();
  const topic = els.topicFilter.value.trim().toLowerCase();
  const source = els.sourceFilter.value;

  return state.items.filter(item => {
    const matchesQ = !q || item.title.toLowerCase().includes(q) || item.summary.toLowerCase().includes(q);
    const matchesTopic = !topic || item.topic.toLowerCase().includes(topic);
    const matchesSource = !source || item.source === source;
    return matchesQ && matchesTopic && matchesSource;
  });
}

function render() {
  const items = getFilteredItems();
  renderStats(items);
  renderTrendTable(items);
  renderItems(items);
  renderBriefing(items);
}

function renderStats(items) {
  const total = items.length;
  const avgSignal = total ? (items.reduce((a,b) => a + b.signal, 0) / total).toFixed(1) : '0.0';
  const avgNoise = total ? (items.reduce((a,b) => a + b.noise, 0) / total).toFixed(1) : '0.0';
  const highSignal = items.filter(i => i.signal >= 7).length;
  const ratio = total ? Math.round((highSignal / total) * 100) : 0;

  els.stats.innerHTML = [
    statCard('Items tracked', total),
    statCard('Average signal', avgSignal),
    statCard('Average noise', avgNoise),
    statCard('High-signal ratio', ratio + '%'),
  ].join('');
}

function statCard(label, value) {
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function renderTrendTable(items) {
  const topicMap = new Map();
  items.forEach(item => {
    const key = item.topic || 'General';
    if (!topicMap.has(key)) topicMap.set(key, {count:0, signal:0, noise:0, latest:item.date});
    const row = topicMap.get(key);
    row.count += 1;
    row.signal += item.signal;
    row.noise += item.noise;
    if (item.date > row.latest) row.latest = item.date;
  });

  const rows = [...topicMap.entries()]
    .map(([topic, v]) => ({
      topic,
      mentions: v.count,
      avgSignal: (v.signal / v.count).toFixed(1),
      avgNoise: (v.noise / v.count).toFixed(1),
      latest: v.latest
    }))
    .sort((a,b) => b.mentions - a.mentions || b.avgSignal - a.avgSignal);

  if (!rows.length) {
    els.trendTable.innerHTML = '<p class="muted">No data yet.</p>';
    return;
  }

  els.trendTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Topic</th>
          <th>Mentions</th>
          <th>Avg signal</th>
          <th>Avg noise</th>
          <th>Latest mention</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escapeHtml(r.topic)}</td>
            <td>${r.mentions}</td>
            <td>${r.avgSignal}</td>
            <td>${r.avgNoise}</td>
            <td>${r.latest}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderItems(items) {
  if (!items.length) {
    els.itemsList.innerHTML = '<p class="muted">No items match these filters.</p>';
    return;
  }

  els.itemsList.innerHTML = items
    .sort((a,b) => b.date.localeCompare(a.date))
    .map(item => `
      <article class="item">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="meta">
          <span class="pill">${escapeHtml(item.source)}</span>
          <span class="pill">${escapeHtml(item.topic)}</span>
          <span class="pill">${item.date}</span>
          <span class="pill score">Signal ${item.signal}/10</span>
          <span class="pill">Noise ${item.noise}/10</span>
        </div>
        <div>${escapeHtml(item.summary)}</div>
        <button class="delete-btn" onclick="deleteItem('${item.id}')">Delete</button>
      </article>
    `).join('');
}

function renderBriefing(inputItems) {
  const items = inputItems || getFilteredItems();
  if (!items.length) {
    els.briefing.textContent = 'No items available yet.';
    return;
  }

  const sortedBySignal = [...items].sort((a,b) => b.signal - a.signal).slice(0, 5);
  const noisy = [...items].sort((a,b) => b.noise - a.noise).slice(0, 3);

  const topicCounts = {};
  items.forEach(i => topicCounts[i.topic] = (topicCounts[i.topic] || 0) + 1);
  const topTopics = Object.entries(topicCounts).sort((a,b) => b[1]-a[1]).slice(0, 5);

  const avgSignal = (items.reduce((a,b) => a+b.signal,0)/items.length).toFixed(1);
  const avgNoise = (items.reduce((a,b) => a+b.noise,0)/items.length).toFixed(1);

  const lines = [];
  lines.push('WEEKLY INTELLIGENCE BRIEFING');
  lines.push('');
  lines.push(`Items analyzed: ${items.length}`);
  lines.push(`Average signal: ${avgSignal}/10`);
  lines.push(`Average noise: ${avgNoise}/10`);
  lines.push('');
  lines.push('Top topics:');
  topTopics.forEach(([topic, count]) => lines.push(`• ${topic}: ${count} mention(s)`));
  lines.push('');
  lines.push('Highest-signal items:');
  sortedBySignal.forEach(item => lines.push(`• [${item.topic}] ${item.title} — signal ${item.signal}/10`));
  lines.push('');
  lines.push('Noisiest items:');
  noisy.forEach(item => lines.push(`• [${item.topic}] ${item.title} — noise ${item.noise}/10`));
  lines.push('');
  lines.push('Suggested takeaway:');
  if (Number(avgSignal) >= 7) {
    lines.push('• The current information stream looks unusually valuable. Preserve the top items and consider turning them into an action plan.');
  } else if (Number(avgNoise) >= 6) {
    lines.push('• Noise is high. Reduce low-value sources and keep only recurring themes backed by evidence or practical results.');
  } else {
    lines.push('• The stream is mixed. Keep tracking topics over time so you can spot patterns instead of reacting to individual messages.');
  }

  els.briefing.textContent = lines.join('\n');
}

function deleteItem(id) {
  state.items = state.items.filter(item => item.id !== id);
  saveItems();
  render();
}
window.deleteItem = deleteItem;

function escapeHtml(str='') {
  return str
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
