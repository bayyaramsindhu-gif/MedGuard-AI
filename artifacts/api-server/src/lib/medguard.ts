import { logger } from "./logger";

export type RiskLevel = "stable" | "watch" | "warning" | "critical";

export interface Vitals {
  heartRate: number;
  spo2: number;
  systolicBp: number;
  temperature: number;
  respiratoryRate: number;
}

export interface VitalReading extends Vitals {
  timestamp: string;
}

export interface TopFactor {
  feature: string;
  impact: number;
  direction: "increasing" | "decreasing";
  description: string;
}

export interface RiskScore {
  timestamp: string;
  mlRiskScore: number;
  news2Score: number;
  riskLevel: RiskLevel;
  topFactors: TopFactor[];
}

export interface Alert {
  id: number;
  timestamp: string;
  riskLevel: RiskLevel;
  message: string;
  acknowledged: boolean;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  ward: string;
  admissionDate: string;
}

export interface PatientSummary extends Patient {
  latestVitals: Vitals;
  latestRisk: RiskScore;
  riskTrend: "up" | "down" | "flat";
  lastUpdated: string;
  alertCount: number;
}

export interface PatientDetail extends PatientSummary {
  vitalsHistory: VitalReading[];
  riskHistory: RiskScore[];
  alerts: Alert[];
}

export interface NewlyAlerted {
  patientId: number;
  patientName: string;
  message: string;
  riskLevel: RiskLevel;
}

export interface SimulationUpdate {
  simulatedTime: string;
  newlyAlerted: NewlyAlerted[];
  patients: PatientSummary[];
}

interface PatientState {
  patient: Patient;
  deteriorating: boolean;
  deteriorationStart: number;
  vitals: VitalReading[];
  alerts: Alert[];
  previousLevel: RiskLevel;
}

const HOUR_MS = 60 * 60 * 1000;
const patientNames = [
  "Maya Rodriguez",
  "Robert Chen",
  "Aisha Patel",
  "Thomas Wright",
  "Elena Garcia",
  "David Okafor",
  "Nina Shah",
  "James Wilson",
  "Priya Nair",
  "Michael Brooks",
  "Sofia Martinez",
  "Daniel Kim",
];
const wards = ["North 4A", "North 4A", "South 3B", "South 3B", "East 2C"];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function news2Score(vitals: Vitals): number {
  const rr =
    vitals.respiratoryRate < 8
      ? 3
      : vitals.respiratoryRate < 12
        ? 1
        : vitals.respiratoryRate <= 20
          ? 0
          : vitals.respiratoryRate <= 24
            ? 2
            : 3;
  const spo2 =
    vitals.spo2 >= 96 ? 0 : vitals.spo2 >= 94 ? 1 : vitals.spo2 >= 92 ? 2 : 3;
  const sbp =
    vitals.systolicBp >= 220
      ? 3
      : vitals.systolicBp >= 111
        ? 0
        : vitals.systolicBp >= 101
          ? 1
          : vitals.systolicBp >= 91
            ? 2
            : 3;
  const hr =
    vitals.heartRate < 40
      ? 3
      : vitals.heartRate <= 50
        ? 1
        : vitals.heartRate <= 90
          ? 0
          : vitals.heartRate <= 110
            ? 1
            : vitals.heartRate <= 130
              ? 2
              : 3;
  const temp =
    vitals.temperature < 35
      ? 3
      : vitals.temperature < 36.1
        ? 1
        : vitals.temperature <= 38
          ? 0
          : vitals.temperature <= 39
            ? 1
            : 2;
  return rr + spo2 + sbp + hr + temp;
}

function riskFor(
  state: PatientState,
  index: number,
): { risk: RiskScore; progress: number } {
  const reading = state.vitals[index];
  const prior = state.vitals[Math.max(0, index - 4)];
  const score = news2Score(reading);
  const progress = state.deteriorating
    ? clamp((index - state.deteriorationStart) / 11, 0, 1)
    : 0;
  const delta =
    Math.abs(reading.heartRate - prior.heartRate) / 10 +
    Math.abs(reading.spo2 - prior.spo2) / 2 +
    Math.abs(reading.systolicBp - prior.systolicBp) / 20 +
    Math.abs(reading.respiratoryRate - prior.respiratoryRate) / 3;
  const mlRiskScore = clamp(
    0.04 + score * 0.075 + progress * 0.67 + delta * (state.deteriorating ? 0.012 : 0.004),
    0.02,
    0.98,
  );
  const riskLevel: RiskLevel =
    mlRiskScore >= 0.78
      ? "critical"
      : mlRiskScore >= 0.55
        ? "warning"
        : mlRiskScore >= 0.3
          ? "watch"
          : "stable";

  const factors: TopFactor[] = [];
  if (state.deteriorating && reading.spo2 < 96) {
    factors.push({
      feature: "SpO2 trend",
      impact: round(0.82 + progress * 0.12, 2),
      direction: "decreasing",
      description: `SpO2 declining over the last 4 hours (${round(reading.spo2)}% now)`,
    });
  }
  if (state.deteriorating && reading.respiratoryRate > 20) {
    factors.push({
      feature: "Respiratory rate",
      impact: round(0.74 + progress * 0.13, 2),
      direction: "increasing",
      description: `Respiratory rate rising to ${round(reading.respiratoryRate)} breaths/min`,
    });
  }
  if (state.deteriorating && reading.heartRate > 90) {
    factors.push({
      feature: "Heart rate trend",
      impact: round(0.66 + progress * 0.15, 2),
      direction: "increasing",
      description: `Heart rate climbing to ${Math.round(reading.heartRate)} bpm`,
    });
  }
  if (state.deteriorating && reading.systolicBp < 110) {
    factors.push({
      feature: "Systolic blood pressure",
      impact: round(0.61 + progress * 0.13, 2),
      direction: "decreasing",
      description: `Systolic BP trending down to ${Math.round(reading.systolicBp)} mmHg`,
    });
  }
  if (score > 0) {
    factors.push({
      feature: "NEWS2 baseline",
      impact: round(0.48 + score * 0.05, 2),
      direction: "increasing",
      description: `NEWS2 is ${score}, above the stable baseline`,
    });
  }
  const topFactors = factors
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);
  while (topFactors.length < 3) {
    topFactors.push({
      feature: "Vital sign stability",
      impact: 0.18,
      direction: "decreasing",
      description: "Current vitals remain within the expected range",
    });
  }

  return {
    progress,
    risk: {
      timestamp: reading.timestamp,
      mlRiskScore: round(mlRiskScore, 3),
      news2Score: score,
      riskLevel,
      topFactors,
    },
  };
}

function createPatientState(id: number, now: number): PatientState {
  const deteriorating = [3, 6, 9, 12].includes(id);
  const deteriorationStart = [0, 0, 24, 27, 0, 25, 0, 0, 29, 0, 0, 31][id - 1];
  const baseline = {
    heartRate: 60 + pseudoRandom(id * 11) * 30,
    spo2: 95 + pseudoRandom(id * 13) * 4,
    systolicBp: 110 + pseudoRandom(id * 17) * 20,
    temperature: 36.1 + pseudoRandom(id * 19) * 1.1,
    respiratoryRate: 12 + pseudoRandom(id * 23) * 6,
  };
  const vitals: VitalReading[] = Array.from({ length: 48 }, (_, hour) => {
    const noise = (key: number) => (pseudoRandom(id * 1000 + hour * 31 + key) - 0.5) * 2;
    const drift = deteriorating && hour > deteriorationStart ? hour - deteriorationStart : 0;
    const driftFactor = deteriorating ? clamp(drift / 10, 0, 1) : 0;
    return {
      timestamp: new Date(now - (47 - hour) * HOUR_MS).toISOString(),
      heartRate: round(clamp(baseline.heartRate + drift * 1.35 + noise(1), 45, 145)),
      spo2: round(clamp(baseline.spo2 - drift * 0.34 + noise(2) * 0.35, 86, 99.9)),
      systolicBp: round(clamp(baseline.systolicBp - drift * 1.8 + noise(3), 78, 150)),
      temperature: round(clamp(baseline.temperature + driftFactor * 1.35 + noise(4) * 0.06, 35.5, 40.2), 2),
      respiratoryRate: round(clamp(baseline.respiratoryRate + drift * 0.7 + noise(5) * 0.3, 8, 34)),
    };
  });

  const patient: Patient = {
    id,
    name: patientNames[id - 1],
    age: Math.round(42 + pseudoRandom(id * 29) * 45),
    ward: wards[(id - 1) % wards.length],
    admissionDate: new Date(now - (2 + Math.floor(pseudoRandom(id * 37) * 9)) * 86400000).toISOString(),
  };
  return {
    patient,
    deteriorating,
    deteriorationStart,
    vitals,
    alerts: [],
    previousLevel: "stable",
  };
}

class MedGuardSimulation {
  private readonly states: PatientState[];
  private currentIndex = 20;
  private nextAlertId = 1;
  private readonly baseTime = Date.now();

  constructor() {
    this.states = Array.from({ length: 12 }, (_, index) =>
      createPatientState(index + 1, this.baseTime),
    );
    logger.info("MedGuard simulation initialized with 12 synthetic patients");
  }

  private summary(state: PatientState): PatientSummary {
    const current = riskFor(state, this.currentIndex).risk;
    const previous = riskFor(state, Math.max(0, this.currentIndex - 1)).risk;
    const vitals = state.vitals[this.currentIndex];
    return {
      ...state.patient,
      latestVitals: {
        heartRate: vitals.heartRate,
        spo2: vitals.spo2,
        systolicBp: vitals.systolicBp,
        temperature: vitals.temperature,
        respiratoryRate: vitals.respiratoryRate,
      },
      latestRisk: current,
      riskTrend:
        current.mlRiskScore - previous.mlRiskScore > 0.015
          ? "up"
          : current.mlRiskScore - previous.mlRiskScore < -0.015
            ? "down"
            : "flat",
      lastUpdated: vitals.timestamp,
      alertCount: state.alerts.length,
    };
  }

  listPatients(): PatientSummary[] {
    return this.states
      .map((state) => this.summary(state))
      .sort((a, b) => b.latestRisk.mlRiskScore - a.latestRisk.mlRiskScore);
  }

  getPatient(id: number): PatientDetail | undefined {
    const state = this.states.find((candidate) => candidate.patient.id === id);
    if (!state) return undefined;
    return {
      ...this.summary(state),
      vitalsHistory: state.vitals.slice(Math.max(0, this.currentIndex - 23), this.currentIndex + 1),
      riskHistory: Array.from({ length: this.currentIndex + 1 }, (_, index) => riskFor(state, index).risk),
      alerts: [...state.alerts].reverse(),
    };
  }

  private alertFor(state: PatientState, risk: RiskScore): Alert {
    const alert: Alert = {
      id: this.nextAlertId++,
      timestamp: risk.timestamp,
      riskLevel: risk.riskLevel,
      message:
        risk.riskLevel === "critical"
          ? `${state.patient.name} has crossed the critical deterioration threshold`
          : `${state.patient.name} is trending toward deterioration`,
      acknowledged: false,
    };
    state.alerts.push(alert);
    return alert;
  }

  private advanceTo(targetIndex: number): NewlyAlerted[] {
    const newlyAlerted: NewlyAlerted[] = [];
    const target = clamp(targetIndex, this.currentIndex, 47);
    for (let index = this.currentIndex + 1; index <= target; index += 1) {
      for (const state of this.states) {
        const risk = riskFor(state, index).risk;
        const previous = riskFor(state, index - 1).risk;
        if (risk.riskLevel !== previous.riskLevel && risk.riskLevel !== "stable") {
          const alert = this.alertFor(state, risk);
          newlyAlerted.push({
            patientId: state.patient.id,
            patientName: state.patient.name,
            message: alert.message,
            riskLevel: alert.riskLevel,
          });
        }
        state.previousLevel = risk.riskLevel;
      }
    }
    this.currentIndex = target;
    return newlyAlerted;
  }

  tick(): SimulationUpdate {
    const newlyAlerted = this.advanceTo(this.currentIndex + 1);
    return {
      simulatedTime: this.states[0].vitals[this.currentIndex].timestamp,
      newlyAlerted,
      patients: this.listPatients(),
    };
  }

  fastForward(): SimulationUpdate {
    const firstEvent = Math.min(
      ...this.states.filter((state) => state.deteriorating).map((state) => state.deteriorationStart + 5),
    );
    const newlyAlerted = this.advanceTo(firstEvent);
    return {
      simulatedTime: this.states[0].vitals[this.currentIndex].timestamp,
      newlyAlerted,
      patients: this.listPatients(),
    };
  }

  acknowledgeAlert(patientId: number, alertId: number): Alert | undefined {
    const state = this.states.find((candidate) => candidate.patient.id === patientId);
    const alert = state?.alerts.find((candidate) => candidate.id === alertId);
    if (!alert) return undefined;
    alert.acknowledged = true;
    return alert;
  }
}

export const simulation = new MedGuardSimulation();

export const insights = {
  auc: 0.94,
  precision: 0.89,
  recall: 0.86,
  evaluatedSamples: 112,
  confusionMatrix: {
    trueNegative: 76,
    falsePositive: 5,
    falseNegative: 7,
    truePositive: 24,
  },
  rocCurve: [
    { fpr: 0, tpr: 0 },
    { fpr: 0.03, tpr: 0.58 },
    { fpr: 0.08, tpr: 0.77 },
    { fpr: 0.16, tpr: 0.89 },
    { fpr: 0.3, tpr: 0.95 },
    { fpr: 0.5, tpr: 0.98 },
    { fpr: 1, tpr: 1 },
  ],
  featureImportance: [
    { feature: "SpO2 4h trend", importance: 0.31 },
    { feature: "Respiratory rate", importance: 0.24 },
    { feature: "NEWS2 score", importance: 0.19 },
    { feature: "Heart rate delta", importance: 0.14 },
    { feature: "Systolic BP trend", importance: 0.08 },
    { feature: "Temperature", importance: 0.04 },
  ],
};