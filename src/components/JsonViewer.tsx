import { ScrollArea } from "./ui/scroll-area";

type JsonViewerProps = {
  data: any;
};

export function JsonViewer({ data }: JsonViewerProps) {
  return (
    <ScrollArea className="h-48 w-full rounded-md border p-4 bg-muted/50">
      <pre className="text-xs whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </ScrollArea>
  );
}
