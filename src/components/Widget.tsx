
"use client";

import { useEffect, useState, useCallback } from "react";
import get from "lodash/get";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Pencil, Trash2, RefreshCw } from "lucide-react";
import { CardWidget } from "./widgets/CardWidget";
import { TableWidget } from "./widgets/TableWidget";
import { ChartWidget } from "./widgets/ChartWidget";
import type { WidgetConfig } from "@/lib/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { WidgetBuilderModal } from "./WidgetBuilderModal";
import { cn } from "@/lib/utils";
import { shouldCacheApi } from "@/config/apiRateLimits";

type WidgetProps = {
  widget: WidgetConfig;
};

export function Widget({ widget }: WidgetProps) {
  const [data, setData] = useState<any>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(widget.title);
  const [showRefreshMessage, setShowRefreshMessage] = useState(false);
  
  const { removeWidget, updateWidget } = useDashboardStore();

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      // Use the proxy API to avoid CORS issues
      let proxyUrl = `/api/proxy?url=${encodeURIComponent(widget.apiUrl)}`;
      
      // For manual refresh on non-cached APIs, add cache-busting parameter
      if (isManualRefresh && !shouldCacheApi(widget.apiUrl)) {
        proxyUrl += '&skipCache=true';
      }
      
      console.log('Fetching from proxy:', proxyUrl);
      const response = await fetch(proxyUrl);
      
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        } catch (jsonError) {
          console.error('Failed to parse error response as JSON:', jsonError);
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      let jsonData;
      try {
        jsonData = await response.json();
        console.log('Successfully parsed JSON data for widget:', widget.id);
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        throw new Error('Invalid JSON response from API');
      }
      
      setData(jsonData);
    } catch (e: any) {
      console.error(`Failed to fetch data for widget ${widget.id}:`, e);
      setError(e.message || 'Unknown error occurred');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [widget.apiUrl, widget.id]);

  useEffect(() => {
    fetchData();
    if (widget.refreshInterval > 0) {
      const interval = setInterval(() => fetchData(false), widget.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchData, widget.refreshInterval]);

  const handleRefreshClick = () => {
    fetchData(true);
    if (widget.refreshInterval > 0) {
      setShowRefreshMessage(true);
      setTimeout(() => setShowRefreshMessage(false), 3000);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleTitleSave = () => {
    updateWidget(widget.id, { title });
    setIsEditingTitle(false);
  };

  const renderWidgetContent = () => {
    if (!data) return null;

    try {
      let widgetData;
      
      // Handle data transformation for table display
      if (widget.dataPath?.startsWith('__wrap_')) {
        // Handle object wrapping for table widgets
        if (widget.dataPath === '__wrap_object__') {
          // Wrap root object in array
          widgetData = Array.isArray(data) ? data : [data];
        } else {
          // Wrap object at specific path in array
          const pathToWrap = widget.dataPath.replace('__wrap_', '');
          const objectToWrap = get(data, pathToWrap, null);
          widgetData = objectToWrap ? (Array.isArray(objectToWrap) ? objectToWrap : [objectToWrap]) : [];
        }
      } else {
        // Normal path extraction
        widgetData = widget.dataPath ? get(data, widget.dataPath, data) : data;
      }

      console.log('Rendering widget type:', widget.type, 'with data:', widgetData);

      switch (widget.type) {
        case "card":
          return <CardWidget data={data} config={widget} />;
        case "table":
          return <TableWidget data={widgetData} config={widget} />;
        case "chart":
          return <ChartWidget data={widgetData} config={widget} />;
        default:
          console.warn('Unknown widget type:', (widget as any).type);
          return <div className="text-muted-foreground">Unknown widget type: {(widget as any).type}</div>;
      }
    } catch (renderError: any) {
      console.error('Error rendering widget content:', renderError);
      return (
        <div className="flex flex-1 flex-col items-center justify-center text-destructive">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p className="font-semibold">Rendering Error</p>
          <p className="text-xs">{renderError.message || 'Failed to render widget'}</p>
        </div>
      );
    }
  };

  // Get appropriate height class based on widget type
  const getWidgetHeightClass = () => {
    switch (widget.type) {
      case 'card':
        // Card widgets with flexible height to accommodate long values
        return 'h-auto min-h-[140px] sm:min-h-[160px] lg:min-h-[180px] max-h-fit';
      case 'table':
        // Table widgets need more height for rows
        return 'h-auto min-h-[400px]';
      case 'chart':
        // Chart widgets need medium height for visualization
        return 'h-auto min-h-[300px]';
      default:
        return 'h-auto min-h-[200px]';
    }
  };

  // Get card styling based on widget type
  const getCardStyling = () => {
    switch (widget.type) {
      case 'card':
        return 'bg-gradient-to-br from-card to-card/95 border-2 hover:border-primary/20 transition-all duration-300 hover:shadow-lg';
      case 'table':
        return 'bg-card border hover:border-primary/20 transition-all duration-300';
      case 'chart':
        return 'bg-card border hover:border-primary/20 transition-all duration-300';
      default:
        return 'bg-card border hover:border-primary/20 transition-all duration-300';
    }
  };

  return (
    <Card className={cn("flex flex-col group", getWidgetHeightClass(), getCardStyling())}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 px-4 pt-4">
        <div className="flex-1 mr-2 space-y-1">
          <div onDoubleClick={() => setIsEditingTitle(true)}>
            {isEditingTitle ? (
              <Input
                value={title}
                onChange={handleTitleChange}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                autoFocus
                className="h-8"
              />
            ) : (
              <CardTitle className="text-base lg:text-lg font-semibold cursor-pointer leading-tight text-foreground">
                {widget.title}
              </CardTitle>
            )}
          </div>
          {widget.refreshInterval > 0 && (
            <CardDescription className={cn("text-xs transition-opacity duration-300", showRefreshMessage ? 'opacity-100' : 'opacity-0')}>
              Auto-refreshes every {widget.refreshInterval} seconds
            </CardDescription>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefreshClick} disabled={isRefreshing}>
             <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <WidgetBuilderModal widgetToEdit={widget}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Pencil className="h-4 w-4" />
            </Button>
          </WidgetBuilderModal>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-500 hover:bg-red-500/10"
            onClick={() => removeWidget(widget.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

      </CardHeader>
      <CardContent className="flex-1 flex flex-col px-0 pb-4">
        {isInitialLoading ? (
          <Skeleton className="flex-1 w-full mx-4" />
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center text-destructive px-4">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="font-semibold">Error loading data</p>
            <p className="text-xs">{error}</p>
          </div>
        ) : (
          renderWidgetContent()
        )}
      </CardContent>
    </Card>
  );
}
