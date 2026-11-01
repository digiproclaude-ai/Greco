import { NextResponse, type NextRequest } from "next/server";

import { timingSafeEqualStrings } from "@/lib/timing-safe";
import { getServerEnv } from "@/server/env";
import { log } from "@/server/log";
import { isJobName, jobs } from "@/server/privileged/jobs/registry";

/** Run a background job. Callers authenticate with `Authorization: Bearer <JOBS_SECRET>`. */
export async function POST(request: NextRequest, context: RouteContext<"/api/jobs/[job]">) {
  const secret = getServerEnv().JOBS_SECRET;
  if (!secret) return NextResponse.json({ error: "jobs_not_configured" }, { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token || !timingSafeEqualStrings(token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await context.params;
  if (!isJobName(job)) return NextResponse.json({ error: "unknown_job" }, { status: 404 });

  try {
    const result = await jobs[job]();
    log.info("job.completed", { job, result });
    return NextResponse.json({ job, result });
  } catch (error) {
    log.error("job.failed", { job, error });
    return NextResponse.json({ error: "job_failed" }, { status: 500 });
  }
}
