import { Layout } from "@/components/layout/Layout";
import { ConnectionDialog } from "@/components/ssh/ConnectionDialog";
import { TerminalPanel } from "@/components/terminal/TerminalPanel";

function App() {
  return (
    <Layout>
      <TerminalPanel />
      <ConnectionDialog />
    </Layout>
  );
}

export default App;
