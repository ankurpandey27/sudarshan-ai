// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ALREADY_APPLIED_TEXT, APPLIED_BUTTON, ONE_CLICK_SUCCESS, LINKEDIN_SUCCESS, NAUKRI_APPLIED_URL, NAUKRI_SUCCESS } from './apply.constants';

describe('application confirmations', () => {
  it("recognises Naukri's one-click confirmation page", () => {
    expect(NAUKRI_SUCCESS.test('Applied to "Node Js Backend Developer" Send Me Jobs Like This')).toBe(true);
    expect(NAUKRI_SUCCESS.test('You have successfully applied to this job')).toBe(true);
    expect(NAUKRI_APPLIED_URL.test('https://www.naukri.com/myapply/saveApply?strJobsarr=[123]')).toBe(true);
  });

  it('does not mistake job-page text for a confirmation', () => {
    expect(NAUKRI_SUCCESS.test('Applicants: 100+ Openings: 2 Apply Save')).toBe(false);
    expect(NAUKRI_SUCCESS.test('Be an early applicant - 12 people applied to similar roles')).toBe(false);
    expect(NAUKRI_APPLIED_URL.test('https://www.naukri.com/job-listings-node-js-developer-123')).toBe(false);
  });

  it("recognises a button that has become a confirmation (Instahyre's one-click apply)", () => {
    expect(APPLIED_BUTTON.test('Application sent!')).toBe(true);
    expect(APPLIED_BUTTON.test('✓ Application sent!')).toBe(true);
    expect(APPLIED_BUTTON.test('Applied')).toBe(true);
    expect(APPLIED_BUTTON.test('Apply now')).toBe(false);
    expect(APPLIED_BUTTON.test('Applied AI Engineer')).toBe(false);
  });

  it("recognises LinkedIn's confirmation", () => {
    expect(LINKEDIN_SUCCESS.test('Your application was sent to Acme!')).toBe(true);
  });

  it('does not take careers-page boilerplate as proof of a one-click application', () => {
    expect(ONE_CLICK_SUCCESS.test('Thank you for your interest in careers at Acme. Sign in to continue.')).toBe(false);
    expect(ONE_CLICK_SUCCESS.test('Your application has been submitted')).toBe(true);
    expect(ONE_CLICK_SUCCESS.test('Thank you for applying!')).toBe(true);
  });

  it('takes only real "already applied" wording, not a sign-in page', () => {
    expect(ALREADY_APPLIED_TEXT.test('Thank you for your interest in Acme. Already have an account? Sign in')).toBe(false);
    expect(ALREADY_APPLIED_TEXT.test("You've already applied to this job")).toBe(true);
    expect(ALREADY_APPLIED_TEXT.test('Your application was already submitted on 3 May')).toBe(true);
  });
});
