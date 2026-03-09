import { providers } from './data/providers.js';
import { stageConfig } from './data/stage.js';
import { Simulation } from './game/simulation.js';

const sim = new Simulation();
let selectedId = 'e1';
let loopId = null;
let popupTimerId = null;

const app = document.getElementById('app');

const root = document.createElement('div');
root.className = 'app-shell';
app.appendChild(root);

const topbar = document.createElement('header');
topbar.className = 'topbar';
root.appendChild(topbar);

const content = document.createElement('div');
content.className = 'content';
root.appendChild(content);

const leftMenu = document.createElement('aside');
leftMenu.className = 'left-menu card';
content.appendChild(leftMenu);

const playfield = document.createElement('main');
playfield.className = 'playfield card';
content.appendChild(playfield);

const rightPanel = document.createElement('aside');
rightPanel.className = 'right-panel';
content.appendChild(rightPanel);

const report = document.createElement('section');
report.className = 'report card';
root.appendChild(report);

const popup = document.createElement('div');
popup.className = 'popup hidden';
root.appendChild(popup);

const floatingLayer = document.createElement('div');
floatingLayer.className = 'floating-layer';
playfield.appendChild(floatingLayer);

const titleRow = document.createElement('div');
titleRow.className = 'title-row';
playfield.appendChild(titleRow);

const titleWrap = document.createElement('div');
const title = document.createElement('h1');
title.textContent = 'Elevator Safety Operations Simulator';
const subtitle = document.createElement('p');
subtitle.textContent = `${stageConfig.name} · 안전관리 체험형 운영 시뮬레이션`;
titleWrap.append(title, subtitle);
titleRow.appendChild(titleWrap);

const mission = document.createElement('div');
mission.className = 'mission';
titleRow.appendChild(mission);

const building = document.createElement('div');
building.className = 'building';
playfield.appendChild(building);

const detailCard = document.createElement('section');
detailCard.className = 'card';
const providerCard = document.createElement('section');
providerCard.className = 'card';
const feedCard = document.createElement('section');
feedCard.className = 'card log';
rightPanel.append(detailCard, providerCard, feedCard);

const kpiFields = {};
['자금', '안전도', '만족도', '고장률', '점검률', '시간'].forEach((label) => {
  const kpi = document.createElement('div');
  kpi.className = 'kpi';
  const span = document.createElement('span');
  span.textContent = label;
  const strong = document.createElement('b');
  strong.textContent = '-';
  kpi.append(span, strong);
  topbar.appendChild(kpi);
  kpiFields[label] = strong;
});

leftMenu.innerHTML = '<h3>실행 메뉴</h3>';
const actionGroups = [
  { title: '운영 조치', items: [['🧹 청소', 'clean'], ['📦 정리', 'organize'], ['🔎 자체점검', 'selfCheck']] },
  { title: '정비 전략', items: [['🛠️ 임시수리', 'temporaryRepair'], ['🔧 예방교체', 'preventiveReplace'], ['✅ 검사 전 점검', 'preInspection']] },
  { title: '이용자 관리', items: [['📞 민원 대응', 'respondComplaint'], ['📢 안전 캠페인', 'safetyCampaign']] }
];

actionGroups.forEach((group) => {
  const wrap = document.createElement('div');
  wrap.className = 'menu-group';
  const heading = document.createElement('h4');
  heading.textContent = group.title;
  wrap.appendChild(heading);

  group.items.forEach(([label, key]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      const result = sim.applyAction(key, selectedId);
      if (result?.ok) {
        showFloatingText(`-${result.cost}`, 'neg');
        showFloatingText(result.effectText, 'pos');
      }
      render();
    });
    wrap.appendChild(btn);
  });

  leftMenu.appendChild(wrap);
});

providerCard.innerHTML = '<h3>유지보수 업체</h3>';
providers.forEach((p) => {
  const btn = document.createElement('button');
  btn.className = 'provider-btn';
  btn.textContent = `${p.name} · 출동비 ₩${p.callCost}`;
  btn.addEventListener('click', () => {
    sim.setProvider(p.id);
    render();
  });
  providerCard.appendChild(btn);
});

const detailTitle = document.createElement('h3');
detailCard.appendChild(detailTitle);

const metaGrid = document.createElement('div');
metaGrid.className = 'grid2';
detailCard.appendChild(metaGrid);
const metaFields = {};
['연식', '혼잡도', '고장위험', '최근 점검'].forEach((k) => {
  const row = document.createElement('div');
  row.className = 'meta-row';
  const label = document.createElement('span');
  label.textContent = k;
  const value = document.createElement('b');
  value.textContent = '-';
  row.append(label, value);
  metaGrid.appendChild(row);
  metaFields[k] = value;
});

const gaugeWrap = document.createElement('div');
gaugeWrap.className = 'gauges';
detailCard.appendChild(gaugeWrap);

const gauges = {};
[
  ['청결', 'cleanliness'],
  ['도어', 'door'],
  ['제어', 'control'],
  ['제동', 'brake'],
  ['혼잡도', 'congestion'],
  ['고장위험(안정도)', 'stability']
].forEach(([label, key]) => {
  const item = document.createElement('div');
  item.className = 'gauge-item';
  const head = document.createElement('div');
  head.className = 'gauge-head';
  const titleEl = document.createElement('span');
  titleEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.textContent = '0';
  head.append(titleEl, valueEl);

  const track = document.createElement('div');
  track.className = 'gauge-track';
  const bar = document.createElement('div');
  bar.className = 'gauge-bar';
  track.appendChild(bar);

  item.append(head, track);
  gaugeWrap.appendChild(item);
  gauges[key] = { bar, valueEl };
});

const signsEl = document.createElement('div');
signsEl.className = 'signs';
detailCard.appendChild(signsEl);
const warnEl = document.createElement('div');
warnEl.className = 'warn';
detailCard.appendChild(warnEl);
const tipEl = document.createElement('div');
tipEl.className = 'tip';
tipEl.textContent = '작은 민원을 방치하면 고장률과 검사 감점이 함께 상승합니다.';
detailCard.appendChild(tipEl);

const feedTitle = document.createElement('h3');
feedTitle.textContent = '이벤트 / 민원 로그';
feedCard.appendChild(feedTitle);
const activeProfileEl = document.createElement('div');
activeProfileEl.className = 'mini';
feedCard.appendChild(activeProfileEl);

const feedList = document.createElement('div');
feedList.className = 'feed-list';
feedCard.appendChild(feedList);
const feedRows = Array.from({ length: 10 }).map(() => {
  const row = document.createElement('div');
  row.className = 'feed-row';
  feedList.appendChild(row);
  return row;
});

report.innerHTML = '<h3>라운드 리포트 & 업적</h3>';
const chips = document.createElement('div');
chips.className = 'chips';
const reportLine1 = document.createElement('div');
reportLine1.className = 'mini';
const reportLine2 = document.createElement('div');
reportLine2.className = 'mini';
const reportResult = document.createElement('div');
reportResult.className = 'result';
report.append(chips, reportLine1, reportLine2, reportResult);

const elevatorEls = new Map();
sim.elevators.forEach((e) => {
  const shaft = document.createElement('div');
  shaft.className = 'shaft';
  const floorLines = document.createElement('div');
  floorLines.className = 'floor-lines';
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = e.name;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = '💬';
  const cleaner = document.createElement('div');
  cleaner.className = 'cleaner';
  const queue = document.createElement('div');
  queue.className = 'queue';
  const car = document.createElement('div');
  car.className = 'car';

  shaft.append(floorLines, label, bubble, cleaner, queue, car);
  shaft.addEventListener('click', () => {
    selectedId = e.id;
    render();
  });

  building.appendChild(shaft);
  elevatorEls.set(e.id, { shaft, bubble, queue, car });
});

function gaugeClassByValue(v) {
  if (v >= 70) return 'good';
  if (v >= 40) return 'warn';
  return 'bad';
}

function updateGauge(gauge, value) {
  const v = clamp01(value);
  gauge.bar.style.width = `${v}%`;
  gauge.valueEl.textContent = `${Math.round(v)}%`;
  gauge.bar.classList.remove('good', 'warn', 'bad');
  gauge.bar.classList.add(gaugeClassByValue(v));
}

function clamp01(v) {
  return Math.max(0, Math.min(100, v));
}

function showFloatingText(text, type = 'pos') {
  const el = document.createElement('div');
  el.className = `floating-text ${type}`;
  el.textContent = text;
  el.style.left = `${50 + Math.random() * 30}%`;
  floatingLayer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => el.remove(), 900);
}

function render() {
  const s = sim.state;
  const e = sim.elevators.find((x) => x.id === selectedId) ?? sim.elevators[0];

  kpiFields['자금'].textContent = `₩${Math.round(s.budget)}`;
  kpiFields['안전도'].textContent = `${s.safetyIndex.toFixed(0)}`;
  kpiFields['만족도'].textContent = `${s.satisfactionIndex.toFixed(0)}`;
  kpiFields['고장률'].textContent = `${s.failureRate.toFixed(0)}`;
  kpiFields['점검률'].textContent = `${s.inspectionRate.toFixed(0)}`;
  kpiFields['시간'].textContent = `Day ${s.day} · ${String(s.hour).padStart(2, '0')}:00 (${s.season})`;

  mission.textContent = `현재 목표: ${s.mission} / 검사 D-${s.daysToInspection}`;

  detailTitle.textContent = `${e.name} 상세 상태`;
  metaFields['연식'].textContent = `${e.ageYears}년`;
  metaFields['혼잡도'].textContent = `${Math.round(e.congestion)}%`;
  metaFields['고장위험'].textContent = `${e.failureRisk.toFixed(1)}`;
  metaFields['최근 점검'].textContent = e.lastInspectionDay ? `${e.lastInspectionDay}일차` : '미실시';

  updateGauge(gauges.cleanliness, e.cleanliness);
  updateGauge(gauges.door, e.door);
  updateGauge(gauges.control, e.control);
  updateGauge(gauges.brake, e.brake);
  updateGauge(gauges.congestion, e.congestion);
  updateGauge(gauges.stability, 100 - e.failureRisk);

  signsEl.textContent = `징후: ${e.signs.join(' · ') || '안정'}`;
  warnEl.textContent = `경고: ${e.warning.join(', ') || '정상'}`;

  activeProfileEl.textContent = `활성 이용자군: ${s.activeProfile.name}`;
  feedRows.forEach((row, i) => {
    row.textContent = s.feed[i] ?? '';
  });

  chips.replaceChildren();
  const achievements = s.achievements.length ? s.achievements : ['업적 달성 대기'];
  achievements.forEach((a) => {
    const chip = document.createElement('span');
    chip.textContent = a;
    chips.appendChild(chip);
  });

  if (s.roundReports[0]) {
    const r = s.roundReports[0];
    reportLine1.textContent = `최근 검사 리포트: Day ${r.day} / ${r.grade} (${r.score})`;
    reportLine2.textContent = `놓친 안전 포인트: ${r.missed.join(', ') || '없음'}`;
  } else {
    reportLine1.textContent = '최근 검사 리포트: 아직 없음';
    reportLine2.textContent = '놓친 안전 포인트: 없음';
  }
  reportResult.textContent = s.resultText || '안전·편의·효율의 균형을 유지하세요.';

  sim.elevators.forEach((elv) => {
    const ui = elevatorEls.get(elv.id);
    const carColor = elv.failureRisk < 35 ? '#57cc99' : elv.failureRisk < 60 ? '#f4b942' : '#ef476f';
    ui.car.style.background = carColor;
    ui.car.style.bottom = `${20 + elv.floorPosition * 230}px`;
    ui.queue.style.height = `${Math.max(8, elv.congestion)}px`;
    ui.bubble.style.opacity = elv.complaints > 0 ? '1' : '0.25';
    ui.shaft.classList.toggle('selected', selectedId === elv.id);
  });

  if (s.eventPopup) {
    popup.textContent = s.eventPopup;
    popup.classList.remove('hidden');
    if (popupTimerId) clearTimeout(popupTimerId);
    popupTimerId = setTimeout(() => {
      sim.clearPopup();
      popup.classList.add('hidden');
    }, 1500);
  }
}

function gameLoop() {
  sim.tickHour();

  if (sim.state.gameOver) {
    if (loopId) {
      clearInterval(loopId);
      loopId = null;
    }
    render();
    return;
  }

  render();
}

render();
loopId = setInterval(gameLoop, 900);
