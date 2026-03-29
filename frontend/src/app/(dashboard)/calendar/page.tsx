import { addDays } from "date-fns";
import { CalendarDays, Clock3, Sparkles } from "lucide-react";

import { AppointmentForm } from "@/components/appointment-form";
import { CalendarOverview } from "@/components/calendar-overview";
import { ApiError, apiFetch } from "@/lib/api";
import { handleProtectedApiError, requireAuthenticatedProfile } from "@/lib/auth";
import type {
  AppointmentListResponse,
  ClientListResponse,
  OrgConfig,
} from "@/types";

type CalendarPageProps = {
  searchParams: Promise<{
    client_id?: string;
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

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const { profile, session } = await requireAuthenticatedProfile();
  const resolvedSearchParams = await searchParams;
  const dateFrom = new Date();
  dateFrom.setHours(0, 0, 0, 0);
  const dateTo = addDays(dateFrom, 6);
  dateTo.setHours(23, 59, 59, 999);

  let appointments: AppointmentListResponse;
  let clients: ClientListResponse;
  let orgConfig: OrgConfig;

  try {
    [appointments, clients, orgConfig] = await Promise.all([
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
  } catch (error) {
    if (error instanceof ApiError) {
      handleProtectedApiError(error);
    }
    throw error;
  }

  const serviceTypes =
    orgConfig.service_types.length > 0
      ? orgConfig.service_types
      : DEFAULT_SERVICE_TYPES;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 shadow-xl shadow-slate-200/60 backdrop-blur-sm">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
              <CalendarDays size={14} />
              Schedule Board
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Calendar
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                Review today&apos;s schedule, plan the week ahead, and keep
                client-facing appointments visible to the whole team.
              </p>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-slate-900/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Weekly Window
                </p>
                <p className="mt-3 text-4xl font-bold tracking-tight text-white">
                  {appointments.appointments.length}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  appointments loaded for the next seven days
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 p-4 text-indigo-200">
                <Clock3 size={24} />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white/10 p-2 text-purple-200">
                  <Sparkles size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Operational Focus
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    Use the schedule panel for quick intake booking, then scan
                    today&apos;s list and the weekly board for conflicts or gaps.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {profile.role === "staff" || profile.role === "admin" ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Schedule Appointment
            </h2>
            <p className="text-sm text-slate-600">
              Book the next visit with a client and keep the weekly board current.
            </p>
          </div>
          <AppointmentForm
            clients={clients.clients}
            serviceTypes={serviceTypes}
            defaultClientId={resolvedSearchParams?.client_id}
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
