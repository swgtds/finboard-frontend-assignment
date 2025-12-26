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
import { Loader2, ArrowLeft } from "lucide-react";
import { JsonViewer } from "./JsonViewer";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { get, set } from "lodash";
import { Trash2 } from "lucide-react";

const baseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  apiUrl: z.string().url("Must be a valid URL"),
  refreshInterval: z.coerce.number().int().positive("Must be a positive number"),
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
            // For array data, get keys from first item
            const firstItemKeys = getObjectKeys(obj[0], "", false);
            return firstItemKeys;
        }
        return [];
    }
    
    return Object.keys(obj).reduce((acc: string[], key: string) => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
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
    return getObjectKeys(obj[0], "");
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


export function WidgetBuilderModal({ children, widgetToEdit }: WidgetBuilderModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [testApiState, setTestApiState] = useState<{loading: boolean; data: any; error: string | null}>({
    loading: false,
    data: null,
    error: null,
  });
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);

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
      items: widgetToEdit.type === 'card' ? widgetToEdit.items : [],
      dataPath: (widgetToEdit.type === 'table' || widgetToEdit.type === 'chart') ? widgetToEdit.dataPath : '',
      columns: widgetToEdit.type === 'table' ? widgetToEdit.columns : [],
      categoryKey: widgetToEdit.type === 'chart' ? widgetToEdit.categoryKey : '',
      valueKey: widgetToEdit.type === 'chart' ? widgetToEdit.valueKey : '',
    } : {
      title: "",
      apiUrl: "",
      refreshInterval: 60,
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
  
  const selectedDataPath = dataPath === '__root__' ? '' : dataPath;

  // For table and chart widgets, get the data from the selected path
  // For root arrays, use the array directly
  let dataForKeys;
  if (widgetType === 'table' || widgetType === 'chart') {
    // If no dataPath is set but we have a root-level array, use it directly
    if ((selectedDataPath === '' || selectedDataPath === undefined || !dataPath) && Array.isArray(testApiState.data)) {
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
    if (!apiUrl) {
      form.setError("apiUrl", { type: "manual", message: "API URL is required to test." });
      return;
    }

    // Client-side rate limiting - prevent requests within 2 seconds of each other
    const now = Date.now();
    if (now - lastRequestTime < 2000) {
      setTestApiState({ 
        loading: false, 
        data: null, 
        error: "Please wait at least 2 seconds between requests to avoid rate limiting." 
      });
      return;
    }
    setLastRequestTime(now);

    const isValid = await form.trigger(["title", "type", "apiUrl", "refreshInterval"]);
    if (!isValid) return;

    setTestApiState({ loading: true, data: null, error: null });
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(apiUrl)}`;
      console.log('Testing API:', { apiUrl, proxyUrl });
      
      const res = await fetch(proxyUrl);
      console.log('Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log('API data received:', data);
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
                const value = field.value === '' ? '__root__' : field.value;
                return (
                <FormItem>
                    <FormLabel>Data Array Path</FormLabel>
                     <Select onValueChange={(val) => field.onChange(val === '__root__' ? '' : val)} value={value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select an array from your data" /></SelectTrigger></FormControl>
                        <SelectContent>
                        {arrayPaths.map(path => 
                           <SelectItem key={path} value={path === '' ? '__root__' : path}>
                                {path === "" ? "(root array)" : path}
                           </SelectItem>
                        )}
                        </SelectContent>
                    </Select>
                    <FormDescription>e.g., 'products' if the API returns {'{ "products": [...] }'}</FormDescription>
                    <FormMessage />
                </FormItem>
            )}} />
        )}

        {/* Debug info - remove in production */}
        {widgetType === "table" && (
          <div className="p-2 bg-gray-100 text-xs rounded">
            <div>Debug Info:</div>
            <div>Widget Type: {widgetType}</div>
            <div>Has API Data: {testApiState.data ? 'Yes' : 'No'}</div>
            <div>API Data Type: {testApiState.data ? (Array.isArray(testApiState.data) ? 'Array' : 'Object') : 'None'}</div>
            <div>API Data Keys: {apiDataKeys.length} ({apiDataKeys.join(', ')})</div>
            <div>Data Path: "{dataPath}"</div>
            <div>Selected Data Path: "{selectedDataPath}"</div>
            <div>Array Paths: [{arrayPaths.join(', ')}]</div>
            <div>Data for Keys Type: {dataForKeys ? (Array.isArray(dataForKeys) ? `Array[${dataForKeys.length}]` : typeof dataForKeys) : 'undefined'}</div>
            <div>First Item Keys: {Array.isArray(dataForKeys) && dataForKeys.length > 0 ? Object.keys(dataForKeys[0]).join(', ') : 'N/A'}</div>
          </div>
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
