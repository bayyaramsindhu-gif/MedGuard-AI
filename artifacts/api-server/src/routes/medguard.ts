import { Router, type IRouter } from "express";
import {
  AcknowledgeAlertParams,
  AcknowledgeAlertResponse,
  FastForwardSimulationResponse,
  GetInsightsResponse,
  GetPatientParams,
  GetPatientResponse,
  GetPatientsResponse,
  TickSimulationResponse,
} from "@workspace/api-zod";
import { insights, simulation } from "../lib/medguard";

const router: IRouter = Router();

router.get("/patients", (_req, res): void => {
  res.json(GetPatientsResponse.parse(simulation.listPatients()));
});

router.get("/patients/:id", (req, res): void => {
  const parsed = GetPatientParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patient = simulation.getPatient(parsed.data.id);
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  res.json(GetPatientResponse.parse(patient));
});

router.post("/patients/:id/alerts/:alertId/acknowledge", (req, res): void => {
  const parsed = AcknowledgeAlertParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const alert = simulation.acknowledgeAlert(parsed.data.id, parsed.data.alertId);
  if (!alert) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.json(AcknowledgeAlertResponse.parse(alert));
});

router.get("/insights", (_req, res): void => {
  res.json(GetInsightsResponse.parse(insights));
});

router.post("/simulation/tick", (_req, res): void => {
  res.json(TickSimulationResponse.parse(simulation.tick()));
});

router.post("/simulation/fast-forward", (_req, res): void => {
  res.json(FastForwardSimulationResponse.parse(simulation.fastForward()));
});

export default router;