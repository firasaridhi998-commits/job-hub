"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Profile } from "@/lib/schema";
import type { ReadinessResult } from "@/lib/scoring/readiness";

interface Ctx {
  profile: Profile | null;
  readiness: ReadinessResult | null;
  version: number;
  setProfile: (p: Profile | null) => void;
  setReadiness: (r: ReadinessResult | null) => void;
  load: (p: Profile, r: ReadinessResult) => void;
  discard: () => void;
}
const C = createContext<Ctx | null>(null);

/** Holds the analysis in memory only. Nothing is written to localStorage, cookies or a database; a page refresh discards it. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [version, setVersion] = useState(0);
  const value = useMemo<Ctx>(() => ({
    profile, readiness, version, setProfile, setReadiness,
    load: (p, r) => { setProfile(p); setReadiness(r); setVersion((v) => v + 1); },
    discard: () => { setProfile(null); setReadiness(null); setVersion((v) => v + 1); },
  }), [profile, readiness, version]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useProfile() {
  const v = useContext(C);
  if (!v) throw new Error("ProfileProvider missing");
  return v;
}
