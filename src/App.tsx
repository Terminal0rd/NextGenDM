import { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { useTauriEvents } from './hooks/useTauriEvents';
import { TooltipProvider } from './components/ui/tooltip';

export default function App() {
  useTauriEvents();

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <TooltipProvider>
      <MainLayout />
    </TooltipProvider>
  );
}
