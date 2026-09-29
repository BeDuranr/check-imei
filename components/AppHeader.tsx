"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BalanceBadge } from "./BalanceBadge";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Chequear" },
  { href: "/historial", label: "Historial" },
];

export function AppHeader() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/login", { method: "DELETE" }).catch(() => {});
    // Recarga completa: el proxy vuelve a evaluar la cookie ya borrada.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 pt-3">
        <Link href="/" className="mr-auto text-base font-semibold tracking-tight">
          Chequeo IMEI
        </Link>
        <BalanceBadge />
        <ThemeToggle />
        <button
          type="button"
          onClick={logout}
          className="rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-card hover:text-fg"
          title="Cerrar sesión"
        >
          Salir
        </button>
      </div>
      <nav className="mx-auto flex max-w-2xl gap-1 px-4 pt-2">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`border-b-2 px-3 pb-2 text-sm font-medium ${
                active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
