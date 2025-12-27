"use client";

import { useState, useMemo } from "react";
import get from "lodash/get";
import type { TableWidgetConfig, WidgetConfig } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Search } from "lucide-react";

type TableWidgetProps = {
  data: any[];
  config: WidgetConfig & TableWidgetConfig;
};

const ROWS_PER_PAGE = 5;

export function TableWidget({ data, config }: TableWidgetProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!searchTerm) return data;

    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredData, currentPage]);


  if (!Array.isArray(data)) {
    return <div className="text-sm text-muted-foreground">Data is not an array.</div>;
  }
  
  return (
    <div className="flex flex-col h-full select-text">
      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search table data..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-muted/50 border-muted-foreground/20 focus:border-primary/50 focus:bg-background transition-colors"
          />
        </div>
      </div>
      <div className="flex-grow relative">
        <ScrollArea className="absolute inset-0">
          <div className="px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  {config.columns.map((col, index) => (
                    <TableHead key={index} className="font-semibold text-foreground select-text">{col.header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="hover:bg-muted/50 transition-colors">
                    {config.columns.map((col, colIndex) => (
                      <TableCell key={colIndex} className="text-sm select-text">{get(row, col.dataPath)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-muted-foreground/10">
        <span className="text-sm text-muted-foreground">
          {filteredData.length === 0 
            ? "No results found" 
            : `Showing ${Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, filteredData.length)} to ${Math.min(currentPage * ROWS_PER_PAGE, filteredData.length)} of ${filteredData.length} entries`
          }
        </span>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
