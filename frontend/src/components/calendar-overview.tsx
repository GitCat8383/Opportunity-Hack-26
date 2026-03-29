"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { formatDateTime } from "@/lib/dates";
import type { Appointment, Client } from "@/types";

type CalendarOverviewProps = {
  appointments: Appointment[];
  clients: Array<Pick<Client, "id" | "first_name" | "last_name">>;
};

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(value);
}

function statusClasses(status: Appointment["status"]) {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "cancelled" || status === "no_show") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-amber-100 text-amber-800";
}

export function CalendarOverview({
  appointments,
  clients,
}: CalendarOverviewProps) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [router]);

  const clientNames = useMemo(
    () =>
      new Map(
        clients.map((client) => [
          client.id,
          `${client.first_name} ${client.last_name}`,
        ])
      ),
    [clients]
  );

  const today = startOfDay(new Date());
  const endOfToday = endOfDay(today);
  const endOfWeek = endOfDay(addDays(today, 6));

  const todayAppointments = appointments.filter((appointment) => {
    const scheduledAt = new Date(appointment.scheduled_at);
    return scheduledAt >= today && scheduledAt <= endOfToday;
  });

  const weeklyAppointments = appointments.filter((appointment) => {
    const scheduledAt = new Date(appointment.scheduled_at);
    return scheduledAt >= today && scheduledAt <= endOfWeek;
  });

  const reminderAppointments = appointments.filter((appointment) => {
    if (appointment.status !== "scheduled") {
      return false;
    }
    const scheduledAt = new Date(appointment.scheduled_at).getTime();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    return scheduledAt >= now && scheduledAt - now <= oneDay;
  });

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(today, index));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Upcoming Appointment Reminders</h2>
            <p className="text-sm text-muted-foreground">
              Auto-refreshing every minute to catch new or rescheduled visits.
            </p>
          </div>
          <p className="text-sm font-medium">
            {reminderAppointments.length} due in the next 24 hours
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Today</h2>
            <p className="text-sm text-muted-foreground">
              {todayAppointments.length} appointment
              {todayAppointments.length === 1 ? "" : "s"}
            </p>
          </div>

          {todayAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No appointments scheduled for today.
            </p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appointment) => (
                <article key={appointment.id} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">
                      {clientNames.get(appointment.client_id) ?? "Unknown client"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses(appointment.status)}`}
                    >
                      {appointment.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatDateTime(appointment.scheduled_at)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {appointment.service_type || "General"} ·{" "}
                    {appointment.duration_minutes} min
                  </p>
                  <div className="mt-3">
                    <Link
                      href={`/clients/${appointment.client_id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      Open client profile
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">This Week</h2>
            <p className="text-sm text-muted-foreground">
              {weeklyAppointments.length} upcoming appointment
              {weeklyAppointments.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {weekDays.map((day) => {
              const items = weeklyAppointments.filter((appointment) => {
                const scheduledAt = new Date(appointment.scheduled_at);
                return (
                  scheduledAt.getFullYear() === day.getFullYear() &&
                  scheduledAt.getMonth() === day.getMonth() &&
                  scheduledAt.getDate() === day.getDate()
                );
              });

              return (
                <div key={day.toISOString()} className="rounded-md border p-4">
                  <p className="font-medium">{formatDayLabel(day)}</p>
                  <div className="mt-3 space-y-3">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No appointments.
                      </p>
                    ) : (
                      items.map((appointment) => (
                        <article key={appointment.id} className="rounded-md bg-muted/40 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">
                                {clientNames.get(appointment.client_id) ?? "Unknown client"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDateTime(appointment.scheduled_at)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusClasses(appointment.status)}`}
                            >
                              {appointment.status.replace("_", " ")}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {appointment.service_type || "General"} ·{" "}
                            {appointment.duration_minutes} min
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
