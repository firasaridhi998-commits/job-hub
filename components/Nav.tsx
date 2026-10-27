"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useProfile } from "./ProfileContext";

const links = [
  { href: "/", label: "Home" },
  { href: "/analyze", label: "Resume Analyzer" },
  { href: "/jobs", label: "Find Jobs" },
  { href: "/#how", label: "How It Works" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { discard } = useProfile();
  if (path === "/login") return null;
  async function signOut() {
    discard();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3" aria-label="Main">
        <Link href="/" aria-label="Job Hub home"><Logo /></Link>
        <ul className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={path === l.href ? "text-accent" : "text-muted hover:text-fg"} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>
            </li>
          ))}
        </ul>
        <button onClick={signOut} className="text-sm text-muted hover:text-fg">Sign out</button>
      </nav>
    </header>
  );
}
