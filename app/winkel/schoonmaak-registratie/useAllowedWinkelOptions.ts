"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import {
  filterAllowedWinkelOptions,
  hasFullAccess,
  WINKEL_STORE_IDS,
} from "../../lib/auth/access";
import type { UserProfile } from "../../lib/supabase/types";
import type { TemperatureLocationOption } from "./temperatureRegistrationShared";

const PROFILE_SELECT =
  "id,full_name,email,role,store,permissions,active,avatar_url,created_at";

export function useAllowedWinkelOptions<
  T extends TemperatureLocationOption,
>(options: readonly T[]) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let ignoreResult = false;

    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        const userId = claimsData?.claims?.sub;

        if (!userId) return;

        const { data } = await supabase
          .from("profiles")
          .select(PROFILE_SELECT)
          .eq("id", userId)
          .maybeSingle();

        if (!ignoreResult) {
          setProfile((data as UserProfile | null) || null);
        }
      } finally {
        if (!ignoreResult) setLoaded(true);
      }
    }

    void loadProfile();

    return () => {
      ignoreResult = true;
    };
  }, []);

  return useMemo(() => {
    const containsWinkelOptions = options.some((option) =>
      WINKEL_STORE_IDS.includes(option.id as (typeof WINKEL_STORE_IDS)[number])
    );

    if (!containsWinkelOptions || !loaded || !profile || hasFullAccess(profile)) {
      return [...options];
    }

    return filterAllowedWinkelOptions(options, profile);
  }, [loaded, options, profile]);
}
