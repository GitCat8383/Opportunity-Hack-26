import { ClientForm } from "@/components/client-form";
import { requireAuthenticatedProfile } from "@/lib/auth";

export default async function NewClientPage() {
  await requireAuthenticatedProfile(["volunteer", "staff", "admin"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register Client</h1>
        <p className="text-sm text-muted-foreground">
          Create a client profile with demographics and optional extra fields.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <ClientForm />
      </div>
    </div>
  );
}
