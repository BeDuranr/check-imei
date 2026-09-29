import { CheckDetail } from "@/components/CheckDetail";

export default async function CheckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckDetail id={id} />;
}
