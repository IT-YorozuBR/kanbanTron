import { getOrCreateDefaultBoard } from "@/lib/actions";
import { BoardLoader } from "@/components/board/board-loader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const board = await getOrCreateDefaultBoard();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
      <header className="aero-glass flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">{board.title}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Arraste os cards entre as fases e anexe imagens diretamente no card.
          </p>
        </div>
      </header>
      <BoardLoader boardId={board.id} initialColumns={board.columns} />
    </main>
  );
}
