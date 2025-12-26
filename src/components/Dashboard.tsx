"use client";

import { useDashboardStore } from "@/store/dashboardStore";
import { Widget } from "./Widget";
import { SortableWidget } from "./SortableWidget";
import type { WidgetConfig } from "@/lib/types";
import { Button } from "./ui/button";
import { WidgetBuilderModal } from "./WidgetBuilderModal";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';

export function Dashboard() {
  const { widgets, reorderWidgets } = useDashboardStore();
  const [activeWidget, setActiveWidget] = useState<WidgetConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const widget = widgets.find((w) => w.id === active.id);
    setActiveWidget(widget || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      reorderWidgets(active.id as string, over.id as string);
    }
    
    setActiveWidget(null);
  };
  
  if (widgets.length === 0) {
    return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-4 text-center">
                <h3 className="text-2xl font-bold tracking-tight">You have no widgets</h3>
                <p className="text-sm text-muted-foreground">Get started by adding a new widget to your dashboard.</p>
                <WidgetBuilderModal>
                    <Button>Add Widget</Button>
                </WidgetBuilderModal>
            </div>
        </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-4 auto-rows-min grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {widgets.map((widget) => (
            <SortableWidget key={widget.id} widget={widget} />
          ))}
        </div>
      </SortableContext>
      
      <DragOverlay>
        {activeWidget && (
          <div className="opacity-50 rotate-2 transform scale-105">
            <Widget widget={activeWidget} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
