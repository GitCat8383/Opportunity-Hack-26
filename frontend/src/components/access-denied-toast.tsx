"use client";

import { useEffect, useState } from "react";

export function AccessDeniedToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setVisible(false);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed right-6 top-6 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-red-700">ACCESS DENIED</p>
      <p className="mt-1 text-sm text-red-600">
        You do not have permission to view that page.
      </p>
    </div>
  );
}
