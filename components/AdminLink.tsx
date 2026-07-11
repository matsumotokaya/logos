"use client";

// The admin console is a signed-in area. Hide the link from guests when auth
// is enabled; in localStorage mode (no auth) it always shows.

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function AdminLink({ className }: { className?: string }) {
  const { enabled, isSignedIn } = useAuth();
  const { dict } = useI18n();
  if (enabled && !isSignedIn) return null;
  return (
    <Link href="/admin" className={className}>
      {dict.header.admin}
    </Link>
  );
}
