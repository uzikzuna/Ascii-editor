import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: ToastType, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <X className="w-5 h-5 text-rose-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-sky-400" />
  };

  const borderColors = {
    success: 'border-emerald-500/30',
    error: 'border-rose-500/30',
    warning: 'border-amber-500/30',
    info: 'border-sky-500/30'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-lg border glass ${borderColors[toast.type]} shadow-neon min-w-[280px] bg-theme-panel/90 backdrop-blur-md`}
    >
      <div className="flex items-center gap-2.5">
        {icons[toast.type]}
        <span className="text-sm font-sans font-medium text-theme-text">{toast.message}</span>
      </div>
      <button 
        onClick={() => onClose(toast.id)}
        className="text-theme-muted hover:text-theme-text transition-colors p-0.5 hover:bg-white/5 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};


// ==========================================
// BUTTON WIDGET
// ==========================================
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'glow' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'secondary', 
  size = 'md', 
  children, 
  className = '', 
  ...props 
}) => {
  const baseStyle = "font-sans font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 outline-none disabled:opacity-50 disabled:pointer-events-none";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const variantStyles = {
    primary: "bg-theme-accent text-theme-bg shadow-neon hover:shadow-neon-strong hover:brightness-110",
    secondary: "border border-theme-border bg-theme-panel hover:bg-white/5 text-theme-text hover:border-theme-accent/50",
    danger: "border border-rose-500/30 bg-rose-950/20 text-rose-300 hover:bg-rose-900/30 hover:border-rose-500",
    glow: "relative bg-theme-panel text-theme-text border border-theme-accent/40 shadow-neon hover:shadow-neon-strong hover:bg-theme-accent/10 hover:border-theme-accent",
    icon: "p-2 border border-theme-border bg-theme-panel hover:bg-white/5 text-theme-text hover:border-theme-accent/50"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: variant === 'icon' ? 1.05 : 1.01 }}
      className={`${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props as any}
    >
      {children}
    </motion.button>
  );
};


// ==========================================
// SLIDER WIDGET
// ==========================================
interface SliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <div className="flex justify-between items-center text-xs font-sans">
        <span className="text-theme-muted font-medium">{label}</span>
        <span className="text-theme-accent font-mono font-semibold">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-theme-border rounded-lg appearance-none cursor-pointer accent-theme-accent focus:outline-none"
        style={{
          background: `linear-gradient(to right, rgb(var(--theme-accent)) 0%, rgb(var(--theme-accent)) ${((value - min) / (max - min)) * 100}%, rgb(var(--theme-border)) ${((value - min) / (max - min)) * 100}%, rgb(var(--theme-border)) 100%)`
        }}
      />
    </div>
  );
};


// ==========================================
// SWITCH WIDGET
// ==========================================
interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  checked,
  onChange,
  className = ''
}) => {
  return (
    <label className={`flex items-center justify-between w-full cursor-pointer select-none ${className}`}>
      <span className="text-xs font-sans font-medium text-theme-muted">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-9 h-5 rounded-full transition-colors duration-200 border ${checked ? 'bg-theme-accent/20 border-theme-accent' : 'bg-theme-panel border-theme-border'}`}></div>
        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full transition-transform duration-200 ${checked ? 'transform translate-x-4 bg-theme-accent shadow-neon' : 'bg-theme-muted'}`}></div>
      </div>
    </label>
  );
};


// ==========================================
// SELECT DROPDOWN WIDGET
// ==========================================
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      <span className="text-xs font-sans font-medium text-theme-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg border border-theme-border bg-theme-panel/75 text-theme-text text-sm font-sans focus:outline-none focus:border-theme-accent/50 transition-colors backdrop-blur-md cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-theme-panel text-theme-text">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
