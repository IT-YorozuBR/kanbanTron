import { notFound } from "next/navigation";
import { getBoard } from "@/lib/actions";
import { BoardLoader } from "@/components/board/board-loader";
import { BoardHeader } from "@/components/board/board-header";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const board = await getBoard(boardId);

  if (!board) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
      <BoardHeader board={{ id: board.id, title: board.title, accent: board.accent }} />
      <BoardLoader boardId={board.id} initialColumns={board.columns} />
    </main>
  );
}
