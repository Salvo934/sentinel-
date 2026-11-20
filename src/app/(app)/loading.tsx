import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Caricamento">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
