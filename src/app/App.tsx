import { QueryProvider } from "@/app/providers/QueryProvider";
import { TerminalPage } from "@/pages/terminal";

export default function App() {
  return (
    <QueryProvider>
      <TerminalPage />
    </QueryProvider>
  );
}
