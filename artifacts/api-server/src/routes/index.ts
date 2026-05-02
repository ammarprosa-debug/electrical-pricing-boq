import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import boqRouter from "./boq";
import pricingRouter from "./pricing";
import materialsRouter from "./materials";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(boqRouter);
router.use(pricingRouter);
router.use(materialsRouter);
router.use(reportsRouter);

export default router;
