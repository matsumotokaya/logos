"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  canAccessLabs,
  type PlatformRole,
} from "@/lib/platform-roles";
import { hasSupabase, supabase } from "@/lib/supabase/client";

type PlatformAccess = {
  loading: boolean;
  roles: PlatformRole[];
  isPlatformAdmin: boolean;
  canAccessLabs: boolean;
};

const roleRequests = new Map<string, Promise<PlatformRole[]>>();

function loadRoles(userId: string): Promise<PlatformRole[]> {
  const existing = roleRequests.get(userId);
  if (existing) return existing;

  const request = (async () => {
    const { data, error } = await supabase
      .from("platform_role_assignments")
      .select("role")
      .eq("user_id", userId);
      if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.role as PlatformRole);
  })().catch((error: unknown) => {
      roleRequests.delete(userId);
      throw error;
  });

  roleRequests.set(userId, request);
  return request;
}

export function usePlatformAccess(): PlatformAccess {
  const { enabled, isSignedIn, loading: authLoading, user } = useAuth();
  const [resolved, setResolved] = useState<{
    userId: string;
    roles: PlatformRole[];
  } | null>(null);

  useEffect(() => {
    if (!hasSupabase || !enabled || authLoading || !isSignedIn || !user?.id) return;

    let cancelled = false;
    const userId = user.id;
    loadRoles(userId)
      .then((roles) => {
        if (!cancelled) setResolved({ userId, roles });
      })
      .catch(() => {
        if (!cancelled) setResolved({ userId, roles: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, enabled, isSignedIn, user?.id]);

  const roles =
    user?.id && resolved?.userId === user.id ? resolved.roles : [];
  const loading = Boolean(
    hasSupabase &&
      enabled &&
      !authLoading &&
      isSignedIn &&
      user?.id &&
      resolved?.userId !== user.id,
  );

  return {
    loading,
    roles,
    isPlatformAdmin: roles.includes("platform_admin"),
    canAccessLabs: canAccessLabs(roles),
  };
}
