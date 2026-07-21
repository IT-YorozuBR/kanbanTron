"use client";

import dynamic from "next/dynamic";
import type { ColumnWithCards } from "@/lib/types";

// Board relies on dnd-kit, which assigns internal a11y ids at mount time;
// those counters can diverge between the SSR pass and hydration, so the
// interactive board is rendered client-side only.
const Board = dynamic(() => import("@/components/board/board").then((mod) => mod.Board), {
  ssr: false,
  loading: () => (
    <div className="flex h-40 items-center justify-center text-sm text-black/50 dark:text-white/50">
      Carregando quadro...
    </div>
  ),
});

export function BoardLoader(props: { boardId: string; initialColumns: ColumnWithCards[] }) {
  return <Board {...props} />;
}
