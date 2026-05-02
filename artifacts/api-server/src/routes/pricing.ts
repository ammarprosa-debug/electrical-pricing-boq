import { Router } from "express";
import { StartPricingParams, StartPricingBody } from "@workspace/api-zod";
import { pricingQueue } from "../lib/pricingQueue.js";

const router = Router();

router.post("/projects/:id/price", async (req, res) => {
  const { id } = StartPricingParams.parse(req.params);
  const parsed = StartPricingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    await pricingQueue.startPricingJob(id, parsed.data.scenarios);
    res.json({
      jobId: `job-${id}-${Date.now()}`,
      projectId: id,
      status: "started",
      startedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to start pricing");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
