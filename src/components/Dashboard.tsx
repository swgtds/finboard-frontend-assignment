"use client";

import { useDashboardStore } from "@/store/dashboardStore";
import { Widget } from "./Widget";
import type { WidgetConfig } from "@/lib/types";
import { Button } from "./ui/button";
import { WidgetBuilderModal } from "./WidgetBuilderModal";


export function Dashboard() {
  const { widgets } = useDashboardStore();
  
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
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {widgets.map((widget) => (
        <Widget key={widget.id} widget={widget} />
      ))}
    </div>
  );
}
