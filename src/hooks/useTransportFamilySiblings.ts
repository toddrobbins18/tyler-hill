import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  lookupTransportFamilyEnrolledSiblings,
  resolveTransportLogTargets,
  type TransportFamilyCamper,
} from "@/lib/transportFamilySiblings";

export function useTransportFamilySiblings(
  companyId: string,
  camperId: string,
  campers: TransportFamilyCamper[],
) {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<TransportFamilyCamper[]>([]);
  const [applyToSiblings, setApplyToSiblings] = useState(false);
  const [loading, setLoading] = useState(false);

  const enrolledIdsKey = useMemo(() => campers.map((c) => c.id).sort().join(","), [campers]);

  useEffect(() => {
    if (!companyId || !camperId) {
      setFamilyId(null);
      setFamilyName(null);
      setSiblings([]);
      setApplyToSiblings(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void lookupTransportFamilyEnrolledSiblings(supabase, companyId, camperId, campers)
      .then((ctx) => {
        if (cancelled) return;
        setFamilyId(ctx.familyId);
        setFamilyName(ctx.familyName);
        setSiblings(ctx.siblings);
        setApplyToSiblings(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFamilyId(null);
        setFamilyName(null);
        setSiblings([]);
        setApplyToSiblings(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, camperId, enrolledIdsKey, campers]);

  const otherSiblings = useMemo(
    () => siblings.filter((s) => s.id !== camperId),
    [siblings, camperId],
  );

  const logTargets = useMemo(
    () => resolveTransportLogTargets(camperId, campers, siblings, applyToSiblings),
    [camperId, campers, siblings, applyToSiblings],
  );

  return {
    familyId,
    familyName,
    siblings,
    otherSiblings,
    applyToSiblings,
    setApplyToSiblings,
    logTargets,
    loading,
  };
}
