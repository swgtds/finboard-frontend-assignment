'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Widget } from './Widget';
import { AnimatedWidget } from './AnimatedWidget';
import type { WidgetConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface SortableWidgetProps {
  widget: WidgetConfig;
}

const getWidgetSizeClass = (widget: WidgetConfig) => {
  switch (widget.type) {
    case 'card':
      return 'col-span-1';
    case 'table':
      return 'col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-4';
    case 'chart':
      return 'col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-3';
    default:
      return 'col-span-1';
  }
};

export function SortableWidget({ widget }: SortableWidgetProps) {
  const [isNewWidget, setIsNewWidget] = useState(false);
  
  useEffect(() => {
    // Check if widget was created in the last 500ms to trigger animation
    const widgetId = widget.id;
    const timestamp = parseInt(widgetId.split('_').pop() || '0');
    const isRecent = Date.now() - timestamp < 500;
    
    if (isRecent) {
      setIsNewWidget(true);
      const timer = setTimeout(() => setIsNewWidget(false), 600);
      return () => clearTimeout(timer);
    }
  }, [widget.id]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sizeClass = getWidgetSizeClass(widget);

  const widgetContent = (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn('cursor-move', sizeClass)}
    >
      <Widget widget={widget} />
    </div>
  );

  return isNewWidget ? (
    <AnimatedWidget delay={0}>
      {widgetContent}
    </AnimatedWidget>
  ) : (
    widgetContent
  );
}