import { ClientForm } from "@/components/client-form";
import { apiFetch } from "@/lib/api";
import { requireAuthenticatedProfile } from "@/lib/auth";
import type { OrgConfig } from "@/types";

export default async function NewClientPage() {
  const { session } = await requireAuthenticatedProfile([
    "volunteer",
    "staff",
    "admin",
  ]);
  const orgConfig = await apiFetch<OrgConfig>(
    "/org-config",
    { cache: "no-store" },
    session.access_token
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register Client</h1>
        <p className="text-sm text-muted-foreground">
          Create a client profile with demographics and optional extra fields.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <ClientForm extraFieldsSchema={orgConfig.extra_fields_schema} />
      </div>
    </div>
  );
}
