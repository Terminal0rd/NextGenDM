import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const appWindow = getCurrentWindow();

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial state
    appWindow.isMaximized().then(setIsMaximized);

    // Listen for window resize to update maximize state
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  return (
    <div 
      data-tauri-drag-region 
      className="h-9 w-full flex justify-between items-center bg-transparent shrink-0 z-50 select-none border-b border-zinc-800/40"
    >
      <div data-tauri-drag-region className="flex items-center h-full pl-4 w-full text-[11px] font-medium text-zinc-400 tracking-wide">
        NextGenDM
      </div>
      
      <div className="flex items-center h-full">
        <button 
          onClick={() => appWindow.minimize()}
          className="inline-flex justify-center items-center h-full w-11 hover:bg-white/10 text-zinc-400 transition-colors"
          tabIndex={-1}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button 
          onClick={async () => {
            if (isMaximized) {
              await appWindow.unmaximize();
            } else {
              await appWindow.maximize();
            }
          }}
          className="inline-flex justify-center items-center h-full w-11 hover:bg-white/10 text-zinc-400 transition-colors"
          tabIndex={-1}
        >
          <Square className="h-3 w-3" />
        </button>
        <button 
          onClick={() => appWindow.close()}
          className="inline-flex justify-center items-center h-full w-11 hover:bg-red-500 hover:text-white text-zinc-400 transition-colors"
          tabIndex={-1}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
