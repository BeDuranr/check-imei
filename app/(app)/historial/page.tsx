import { ChecksTable } from "@/components/ChecksTable";
import { ImportOrder } from "@/components/ImportOrder";

export default function HistorialPage() {
  return (
    <div className="space-y-4">
      <ChecksTable />
      <ImportOrder />
    </div>
  );
}
