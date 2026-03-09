import { providers } from './data/providers.js';
import { stageConfig } from './data/stage.js';
import { Simulation } from './game/simulation.js';

const sim = new Simulation();
let selectedId = 'e1';

const app = document.getElementById('app');
app.innerHTML = `
  <div class="app-shell">
    <header class="topbar" id="topbar"></header>
    <div class="content">
      <aside class="left-menu card" id="leftMenu"></aside>
      <main class="playfield card">
        <div class="title-row">
          <div>
            <h1>Elevator Safety Operations Simulator</h1>
            <p>${stageConfig.name} · 안전관리 체험형 운영 시뮬레이션</p>
          </div>
          <div class="mission" id="mission"></div>
        </div>
        <div class="building" id="building"></div>
      </main>
      <aside class="right-panel">
        <section class="card" id="detail"></section>
        <section class="card" id="providers"></section>
        <section class="card log" id="feed"></section>
      </aside>
    </div>
    <section class="report card" id="report"></section>
    <div class="popup hidden" id="popup"></div>
  </div>
`;

const topbar = document.getElementById('topbar');
const building = document.getElementById('building');
const detail = document.getElementById('detail');
const feed = document.getElementById('feed');
const providerPanel = document.getElementById('providers');
const leftMenu = document.getElementById('leftMenu');
const report = document.getElementById('report');
const popup = document.getElementById('popup');
const mission = document.getElementById('mission');

const elevatorEls = new Map();
sim.elevators.forEach((e) => {
  const shaft = document.createElement('div');
  shaft.className = 'shaft';
  shaft.innerHTML = `
    <div class="floor-lines"></div>
    <div class="label">${e.name}</div>
    <div class="bubble">💬</div>
    <div class="cleaner"></div>
    <div class="queue"></div>
    <div class="car"></div>
  `;
  shaft.onclick = () => { selectedId = e.id; render(); };
  building.appendChild(shaft);
  elevatorEls.set(e.id, shaft);
});

const actionGroups = [
  { title: '운영 조치', items: [['🧹 청소', 'clean'], ['📦 정리', 'organize'], ['🔎 자체점검', 'selfCheck']] },
  { title: '정비 전략', items: [['🛠️ 임시수리', 'temporaryRepair'], ['🔧 예방교체', 'preventiveReplace'], ['✅ 검사 전 점검', 'preInspection']] },
  { title: '이용자 관리', items: [['📞 민원 대응', 'respondComplaint'], ['📢 안전 캠페인', 'safetyCampaign']] },
  { title: '시설 확장', items: [['🧱 승강기 증설(설계)', 'expandElevator'], ['↗️ 에스컬레이터 도입', 'enableEscalator']] }
];

leftMenu.innerHTML = '<h3>실행 메뉴</h3>';
actionGroups.forEach((group) => {
  const wrap = document.createElement('div');
  wrap.className = 'menu-group';
  wrap.innerHTML = `<h4>${group.title}</h4>`;
  group.items.forEach(([label, key]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => {
      if (key === 'expandElevator' || key === 'enableEscalator') sim.applyGlobalAction(key);
      else sim.applyAction(key, selectedId);
      render();
    };
    wrap.appendChild(b);
  });
  leftMenu.appendChild(wrap);
});

providerPanel.innerHTML = '<h3>유지보수 업체</h3>';
providers.forEach((p) => {
  const b = document.createElement('button');
  b.className = 'provider-btn';
  b.textContent = `${p.name} · 출동비 ₩${p.callCost}`;
  b.onclick = () => { sim.setProvider(p.id); render(); };
  providerPanel.appendChild(b);
});

function renderTopbar() {
  const s = sim.state;
  topbar.innerHTML = `
    <div class="kpi"><span>💰 자금</span><b>₩${Math.round(s.budget)}</b></div>
    <div class="kpi"><span>🛡️ 안전도</span><b>${s.safetyIndex.toFixed(0)}</b></div>
    <div class="kpi"><span>🙂 만족도</span><b>${s.satisfactionIndex.toFixed(0)}</b></div>
    <div class="kpi"><span>⚠️ 고장률</span><b>${s.failureRate.toFixed(0)}</b></div>
    <div class="kpi"><span>🧪 점검률</span><b>${s.inspectionRate.toFixed(0)}</b></div>
    <div class="kpi"><span>📅</span><b>Day ${s.day} (${s.season})</b></div>
  `;
}

function render() {
  const s = sim.state;
  const e = sim.elevators.find((x) => x.id === selectedId);
  mission.textContent = `현재 목표: ${s.mission} / 검사 D-${s.daysToInspection}`;

  detail.innerHTML = `
    <h3>${e.name} 상세 상태</h3>
    <div class="grid2">
      <div>연식 <b>${e.ageYears}년</b></div><div>혼잡도 <b>${e.congestion.toFixed(0)}</b></div>
      <div>고장위험 <b>${e.failureRisk.toFixed(1)}</b></div><div>최근 점검 <b>${e.lastInspectionDay || '미실시'}일차</b></div>
    </div>
    <div class="stat-row">도어 ${e.door.toFixed(0)} · 제어 ${e.control.toFixed(0)} · 제동 ${e.brake.toFixed(0)}</div>
    <div class="stat-row">비상통화 ${e.emergencyCall.toFixed(0)} · 과부하감지 ${e.overloadSensor.toFixed(0)} · 인터록 ${e.interlock.toFixed(0)}</div>
    <div class="stat-row">청결 ${e.cleanliness.toFixed(0)} · 정리 ${e.clutter.toFixed(0)} · 노후 ${e.wear.toFixed(0)}</div>
    <div class="signs">징후: ${e.signs.join(' · ') || '안정'}</div>
    <div class="warn">경고: ${e.warning.join(', ') || '정상'}</div>
    <div class="tip">작은 민원을 방치하면 고장률과 검사 감점이 함께 상승합니다.</div>
  `;

  feed.innerHTML = `<h3>이벤트 / 민원 로그</h3><div class='mini'>활성 이용자군: ${s.activeProfile.name}</div>${s.feed.map((f) => `<div>${f}</div>`).join('')}`;

  report.innerHTML = `
    <h3>라운드 리포트 & 업적</h3>
    <div class="chips">${s.achievements.length ? s.achievements.map((a) => `<span>${a}</span>`).join('') : '<span>업적 달성 대기</span>'}</div>
    <div class="mini">최근 검사 리포트: ${s.roundReports[0] ? `Day ${s.roundReports[0].day} / ${s.roundReports[0].grade} (${s.roundReports[0].score})` : '아직 없음'}</div>
    <div class="mini">놓친 안전 포인트: ${s.roundReports[0]?.missed?.join(', ') || '없음'}</div>
    <div class="result">${s.resultText || '안전·편의·효율의 균형을 유지하세요.'}</div>
  `;

  sim.elevators.forEach((elv) => {
    const shaft = elevatorEls.get(elv.id);
    const car = shaft.querySelector('.car');
    const queue = shaft.querySelector('.queue');
    const color = elv.failureRisk < 35 ? '#8be9a8' : elv.failureRisk < 60 ? '#ffdd94' : '#ff8fab';
    car.style.background = color;
    car.style.bottom = `${18 + elv.floorPosition * 220}px`;
    queue.style.height = `${Math.max(8, elv.congestion)}px`;
    shaft.classList.toggle('selected', selectedId === elv.id);
    shaft.querySelector('.bubble').style.opacity = elv.complaints > 0 ? 1 : 0.3;
  });

  if (s.eventPopup) {
    popup.classList.remove('hidden');
    popup.textContent = s.eventPopup;
    setTimeout(() => {
      sim.clearPopup();
      popup.classList.add('hidden');
    }, 1600);
  }

  renderTopbar();
}

setInterval(() => { sim.tickDay(); render(); }, 1200);
render();
