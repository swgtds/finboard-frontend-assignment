
"use client";

import type { CardWidgetConfig, WidgetConfig } from "@/lib/types";
import get from "lodash/get";

type CardWidgetProps = {
  data: any;
  config: WidgetConfig & CardWidgetConfig;
};

export function CardWidget({ data, config }: CardWidgetProps) {
  const itemCount = config.items.length;

  const gridCols = itemCount === 1 
    ? 'grid-cols-1' 
    : 'grid-cols-1 sm:grid-cols-2';
  
  return (
    <div className={`grid gap-3 lg:gap-4 ${gridCols} flex-1 p-3 lg:p-4 h-full place-content-start items-start select-text`}>
      {config.items.map((item, index) => {
        const value = get(data, item.valuePath);
        const formattedValue = typeof value === "number" ? value.toLocaleString() : String(value);
        
        return (
          <div key={index} className="flex flex-col space-y-1 min-w-0 select-text">
            <div className="flex items-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide break-words line-clamp-2 leading-tight select-text">
                {item.label}
              </p>
            </div>
            <div className="flex flex-wrap items-baseline gap-1 min-w-0">
              {item.prefix && (
                <span className="text-xs lg:text-sm font-medium text-muted-foreground flex-shrink-0 select-text">
                  {item.prefix}
                </span>
              )}
              <p className="text-lg lg:text-xl xl:text-2xl font-bold text-foreground tracking-tight break-all min-w-0 flex-1 select-text">
                {formattedValue}
              </p>
              {item.suffix && (
                <span className="text-xs lg:text-sm font-medium text-muted-foreground flex-shrink-0 select-text">
                  {item.suffix}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
