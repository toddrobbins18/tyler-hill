import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import {
  PARENT_EMAIL_TEMPLATE_OPTIONS,
  type ParentEmailTemplateKey,
} from "@/lib/parentEmailTemplates";
import { toast } from "sonner";

type Props = {
  childId: string;
  camperName: string;
  parentEmail: string | null | undefined;
};

export function ParentTemplateEmailPanel({ childId, camperName, parentEmail }: Props) {
  const { currentCompany } = useCompany();
  const [pendingKey, setPendingKey] = useState<ParentEmailTemplateKey | null>(null);
  const [sending, setSending] = useState(false);

  const pendingTemplate = PARENT_EMAIL_TEMPLATE_OPTIONS.find((t) => t.key === pendingKey);

  const send = async () => {
    if (!pendingKey || !currentCompany?.id) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-parent-template-email", {
      body: {
        company_id: currentCompany.id,
        child_id: childId,
        template_key: pendingKey,
      },
    });
    setSending(false);
    setPendingKey(null);

    if (error || !data?.success) {
      toast.error(data?.error ?? error?.message ?? "Failed to send email");
      return;
    }
    toast.success(`Email sent to ${data.recipient}`);
  };

  if (!parentEmail?.trim()) {
    return (
      <p className="text-xs text-muted-foreground">
        Add a parent email to send quick template messages.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Quick email to parent</p>
        </div>
        <p className="text-xs text-muted-foreground">
          One tap sends to {parentEmail}
        </p>
        <div className="flex flex-wrap gap-2">
          {PARENT_EMAIL_TEMPLATE_OPTIONS.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setPendingKey(key)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <AlertDialog open={!!pendingKey} onOpenChange={(open) => !open && setPendingKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Email parent?</AlertDialogTitle>
            <AlertDialogDescription>
              Send &ldquo;{pendingTemplate?.label}&rdquo; to {parentEmail} for {camperName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()} disabled={sending}>
              {sending ? "Sending…" : "Send email"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
