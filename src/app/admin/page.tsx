import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listAllUsers, listSectors } from "@/lib/auth-actions";
import { CreateSectorForm } from "@/components/auth/create-sector-form";
import { CreateUserForm } from "@/components/auth/create-user-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const [sectors, users] = await Promise.all([listSectors(), listAllUsers()]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
      <header className="aero-glass flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Administracao</h1>
          <p className="text-sm text-black/60 dark:text-white/60">Setores e contas de usuario.</p>
        </div>
        <Link href="/" className="aero-button aero-button-ghost text-xs">
          Voltar aos quadros
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="aero-glass p-5">
          <h2 className="mb-3 text-base font-bold">Setores</h2>
          <CreateSectorForm />
          <ul className="mt-4 flex flex-col gap-2">
            {sectors.map((sector) => (
              <li key={sector.id} className="aero-card px-3 py-2 text-sm font-medium">
                {sector.name}
              </li>
            ))}
            {sectors.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50">Nenhum setor criado ainda.</p>
            ) : null}
          </ul>
        </section>

        <section className="aero-glass p-5">
          <h2 className="mb-3 text-base font-bold">Usuarios</h2>
          <CreateUserForm sectors={sectors} />
          <ul className="mt-4 flex flex-col gap-2">
            {users.map((u) => (
              <li key={u.id} className="aero-card flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-medium">{u.email}</span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {u.role === "admin" ? "Administrador" : u.sector?.name ?? "Sem setor"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
