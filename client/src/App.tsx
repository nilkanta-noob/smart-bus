import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import { FleetSimulationProvider } from "@/contexts/FleetSimulationContext";

export default function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster position="top-center" />
        <FleetSimulationProvider><Home /></FleetSimulationProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
