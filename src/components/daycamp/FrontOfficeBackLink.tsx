import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const FRONT_OFFICE_PATH = "/day-camp/front-office";

/** Back navigation from Front Office sub-tools (transport admin, bus attendance, etc.). */
export function FrontOfficeBackLink() {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 mb-1 h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
      asChild
    >
      <Link to={FRONT_OFFICE_PATH}>
        <ArrowLeft className="h-4 w-4" />
        Front Office
      </Link>
    </Button>
  );
}
