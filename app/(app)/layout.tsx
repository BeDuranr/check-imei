import { AppHeader } from "@/components/AppHeader";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-5 pb-16">{children}</main>
    </>
  );
}
