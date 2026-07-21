import { listBoards } from "@/lib/actions";
import { BoardsList } from "@/components/boards/boards-list";

export const dynamic = "force-dynamic";

export default async function Home() {
  const boards = await listBoards();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
      <header className="aero-glass px-6 py-4">
        <h1 className="text-xl font-extrabold tracking-tight">Meus quadros</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Crie quantos quadros kanban precisar, cada um com seu proprio nome e cor.
        </p>
      </header>
      <BoardsList initialBoards={boards} />
    </main>
  );
}
