import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listOwnSectorUsers } from "@/lib/auth-actions";
import { InviteUserForm } from "@/components/auth/invite-user-form";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireUser();
  if (user.role !== "member" || !user.sectorId) redirect("/");

  const users = await listOwnSectorUsers();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
      <header className="aero-glass flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Equipe de {user.sectorName}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">Convide outras pessoas para o seu setor.</p>
        </div>
        <Link href="/" className="aero-button aero-button-ghost text-xs">
          Voltar aos quadros
        </Link>
      </header>

      <section className="aero-glass max-w-md p-5">
        <h2 className="mb-3 text-base font-bold">Novo membro</h2>
        <InviteUserForm />
        <ul className="mt-4 flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="aero-card px-3 py-2 text-sm font-medium">
              {u.email}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
