// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { classifyReply } from './classify-reply.util';

describe('what an employer replied', () => {
  it.each([
    ['Thank you for applying to Acme', 'We have received your application for Backend Engineer and will review it.', 'received'],
    ['Your application was sent to Acme', 'Your application to Backend Engineer at Acme was sent.', 'received'],
    ['Application received - Senior Developer', 'Hi Ankur, thanks for your interest in Zeta.', 'received'],
    ['Update on your application', 'Unfortunately, we have decided to move forward with other candidates whose experience more closely matches.', 'rejected'],
    ['Your application at Acme', 'After careful review we will not be moving forward to the interview stage.', 'rejected'],
    ['Regarding your candidature', 'We regret to inform you that the position has been filled.', 'rejected'],
    ['Next steps: Online assessment', 'Please complete the HackerRank test within 3 days before your interview.', 'assessment'],
    ['Interview invitation - Acme', 'We would like to schedule a call with you. Please share your availability.', 'interview'],
    ['Quick chat?', 'You have been shortlisted for the Backend role. Book a slot: calendly.com/acme/30min', 'interview'],
    ['Offer letter - Acme', 'We are pleased to extend an offer for the role of Senior Engineer.', 'offer'],
  ])('"%s" is %s', (subject, text, kind) => expect(classifyReply(subject, text)).toBe(kind));

  it.each([
    ['Job alert: 25 new Node.js jobs', 'Backend Engineer - Acme. Apply now. Senior Dev - Zeta. Apply now.'],
    ['Jobs you may be interested in', 'Based on your profile. View job. View job. View job.'],
    ['Acme is hiring', 'Acme is hiring for 12 roles near you. Easy Apply.'],
    ['Your weekly digest', 'Recruiters viewed your profile 4 times.'],
    ['Lunch on Friday?', 'Shall we meet at 1?'],
    ['Your order has shipped', 'Thank you for your order. It will arrive soon.'],
  ])('"%s" is not a reply', (subject, text) => expect(classifyReply(subject, text)).toBeNull());
});
