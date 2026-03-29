import { requireAuthenticatedProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import type { AuditLogEntry, UserProfile } from "@/types";

export default async function AuditLogPage() {
  const { supabase } = await requireAuthenticatedProfile(["admin"]);

  const { data: auditLogRows } = await supabase
    .from("audit_log")
    .select("id, org_id, user_id, action, table_name, record_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const userIds = Array.from(
    new Set((auditLogRows ?? []).map((row) => row.user_id).filter(Boolean))
  );

  const { data: profileRows } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [] as Array<Pick<UserProfile, "id" | "full_name">> };

  const userNames = new Map(
    (profileRows ?? []).map((profile) => [profile.id, profile.full_name])
  );

  const auditLog = (auditLogRows ?? []) as AuditLogEntry[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Recent create, update, and delete activity without raw field values.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">Time</th>
              <th className="p-3 text-left font-medium">Action</th>
              <th className="p-3 text-left font-medium">Table</th>
              <th className="p-3 text-left font-medium">User</th>
              <th className="p-3 text-left font-medium">Changed Fields</th>
            </tr>
          </thead>
          <tbody>
            {auditLog.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  No audit events found yet.
                </td>
              </tr>
            ) : (
              auditLog.map((row) => {
                const changedFields = Object.keys(row.metadata ?? {}).filter(
                  (key) => key !== "table"
                );

                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-3 text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="p-3 capitalize">{row.action}</td>
                    <td className="p-3">{row.table_name}</td>
                    <td className="p-3">
                      {row.user_id ? userNames.get(row.user_id) ?? row.user_id : "System"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {changedFields.length > 0
                        ? changedFields.join(", ")
                        : "No field list"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
