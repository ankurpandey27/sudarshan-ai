// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SecretBoxService } from '../../common/crypto/secret-box.service';
import { EventsService } from '../../common/events/events.service';
import { StorageService } from '../../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InboxService } from './inbox.service';
import { MailMessage } from './interfaces/inbox.interface';

describe('replies from your mailbox', () => {
  const setup = () => {
    const storage = new StorageService(':memory:');
    const now = new Date();
    const day = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
    for (const [id, title, company, applied] of [
      [1, 'Backend Engineer', 'Acme Technologies', day(10)],
      [2, 'Node.js Developer', 'Zeta Labs', day(5)],
    ] as const) {
      storage.run("INSERT INTO jobs (id, source, external_id, url, title, company, status, discovered_at, updated_at, applied_at) VALUES (?, 'web', ?, ?, ?, ?, 'applied', ?, ?, ?)", [
        id,
        `x${id}`,
        `https://x.test/${id}`,
        title,
        company,
        applied,
        applied,
        applied,
      ]);
    }
    const notify = jest.fn(async () => ({ telegram: false }));
    const svc = new InboxService(storage, {} as SecretBoxService, new EventsService(storage), { notify } as unknown as NotificationsService);
    const mail = (id: string, from: string, subject: string, text: string): MailMessage => ({ id, from, fromName: '', subject, text, at: day(1) });
    return { storage, svc, notify, mail };
  };

  it('records replies against the right application, once each, and tells you about interviews', () => {
    const { svc, notify, mail } = setup();
    const messages = [
      mail('<a@acme.com>', 'careers@acme.com', 'Interview invitation', 'We would like to schedule a call for the Backend Engineer role.'),
      mail('<b@greenhouse.io>', 'no-reply@greenhouse.io', 'Thank you for applying to Zeta Labs', 'We have received your application.'),
      mail('<c@linkedin.com>', 'jobs-noreply@linkedin.com', 'Job alert: 30 new jobs', 'Apply now. Apply now. Apply now.'),
      mail('<d@shop.com>', 'orders@shop.com', 'Your order', 'Shipped.'),
    ];
    expect(svc.record(messages)).toBe(2);
    expect(svc.record(messages)).toBe(0);
    expect(svc.replies().map((r) => [r.jobId, r.kind])).toEqual(
      expect.arrayContaining([
        [1, 'interview'],
        [2, 'received'],
      ]),
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('needs_you', 'Acme Technologies: an interview invitation', expect.stringContaining('Backend Engineer @ Acme Technologies'));
    expect(svc.status().replies).toEqual({ interview: 1, received: 1 });
  });

  it('ignores replies about companies you never applied to', () => {
    const { svc, mail } = setup();
    expect(svc.record([mail('<e@other.com>', 'hr@othercorp.com', 'Interview invitation', 'Shall we schedule a call?')])).toBe(0);
  });
});
