// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, HardDriveDownload, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { BackupCheck, BackupStatus } from '../lib/types';
import { Button, Card, CardHeader, Field, Input } from './ui';
import { DropUpload } from './drop-upload';
import { useToast } from './toast';

/** Waits for the server to come back after a restart, then reloads the page with the restored data. */
async function reloadWhenBack(): Promise<void> {
  await new Promise((r) => setTimeout(r, 2500));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch('/api/health')).ok) return window.location.reload();
    } catch {
      // Still restarting.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Daily backups, your own backup folder, and download / restore. `folder` is part of the Settings draft (saved with it). */
export function BackupCard({ folder, onFolder }: { folder: string; onFolder: (v: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['backup'], queryFn: () => api.get<BackupStatus>('/backup') });
  const [file, setFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState<BackupCheck | null>(null);

  const now = useMutation({
    mutationFn: () => api.post<BackupStatus>('/backup/now'),
    onSuccess: (s) => {
      qc.setQueryData(['backup'], s);
      if (s.folderError) toast('error', `Backed up here, but not to your folder: ${s.folderError}`);
      else toast('ok', s.folder ? `Backed up, and copied to ${s.folder}` : 'Backed up');
    },
    onError: (e: Error) => toast('error', e.message),
  });
  const restore = useMutation({
    mutationFn: (f: File) => api.upload<BackupCheck>('/backup/restore', f),
    onSuccess: (r) => {
      setRestoring(r);
      setFile(null);
      void reloadWhenBack();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  if (restoring) {
    return (
      <Card>
        <CardHeader title="Restoring your backup" />
        <p className="p-4 text-[13.5px] text-ink-2">
          {restoring.jobs} jobs, {restoring.answers} answers{restoring.resume ? ' and your resume' : ''}. Sudarshan AI is restarting to apply it - this page
          reloads by itself. If it does not come back within a minute, start it again with <code>npm start</code>.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Backups" hint="Your data and resume, once a day - keep a copy off this computer too" />
      <div className="space-y-4 p-4">
        <p className="text-[13px] text-ink-2">
          {data?.last ? (
            <>
              Last backup {timeAgo(data.last.at)} - {data.count} kept in <code className="break-all">{data.dir}</code>
            </>
          ) : (
            'No backup yet - the first one is made today.'
          )}
        </p>
        <Field
          label="Also copy each backup to this folder"
          hint="A folder that syncs elsewhere - OneDrive, Google Drive, Dropbox - or a USB disk. Full path. The last 7 are kept there. AI keys are never in a backup."
        >
          <Input value={folder} onChange={(e) => onFolder(e.target.value)} placeholder="e.g. C:\Users\you\OneDrive\Sudarshan AI backups" />
        </Field>
        {data?.folderError && (
          <p className="flex items-center gap-2 text-[13px] text-bad">
            <AlertTriangle className="size-4 shrink-0" /> Could not copy to your folder: {data.folderError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<HardDriveDownload className="size-3.5" />} loading={now.isPending} onClick={() => now.mutate()}>
            Back up now
          </Button>
          <a
            href="/api/backup/export/file"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[13px] hover:bg-surface-2"
          >
            <Download className="size-3.5" /> Download a backup
          </a>
        </div>
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-[13px] font-semibold">Restore from a backup</p>
          {file ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px]">
              <RotateCcw className="size-4 shrink-0 text-warn" />
              <span className="min-w-0 flex-1">
                Replace everything here with <b className="break-all">{file.name}</b>? Your current data is kept in the backups folder first. Sudarshan AI
                restarts to apply it.
              </span>
              <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" loading={restore.isPending} onClick={() => restore.mutate(file)}>
                Restore
              </Button>
            </div>
          ) : (
            <DropUpload accept=".db" onFile={setFile} title="Choose a backup file" hint="sudarshan-backup-....db or agent-....db" />
          )}
        </div>
      </div>
    </Card>
  );
}
