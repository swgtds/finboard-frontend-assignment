'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Widget } from './Widget';
import type { WidgetConfig } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SortableWidgetProps {
  widget: WidgetConfig;
}

// Define size classes for different widget types
const getWidgetSizeClass = (widget: WidgetConfig) => {
  switch (widget.type) {
    case 'card':
      // Card widgets are compact - take 1 column on mobile, 1-2 on larger screens
      return 'col-span-1';
    case 'table':
      // Table widgets need more space - span multiple columns
      return 'col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-4';
    case 'chart':
      // Chart widgets need medium to large space
      return 'col-span-1 sm:col-span-2 md:col-span-2 lg:col-span-2 xl:col-span-3';
    default:
      return 'col-span-1';
  }
};

export function SortableWidget({ widget }: SortableWidgetProps) {
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

  return (
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
}