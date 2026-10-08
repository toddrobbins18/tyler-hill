import {
  SANDBOX_DEMO_STAFF_ACCOUNTS,
  SANDBOX_DEMO_STAFF_PASSWORD,
} from "@/lib/nestSandboxStaffDemo";

export function NestSandboxStaffTestAccountsCard() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground space-y-2">
      <p className="font-medium text-foreground">Sandbox staff test logins</p>
      <p>
        Use two browsers (or incognito) to message each other. Accounts must exist in{" "}
        <strong>Supabase → Authentication → Users</strong> first (password below), then run{" "}
        <code className="text-xs bg-muted px-1 rounded">create_nest_sandbox_test_staff.sql</code>{" "}
        or{" "}
        <code className="text-xs bg-muted px-1 rounded">npm run sandbox:create-staff-test-users</code>{" "}
        with <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in <code className="text-xs">.env</code>.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        {SANDBOX_DEMO_STAFF_ACCOUNTS.map((a) => (
          <li key={a.key}>
            <span className="text-foreground">{a.fullName}</span> —{" "}
            <code className="text-xs">{a.email}</code>
          </li>
        ))}
      </ul>
      <p>
        Password (training only):{" "}
        <code className="text-xs bg-muted px-1 rounded">{SANDBOX_DEMO_STAFF_PASSWORD}</code>
      </p>
    </div>
  );
}
