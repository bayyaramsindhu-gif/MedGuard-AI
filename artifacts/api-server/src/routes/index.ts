import { Router, type IRouter } from "express";
import healthRouter from "./health";
import medguardRouter from "./medguard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(medguardRouter);

export default router;
