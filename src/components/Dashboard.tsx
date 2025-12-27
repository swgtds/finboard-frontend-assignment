"use client";

import { useDashboardStore } from "@/store/dashboardStore";
import { Widget } from "./Widget";
import { SortableWidget } from "./SortableWidget";
import type { WidgetConfig } from "@/lib/types";
import { Button } from "./ui/button";
import { WidgetBuilderModal } from "./WidgetBuilderModal";
import { TemplatesSidebar } from "./TemplatesSidebar";
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
import { PlusCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Dashboard() {
  const { widgets, reorderWidgets, addWidget } = useDashboardStore();
  const [activeWidget, setActiveWidget] = useState<WidgetConfig | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

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

  const handleTemplateDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleTemplateDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleTemplateDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const template = JSON.parse(e.dataTransfer.getData('application/json'));
      const newWidget: WidgetConfig = {
        ...template.config,
        id: `widget_${Math.random().toString(36).substring(2)}_${Date.now()}`,
      } as WidgetConfig;
      
      addWidget(newWidget);
      
      toast({
        title: "Widget Added",
        description: `${template.name} has been added to your dashboard.`,
      });
    } catch (error) {
      console.error('Failed to parse dropped template:', error);
      toast({
        title: "Error",
        description: "Failed to add widget. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  if (widgets.length === 0) {
    return (
        <div 
          className={`flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm transition-colors ${
            isDragOver ? 'border-primary bg-primary/5' : ''
          }`}
          onDragOver={handleTemplateDragOver}
          onDragLeave={handleTemplateDragLeave}
          onDrop={handleTemplateDrop}
        >
            <div className="flex flex-col items-center gap-4 text-center">
                <h3 className="text-2xl font-bold tracking-tight">Your finance dashboard is empty</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your financial API or pick a built-in template to get started.
                  {isDragOver && " Drop template here to add it!"}
                </p>
                <div className="flex gap-2 flex-wrap justify-center">
                  <TemplatesSidebar>
                    <Button variant="outline" size="lg">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Browse Templates
                    </Button>
                  </TemplatesSidebar>
                  <WidgetBuilderModal>
                    <Button size="lg">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Custom Widget
                    </Button>
                  </WidgetBuilderModal>
                </div>
            </div>
        </div>
    )
  }

  return (
    <div
      onDragOver={handleTemplateDragOver}
      onDragLeave={handleTemplateDragLeave}
      onDrop={handleTemplateDrop}
      className={`transition-colors rounded-lg ${isDragOver ? 'bg-primary/5' : ''}`}
    >
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
    </div>
  );
}
