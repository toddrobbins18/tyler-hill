/** Training-only staff logins for Nest sandbox (Messages, Groups). Not for production camps. */
export const SANDBOX_DEMO_STAFF_DOMAIN = "@nest-demo.example";

/** Shared password for all sandbox demo staff (training only). */
export const SANDBOX_DEMO_STAFF_PASSWORD = "NestSandbox2027!";

export type SandboxDemoStaffAccount = {
  key: string;
  label: string;
  email: string;
  fullName: string;
};

export const SANDBOX_DEMO_STAFF_ACCOUNTS: SandboxDemoStaffAccount[] = [
  {
    key: "alpha",
    label: "Staff A",
    email: "staff.alpha@nest-demo.example",
    fullName: "Sam Sandbox Staff",
  },
  {
    key: "beta",
    label: "Staff B",
    email: "staff.beta@nest-demo.example",
    fullName: "Jordan Sandbox Staff",
  },
];

export function isSandboxDemoStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return SANDBOX_DEMO_STAFF_ACCOUNTS.some((a) => a.email.toLowerCase() === lower);
}
