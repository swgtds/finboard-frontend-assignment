"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardStore } from "@/store/dashboardStore";
import type { WidgetConfig, WidgetType } from "@/lib/types";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { JsonViewer } from "./JsonViewer";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { get, set } from "lodash";
import { Trash2 } from "lucide-react";
import { getRateLimitConfig } from "@/config/apiRateLimits";

const baseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  apiUrl: z.string().url("Must be a valid URL"),
  refreshInterval: z.coerce.number().int().positive("Must be a positive number"),
  apiKey: z.string().optional(),
});

const cardSchema = baseSchema.extend({
  type: z.literal("card"),
  items: z.array(z.object({
    label: z.string().min(1, "Label is required"),
    valuePath: z.string().min(1, "Value path is required"),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  })).min(1, "Card widgets must have at least one item."),
  dataPath: z.string().optional(),
  columns: z.array(z.any()).optional(),
  categoryKey: z.string().optional(),
  valueKey: z.string().optional(),
});

const tableSchema = baseSchema.extend({
  type: z.literal("table"),
  dataPath: z.string().min(1, "Data Array Path is required for table widgets.").or(z.literal("")),
  columns: z.array(z.object({
    header: z.string().min(1, "Header is required"),
    dataPath: z.string().min(1, "Data path is required"),
  })).min(1, "Table widgets must have at least one column."),
  items: z.array(z.any()).optional(),
  categoryKey: z.string().optional(),
  valueKey: z.string().optional(),
});

const chartSchema = baseSchema.extend({
  type: z.literal("chart"),
  dataPath: z.string().min(1, "Data Array Path is required for chart widgets.").or(z.literal("")),
  categoryKey: z.string().min(1, "Category Key is required for chart widgets."),
  valueKey: z.string().min(1, "Value Key is required for chart widgets."),
  items: z.array(z.any()).optional(),
  columns: z.array(z.any()).optional(),
});

const formSchema = z.discriminatedUnion("type", [cardSchema, tableSchema, chartSchema]);

type WidgetBuilderFormValues = z.infer<typeof formSchema>;

type WidgetBuilderModalProps = {
  children: React.ReactNode;
  widgetToEdit?: WidgetConfig;
};

const getObjectKeys = (obj: any, prefix = "", isRootArray = false): string[] => {
    if (obj === null || typeof obj !== 'object') return [];

    if (Array.isArray(obj)) {
        if (obj.length > 0) {
            const firstItemKeys = getObjectKeys(obj[0], "", false);
            return firstItemKeys;
        }
        return [];
    }
    
    return Object.keys(obj).reduce((acc: string[], key: string) => {
        const hasSpecialChars = /[\s.]/.test(key);
        const newPrefix = prefix 
            ? (hasSpecialChars ? `${prefix}["${key}"]` : `${prefix}.${key}`)
            : (hasSpecialChars ? `["${key}"]` : key);
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            acc.push(...getObjectKeys(obj[key], newPrefix, false));
        } else {
            acc.push(newPrefix);
        }
        return acc;
    }, []);
};

// Get base field names from array data (without indices)
const getBaseFieldNames = (obj: any): string[] => {
    if (!Array.isArray(obj) || obj.length === 0) return [];
    
    const firstItem = obj[0];
    
    // Handle arrays of arrays (like [[timestamp, value], [timestamp, value]])
    if (Array.isArray(firstItem)) {
        // For arrays of arrays, create synthetic field names based on array indices
        return firstItem.map((_, index) => `[${index}]`);
    }
    
    // Handle regular object arrays
    return getObjectKeys(firstItem, "");
};

// Get all indexed paths for a specific field across all array items
const getIndexedPaths = (arr: any[], fieldName: string): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((_, index) => `${index}.${fieldName}`);
};

const getArrayPaths = (data: any, prefix = ''): string[] => {
    let paths: string[] = [];
    if (data === null || typeof data !== 'object') return [];

    if (Array.isArray(data)) {
        paths.push(prefix || ""); 
    }

    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const newPath = prefix ? `${prefix}.${key}` : key;
            if (Array.isArray(data[key])) {
                paths.push(newPath);
            } else if (typeof data[key] === 'object') {
                paths = paths.concat(getArrayPaths(data[key], newPath));
            }
        }
    }
    return paths;
};

// Get paths of objects that can be wrapped in arrays for table display
const getWrappableObjectPaths = (data: any, prefix = ''): string[] => {
    let paths: string[] = [];
    if (data === null || typeof data !== 'object') return [];

    // If it's an object (not array), it can be wrapped
    if (!Array.isArray(data) && Object.keys(data).length > 0) {
        paths.push(prefix || "__wrap_object__");
    }

    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const newPath = prefix ? `${prefix}.${key}` : key;
            if (!Array.isArray(data[key]) && typeof data[key] === 'object' && data[key] !== null) {
                paths.push(`__wrap_${newPath}`);
                paths = paths.concat(getWrappableObjectPaths(data[key], newPath));
            }
        }
    }
    return paths;
};


export function WidgetBuilderModal({ children, widgetToEdit }: WidgetBuilderModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testApiState, setTestApiState] = useState<{loading: boolean; data: any; error: string | null}>({
    loading: false,
    data: null,
    error: null,
  });
  const [lastRateLimitedRequest, setLastRateLimitedRequest] = useState<Map<string, number>>(new Map());

  const { addWidget, updateWidget } = useDashboardStore();
  const { toast } = useToast();

  const form = useForm<WidgetBuilderFormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
  });

  const resetState = () => {
    setStep(1);
    const defaultValues: WidgetBuilderFormValues = widgetToEdit ? {
      title: widgetToEdit.title,
      type: widgetToEdit.type,
      apiUrl: widgetToEdit.apiUrl,
      refreshInterval: widgetToEdit.refreshInterval,
      apiKey: widgetToEdit.apiKey || '',
      items: widgetToEdit.type === 'card' ? widgetToEdit.items : [],
      dataPath: (widgetToEdit.type === 'table' || widgetToEdit.type === 'chart') ? widgetToEdit.dataPath : '',
      columns: widgetToEdit.type === 'table' ? widgetToEdit.columns : [],
      categoryKey: widgetToEdit.type === 'chart' ? widgetToEdit.categoryKey : '',
      valueKey: widgetToEdit.type === 'chart' ? widgetToEdit.valueKey : '',
    } : {
      title: "",
      apiUrl: "",
      refreshInterval: 60,
      apiKey: "",
      type: "card" as WidgetType,
      items: [],
      dataPath: "",
      columns: [],
      categoryKey: "",
      valueKey: "",
    };
    form.reset(defaultValues as any);
    setTestApiState({ loading: false, data: null, error: null });
  }

  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open, widgetToEdit]);

  const { fields: cardItems, append: appendCardItem, remove: removeCardItem } = useFieldArray({ control: form.control, name: "items" });
  const { fields: tableColumns, append: appendTableColumn, remove: removeTableColumn } = useFieldArray({ control: form.control, name: "columns" });

  const widgetType = form.watch("type");
  const dataPath = form.watch('dataPath');
  
  const arrayPaths = testApiState.data ? Array.from(new Set(getArrayPaths(testApiState.data))) : [];
  const wrappableObjectPaths = testApiState.data ? Array.from(new Set(getWrappableObjectPaths(testApiState.data))) : [];
  const allAvailablePaths = [...arrayPaths, ...wrappableObjectPaths];
  
  const selectedDataPath = dataPath === '__root__' ? '' : dataPath;

  let dataForKeys;
  if (widgetType === 'table' || widgetType === 'chart') {
    if (selectedDataPath === '__wrap_object__') {
      const rootData = testApiState.data;
      dataForKeys = Array.isArray(rootData) ? rootData : [rootData];
    } else if (selectedDataPath?.startsWith('__wrap_')) {
      const pathToWrap = selectedDataPath.replace('__wrap_', '');
      const objectToWrap = get(testApiState.data, pathToWrap);
      dataForKeys = Array.isArray(objectToWrap) ? objectToWrap : [objectToWrap];
    } else if ((selectedDataPath === '' || selectedDataPath === undefined || !dataPath) && Array.isArray(testApiState.data)) {
      // If no dataPath is set but we have a root-level array, use it directly
      dataForKeys = testApiState.data;
    } else if (selectedDataPath === '' || selectedDataPath === undefined) {
      // Root level data
      dataForKeys = testApiState.data;
    } else {
      // Nested data
      dataForKeys = get(testApiState.data, selectedDataPath);
    }
  } else {
    dataForKeys = testApiState.data;
  }

  // For widgets with array data, show base field names (without indices)
  let apiDataKeys: string[] = [];
  if (Array.isArray(dataForKeys)) {
    apiDataKeys = Array.from(new Set(getBaseFieldNames(dataForKeys)));
  } else {
    apiDataKeys = dataForKeys ? Array.from(new Set(getObjectKeys(dataForKeys, ""))) : [];
  }


  const handleTestApiAndNext = async () => {
    const apiUrl = form.getValues("apiUrl");
    const apiKey = form.getValues("apiKey");
    if (!apiUrl) {
      form.setError("apiUrl", { type: "manual", message: "API URL is required to test." });
      return;
    }

    // Client-side rate limiting - for any configured API
    const now = Date.now();
    const rateLimitConfig = getRateLimitConfig(apiUrl);
    
    if (rateLimitConfig) {
      const lastRequest = lastRateLimitedRequest.get(rateLimitConfig.domain) || 0;
      if (now - lastRequest < 2000) { // 2 second minimum delay
        setTestApiState({ 
          loading: false, 
          data: null, 
          error: `Please wait at least 2 seconds between ${rateLimitConfig.domain} requests to avoid rate limiting.` 
        });
        return;
      }
      
      // Update the timestamp for this domain
      setLastRateLimitedRequest(prev => new Map(prev).set(rateLimitConfig.domain, now));
    }

    const isValid = await form.trigger(["title", "type", "apiUrl", "refreshInterval"]);
    if (!isValid) return;

    setTestApiState({ loading: true, data: null, error: null });
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(apiUrl)}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`;
      console.log('Testing API:', { apiUrl, proxyUrl, hasApiKey: !!apiKey });
      
      const res = await fetch(proxyUrl);
      console.log('Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        let errorMessage = errorData.error || `Request failed with status ${res.status}`;
        
        // Enhanced error handling for common API authentication issues
        if (res.status === 401) {
          if (!apiKey) {
            errorMessage = "API key required. This API requires authentication. Please enter your API key in the field above.";
          } else {
            errorMessage = "Invalid API key. Please check your API key and try again.";
          }
        } else if (res.status === 403) {
          if (!apiKey) {
            errorMessage = "Access forbidden. This API may require an API key for authentication. Please enter your API key if you have one.";
          } else {
            errorMessage = "Access forbidden. Your API key may not have permission to access this endpoint, or you may have exceeded your quota.";
          }
        } else if (res.status === 400) {
          if (!apiKey && errorMessage.toLowerCase().includes('unauthorized')) {
            errorMessage = "Bad request - API key may be required. Please enter your API key if this API requires authentication.";
          } else if (!apiKey && (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('authentication'))) {
            errorMessage = "API key required. This API requires authentication. Please enter your API key in the field above.";
          }
        } else if (res.status === 429) {
          errorMessage = "Rate limit exceeded. Please wait before making another request.";
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      console.log('API data received:', data);
      
      // Auto-select the best data path for table and chart widgets
      if (widgetType === 'table' || widgetType === 'chart') {
        const detectedArrayPaths = Array.from(new Set(getArrayPaths(data)));
        const detectedWrappablePaths = Array.from(new Set(getWrappableObjectPaths(data)));
        
        let autoSelectedPath = '';
        
        if (detectedArrayPaths.length > 0) {
          // Prefer arrays over objects
          // If there's a root array, use it; otherwise use the first array found
          if (detectedArrayPaths.includes('')) {
            autoSelectedPath = '__root__';
          } else {
            // Choose the shortest/most direct array path
            autoSelectedPath = detectedArrayPaths.sort((a, b) => a.length - b.length)[0];
          }
        } else if (detectedWrappablePaths.length > 0) {
          // If no arrays found, use the first wrappable object
          // Prefer root object over nested objects
          if (detectedWrappablePaths.includes('__wrap_object__')) {
            autoSelectedPath = '__wrap_object__';
          } else {
            autoSelectedPath = detectedWrappablePaths[0];
          }
        }
        
        if (autoSelectedPath) {
          console.log('Auto-selecting data path:', autoSelectedPath);
          form.setValue('dataPath', autoSelectedPath === '__root__' ? '' : autoSelectedPath);
          
          // For chart widgets, also auto-select categoryKey and valueKey if data is array of arrays
          if (widgetType === 'chart') {
            let dataToCheck = data;
            if (autoSelectedPath !== '__root__' && !autoSelectedPath.startsWith('__wrap_')) {
              dataToCheck = get(data, autoSelectedPath);
            }
            
            // Check if this is an array of arrays (like [[timestamp, value]])
            if (Array.isArray(dataToCheck) && dataToCheck.length > 0 && Array.isArray(dataToCheck[0])) {
              // Auto-select [0] for category (X-axis, typically timestamp) and [1] for value (Y-axis)
              form.setValue('categoryKey', '[0]');
              form.setValue('valueKey', '[1]');
              
              console.log('Auto-selected chart keys: categoryKey=[0], valueKey=[1]');
              toast({ 
                title: 'Chart Configuration Auto-Selected', 
                description: 'Detected time-series data format. X-axis set to timestamps, Y-axis set to values.',
              });
            }
          }
          
          // Show a toast notification about auto-selection
          toast({ 
            title: 'Data Path Auto-Selected', 
            description: `Automatically selected "${autoSelectedPath === '__root__' ? '(root array)' : autoSelectedPath.replace('__wrap_', '').replace('_object__', ' object')}" as the data source.`,
          });
        }
      }
      
      setTestApiState({ loading: false, data, error: null });
      setStep(2);
    } catch (e: any) {
      console.error('API test error:', e);
      let errorMessage = e.message || 'Failed to fetch data. Please check the URL and try again.';
      
      // Handle specific rate limiting errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit')) {
        errorMessage = errorMessage + ' Try using cached data or wait before testing again.';
      }
      
      setTestApiState({ loading: false, data: null, error: errorMessage });
    }
  };

  const onSubmit = (values: WidgetBuilderFormValues) => {
    const id = widgetToEdit ? widgetToEdit.id : `widget-${Date.now()}`;
    
    const finalValues = { ...values };
    if ((finalValues.type === 'table' || finalValues.type === 'chart') && finalValues.dataPath === '__root__') {
      finalValues.dataPath = '';
    }
    
    // Keep the transformation paths as-is - they will be handled by the Widget component
    // The __wrap_ prefixed paths will be processed during data fetching

    if(widgetToEdit) {
        updateWidget(id, finalValues);
        toast({ title: 'Widget Updated', description: `Widget "${values.title}" has been updated.` });
    } else {
        addWidget({ ...finalValues, id });
        toast({ title: 'Widget Added', description: `New widget "${values.title}" created.` });
    }
    
    setOpen(false);
  };
  
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="title" render={({ field }) => (
            <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="type" render={({ field }) => (
          <FormItem><FormLabel>Widget Type</FormLabel>
            <Select onValueChange={(value) => {
                const currentValues = form.getValues();
                form.reset({
                  ...currentValues,
                  type: value as WidgetType,
                  items: value === 'card' ? currentValues.items || [] : [],
                  dataPath: value !== 'card' ? currentValues.dataPath || '' : '',
                  columns: value === 'table' ? currentValues.columns || [] : [],
                  categoryKey: value === 'chart' ? currentValues.categoryKey || '' : '',
                  valueKey: value === 'chart' ? currentValues.valueKey || '' : '',
                }, { keepDefaultValues: true });
                form.clearErrors();
            }} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="chart">Chart</SelectItem>
              </SelectContent>
            </Select><FormMessage />
          </FormItem>
        )} />
      </div>
      
      <FormField control={form.control} name="apiUrl" render={({ field }) => (
        <FormItem><FormLabel>API URL</FormLabel><FormControl><Input {...field} placeholder="https://api.example.com/data" /></FormControl><FormMessage /></FormItem>
      )} />

      <FormField control={form.control} name="apiKey" render={({ field }) => (
        <FormItem>
          <FormLabel>API Key (if required as header)</FormLabel>
          <FormControl>
            <div className="relative">
              <Input 
                {...field} 
                placeholder="Enter API key if required (will be sent as X-Api-Key header)" 
                type={showApiKey ? "text" : "password"} 
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </FormControl>
          <FormDescription>
            Optional. Some APIs require an API key to be sent in the X-Api-Key header.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )} />

       <FormField control={form.control} name="refreshInterval" render={({ field }) => (
        <FormItem><FormLabel>Refresh Interval (seconds)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
      )} />

      {testApiState.error && <p className="text-sm text-destructive">{testApiState.error}</p>}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="mb-4 -ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
        </Button>

        {testApiState.data && <JsonViewer data={testApiState.data} />}

        {widgetType === "card" && (
            <div className="space-y-4 rounded-md border p-4 mt-4">
            <h3 className="font-medium">Card Items</h3>
            {apiDataKeys.length > 0 ? (
                <FormItem>
                    <FormLabel>Select fields to display</FormLabel>
                     <FormField
                        control={form.control}
                        name="items"
                        render={() => (
                           <FormItem>
                              <ScrollArea className="h-32">
                              <div className="space-y-2">
                                  {apiDataKeys.map((key) => (
                                  <FormField
                                      key={key}
                                      control={form.control}
                                      name="items"
                                      render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                          <FormControl>
                                          <Checkbox
                                              checked={field.value?.some((item: any) => item.valuePath.endsWith(`.${key}`) || item.valuePath === key)}
                                              onCheckedChange={(checked) => {
                                                const currentItems = form.getValues('items') || [];
                                                if (checked) {
                                                  // When checking a field, add items for all array indices (if array data)
                                                  if (Array.isArray(dataForKeys)) {
                                                    const indexedPaths = getIndexedPaths(dataForKeys, key);
                                                    indexedPaths.forEach((path) => {
                                                      if (!currentItems.some((item: any) => item.valuePath === path)) {
                                                        appendCardItem({ label: key, valuePath: path, prefix: '', suffix: '' });
                                                      }
                                                    });
                                                  } else {
                                                    // For object data (not array), just add the field as-is
                                                    if (!currentItems.some((item: any) => item.valuePath === key)) {
                                                      appendCardItem({ label: key, valuePath: key, prefix: '', suffix: '' });
                                                    }
                                                  }
                                                } else {
                                                  // When unchecking, remove all items with this field
                                                  const indicesToRemove: number[] = [];
                                                  currentItems.forEach((item: any, idx: number) => {
                                                    if (item.valuePath.endsWith(`.${key}`) || item.valuePath === key) {
                                                      indicesToRemove.push(idx);
                                                    }
                                                  });
                                                  // Remove in reverse order to maintain indices
                                                  indicesToRemove.reverse().forEach((idx) => {
                                                    removeCardItem(idx);
                                                  });
                                                }
                                              }}
                                          />
                                          </FormControl>
                                          <FormLabel className="font-normal text-sm">{key}</FormLabel>
                                      </FormItem>
                                      )}
                                  />
                                  ))}
                              </div>
                              </ScrollArea>
                               <FormMessage />
                           </FormItem>
                        )}
                      />
                    <FormDescription>
                    Selected fields will be shown as card items. You can edit the labels below.
                    </FormDescription>
                </FormItem>
            ) : (
                <p className="text-sm text-muted-foreground">No available fields to display. Please check your API response.</p>
            )}
            
            {cardItems.map((item, index) => (
                <div key={item.id} className="flex items-end gap-2 p-2 border rounded-md">
                    <FormField control={form.control} name={`items.${index}.label`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Label</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name={`items.${index}.valuePath`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Value Path</FormLabel><FormControl><Input {...field} readOnly /></FormControl></FormItem>)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCardItem(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
            ))}
             <FormField
                control={form.control}
                name="items"
                render={() => (<FormItem><FormMessage className="mt-2" /></FormItem>)}
            />
            </div>
        )}
        
        {(widgetType === "table" || widgetType === "chart") && (
            <FormField control={form.control} name="dataPath" render={({ field }) => {
                const value = field.value === '' ? '__root__' : (field.value || '');
                return (
                <FormItem>
                    <FormLabel>Data Array Path</FormLabel>
                     <Select onValueChange={(val) => field.onChange(val === '__root__' ? '' : val)} value={value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Auto-selected based on API response" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {arrayPaths.map(path => 
                           <SelectItem key={path} value={path === '' ? '__root__' : path}>
                                {path === "" ? "(root array)" : path}
                           </SelectItem>
                        )}
                        {wrappableObjectPaths.length > 0 && arrayPaths.length > 0 && (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground border-t">Objects (will be wrapped in array):</div>
                        )}
                        {wrappableObjectPaths.map(path => {
                          const displayPath = path === '__wrap_object__' ? '(root object → array)' : path.replace('__wrap_', '') + ' (object → array)';
                          return (
                            <SelectItem key={path} value={path}>
                              {displayPath}
                            </SelectItem>
                          );
                        })}
                        </SelectContent>
                    </Select>
                    <FormDescription>
                      {value && value !== '' && typeof value === 'string'
                        ? `Auto-selected: ${value === '__root__' ? '(root array)' : value.replace('__wrap_', '').replace('_object__', ' object → array')}. You can change this if needed.`
                        : 'Arrays are ready for tables. Objects will be automatically wrapped in arrays (e.g., { "data": {...} } → [{ "data": {...} }])'
                      }
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}} />
        )}

        {widgetType === "table" && testApiState.data && apiDataKeys.length > 0 && (
            <div className="space-y-4 rounded-md border p-4 mt-4">
                <h3 className="font-medium">Table Columns</h3>
                 <FormItem>
                    <FormLabel>Select columns to display</FormLabel>
                     <FormField
                        control={form.control}
                        name="columns"
                        render={() => (
                           <FormItem>
                              <ScrollArea className="h-32">
                              <div className="space-y-2">
                                  {apiDataKeys.map((key) => (
                                  <FormField
                                      key={key}
                                      control={form.control}
                                      name="columns"
                                      render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                          <FormControl>
                                          <Checkbox
                                              checked={field.value?.some((item: any) => item.dataPath === key)}
                                              onCheckedChange={(checked) => {
                                                const currentColumns = form.getValues('columns') || [];
                                                if (checked) {
                                                  if (!currentColumns.some((item: any) => item.dataPath === key)) {
                                                    const header = key.split('.').pop() || key;
                                                    appendTableColumn({ header, dataPath: key });
                                                  }
                                                } else {
                                                  const itemIndex = currentColumns.findIndex((item: any) => item.dataPath === key);
                                                  if (itemIndex > -1) {
                                                    removeTableColumn(itemIndex);
                                                  }
                                                }
                                              }}
                                          />
                                          </FormControl>
                                          <FormLabel className="font-normal text-sm">{key}</FormLabel>
                                      </FormItem>
                                      )}
                                  />
                                  ))}
                              </div>
                              </ScrollArea>
                               <FormMessage />
                           </FormItem>
                        )}
                      />
                    <FormDescription>
                        Selected fields will be shown as table columns. You can edit the headers below.
                    </FormDescription>
                </FormItem>

                {tableColumns.map((item, index) => (
                    <div key={item.id} className="flex items-end gap-2 p-2 border rounded-md">
                        <FormField control={form.control} name={`columns.${index}.header`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Header</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`columns.${index}.dataPath`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Data Path</FormLabel><FormControl><Input {...field} readOnly /></FormControl></FormItem>)} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTableColumn(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                ))}
                 <FormField
                      control={form.control}
                      name="columns"
                      render={() => (<FormItem><FormMessage /></FormItem>)}
                  />
            </div>
        )}

        {widgetType === "table" && (!testApiState.data || apiDataKeys.length === 0) && (
          <div className="space-y-4 rounded-md border p-4 mt-4">
            <h3 className="font-medium">Table Columns</h3>
            <div className="text-sm text-muted-foreground">
              {!testApiState.data 
                ? "Please test the API first to see available columns." 
                : "No columns available. The API response might be empty or in an unexpected format."}
            </div>
          </div>
        )}
        
        {widgetType === "chart" && (dataPath || dataPath === '') && (
            <div className="space-y-4 rounded-md border p-4 mt-4">
                <h3 className="font-medium">Chart Configuration</h3>
                    <FormField control={form.control} name="categoryKey" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category Key (X-axis)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a category field" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {apiDataKeys.map(key => <SelectItem key={key} value={key}>{key}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormDescription>Field to use for the X-axis from within the data array item.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="valueKey" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Value Key (Y-axis)</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a value field" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {apiDataKeys.map(key => <SelectItem key={key} value={key}>{key}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormDescription>Field to use for the Y-axis from within the data array item.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
            </div>
        )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{widgetToEdit ? 'Edit Widget' : 'Create New Widget'}</DialogTitle>
              <DialogDescription>
                {step === 1
                  ? "Configure your widget by providing the details below."
                  : "Configure the data to display on your widget."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-grow overflow-y-auto p-1 pr-4 my-4">
              {step === 1 ? renderStep1() : renderStep2()}
            </div>

            <DialogFooter>
              {step === 1 ? (
                <Button
                  type="button"
                  onClick={handleTestApiAndNext}
                  disabled={testApiState.loading}
                >
                  {testApiState.loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Next"
                  )}
                </Button>
              ) : (
                <Button type="submit">
                  {widgetToEdit ? "Save Changes" : "Create Widget"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
