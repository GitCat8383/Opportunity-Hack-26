import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight">
          Nonprofit Case Management
        </h1>
        <p className="text-lg text-muted-foreground">
          Lightweight, AI-powered client and case management for small
          nonprofits. Track clients, log services, and report outcomes — all in
          one place.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
