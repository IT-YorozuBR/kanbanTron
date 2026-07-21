import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBoard } from "@/lib/actions";
import { BoardLoader } from "@/components/board/board-loader";
import { BoardHeader } from "@/components/board/board-header";
import { UserMenu } from "@/components/auth/user-menu";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const user = await requireUser();
  const { boardId } = await params;
  const board = await getBoard(boardId);

  if (!board) notFound();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-10">
      <BoardHeader
        board={{ id: board.id, title: board.title, accent: board.accent }}
        canDelete={user.role === "admin" || board.createdById === user.id}
      >
        <UserMenu user={user} />
      </BoardHeader>
      <BoardLoader boardId={board.id} initialColumns={board.columns} />
    </main>
  );
}
