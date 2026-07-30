import { Construction } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";

type DayCampPlaceholderProps = {
  title: string;
  description: string;
};

export default function DayCampPlaceholder({ title, description }: DayCampPlaceholderProps) {
  const { currentCompany } = useCompany();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{currentCompany?.name ?? "Day Camp"}</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <Construction className="h-8 w-8 text-muted-foreground" />
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
