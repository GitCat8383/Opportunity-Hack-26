import { addDays } from "date-fns";

import { AppointmentForm } from "@/components/appointment-form";
import { CalendarOverview } from "@/components/calendar-overview";
import { apiFetch } from "@/lib/api";
import { requireAuthenticatedProfile } from "@/lib/auth";
import type {
  AppointmentListResponse,
  ClientListResponse,
  OrgConfig,
} from "@/types";

type CalendarPageProps = {
  searchParams?: {
    client_id?: string;
  };
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

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const { profile, session } = await requireAuthenticatedProfile();
  const dateFrom = new Date();
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = addDays(dateFrom, 6);
  dateTo.setHours(23, 59, 59, 999);

  const [appointments, clients, orgConfig] = await Promise.all([
    apiFetch<AppointmentListResponse>(
      `/appointments?date_from=${encodeURIComponent(dateFrom.toISOString())}&date_to=${encodeURIComponent(dateTo.toISOString())}&per_page=200`,
      { cache: "no-store" },
      session.access_token
    ),
    apiFetch<ClientListResponse>(
      "/clients?per_page=100",
      { cache: "no-store" },
      session.access_token
    ),
    apiFetch<OrgConfig>(
      "/org-config",
      { cache: "no-store" },
      session.access_token
    ),
  ]);

  const serviceTypes =
    orgConfig.service_types.length > 0
      ? orgConfig.service_types
      : DEFAULT_SERVICE_TYPES;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Review upcoming appointments for today and the rest of the week.
        </p>
      </div>

      {profile.role === "staff" || profile.role === "admin" ? (
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-semibold">Schedule Appointment</h2>
            <p className="text-sm text-muted-foreground">
              Book the next visit with a client and keep the weekly board current.
            </p>
          </div>
          <AppointmentForm
            clients={clients.clients}
            serviceTypes={serviceTypes}
            defaultClientId={searchParams?.client_id}
          />
        </section>
      ) : null}

      <CalendarOverview
        appointments={appointments.appointments}
        clients={clients.clients}
      />
    </div>
  );
}
