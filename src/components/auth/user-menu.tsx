import Link from "next/link";
import { logout } from "@/lib/auth-actions";
import type { SessionUser } from "@/lib/auth";

export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right text-xs leading-tight">
        <p className="font-semibold">{user.email}</p>
        <p className="text-black/50 dark:text-white/50">
          {user.role === "admin" ? "Administrador" : user.sectorName ?? "Sem setor"}
        </p>
      </div>
      {user.role === "admin" ? (
        <Link href="/admin" className="aero-button aero-button-ghost text-xs">
          Administracao
        </Link>
      ) : (
        <Link href="/team" className="aero-button aero-button-ghost text-xs">
          Equipe
        </Link>
      )}
      <form action={logout}>
        <button type="submit" className="aero-button aero-button-berry text-xs">
          Sair
        </button>
      </form>
    </div>
  );
}
