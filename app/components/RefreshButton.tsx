"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="border-gray-600 text-gray-300 hover:bg-gray-800 rounded-full"
      onClick={handleRefresh}
    >
      <RefreshCw className="h-4 w-4 mr-2" />
      Обновить
    </Button>
  );
}