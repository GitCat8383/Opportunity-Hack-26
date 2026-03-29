import { notFound } from "next/navigation";

import { ServiceEntryForm } from "@/components/service-entry-form";
import { ApiError, apiFetch } from "@/lib/api";
import { handleProtectedApiError, requireAuthenticatedProfile } from "@/lib/auth";
import type { Client } from "@/types";

type NewServiceEntryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const DEFAULT_SERVICE_TYPES = [
  "General",
  "Food Assistance",
  "Housing",
  "Mental Health",
  "Legal",
  "Medical",
  "Education",
  "Other",
];

export default async function NewServiceEntryPage({
  params,
}: NewServiceEntryPageProps) {
  const { profile, session, supabase } = await requireAuthenticatedProfile([
    "volunteer",
    "staff",
    "admin",
  ]);
  const { id } = await params;

  try {
    const client = await apiFetch<Client>(
      `/clients/${id}`,
      { cache: "no-store" },
      session.access_token
    );

    const { data: orgConfig } = await supabase
      .from("org_config")
      .select("service_types")
      .eq("org_id", profile.org_id)
      .maybeSingle();

    const serviceTypes =
      Array.isArray(orgConfig?.service_types) && orgConfig.service_types.length > 0
        ? orgConfig.service_types.map(String)
        : DEFAULT_SERVICE_TYPES;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Log Service</h1>
          <p className="text-sm text-muted-foreground">
            Add a new service entry for {client.first_name} {client.last_name}.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <ServiceEntryForm
            clientId={client.id}
            serviceTypes={serviceTypes}
            staffName={profile.full_name}
            canUseAi={profile.role === "staff" || profile.role === "admin"}
          />
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        notFound();
      }
      handleProtectedApiError(error);
    }
    throw error;
  }
}
