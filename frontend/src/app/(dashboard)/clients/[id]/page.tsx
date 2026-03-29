import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { requireAuthenticatedProfile } from "@/lib/auth";
import type { Client, OrgConfig, ServiceEntryListResponse } from "@/types";

type ClientProfilePageProps = {
  params: {
    id: string;
  };
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm">{value ?? "Not provided"}</p>
    </div>
  );
}

export default async function ClientProfilePage({
  params,
}: ClientProfilePageProps) {
  const { session } = await requireAuthenticatedProfile();

  try {
    const [client, orgConfig, serviceEntries] = await Promise.all([
      apiFetch<Client>(`/clients/${params.id}`, { cache: "no-store" }, session.access_token),
      apiFetch<OrgConfig>("/org-config", { cache: "no-store" }, session.access_token),
      apiFetch<ServiceEntryListResponse>(
        `/service-entries?client_id=${params.id}&per_page=100`,
        { cache: "no-store" },
        session.access_token
      ),
    ]);
    const customFieldLabels = new Map(
      orgConfig.extra_fields_schema.map((field) => [field.key, field.label])
    );

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {client.first_name} {client.last_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Client profile and service history
            </p>
          </div>
          <Link
            href={`/clients/${client.id}/services/new`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            + Log Service
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-lg border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Demographics</h2>
            <div className="grid gap-4">
              <DetailRow label="Status" value={client.status} />
              <DetailRow label="Date of Birth" value={client.date_of_birth} />
              <DetailRow label="Phone" value={client.phone} />
              <DetailRow label="Email" value={client.email} />
              <DetailRow label="Language" value={client.language.toUpperCase()} />
              <DetailRow label="Gender" value={client.gender} />
              <DetailRow label="Household Size" value={client.household_size} />
              <DetailRow label="Address" value={client.address} />
            </div>

            <div>
              <h3 className="text-sm font-medium">Custom Fields</h3>
              {Object.keys(client.extra_fields).length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No custom fields recorded yet.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {Object.entries(client.extra_fields).map(([key, value]) => (
                    <DetailRow
                      key={key}
                      label={customFieldLabels.get(key) ?? key}
                      value={
                        value == null
                          ? null
                          : typeof value === "string"
                            ? value
                            : JSON.stringify(value)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Service History</h2>
              <p className="text-sm text-muted-foreground">
                {serviceEntries.total} total entries
              </p>
            </div>

            {serviceEntries.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No services logged yet for this client.
              </p>
            ) : (
              <div className="space-y-4">
                {serviceEntries.entries.map((entry) => (
                  <article key={entry.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{entry.service_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.service_date}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Staff ID: {entry.staff_id}
                      </p>
                    </div>

                    {entry.summary ? (
                      <p className="mt-3 text-sm">
                        <span className="font-medium">Summary:</span>{" "}
                        {entry.summary}
                      </p>
                    ) : null}

                    <p className="mt-3 whitespace-pre-wrap text-sm">
                      {entry.notes || "No notes recorded."}
                    </p>

                    {entry.action_items.length > 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Action items: {entry.action_items.join(", ")}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
