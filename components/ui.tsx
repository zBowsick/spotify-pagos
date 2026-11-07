'use client';

import React from 'react';

// ---- Button ----
export function Button({
  children, variant = 'primary', size = 'md', disabled, loading, className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand text-white hover:bg-brand-hover',
    secondary: 'bg-border text-fg hover:bg-muted/20',
    danger: 'bg-danger text-white hover:bg-red-700',
    ghost: 'bg-transparent text-fg hover:bg-border',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-base', lg: 'px-6 py-3 text-lg' };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <span className="spinner" />}
      {children}
    </button>
  );
}

// ---- Input ----
export function Input({ label, error, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      <input className={`input ${error ? 'border-danger' : ''}`} {...props} />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

// ---- Select ----
export function Select({ label, error, children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      <select className={`select ${error ? 'border-danger' : ''}`} {...props}>{children}</select>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

// ---- Textarea ----
export function Textarea({ label, error, className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      <textarea className={`textarea ${error ? 'border-danger' : ''}`} {...props} />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}

// ---- Badge ----
export function Badge({ children, variant = 'neutral', className = '' }: { children: React.ReactNode; variant?: 'success' | 'warning' | 'danger' | 'neutral'; className?: string }) {
  const variants = { success: 'badge-success', warning: 'badge-warning', danger: 'badge-danger', neutral: 'badge-neutral' };
  return <span className={`badge ${variants[variant]} ${className}`}>{children}</span>;
}

// ---- Card ----
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 border-b border-border ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

// ---- Modal ----
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; }
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-ghost p-1" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Toast ----
export function Toast({ message, variant = 'success', onClose }: { message: string; variant?: 'success' | 'error' | 'warning'; onClose: () => void }) {
  const variants = { success: 'toast-success', error: 'toast-error', warning: 'toast-warning' };
  return (
    <div className={`toast ${variants[variant]}`} role="alert">
      <div className="flex items-start gap-3">
        <span className="flex-1">{message}</span>
        <button className="btn btn-ghost p-1" onClick={onClose}>✕</button>
      </div>
    </div>
  );
}

// ---- Loading ----
export function Loading({ text = 'Cargando...' }: { text?: string }) {
  return <div className="flex flex-col items-center justify-center gap-3 p-8"><span className="spinner w-8 h-8 border-3" /><span className="text-muted">{text}</span></div>;
}

// ---- Empty State ----
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <p className="text-xl font-medium mb-1">{title}</p>
      {description && <p className="text-muted mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ---- Table ----
export function Table({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`table-wrap ${className}`}><table>{children}</table></div>;
}

export function Thead({ children }: { children: React.ReactNode }) { return <thead>{children}</thead>; }
export function Tbody({ children }: { children: React.ReactNode }) { return <tbody>{children}</tbody>; }
export function Tr({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <tr className={className}>{children}</tr>; }
export function Th({ children, className = '', onClick, style, ...props }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  return <th className={className} onClick={onClick} style={style} {...props}>{children}</th>;
}
export function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <td className={className}>{children}</td>; }

// ---- Alert ----
export function Alert({ children, variant = 'info', className = '' }: { children: React.ReactNode; variant?: 'info' | 'success' | 'warning' | 'error'; className?: string }) {
  const variants = {
    info: 'border-brand bg-brand/5 text-brand',
    success: 'border-success bg-success/5 text-success',
    warning: 'border-warning bg-warning/5 text-warning',
    error: 'border-danger bg-danger/5 text-danger',
  };
  return <div className={`p-4 rounded-lg border ${variants[variant]} ${className}`}>{children}</div>;
}

// ---- Avatar ----
export function Avatar({ name, className = '' }: { name: string; className?: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return <div className={`w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-semibold ${className}`}>{initials}</div>;
}