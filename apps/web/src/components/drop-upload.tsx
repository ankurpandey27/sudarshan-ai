// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useRef, useState, type ReactNode } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { cn } from '../lib/format';

export function DropUpload({
  accept,
  onFile,
  busy,
  title,
  hint,
  done,
}: {
  accept: string;
  onFile: (f: File) => void;
  busy?: boolean;
  title: string;
  hint: ReactNode;
  done?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file && !busy) onFile(file);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
        over ? 'border-accent bg-accent-soft/50' : 'border-line-strong hover:border-ink-3 hover:bg-surface-2/60',
      )}
    >
      {busy ? <Loader2 className="size-6 animate-spin text-accent" /> : <UploadCloud className="size-6 text-ink-3" />}
      <p className="mt-2 text-sm font-semibold">{busy ? 'Reading...' : title}</p>
      <p className="mt-0.5 text-[12.5px] text-ink-3">{hint}</p>
      {done && <div className="mt-3">{done}</div>}
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
