import { z } from "zod";

export const ExperienceSchema = z.object({
  title: z.string().max(200).default(""),
  company: z.string().max(200).default(""),
  start: z.string().max(30).optional(),
  end: z.string().max(30).optional(),
  bullets: z.array(z.string().max(800)).max(30).default([]),
});
export const EducationSchema = z.object({
  degree: z.string().max(300).default(""),
  institution: z.string().max(300).default(""),
  year: z.string().max(20).optional(),
});
export const PreferencesSchema = z.object({
  workMode: z.enum(["any", "remote", "hybrid", "onsite"]).default("any"),
  locations: z.array(z.string().max(100)).max(10).default([]),
  minSalary: z.number().nonnegative().optional(),
  salaryCurrency: z.string().max(5).optional(),
  openToRelocation: z.boolean().default(false),
  /** Only ever set by the user. Never inferred from nationality, name or language. */
  needsSponsorship: z.boolean().optional(),
  workAuthorizationNotes: z.string().max(300).optional(),
});
export const MetaSchema = z.object({
  wordCount: z.number().default(0),
  sections: z.array(z.string()).default([]),
  bulletCount: z.number().default(0),
  warnings: z.array(z.string().max(300)).max(20).default([]),
});
export const ProfileSchema = z.object({
  name: z.string().max(200).default(""),
  email: z.string().max(200).default(""),
  phone: z.string().max(50).default(""),
  location: z.string().max(200).default(""),
  headline: z.string().max(300).default(""),
  summary: z.string().max(2500).default(""),
  skills: z.array(z.string().max(60)).max(120).default([]),
  experience: z.array(ExperienceSchema).max(25).default([]),
  education: z.array(EducationSchema).max(12).default([]),
  certifications: z.array(z.string().max(200)).max(30).default([]),
  languages: z.array(z.string().max(60)).max(15).default([]),
  targetTitles: z.array(z.string().max(120)).max(5).default([]),
  yearsExperience: z.number().min(0).max(60).nullable().default(null),
  preferences: PreferencesSchema.prefault({}),
  meta: MetaSchema.prefault({}),
});
export type Profile = z.infer<typeof ProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;

export const emptyProfile = (): Profile => ProfileSchema.parse({});

export const ScoreRequestSchema = z.object({
  profile: ProfileSchema,
  targetDescription: z.string().max(12_000).optional(),
});

export const JobSearchRequestSchema = z.object({
  profile: ProfileSchema,
  query: z.string().trim().min(2).max(120),
  location: z.string().trim().max(120).optional(),
  remoteOnly: z.boolean().optional(),
  country: z.string().trim().length(2).optional(),
  page: z.number().int().min(1).max(10).default(1),
});

export interface Job {
  id: string;
  provider: "adzuna" | "jsearch";
  title: string;
  company: string;
  location: string;
  country?: string;
  remote: "remote" | "hybrid" | "onsite" | "unknown";
  employmentType?: string;
  description: string;
  requirements: string[];
  salary?: { min?: number; max?: number; currency?: string; period?: string };
  postedAt?: string;
  applyUrl: string;
  source: string;
  lastCheckedAt: string;
}
