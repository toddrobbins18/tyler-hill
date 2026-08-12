import { useParams, Navigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { northShoreBusTransportEnabled } from "@/lib/camps";
import DayCampPlaceholder from "./DayCampPlaceholder";
import SunshineReport from "./SunshineReport";
import Transport from "./Transport";
import OfficeTransportChanges from "./OfficeTransportChanges";
import SwimProgram from "./SwimProgram";

import Nurse from "./Nurse";

const DAY_CAMP_MODULES: Record<string, { title: string; description: string }> = {
  "sunshine-report": {
    title: "Sunshine Report",
    description:
      "Daily camper tracking — fill out throughout the day, then send to parents at the end of day.",
  },
  "swim": {
    title: "Swim",
    description: "Swim Bracelets and Level Reports.",
  },
  "nurse": {
    title: "Nurse",
    description: "Track incidents and treatments.",
  },
  "transport": {
    title: "Transport",
    description: "Bus routes, maps, coordination, and travel reports",
  },
  "office-changes": {
    title: "Office Changes",
    description: "Schedule changes that notify transportation when entered.",
  },
};

export default function DayCampModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { currentCompany } = useCompany();
  const config = moduleId ? DAY_CAMP_MODULES[moduleId] : undefined;

  if (moduleId === "transport" && !northShoreBusTransportEnabled(currentCompany)) {
    return <Navigate to="/transportation" replace />;
  }

  if (!config) {
    return (
      <DayCampPlaceholder
        title="Day Camp"
        description="This module was not found."
      />
    );
  }

  if (moduleId === "sunshine-report") {
    return <SunshineReport />;
  }

  if (moduleId === "transport") {
    return <Transport />;
  }

  if (moduleId === "office-changes") {
    return <OfficeTransportChanges />;
  }

  if (moduleId === "swim") {
    return <SwimProgram />;
  }

  if (moduleId === "nurse") {
    return <Nurse />;
  }

  return <DayCampPlaceholder title={config.title} description={config.description} />;
}
