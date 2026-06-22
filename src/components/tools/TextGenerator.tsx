import React, { useState, useEffect } from 'react';
import { Type, Copy, Download } from 'lucide-react';
import { generateTextBanner } from '../../utils/figletFonts';
import { Button, Slider, Select, useToast } from '../shared/Widgets';

export const TextGenerator: React.FC = () => {
  const [inputText, setInputText] = useState('ASCII');
  const [activeFont, setActiveFont] = useState('Slant');
  const [letterSpacing, setLetterSpacing] = useState(1);
  const [bannerOutput, setBannerOutput] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    if (inputText) {
      const banner = generateTextBanner(inputText, activeFont, letterSpacing);
      setBannerOutput(banner);
    } else {
      setBannerOutput('');
    }
  }, [inputText, activeFont, letterSpacing]);

  const copyToClipboard = () => {
    if (!bannerOutput) return;
    navigator.clipboard.writeText(bannerOutput);
    showToast('Banner text copied!', 'success');
  };

  const downloadTextFile = () => {
    if (!bannerOutput) return;
    const blob = new Blob([bannerOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascii_banner_${inputText.toLowerCase().replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded text banner!', 'success');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      
      {/* Settings Side Panel */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-theme-border/40 flex items-center justify-between bg-black/10">
          <span className="text-xs font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
            <Type className="w-4 h-4 text-theme-accent" />
            TYPOGRAPHY CONSOLE
          </span>
        </div>

        <div className="p-4 flex flex-col gap-5">
          {/* Input text */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-sans font-medium text-theme-muted">INPUT TYPOGRAPHY</span>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value.substring(0, 30))}
              placeholder="Type message here..."
              className="w-full px-3 py-2 rounded-lg border border-theme-border bg-theme-panel/75 text-theme-text text-sm font-sans focus:outline-none focus:border-theme-accent/50 transition-colors"
            />
            <span className="text-[9px] font-mono text-theme-muted text-right">Max 30 chars</span>
          </div>

          {/* Font selector */}
          <Select
            label="FONT STYLES"
            value={activeFont}
            onChange={setActiveFont}
            options={[
              { value: 'Slant', label: 'Slant Italic' },
              { value: 'Blocks', label: 'Solid Blocks' },
              { value: 'Cyber', label: 'Cyber Wireframe' },
              { value: 'Mini', label: 'Mini Condensed' }
            ]}
          />

          {/* Letter spacing */}
          <Slider
            label="LETTER SPACING"
            min={0}
            max={4}
            value={letterSpacing}
            onChange={setLetterSpacing}
          />
        </div>
      </div>

      {/* Main Workspace (Preview Area) */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        {/* Toolbar Header */}
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          <span className="text-xs font-mono text-theme-muted">TYPOGRAPHIC BANNER PREVIEW</span>
          
          {bannerOutput && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={copyToClipboard}>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </Button>
              <Button variant="glow" size="sm" onClick={downloadTextFile}>
                <Download className="w-3.5 h-3.5" />
                <span>Export TXT</span>
              </Button>
            </div>
          )}
        </div>

        {/* Viewport */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-theme-bg/25">
          {bannerOutput ? (
            <pre className="ascii-font text-theme-accent text-sm md:text-base leading-snug tracking-wider p-6 rounded-xl border border-theme-border bg-theme-panel/40 backdrop-blur-md overflow-auto max-w-full shadow-neon select-text">
              {bannerOutput}
            </pre>
          ) : (
            <div className="text-xs text-theme-muted font-mono">
              Provide input characters to generate typographic layout.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
