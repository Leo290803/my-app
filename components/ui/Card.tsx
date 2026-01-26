import React from "react";

type BlockProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: BlockProps) {
  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: BlockProps) {
  return (
    <div className={`border-b border-zinc-200 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }: BlockProps) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}