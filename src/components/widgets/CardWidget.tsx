
"use client";

import type { CardWidgetConfig, WidgetConfig } from "@/lib/types";
import get from "lodash/get";

type CardWidgetProps = {
  data: any;
  config: WidgetConfig & CardWidgetConfig;
};

export function CardWidget({ data, config }: CardWidgetProps) {
  return (
    <div className="grid gap-4 grid-cols-2 flex-1 items-center">
      {config.items.map((item, index) => {
        const value = get(data, item.valuePath);
        return (
          <div key={index} className="flex flex-col overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{item.label}</p>
            <p className="text-2xl font-bold break-words">
              {item.prefix}
              {typeof value === "number" ? value.toLocaleString() : String(value)}
              {item.suffix}
            </p>
          </div>
        );
      })}
    </div>
  );
}
