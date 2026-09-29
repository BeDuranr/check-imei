"use client";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark = root.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // sin almacenamiento: el cambio dura hasta recargar
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-card hover:text-fg"
      aria-label="Cambiar modo claro/oscuro"
      title="Cambiar modo claro/oscuro"
    >
      <span className="dark:hidden">☾</span>
      <span className="hidden dark:inline">☀</span>
    </button>
  );
}
