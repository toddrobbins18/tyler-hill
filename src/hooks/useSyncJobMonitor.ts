import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SyncJobRow } from "@/lib/operationsDashboard";
import {
  buildSyncJobLogSteps,
  initialSyncJobSteps,
  syncJobIsLive,
  syncJobTerminal,
  type OperationStep,
} from "@/lib/operationLiveLog";

type SyncJobMonitorState = {
  job: SyncJobRow | null;
  steps: OperationStep[];
  isLive: boolean;
  isDone: boolean;
  error: string | null;
};

const POLL_MS = 2500;

export function useSyncJobMonitor(jobId: string | null) {
  const [state, setState] = useState<SyncJobMonitorState>({
    job: null,
    steps: [{ id: "init", label: "Starting…", status: "running" }],
    isLive: Boolean(jobId),
    isDone: false,
    error: null,
  });
  const stepLabelsRef = useRef<string[]>([]);

  const applyJob = useCallback((job: SyncJobRow) => {
    const { steps, stepLabels } = buildSyncJobLogSteps(job, stepLabelsRef.current);
    stepLabelsRef.current = stepLabels;
    const terminal = syncJobTerminal(job.status);
    const live = syncJobIsLive(job);
    setState({
      job,
      steps,
      isLive: live,
      isDone: terminal || job.status.toLowerCase() === "failed",
      error: job.error_message ?? null,
    });
  }, []);

  useEffect(() => {
    if (!jobId) {
      stepLabelsRef.current = [];
      setState({
        job: null,
        steps: [],
        isLive: false,
        isDone: false,
        error: null,
      });
      return;
    }

    stepLabelsRef.current = [];
    let cancelled = false;

    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const { data, error } = await supabase.from("sync_jobs").select("*").eq("id", jobId).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setState((prev) => ({
          ...prev,
          error: error?.message ?? "Sync job not found",
          isLive: false,
          isDone: true,
        }));
        if (interval) clearInterval(interval);
        return;
      }
      const row = data as SyncJobRow;
      applyJob(row);
      if (syncJobTerminal(row.status) || row.status.toLowerCase() === "failed") {
        if (interval) clearInterval(interval);
      }
    };

    void poll();
    interval = setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, applyJob]);

  return state;
}

/** Monitor the newest live CampMinder job for a company (auto-sync or manual). */
export function useCompanySyncJobMonitor(companyId: string | null) {
  const [jobId, setJobId] = useState<string | null>(null);
  const monitor = useSyncJobMonitor(jobId);

  useEffect(() => {
    if (!companyId) {
      setJobId(null);
      return;
    }

    let cancelled = false;

    const findLive = async () => {
      const { data } = await supabase
        .from("sync_jobs")
        .select("*")
        .eq("company_id", companyId)
        .eq("entity_type", "campminder")
        .in("status", ["pending", "running"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      const row = data as SyncJobRow | null;
      if (row && syncJobIsLive(row)) {
        setJobId(row.id);
      }
    };

    void findLive();
    const interval = setInterval(() => void findLive(), POLL_MS * 2);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [companyId]);

  return { ...monitor, trackedJobId: jobId, watchJob: setJobId };
}

export { initialSyncJobSteps };
