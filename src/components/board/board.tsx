"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { moveCard, reorderColumns } from "@/lib/actions";
import type { CardWithAttachments, ColumnWithCards } from "@/lib/types";
import { ColumnView } from "@/components/board/column";
import { CardPreview } from "@/components/board/card-item";
import { NewColumnForm } from "@/components/board/new-column-form";
import { CardModal } from "@/components/board/card-modal";

export function Board({ boardId, initialColumns }: { boardId: string; initialColumns: ColumnWithCards[] }) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeCard, setActiveCard] = useState<CardWithAttachments | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Snapshot taken at drag start so we can roll back if the server rejects the move.
  const dragSnapshot = useRef<ColumnWithCards[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const openCard = useMemo(
    () => columns.flatMap((c) => c.cards).find((c) => c.id === openCardId) ?? null,
    [columns, openCardId],
  );

  function findColumnOf(cardId: string): ColumnWithCards | undefined {
    return columns.find((col) => col.cards.some((card) => card.id === cardId));
  }

  function handleDragStart(event: DragStartEvent) {
    dragSnapshot.current = columns;
    const data = event.active.data.current;
    if (data?.type === "card") setActiveCard(data.card as CardWithAttachments);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current;
    if (activeData?.type !== "card") return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const overData = over.data.current;
    const sourceColumn = findColumnOf(activeId);
    if (!sourceColumn) return;

    const destColumnId =
      overData?.type === "card" ? (overData.card as CardWithAttachments).columnId : overId;

    if (sourceColumn.id === destColumnId && overData?.type !== "card") return;

    setColumns((prev) => {
      const from = prev.find((c) => c.cards.some((card) => card.id === activeId));
      const to = prev.find((c) => c.id === destColumnId);
      if (!from || !to) return prev;

      const moving = from.cards.find((card) => card.id === activeId);
      if (!moving) return prev;

      if (from.id === to.id) {
        const oldIndex = from.cards.findIndex((c) => c.id === activeId);
        const newIndex = from.cards.findIndex((c) => c.id === overId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const reordered = arrayMove(from.cards, oldIndex, newIndex);
        return prev.map((c) => (c.id === from.id ? { ...c, cards: reordered } : c));
      }

      const fromCards = from.cards.filter((c) => c.id !== activeId);
      const insertIndex =
        overData?.type === "card" ? to.cards.findIndex((c) => c.id === overId) : to.cards.length;
      const toCards = [...to.cards];
      const movedCard = { ...moving, columnId: to.id };
      toCards.splice(insertIndex === -1 ? to.cards.length : insertIndex, 0, movedCard);

      return prev.map((c) => {
        if (c.id === from.id) return { ...c, cards: fromCards };
        if (c.id === to.id) return { ...c, cards: toCards };
        return c;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) {
      dragSnapshot.current = null;
      return;
    }

    const activeData = active.data.current;

    if (activeData?.type === "column") {
      const activeId = active.id as string;
      const overId = over.id as string;
      if (activeId !== overId) {
        const oldIndex = columns.findIndex((c) => c.id === activeId);
        const newIndex = columns.findIndex((c) => c.id === overId);
        const reordered = arrayMove(columns, oldIndex, newIndex);
        setColumns(reordered);
        startTransition(async () => {
          const res = await reorderColumns({
            boardId,
            orderedColumnIds: reordered.map((c) => c.id),
          });
          if (!res.ok) router.refresh();
        });
      }
      dragSnapshot.current = null;
      return;
    }

    if (activeData?.type === "card") {
      const activeId = active.id as string;
      const destColumn = findColumnOf(activeId);
      if (destColumn) {
        const orderedCardIds = destColumn.cards.map((c) => c.id);
        startTransition(async () => {
          const res = await moveCard({ cardId: activeId, toColumnId: destColumn.id, orderedCardIds });
          if (!res.ok) router.refresh();
        });
      }
    }

    dragSnapshot.current = null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="aero-scroll flex h-full items-start gap-5 overflow-x-auto pb-6">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map((column) => (
            <ColumnView
              key={column.id}
              column={column}
              onColumnsChange={setColumns}
              onOpenCard={setOpenCardId}
            />
          ))}
        </SortableContext>
        <NewColumnForm boardId={boardId} onCreated={(col) => setColumns((prev) => [...prev, col])} />
      </div>
      <DragOverlay>{activeCard ? <CardPreview card={activeCard} overlay /> : null}</DragOverlay>
      {openCard ? (
        <CardModal
          card={openCard}
          columns={columns}
          onClose={() => setOpenCardId(null)}
          onColumnsChange={setColumns}
        />
      ) : null}
    </DndContext>
  );
}
