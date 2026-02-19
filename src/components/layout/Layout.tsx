import { Sidebar } from "@/components/layout/Sidebar";
import { useAppStore } from "@/stores/app-store";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen && <Sidebar />}
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
