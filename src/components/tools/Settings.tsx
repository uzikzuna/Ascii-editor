import React from 'react';
import { Settings as SettingsIcon, Shield, Trash2, Key } from 'lucide-react';
import { Button, Select, useToast } from '../shared/Widgets';

interface SettingsProps {
  activeTheme: string;
  onChangeTheme: (theme: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  activeTheme,
  onChangeTheme
}) => {
  const { showToast } = useToast();

  const handleWipeCache = () => {
    if (confirm('Are you absolutely sure you want to delete all saved projects and history? This cannot be undone.')) {
      localStorage.clear();
      showToast('Wiped local projects database. Refreshing...', 'info');
      setTimeout(() => window.location.reload(), 1500);
    }
  };

  const keyboardShortcuts = [
    { keys: 'Ctrl + K', desc: 'Open system command search console' },
    { keys: 'Ctrl + B', desc: 'Toggle sidebar visibility collapse' },
    { keys: 'Ctrl + Z', desc: 'Undo last draw operation (Editor only)' },
    { keys: 'Ctrl + Y', desc: 'Redo drawing grid states (Editor only)' },
    { keys: 'ESC', desc: 'Exit active modal or close command palette' }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 grid-bg">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        
        {/* Settings Header */}
        <div className="border-b border-theme-border/30 pb-4">
          <h1 className="text-2xl font-extrabold text-theme-text flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-theme-accent" />
            SYSTEM PARAMETERS
          </h1>
          <p className="text-xs text-theme-muted mt-1 font-sans">
            Configure system themes, engine frame limiting, and cache configurations.
          </p>
        </div>

        {/* Theme Settings Section */}
        <div className="glass border border-theme-border/50 rounded-xl p-5 flex flex-col gap-4 bg-theme-panel/20">
          <h3 className="text-sm font-semibold text-theme-text flex items-center gap-2">
            <Shield className="w-4 h-4 text-theme-accent" />
            VISUAL INTERFACE STYLE
          </h3>
          <Select
            label="THEME STYLE SELECTOR"
            value={activeTheme}
            onChange={onChangeTheme}
            options={[
              { value: 'jarvis', label: 'JARVIS Blue (Holodeck Navy/Cyan)' },
              { value: 'green-terminal', label: 'Classic Green Terminal (Retro Phosphor)' },
              { value: 'amber-crt', label: 'Amber CRT (Warm Orange Terminal)' },
              { value: 'cyberpunk', label: 'Cyberpunk Purple (Synthwave Hot Pink)' },
              { value: 'monochrome-white', label: 'Monochrome White (Minimalist slate)' },
              { value: 'oled-dark', label: 'OLED Dark (True Black Contrast)' },
              { value: 'light-mode', label: 'Light Mode (Frosted Silver Blue)' }
            ]}
          />
        </div>

        {/* Keybinding Reference Sheet */}
        <div className="glass border border-theme-border/50 rounded-xl p-5 flex flex-col gap-3 bg-theme-panel/20">
          <h3 className="text-sm font-semibold text-theme-text flex items-center gap-2">
            <Key className="w-4 h-4 text-theme-accent" />
            SYSTEM KEY SHORTCUTS
          </h3>
          
          <div className="flex flex-col gap-2.5 mt-2">
            {keyboardShortcuts.map((sc, idx) => (
              <div key={idx} className="flex justify-between items-center border-b border-theme-border/10 pb-2 text-sm font-sans">
                <span className="text-theme-muted text-xs">{sc.desc}</span>
                <kbd className="px-2 py-0.5 border border-theme-border bg-theme-panel rounded text-[10px] font-mono text-theme-accent font-semibold shadow-sm">
                  {sc.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* Cache / System Operations */}
        <div className="glass border border-theme-border/50 rounded-xl p-5 flex flex-col gap-4 bg-theme-panel/20">
          <div>
            <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              DANGER ZONE
            </h3>
            <p className="text-xs text-theme-muted mt-1 leading-normal font-sans">
              Perform structural cache cleaning operations. This deletes all local browser database records.
            </p>
          </div>
          <div className="pt-2">
            <Button variant="danger" size="sm" onClick={handleWipeCache}>
              Wipe Projects Local Cache
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};
