import { providers } from '../data/providers.js';
import { seasonalEvents } from '../data/seasonalEvents.js';
import { stageConfig } from '../data/stage.js';

const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const seasonByDay = (day) => ['spring', 'summer', 'autumn', 'winter'][Math.floor(((day - 1) / 10) % 4)];

const passengerProfiles = [
  { key: 'office', name: '직장인', congestion: 1.2, safetyNeed: 1.0 },
  { key: 'senior', name: '노약자', congestion: 0.8, safetyNeed: 1.4 },
  { key: 'child', name: '어린이 동반', congestion: 0.9, safetyNeed: 1.5 },
  { key: 'logistics', name: '물류 이동', congestion: 1.3, safetyNeed: 1.2 }
];

export class Simulation {
  constructor() {
    this.elevators = stageConfig.elevators.map((name, i) => ({
      id: `e${i + 1}`,
      name,
      ageYears: 5 + i,
      floorPosition: i * 0.5,
      direction: 1,
      congestion: 35,
      cleanliness: 82,
      clutter: 78,
      door: 80,
      control: 82,
      emergencyCall: 90,
      overloadSensor: 86,
      brake: 84,
      interlock: 85,
      wear: 18,
      failureRisk: 12,
      satisfaction: 80,
      inspectionReadiness: 78,
      complaints: 0,
      warning: [],
      temporaryFixDebt: 0,
      preventiveBonus: 0,
      lastInspectionDay: 0,
      signs: []
    }));

    this.state = {
      day: 1,
      hour: 8,
      budget: stageConfig.startBudget,
      reputation: 60,
      season: 'spring',
      daysToInspection: stageConfig.inspectionCycle,
      activeProviderId: providers[0].id,
      globalComplaints: 0,
      safetyIndex: 76,
      satisfactionIndex: 78,
      failureRate: 12,
      inspectionRate: 74,
      activeProfile: passengerProfiles[0],
      feed: ['운영 개시: 안전·편의·효율 균형이 핵심입니다.'],
      eventPopup: null,
      roundReports: [],
      achievements: [],
      mission: '민원 12건 이하 + 안전지수 75 이상으로 30일 운영',
      lastAction: null,
      gameOver: false,
      resultText: ''
    };
  }

  get activeProvider() {
    return providers.find((p) => p.id === this.state.activeProviderId) ?? providers[0];
  }

  setProvider(id) {
    const found = providers.find((p) => p.id === id);
    if (!found || this.state.gameOver) return;
    this.state.activeProviderId = id;
    this.pushFeed(`유지보수 업체 변경: ${found.name} (${found.flavor})`);
  }

  applyAction(action, elevatorId) {
    if (this.state.gameOver) return { ok: false };
    const e = this.elevators.find((x) => x.id === elevatorId);
    if (!e) return { ok: false };

    const provider = this.activeProvider;
    const spend = (cost) => {
      if (this.state.budget < cost) {
        this.pushFeed('예산 부족! 우선순위를 다시 정하세요.');
        return false;
      }
      this.state.budget -= cost;
      return true;
    };

    let cost = 0;
    let effectText = '';

    if (action === 'clean') {
      cost = 55;
      if (!spend(cost)) return { ok: false };
      e.cleanliness = clamp(e.cleanliness + 25);
      e.failureRisk = clamp(e.failureRisk - 8);
      effectText = '+청결 +예방효과';
      this.pushFeed(`${e.name}: 청소 완료. 센서 오작동 확률 하락.`);
    } else if (action === 'organize') {
      cost = 65;
      if (!spend(cost)) return { ok: false };
      e.clutter = clamp(e.clutter + 24);
      e.interlock = clamp(e.interlock + 6);
      effectText = '+정리 +인터록';
      this.pushFeed(`${e.name}: 적재물 정리 완료. 인터록 안정성 개선.`);
    } else if (action === 'selfCheck') {
      cost = 95;
      if (!spend(cost)) return { ok: false };
      e.door = clamp(e.door + 8);
      e.control = clamp(e.control + 8);
      e.emergencyCall = clamp(e.emergencyCall + 6);
      e.overloadSensor = clamp(e.overloadSensor + 6);
      e.lastInspectionDay = this.state.day;
      e.failureRisk = clamp(e.failureRisk - 10);
      effectText = '+조기징후 해소';
      this.pushFeed(`${e.name}: 자체 점검으로 이상 징후 조치.`);
    } else if (action === 'preventiveReplace') {
      cost = 240 + provider.callCost;
      if (!spend(cost)) return { ok: false };
      e.wear = clamp(e.wear - 18);
      e.brake = clamp(e.brake + 16 * provider.preventiveEfficiency);
      e.interlock = clamp(e.interlock + 16 * provider.preventiveEfficiency);
      e.overloadSensor = clamp(e.overloadSensor + 14 * provider.preventiveEfficiency);
      e.failureRisk = clamp(e.failureRisk - 20 * provider.quality);
      e.preventiveBonus += 15;
      effectText = '+장기안정성';
      this.pushFeed(`${e.name}: 예방교체 완료. 장기 재발 위험 감소.`);
    } else if (action === 'temporaryRepair') {
      cost = 130 + provider.callCost;
      if (!spend(cost)) return { ok: false };
      e.door = clamp(e.door + 10 * provider.speed);
      e.control = clamp(e.control + 8 * provider.speed);
      e.failureRisk = clamp(e.failureRisk - 8 * provider.emergencyPower);
      e.temporaryFixDebt += 12;
      effectText = '+즉시복구 -장기안정';
      this.pushFeed(`${e.name}: 임시수리 완료(재발 부채 누적).`);
    } else if (action === 'respondComplaint') {
      cost = 70;
      if (!spend(cost)) return { ok: false };
      const reduced = Math.min(2, e.complaints);
      e.complaints -= reduced;
      this.state.globalComplaints = Math.max(0, this.state.globalComplaints - reduced);
      e.satisfaction = clamp(e.satisfaction + 8);
      effectText = `-민원 ${reduced}건`;
      this.pushFeed(`${e.name}: 민원 ${reduced}건 대응.`);
    } else if (action === 'safetyCampaign') {
      cost = 105;
      if (!spend(cost)) return { ok: false };
      e.satisfaction = clamp(e.satisfaction + 7);
      e.emergencyCall = clamp(e.emergencyCall + 5);
      this.state.reputation = clamp(this.state.reputation + 3);
      effectText = '+안전인지';
      this.pushFeed('안전 캠페인 시행: 비상행동 인지도 증가.');
    } else if (action === 'preInspection') {
      cost = 165;
      if (!spend(cost)) return { ok: false };
      e.inspectionReadiness = clamp(e.inspectionReadiness + 14);
      effectText = '+검사준비';
      this.pushFeed(`${e.name}: 검사 전 사전점검 완료.`);
    } else {
      return { ok: false };
    }

    this.refreshKpis();
    this.state.lastAction = { elevatorId, cost, effectText };
    return { ok: true, elevatorId, cost, effectText };
  }

  tickHour() {
    if (this.state.gameOver) return;

    this.state.hour += 1;
    const isNewDay = this.state.hour >= 24;
    if (isNewDay) {
      this.state.hour = 0;
      this.state.day += 1;
      this.onDayPassed();
    }

    const isPeak = [8, 9, 18, 19].includes(this.state.hour);
    for (const e of this.elevators) {
      const passengerFactor = this.state.activeProfile.congestion;
      const safetyNeed = this.state.activeProfile.safetyNeed;

      e.congestion = clamp(e.congestion + (isPeak ? 2.1 : -1.4) + passengerFactor * 0.8, 10, 100);
      const dustPenalty = (100 - e.cleanliness) / 110;
      const clutterPenalty = (100 - e.clutter) / 130;
      const complaintPenalty = e.complaints * 0.15;
      const chain = dustPenalty + clutterPenalty + complaintPenalty + e.congestion / 300;

      e.cleanliness = clamp(e.cleanliness - (0.10 + (this.state.season === 'spring' ? 0.05 : 0)));
      e.clutter = clamp(e.clutter - (0.07 + (this.state.season === 'autumn' ? 0.05 : 0)));
      e.door = clamp(e.door - (0.09 + chain + (this.state.season === 'winter' ? 0.08 : 0)));
      e.control = clamp(e.control - (0.09 + chain + (this.state.season === 'summer' ? 0.08 : 0)));
      e.emergencyCall = clamp(e.emergencyCall - 0.05 * safetyNeed);
      e.overloadSensor = clamp(e.overloadSensor - (0.08 + dustPenalty + e.congestion / 420));
      e.brake = clamp(e.brake - (0.07 + e.wear / 1800));
      e.interlock = clamp(e.interlock - (0.07 + clutterPenalty));
      e.wear = clamp(e.wear + 0.12 + complaintPenalty + e.congestion / 550);
      e.temporaryFixDebt = Math.max(0, e.temporaryFixDebt - 0.08);
      e.preventiveBonus = Math.max(0, e.preventiveBonus - 0.04);

      if (Math.random() < 0.09 + (this.state.season === 'autumn' ? 0.03 : 0) + (isPeak ? 0.03 : 0)) {
        const reason = this.rollComplaintReason(e);
        e.complaints += 1;
        this.state.globalComplaints += 1;
        e.satisfaction = clamp(e.satisfaction - 2.5);
        this.pushFeed(`${e.name} 민원: ${reason}`);
      }

      this.maybeSpecialEvent(e);

      e.failureRisk = clamp(
        8 +
          (100 - e.door) * 0.16 +
          (100 - e.control) * 0.14 +
          (100 - e.overloadSensor) * 0.14 +
          (100 - e.brake) * 0.18 +
          (100 - e.interlock) * 0.18 +
          (100 - e.cleanliness) * 0.08 +
          e.complaints * 1.8 +
          e.wear * 0.13 +
          e.temporaryFixDebt -
          e.preventiveBonus
      );

      const coreAvg =
        (e.cleanliness + e.clutter + e.door + e.control + e.emergencyCall + e.overloadSensor + e.brake + e.interlock) / 8;
      e.inspectionReadiness = clamp(coreAvg - e.complaints * 1.7 - e.temporaryFixDebt * 0.4 + e.preventiveBonus * 0.6);
      e.satisfaction = clamp(e.satisfaction - Math.max(0, e.failureRisk - 40) / 90);
      e.signs = this.buildSigns(e);

      e.warning = [];
      if (e.cleanliness < 45 || e.clutter < 45) e.warning.push('환경 취약');
      if (e.complaints >= 4) e.warning.push('민원 누적');
      if (e.failureRisk > 55) e.warning.push('점검 필요');
      if (e.failureRisk > 72) e.warning.push('위험 상승');

      e.floorPosition += e.direction * 0.04;
      if (e.floorPosition >= 1) {
        e.floorPosition = 1;
        e.direction = -1;
      }
      if (e.floorPosition <= 0) {
        e.floorPosition = 0;
        e.direction = 1;
      }
    }

    this.refreshKpis();
    this.unlockAchievements();
  }

  onDayPassed() {
    this.state.budget += stageConfig.dailyIncome;
    this.state.daysToInspection -= 1;
    this.state.season = seasonByDay(this.state.day);
    this.state.activeProfile = passengerProfiles[Math.floor(Math.random() * passengerProfiles.length)];

    if (this.state.day % 10 === 1) {
      const event = seasonalEvents[this.state.season][0];
      this.pushFeed(`계절 이벤트: ${event.title} (${event.effect})`);
      this.state.eventPopup = `🌦️ ${event.title}`;
    }

    if (this.state.day === 2) this.pushFeed('[힌트] 먼지·적재물은 센서/인터록 안정성에 영향.');
    if (this.state.day === 5) this.pushFeed('[힌트] 민원 방치는 리스크 가중치로 누적.');
    if (this.state.day === 9) this.pushFeed('[힌트] 임시수리는 빠르지만 부채가 남음.');
    if (this.state.day === 14) this.pushFeed('[힌트] 검사 직전 땜빵보다 평소 관리가 유리.');

    if (this.state.daysToInspection <= 0) this.performInspection();
  }

  maybeSpecialEvent(e) {
    const pool = [];
    if (e.door < 52) pool.push('문 끼임 위험 증가');
    if (e.overloadSensor < 50) pool.push('과부하 감지 둔화');
    if (e.control < 50) pool.push('층 정지 오차 징후');
    if (e.emergencyCall < 50) pool.push('비상통화 응답 저하');
    if (e.brake < 52) pool.push('제동 성능 저하');
    if (e.interlock < 52) pool.push('인터록 점검 필요');

    if (pool.length && Math.random() < 0.04) {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      this.state.eventPopup = `⚠️ ${e.name} ${picked}`;
      this.pushFeed(`${e.name} 징후 이벤트: ${picked}`);
    }
  }

  buildSigns(e) {
    const signs = [];
    if (e.cleanliness < 55) signs.push('먼지↑');
    if (e.door < 55) signs.push('문동작 불안정');
    if (e.control < 55) signs.push('정지 오차 징후');
    if (e.overloadSensor < 58) signs.push('과부하 민감도↓');
    if (e.emergencyCall < 60) signs.push('비상통화 점검');
    return signs;
  }

  refreshKpis() {
    const avg = (key) => this.elevators.reduce((sum, e) => sum + e[key], 0) / this.elevators.length;
    const risk = avg('failureRisk');
    this.state.safetyIndex = clamp(100 - risk * 0.9);
    this.state.satisfactionIndex = clamp(avg('satisfaction') - this.state.globalComplaints * 0.2);
    this.state.failureRate = clamp(risk);
    this.state.inspectionRate = clamp(avg('inspectionReadiness'));
  }

  unlockAchievements() {
    const add = (name) => {
      if (!this.state.achievements.includes(name)) this.state.achievements.push(name);
    };
    if (this.state.globalComplaints <= 3 && this.state.day >= 10) add('민원 제로 매니저');
    if (this.elevators.every((e) => e.preventiveBonus > 6)) add('예방정비 달인');
    if (this.state.safetyIndex >= 85 && this.state.day >= 20) add('안전 최우수 빌딩');
  }

  rollComplaintReason(e) {
    const pool = [
      e.cleanliness < 55 ? '내부가 지저분해요' : '대기시간이 길어요',
      e.door < 60 ? '문이 너무 빨리 닫혀요' : '버튼 반응이 느려요',
      e.control < 58 ? '운행 진동/소음이 커요' : '층 도착 안내가 불안정해요',
      e.congestion > 70 ? '혼잡이 심해요' : '출퇴근 시간 안내가 필요해요'
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  performInspection() {
    const avgReadiness = this.elevators.reduce((s, e) => s + e.inspectionReadiness, 0) / this.elevators.length;
    const avgSafety =
      this.elevators.reduce((s, e) => s + (e.door + e.control + e.emergencyCall + e.overloadSensor + e.brake + e.interlock) / 6, 0) /
      this.elevators.length;
    const avgClean = this.elevators.reduce((s, e) => s + (e.cleanliness + e.clutter) / 2, 0) / this.elevators.length;
    const complaintPenalty = this.state.globalComplaints * 0.9;
    const repeatedFaultPenalty = this.elevators.reduce((s, e) => s + e.temporaryFixDebt * 0.8 + e.complaints * 0.7, 0);
    const score = clamp(avgReadiness * 0.35 + avgSafety * 0.35 + avgClean * 0.2 + this.state.reputation * 0.1 - complaintPenalty - repeatedFaultPenalty, 0, 100);

    let grade = '불합격';
    if (score >= stageConfig.passScore) grade = '합격';
    else if (score >= stageConfig.conditionalScore) grade = '조건부 합격';
    else if (score >= stageConfig.failScore) grade = '재점검';

    this.state.roundReports.unshift({
      day: this.state.day,
      grade,
      score: Number(score.toFixed(1)),
      missed: this.elevators.flatMap((e) => e.warning.map((w) => `${e.name}:${w}`)).slice(0, 4)
    });

    const msg = `정기검사 결과: ${grade} (점수 ${score.toFixed(1)})`;
    this.pushFeed(msg);
    this.state.eventPopup = `🧪 ${msg}`;

    if (grade === '합격') {
      this.state.gameOver = true;
      this.state.resultText = '🎉 합격! 예방 중심 운영이 안전성과를 만들었습니다.';
    } else if (grade === '조건부 합격') {
      this.state.budget -= 240;
      this.state.daysToInspection = 12;
      this.pushFeed('조건부 합격: 보완명령 대응 비용 발생.');
    } else if (grade === '재점검') {
      this.state.budget -= 320;
      this.state.daysToInspection = 10;
      this.pushFeed('재점검 통보: 시간/비용 페널티 발생.');
    } else {
      this.state.gameOver = true;
      this.state.resultText = '❌ 불합격. 사후 땜빵 중심 운영으로 안전 신뢰가 하락했습니다.';
    }
  }

  clearPopup() {
    this.state.eventPopup = null;
  }

  consumeLastAction() {
    const action = this.state.lastAction;
    this.state.lastAction = null;
    return action;
  }

  pushFeed(text) {
    this.state.feed.unshift(`[Day ${this.state.day} ${String(this.state.hour).padStart(2, '0')}:00] ${text}`);
    this.state.feed = this.state.feed.slice(0, 10);
  }
}
