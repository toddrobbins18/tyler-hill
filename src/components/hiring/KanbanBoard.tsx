import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { StaffMember, HiringStatus } from "@/types/staff";
import { KanbanColumn } from "./KanbanColumn";
import { StaffCard } from "./StaffCard";

interface KanbanBoardProps {
  staff: StaffMember[];
  onStaffUpdate: (staff: StaffMember[]) => void;
}

const columns: { status: HiringStatus; title: string }[] = [
  { status: "to-hire", title: "To Hire" },
  { status: "interviewing", title: "Interviewing" },
  { status: "offered", title: "Offered" },
  { status: "hired", title: "Hired" },
];

export function KanbanBoard({ staff, onStaffUpdate }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }

    const staffId = active.id as string;
    const newStatus = over.id as HiringStatus;

    if (columns.some((col) => col.status === newStatus)) {
      const updatedStaff = staff.map((member) =>
        member.id === staffId ? { ...member, status: newStatus } : member
      );
      onStaffUpdate(updatedStaff);
    }

    setActiveId(null);
  };

  const activeStaff = activeId ? staff.find((s) => s.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            title={column.title}
            staff={staff.filter((s) => s.status === column.status)}
          />
        ))}
      </div>

      <DragOverlay>{activeStaff && <StaffCard staff={activeStaff} />}</DragOverlay>
    </DndContext>
  );
}
