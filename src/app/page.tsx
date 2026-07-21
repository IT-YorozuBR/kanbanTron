import { requireUser } from "@/lib/auth";
import { listSectors } from "@/lib/auth-actions";
import { listBoards } from "@/lib/actions";
import { BoardsList } from "@/components/boards/boards-list";
import { UserMenu } from "@/components/auth/user-menu";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  const [boards, sectors] = await Promise.all([listBoards(), user.role === "admin" ? listSectors() : null]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
      <header className="aero-glass flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Meus quadros</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Crie quantos quadros kanban precisar, cada um com seu proprio nome e cor.
          </p>
        </div>
        <UserMenu user={user} />
      </header>
      <BoardsList initialBoards={boards} sectors={sectors} currentUser={{ id: user.id, role: user.role }} />
    </main>
  );
}
