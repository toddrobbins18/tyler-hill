import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DayCampBackLink({ to = "/" }: { to?: string }) {
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
      onClick={() => navigate(to)}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
