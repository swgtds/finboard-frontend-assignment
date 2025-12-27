"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStore } from "@/store/dashboardStore";
import { widgetTemplates, WidgetTemplate } from "@/lib/templates";
import { Layout, Sparkles, GripVertical, BarChart3, CreditCard, Table } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateId } from "@/lib/utils";
import type { WidgetConfig } from "@/lib/types";

interface TemplatesSidebarProps {
  children: React.ReactNode;
}

export function TemplatesSidebar({ children }: TemplatesSidebarProps) {
  const [open, setOpen] = useState(false);
  const { addWidget } = useDashboardStore();
  const { toast } = useToast();

  const getWidgetIcon = (type: string) => {
    switch (type) {
      case 'chart':
        return <BarChart3 className="w-4 h-4" />;
      case 'card':
        return <CreditCard className="w-4 h-4" />;
      case 'table':
        return <Table className="w-4 h-4" />;
      default:
        return <Layout className="w-4 h-4" />;
    }
  };

  const handleTemplateSelect = (template: WidgetTemplate) => {
    const newWidget: WidgetConfig = {
      ...template.config,
      id: generateId(),
    } as WidgetConfig;
    
    addWidget(newWidget);
    setOpen(false);
    
    toast({
      title: "Widget Added",
      description: `${template.name} has been added to your dashboard.`,
    });
  };

  const handleDragStart = (e: React.DragEvent, template: WidgetTemplate) => {
    e.dataTransfer.setData('application/json', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const categoryColors = {
    stocks: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    crypto: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    forex: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    commodities: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    indices: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    portfolio: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  };

  const groupedTemplates = widgetTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, WidgetTemplate[]>);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Widget Templates
          </SheetTitle>
          <SheetDescription>
            Click to add ready-made stock and crypto widgets.
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          <div className="space-y-6">
            {Object.entries(groupedTemplates).map(([category, templates]) => (
              <div key={category} className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </h3>
                <div className="grid gap-3">
                  {templates.map((template) => (
                    <Card
                      key={template.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, template)}
                      className="cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] relative group"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 transition-opacity">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl w-8 h-8 flex items-center justify-center bg-muted rounded">
                            {getWidgetIcon(template.config.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <CardTitle className="text-sm font-medium truncate">
                                {template.name}
                              </CardTitle>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${categoryColors[template.category]} shrink-0`}
                              >
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-xs line-clamp-2">
                          {template.description}
                        </CardDescription>
                        <div className="mt-2 pt-2 border-t">
                          <Button 
                            size="sm" 
                            className="w-full h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTemplateSelect(template);
                            }}
                          >
                            <Layout className="w-3 h-3 mr-1" />
                            Add Widget
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}