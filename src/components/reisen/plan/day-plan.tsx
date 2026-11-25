"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BedDouble,
  Car,
  GripVertical,
  Lightbulb,
  MapPin,
  MoreVertical,
  Plane,
  Plus,
  StickyNote,
  Tent,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDayShort } from "@/lib/format";
import { placeAt } from "@/lib/ordering";
import type { ItemKind } from "@/lib/schemas/day-item";
import { cn } from "@/lib/utils";
import { moveDayItem } from "@/server/actions/day-items";
import type { PlanItem } from "@/server/trips/data";

import { ItemDialog, type EditTarget } from "./item-dialog";
import { detailText, isMultiDay, lastDay, timeText } from "./item-text";

const IDEAS = "ideas";
const ICONS: Record<ItemKind, LucideIcon> = {
  flight: Plane,
  transport: Car,
  lodging: BedDouble,
  campsite: Tent,
  game: Trophy,
  activity: MapPin,
  note: StickyNote,
};

type Columns = Record<string, string[]>;

function buildColumns(items: PlanItem[], days: string[]): Columns {
  const cols: Columns = { [IDEAS]: [] };
  for (const d of days) cols[d] = [];
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const key = item.day ?? IDEAS;
    (cols[key] ??= []).push(item.id);
  }
  return cols;
}

export function DayPlan({
  tripId,
  days,
  items: serverItems,
  canEdit,
}: {
  tripId: string;
  days: string[];
  items: PlanItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(serverItems);
  const [columns, setColumns] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dragging = useRef(false);

  // Server-Stand übernehmen (nach Speichern, Realtime-Refresh), aber nicht mitten im Ziehen.
  useEffect(() => {
    if (!dragging.current) setItems(serverItems);
  }, [serverItems]);

  useRealtimeRefresh("day_item", tripId);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const baseColumns = useMemo(() => buildColumns(items, days), [items, days]);
  const cols = columns ?? baseColumns;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function containerOf(id: string, from: Columns = cols) {
    if (id in from) return id;
    return Object.keys(from).find((k) => from[k].includes(id));
  }

  function commit(id: string, container: string, index: number) {
    const day = container === IDEAS ? null : container;
    const list = items
      .filter((i) => (i.day ?? IDEAS) === container && i.id !== id)
      .sort((a, b) => a.position - b.position);
    const { position, renumbered } = placeAt(list, id, index);
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) return { ...i, day, position };
        const r = renumbered?.find((x) => x.id === i.id);
        return r ? { ...i, position: r.position } : i;
      }),
    );
    setError(null);
    startTransition(async () => {
      const result = await moveDayItem({ tripId, id, day, index });
      if (!result.ok) {
        setError("Verschieben hat nicht geklappt.");
        router.refresh();
      }
    });
  }

  function onDragStart(e: DragStartEvent) {
    dragging.current = true;
    setActiveId(String(e.active.id));
    setColumns(baseColumns);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    setColumns((prev) => {
      if (!prev) return prev;
      const from = containerOf(id, prev);
      const to = containerOf(overId, prev);
      if (!from || !to || from === to) return prev;
      const target = prev[to];
      const overIndex = target.indexOf(overId);
      const at = overIndex >= 0 ? overIndex : target.length;
      return {
        ...prev,
        [from]: prev[from].filter((x) => x !== id),
        [to]: [...target.slice(0, at), id, ...target.slice(at)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const current = columns;
    dragging.current = false;
    setActiveId(null);
    setColumns(null);
    if (!over || !current) return;
    const to = containerOf(String(over.id), current);
    if (!to) return;
    let list = current[to];
    const oldIndex = list.indexOf(id);
    const overIndex = list.indexOf(String(over.id));
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
      list = arrayMove(list, oldIndex, overIndex);
    }
    const index = list.indexOf(id);
    const item = byId.get(id);
    if (!item) return;
    const original = baseColumns[item.day ?? IDEAS] ?? [];
    if ((item.day ?? IDEAS) === to && original.indexOf(id) === index) return;
    commit(id, to, index);
  }

  const containerLabel = (key: string) =>
    key === IDEAS ? "Ideen-Ablage" : formatDayShort(key);

  const renderList = (key: string) => {
    const ids = cols[key] ?? [];
    const bands =
      key === IDEAS
        ? []
        : items.filter(
            (i) =>
              isMultiDay(i) &&
              i.day !== null &&
              i.day < key &&
              key <= (lastDay(i) as string),
          );
    return (
      <Column
        id={key}
        ids={ids}
        canEdit={canEdit}
        empty={
          key === IDEAS
            ? "Ideen hier sammeln und später auf einen Tag ziehen."
            : "Noch nichts geplant"
        }
      >
        {bands.map((b) => (
          <li key={`band-${b.id}`}>
            <ItemCard
              item={b}
              onDay={key}
              band
              onEdit={
                canEdit ? () => setEditing({ item: b, day: b.day }) : undefined
              }
            />
          </li>
        ))}
        {ids.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          return (
            <SortableItem
              key={id}
              item={item}
              onDay={key === IDEAS ? undefined : key}
              canEdit={canEdit}
              onEdit={() => setEditing({ item, day: item.day })}
              menu={
                canEdit ? (
                  <MoveMenu
                    title={item.title}
                    containers={[IDEAS, ...days].filter((k) => k !== key)}
                    label={containerLabel}
                    canUp={index > 0}
                    canDown={index < ids.length - 1}
                    onMove={(to) =>
                      commit(
                        id,
                        to,
                        to === key ? index : (cols[to]?.length ?? 0),
                      )
                    }
                    onUp={() => commit(id, key, index - 1)}
                    onDown={() => commit(id, key, index + 1)}
                    onEdit={() => setEditing({ item, day: item.day })}
                  />
                ) : null
              }
            />
          );
        })}
      </Column>
    );
  };

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          dragging.current = false;
          setActiveId(null);
          setColumns(null);
        }}
      >
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr] lg:items-start">
          <details
            open
            className="rounded-lg border bg-muted/40 p-3 lg:sticky lg:top-4"
            aria-label="Ideen-Ablage"
          >
            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
              <Lightbulb className="size-4" aria-hidden />
              Ideen ({cols[IDEAS]?.length ?? 0})
            </summary>
            <div className="mt-3 space-y-2">
              {renderList(IDEAS)}
              {canEdit && (
                <AddButton
                  onClick={() => setEditing({ day: null })}
                  label="Idee"
                />
              )}
            </div>
          </details>

          <ol className="space-y-4">
            {days.map((day, i) => (
              <li key={day} aria-label={formatDayShort(day)}>
                <section className="space-y-2">
                  <h2 className="flex items-baseline gap-2 font-semibold">
                    {formatDayShort(day)}
                    <span className="text-sm font-normal text-muted-foreground">
                      Tag {i + 1}
                    </span>
                  </h2>
                  {renderList(day)}
                  {canEdit && (
                    <AddButton
                      onClick={() => setEditing({ day })}
                      label="Eintrag"
                    />
                  )}
                </section>
              </li>
            ))}
          </ol>
        </div>
        <DragOverlay>
          {active ? <ItemCard item={active} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {canEdit && (
        <ItemDialog
          tripId={tripId}
          days={days}
          target={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Column({
  id,
  ids,
  canEdit,
  empty,
  children,
}: {
  id: string;
  ids: string[];
  canEdit: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !canEdit });
  const hasContent = Array.isArray(children)
    ? children.some((c) => (Array.isArray(c) ? c.length > 0 : Boolean(c)))
    : Boolean(children);
  return (
    <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
      <ul
        ref={setNodeRef}
        data-container={id}
        className={cn(
          "min-h-12 space-y-2 rounded-md",
          isOver && "bg-accent/60 outline-2 outline-primary/40 outline-dashed",
        )}
      >
        {children}
        {!hasContent && (
          <li className="px-1 py-3 text-sm text-muted-foreground">{empty}</li>
        )}
      </ul>
    </SortableContext>
  );
}

function SortableItem({
  item,
  onDay,
  canEdit,
  onEdit,
  menu,
}: {
  item: PlanItem;
  onDay?: string;
  canEdit: boolean;
  onEdit: () => void;
  menu: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canEdit });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      data-item-title={item.title}
    >
      <ItemCard
        item={item}
        onDay={onDay}
        onEdit={canEdit ? onEdit : undefined}
        handle={
          canEdit ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              className="-my-1 -ml-1 flex size-9 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label={`${item.title} ziehen`}
              {...attributes}
              {...listeners}
            >
              <GripVertical className="size-4" />
            </button>
          ) : null
        }
        menu={menu}
      />
    </li>
  );
}

// Feste Farbe je Eintragsart (Design „Ostsee“, Tokens in globals.css).
function KindBadge({
  kind,
  Icon,
  small,
}: {
  kind: ItemKind;
  Icon: LucideIcon;
  small?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px]",
        small ? "size-6" : "size-8",
      )}
      style={{
        color: `var(--kind-${kind})`,
        backgroundColor: `var(--kind-${kind}-soft)`,
      }}
    >
      <Icon className="size-4" />
    </span>
  );
}

function ItemCard({
  item,
  onDay,
  band = false,
  dragging = false,
  handle,
  menu,
  onEdit,
}: {
  item: PlanItem;
  onDay?: string;
  band?: boolean;
  dragging?: boolean;
  handle?: React.ReactNode;
  menu?: React.ReactNode;
  onEdit?: () => void;
}) {
  const Icon = ICONS[item.kind];
  const time = item.day ? timeText(item, onDay) : null;
  const detail = detailText(item);
  const body = (
    <>
      <span className="flex items-start gap-3">
        <KindBadge kind={item.kind} Icon={Icon} small={band} />
        <span className="block min-w-0 flex-1">
          <span className="block truncate font-semibold">{item.title}</span>
          {time && <span className="block text-sm">{time}</span>}
          {detail && !band && (
            <span className="line-clamp-2 block text-sm text-muted-foreground">
              {detail}
            </span>
          )}
        </span>
      </span>
    </>
  );
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-2xl border border-card-border bg-card p-3 shadow-card",
        band && "border-dashed border-border bg-muted/60 py-2 shadow-none",
        dragging && "shadow-lg",
      )}
    >
      {handle}
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
          aria-label={`${item.title} bearbeiten`}
        >
          {body}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{body}</div>
      )}
      {item.url && !band && (
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm underline underline-offset-4"
        >
          Link
        </a>
      )}
      {menu}
    </div>
  );
}

function MoveMenu({
  title,
  containers,
  label,
  canUp,
  canDown,
  onMove,
  onUp,
  onDown,
  onEdit,
}: {
  title: string;
  containers: string[];
  label: (key: string) => string;
  canUp: boolean;
  canDown: boolean;
  onMove: (to: string) => void;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-my-1 -mr-1 size-9"
          aria-label={`Aktionen für ${title}`}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>Bearbeiten</DropdownMenuItem>
        <DropdownMenuItem disabled={!canUp} onSelect={onUp}>
          Nach oben
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canDown} onSelect={onDown}>
          Nach unten
        </DropdownMenuItem>
        <DropdownMenuLabel>Verschieben nach …</DropdownMenuLabel>
        {containers.map((key) => (
          <DropdownMenuItem key={key} onSelect={() => onMove(key)}>
            {label(key)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="text-muted-foreground"
    >
      <Plus aria-hidden />
      {label}
    </Button>
  );
}
