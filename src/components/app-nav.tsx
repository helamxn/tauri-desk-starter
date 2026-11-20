import { Link, useLocation } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { SECTIONS } from "@/features/sections";

/** Navegación de la barra: un enlace por sección con aspecto de botón pequeño; la activa, «secondary». */
export function AppNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Sections" className="flex items-center gap-1">
      {SECTIONS.map((s) => {
        const active = pathname === s.to;
        return (
          <Link
            key={s.to}
            to={s.to}
            aria-current={active ? "page" : undefined}
            className={buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" })}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
