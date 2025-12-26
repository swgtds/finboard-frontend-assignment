
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
      
      // For manual refresh on non-CoinGecko APIs, add cache-busting parameter
      if (isManualRefresh && !widget.apiUrl.includes('coingecko.com')) {
        proxyUrl += '&skipCache=true';
      }
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      setData(jsonData);
    } catch (e: any) {
      setError(e.message);
      console.error(`Failed to fetch data for widget ${widget.id}:`, e);
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

    switch (widget.type) {
      case "card":
        return <CardWidget data={data} config={widget} />;
      case "table":
        return <TableWidget data={widgetData} config={widget} />;
      case "chart":
        return <ChartWidget data={widgetData} config={widget} />;
      default:
        return null;
    }
  };

  return (
    <Card className="flex flex-col h-full group">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
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
              <CardTitle className="text-lg font-medium cursor-pointer leading-tight">{widget.title}</CardTitle>
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
      <CardContent className="flex-1 flex flex-col">
        {isInitialLoading ? (
          <Skeleton className="flex-1 w-full" />
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center text-destructive">
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
