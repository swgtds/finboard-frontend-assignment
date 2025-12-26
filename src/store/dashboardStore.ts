"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { WidgetConfig } from "@/lib/types";

type DashboardState = {
  widgets: WidgetConfig[];
};

type DashboardActions = {
  addWidget: (widget: WidgetConfig) => void;
  updateWidget: (widgetId: string, updatedConfig: Partial<WidgetConfig>) => void;
  removeWidget: (widgetId: string) => void;
  setWidgets: (widgets: WidgetConfig[]) => void;
  reorderWidgets: (activeId: string, overId: string) => void;
};

const initialState: DashboardState = {
  widgets: [],
};

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  persist(
    immer((set) => ({
      ...initialState,
      addWidget: (widget) =>
        set((state) => {
          state.widgets.push(widget);
        }),
      updateWidget: (widgetId, updatedConfig) =>
        set((state) => {
          const widgetIndex = state.widgets.findIndex((w) => w.id === widgetId);
          if (widgetIndex !== -1) {
            state.widgets[widgetIndex] = {
              ...state.widgets[widgetIndex],
              ...updatedConfig,
            } as WidgetConfig;
          }
        }),
      removeWidget: (widgetId) =>
        set((state) => {
          state.widgets = state.widgets.filter((w) => w.id !== widgetId);
        }),
      setWidgets: (widgets) =>
        set((state) => {
          state.widgets = widgets;
        }),
      reorderWidgets: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.widgets.findIndex((widget) => widget.id === activeId);
          const newIndex = state.widgets.findIndex((widget) => widget.id === overId);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const [reorderedWidget] = state.widgets.splice(oldIndex, 1);
            state.widgets.splice(newIndex, 0, reorderedWidget);
          }
        }),
    })),
    {
      name: "finboard-dashboard-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
