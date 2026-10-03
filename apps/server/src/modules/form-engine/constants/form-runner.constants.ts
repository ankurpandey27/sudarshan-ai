// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** How long a captcha gets to clear by itself (Cloudflare-style checks) before it is handed to you. */
export const CAPTCHA_WAIT_MS = 15_000;

/** A resume file already attached on the page, e.g. "AnkurResume.pdf" on Indeed's resume step. */
// A real file name - letters or digits right before the extension - not hint text like "(.pdf, .docx)".
export const RESUME_ON_PAGE = /\b[A-Za-z0-9][\w()-]*[A-Za-z0-9]\.(pdf|docx?|rtf)\b/i;

/** Buttons that end or undo an application; never tried as "another way forward". */
export const UNSAFE_ACTION = /save (and|&) (close|exit)|save for later|withdraw|delete|remove|sign ?out|log ?out|unsubscribe/i;

/**
 * Buttons that never move an application forward: leaving or pausing it (Save and close, Save
 * job), site chrome (Indeed's "1 new update", Report, Skip to main content), previews, going back,
 * and captcha controls. Never chosen, never learned - not even from what you click by hand.
 * "Save and continue" still counts.
 */
export const NEVER_ADVANCE = new RegExp(
  [
    UNSAFE_ACTION.source,
    /^(save|don'?t save|do not save|save job|go back|back|previous|cancel|close|discard|help|verify|skip)$/.source,
    /\bpreview\b|\bnew (update|message|notification)s?\b|\bnotifications?\b|\breport\b|feedback|skip to|not interested/.source,
    /\b(search|find) jobs?\b|view (full )?job description|cv options|challenge|captcha|\bedit\b/.source,
  ].join('|'),
  'i',
);

/** A learned "apply" button must say so; anything else (a job title, a search box) is noise. */
export const APPLY_WORDING = /\bapply\b|i'?m interested|continue|start|sollicit|reageer|bewerb|postul|candidat|aplicar|aplikuj|ansök|ansøg|søk/i;
/** Different buttons tried on one step before handing the form over as stuck. */
export const MAX_OTHER_MOVES = 3;

/** How long a step that shows nothing to press may take to finish drawing (Indeed: a few seconds). */
export const STEP_RENDER_WAIT_MS = 12_000;

/**
 * Optional questions left blank even when the AI could answer: facts only you can give (who referred
 * you, a promo code) and voluntary self-identification (gender, race, disability, veteran status),
 * which is your choice to share.
 */
export const OPTIONAL_LEFT_BLANK =
  /\b(refer(r?al|red|rer)|promo|coupon|voucher|gender|pronouns?|sex|race|ethnicity|ethnic|disability|disabilities|disabled|veteran|religion|caste|sexual orientation|marital|self[- ]identif\w*|search|password)\b/i;

/** A form that says it was sent: WordPress Contact Form 7 marks its form "sent" and keeps it on the page, emptied. */
export const SENT_FORM = 'form.wpcf7-form.sent, .wpcf7 form[data-status="sent"]';

/**
 * "Thank you for your application" / "Your application was sent" in the world's major languages -
 * a confirmation on any site, next to the site's own English wording.
 */
export const CONFIRMED_WORLDWIDE = new RegExp(
  [
    // Dutch, German, French, Spanish, Portuguese, Italian, Polish, Swedish, Danish/Norwegian
    'bedankt voor (je|uw) (sollicitatie|reactie)|(je|uw) sollicitatie is (verzonden|ontvangen|verstuurd)',
    'vielen dank für ihre bewerbung|danke für deine bewerbung|ihre bewerbung (wurde|ist) (erfolgreich )?(versendet|übermittelt|eingegangen|gesendet)',
    'merci pour votre candidature|votre candidature (a bien été|a été) (envoyée|reçue|transmise)',
    'gracias por (tu|su) (postulación|solicitud|candidatura)|(tu|su) (postulación|solicitud|candidatura) (ha sido|fue) (enviada|recibida)',
    'obrigad[oa] pela (sua )?candidatura|sua candidatura foi (enviada|recebida)',
    'grazie per (la tua|la sua) candidatura|candidatura (inviata|ricevuta) con successo',
    'dziękujemy za (twoją |przesłanie )?aplikacj[eę]|twoja aplikacja została wysłana',
    'tack för din ansökan|din ansökan (har skickats|är skickad)|tak for din ansøgning|takk for din søknad',
    // Russian, Turkish, Indonesian, Vietnamese, Arabic, Hindi
    'спасибо за (ваш )?отклик|ваш отклик (отправлен|получен)|ваша заявка (отправлена|принята)',
    'başvurunuz (alındı|gönderildi|iletildi)|başvurunuz için teşekkür',
    'terima kasih (telah|sudah) melamar|lamaran anda (telah|sudah) (terkirim|dikirim|diterima)',
    'cảm ơn bạn đã ứng tuyển|hồ sơ (của bạn )?đã được gửi',
    'شكرا(ً)? (لك )?على (تقديمك|طلبك)|تم (إرسال|استلام) طلبك',
    'आवेदन (के लिए )?धन्यवाद|आपका आवेदन (भेज दिया गया|प्राप्त हो गया|सफलतापूर्वक)',
    // Chinese, Japanese, Korean
    '感谢您的申请|申请已提交|您的简历已(投递|发送)|投递成功',
    '応募(いただき|して頂き)?ありがとうございます|応募が完了しました|応募を受け付けました',
    '지원해 주셔서 감사합니다|지원이 완료되었습니다|지원서가 제출되었습니다',
  ].join('|'),
  'i',
);

/** Words that say nothing about what a years question is about. */
export const SUBJECT_FILLER = new Set([
  'how',
  'many',
  'much',
  'long',
  'years',
  'year',
  'yrs',
  'yr',
  'of',
  'experience',
  'exp',
  'do',
  'does',
  'you',
  'your',
  'have',
  'has',
  'with',
  'in',
  'on',
  'using',
  'the',
  'a',
  'an',
  'and',
  'or',
  'total',
  'overall',
  'work',
  'working',
  'worked',
  'hands',
  'professional',
  'relevant',
  'industry',
  'number',
  'please',
  'mention',
  'enter',
  'specify',
  'what',
  'is',
  'are',
  'currently',
  'current',
  'approximately',
  'approx',
  'least',
  'at',
  'minimum',
  'min',
  'plus',
]);

/** The page moved on while it was being read (a new page replaced it). */
export const NAVIGATED = /execution context was destroyed|cannot find context|detached frame|target closed|navigat/i;

/** How long a Submit may take before it counts as "did nothing". */
export const SEND_WAIT_MS = 25_000;

/** After a press: at least this long, then until the page is quiet for SETTLE_QUIET_MS, at most SETTLE_MAX_MS. */
export const SETTLE_MIN_MS = 500;
export const SETTLE_QUIET_MS = 900;
export const SETTLE_MAX_MS = 7000;

/** A press that changed nothing yet gets this long to show its result before another button is tried. */
export const NO_CHANGE_WAIT_MS = 5000;

/** A step still loading (no fields, hardly any text) may take this long (Indeed smartapply, 2026-10-01). */
export const SLOW_STEP_RENDER_WAIT_MS = 30_000;

/** With Submit greyed out, a captcha may still be on its way (Indeed): looked for this long. */
export const LATE_CAPTCHA_WAIT_MS = 12_000;

/** Submits that land back on the same form before Sudarshan stops and asks you. */
export const MAX_SAME_FORM_SENDS = 2;

/**
 * Presses of Submit in one application, whatever the form looks like after each: a form that changes a little every
 * time (Capco on Greenhouse, 2026-10-03: five rounds) is not progress. After this many, the tab is handed to you.
 */
export const MAX_SENDS_PER_RUN = 3;

/** Searchable dropdowns opened per step to read their options, at most. */
export const MAX_PROBED_COMBOBOXES = 20;
