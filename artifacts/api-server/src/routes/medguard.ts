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

router.get("/patients", async (_req, res): Promise<void> => {
  const patients = await simulation.listPatients();

  res.json(
    GetPatientsResponse.parse(patients),
  );
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const parsed =
    GetPatientParams.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.message,
    });
    return;
  }

  const patient =
    await simulation.getPatient(
      parsed.data.id,
    );

  if (!patient) {
    res.status(404).json({
      error: "Patient not found",
    });
    return;
  }

  res.json(
    GetPatientResponse.parse(patient),
  );
});

router.post(
  "/patients/:id/alerts/:alertId/acknowledge",
  (req, res): void => {
    const parsed =
      AcknowledgeAlertParams.safeParse(
        req.params,
      );

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.message,
      });
      return;
    }

    const alert =
      simulation.acknowledgeAlert(
        parsed.data.id,
        parsed.data.alertId,
      );

    if (!alert) {
      res.status(404).json({
        error: "Alert not found",
      });
      return;
    }

    res.json(
      AcknowledgeAlertResponse.parse(
        alert,
      ),
    );
  },
);

router.get("/insights", (_req, res): void => {
  res.json(
    GetInsightsResponse.parse(insights),
  );
});

router.post(
  "/simulation/tick",
  async (_req, res): Promise<void> => {
    const result =
      await simulation.tick();

    res.json(
      TickSimulationResponse.parse(
        result,
      ),
    );
  },
);

router.post(
  "/simulation/fast-forward",
  async (_req, res): Promise<void> => {
    const result =
      await simulation.fastForward();

    res.json(
      FastForwardSimulationResponse.parse(
        result,
      ),
    );
  },
);

export default router;