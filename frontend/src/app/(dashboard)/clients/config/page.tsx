import Link from "next/link";

import { CustomFieldsManager } from "@/components/custom-fields-manager";
import { apiFetch } from "@/lib/api";
import { requireAuthenticatedProfile } from "@/lib/auth";
import type { OrgConfig } from "@/types";

export default async function ClientConfigPage() {
  const { session } = await requireAuthenticatedProfile(["admin"]);
  const orgConfig = await apiFetch<OrgConfig>(
    "/org-config",
    { cache: "no-store" },
    session.access_token
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Client Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Manage organization-specific client intake fields.
          </p>
        </div>
        <Link
          href="/clients"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent transition"
        >
          Back to Clients
        </Link>
      </div>

      <CustomFieldsManager initialConfig={orgConfig} />
    </div>
  );
}
