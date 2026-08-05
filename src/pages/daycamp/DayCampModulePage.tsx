import { useParams } from "react-router-dom";
import DayCampPlaceholder from "./DayCampPlaceholder";
import SunshineReport from "./SunshineReport";
import OfficeTransportChanges from "./OfficeTransportChanges";
import SwimProgram from "./SwimProgram";

const DAY_CAMP_MODULES: Record<string, { title: string; description: string }> = {
  "sunshine-report": {
    title: "Sunshine Report",
    description:
      "Daily camper tracking for Nursery Campers division, grouped like Airtable, with P1 email. Waiting on Todd's API.",
  },
  "swim": {
    title: "Swim",
    description: "Swim Bracelets and Level Reports.",
  },
  "health-center": {
    title: "Health Center",
    description:
      "Day camp health module — separate from sleepaway Nurse. Emails to division leaders and directors when a child is sent home.",
  },
  "office-changes": {
    title: "Office Changes",
    description: "Schedule changes that notify transportation when entered.",
  },
  "parent-portal": {
    title: "Parent Portal",
    description:
      "Parent single sign-on for swim lessons and transportation requests.",
  },
};

export default function DayCampModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const config = moduleId ? DAY_CAMP_MODULES[moduleId] : undefined;

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

  if (moduleId === "office-changes") {
    return <OfficeTransportChanges />;
  }

  if (moduleId === "swim") {
    return <SwimProgram />;
  }

  return <DayCampPlaceholder title={config.title} description={config.description} />;
}
