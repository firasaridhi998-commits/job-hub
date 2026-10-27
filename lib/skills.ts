interface SkillDef {
  name: string;
  /** Aliases safe to find inside free text. */
  aliases?: string[];
  /** Aliases only trusted when a whole token (e.g. one item of a Skills list). */
  tokenAliases?: string[];
}

const DEFS: SkillDef[] = [
  { name: "JavaScript", aliases: ["js", "javascript", "ecmascript"] },
  { name: "TypeScript", aliases: ["ts", "typescript"] },
  { name: "Python", aliases: ["python3"] },
  { name: "Java" },
  { name: "C++", aliases: ["cpp"] },
  { name: "C#", aliases: ["csharp"] },
  { name: ".NET", aliases: ["dotnet", "asp.net"] },
  { name: "Go", aliases: ["golang"] },
  { name: "Rust" },
  { name: "PHP" },
  { name: "Ruby" },
  { name: "Swift" },
  { name: "Kotlin" },
  { name: "Dart" },
  { name: "Flutter" },
  { name: "React", aliases: ["reactjs", "react.js"] },
  { name: "Next.js", aliases: ["nextjs"] },
  { name: "Vue", aliases: ["vuejs", "vue.js"] },
  { name: "Angular", aliases: ["angularjs"] },
  { name: "Node.js", aliases: ["nodejs", "node"] },
  { name: "Express", aliases: ["express.js", "expressjs"] },
  { name: "Django" },
  { name: "Flask" },
  { name: "FastAPI" },
  { name: "Spring", aliases: ["spring boot", "spring framework"] },
  { name: "Laravel" },
  { name: "HTML", aliases: ["html5"] },
  { name: "CSS", aliases: ["css3"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"] },
  { name: "SQL", aliases: ["t-sql", "pl/sql"] },
  { name: "PostgreSQL", aliases: ["postgres"] },
  { name: "MySQL" },
  { name: "MongoDB", aliases: ["mongo"] },
  { name: "Redis" },
  { name: "Firebase" },
  { name: "GraphQL" },
  { name: "REST APIs", aliases: ["rest api", "restful", "rest apis"], tokenAliases: ["rest"] },
  { name: "Docker" },
  { name: "Kubernetes", aliases: ["k8s"] },
  { name: "AWS", aliases: ["amazon web services"] },
  { name: "Azure", aliases: ["microsoft azure"] },
  { name: "Google Cloud", aliases: ["gcp", "google cloud platform"] },
  { name: "Linux" },
  { name: "Git" },
  { name: "CI/CD", aliases: ["cicd", "continuous integration"] },
  { name: "Terraform" },
  { name: "Jenkins" },
  { name: "Machine Learning", aliases: ["ml"] },
  { name: "Deep Learning" },
  { name: "NLP", aliases: ["natural language processing"] },
  { name: "Data Analysis", aliases: ["data analytics"] },
  { name: "Pandas" },
  { name: "NumPy" },
  { name: "TensorFlow" },
  { name: "PyTorch" },
  { name: "Power BI", aliases: ["powerbi"] },
  { name: "Tableau" },
  { name: "Excel", aliases: ["microsoft excel", "ms excel"], tokenAliases: ["excel"] },
  { name: "Microsoft Office", aliases: ["ms office", "office 365"] },
  { name: "Agile", aliases: ["scrum", "kanban"] },
  { name: "Project Management", aliases: ["pmp"] },
  { name: "Figma" },
  { name: "UI/UX", aliases: ["ux design", "ui design", "ux/ui", "user experience"] },
  { name: "SEO", aliases: ["search engine optimization"] },
  { name: "Digital Marketing", aliases: ["online marketing"] },
  { name: "Marketing" },
  { name: "Sales" },
  { name: "Customer Service", aliases: ["customer support"] },
  { name: "Accounting" },
  { name: "Financial Analysis", aliases: ["financial modeling", "financial modelling"] },
  { name: "Recruitment", aliases: ["recruiting", "talent acquisition"] },
  { name: "SAP" },
  { name: "Salesforce" },
  { name: "Photoshop", aliases: ["adobe photoshop"] },
  { name: "Illustrator", aliases: ["adobe illustrator"] },
  { name: "Cybersecurity", aliases: ["cyber security", "infosec", "information security"] },
  { name: "Embedded Systems", aliases: ["embedded c", "firmware"] },
  { name: "Vehicle Diagnostics", aliases: ["automotive diagnostics", "obd"] },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const ALIAS_TO_NAME = new Map<string, string>();
const MATCHERS = DEFS.map((d) => {
  const tokenOnly = (d.tokenAliases ?? []).map((a) => a.toLowerCase()).includes(d.name.toLowerCase());
  const free = [...(tokenOnly ? [] : [d.name]), ...(d.aliases ?? [])];
  ALIAS_TO_NAME.set(d.name.toLowerCase(), d.name);
  for (const a of free) ALIAS_TO_NAME.set(a.toLowerCase(), d.name);
  for (const a of d.tokenAliases ?? []) ALIAS_TO_NAME.set(a.toLowerCase(), d.name);
  const alt = free.map(esc).join("|");
  return { name: d.name, re: new RegExp(`(?<![A-Za-z0-9+#.])(?:${alt})(?![A-Za-z0-9+#]|\\.[A-Za-z0-9])`, "i") };
});

/** Map a raw skill token to its canonical name (or a tidied version of itself). */
export function normalizeSkill(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ").replace(/^[•\-*–·▪]\s*/, "").replace(/[.;,]+$/, "");
  return ALIAS_TO_NAME.get(t.toLowerCase()) ?? t;
}

/** Find taxonomy skills mentioned anywhere in free text. */
export function extractSkills(text: string): string[] {
  return MATCHERS.filter((m) => m.re.test(text)).map((m) => m.name);
}

export function dedupeSkills(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list.map(normalizeSkill)) {
    const k = s.toLowerCase();
    if (s && !seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

export const skillKey = (s: string) => normalizeSkill(s).toLowerCase();
