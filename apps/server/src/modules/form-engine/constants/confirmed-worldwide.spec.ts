// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CONFIRMED_WORLDWIDE } from './form-runner.constants';

describe('CONFIRMED_WORLDWIDE', () => {
  it.each([
    'Bedankt voor je sollicitatie!',
    'Vielen Dank für Ihre Bewerbung',
    'Ihre Bewerbung wurde erfolgreich übermittelt.',
    'Merci pour votre candidature',
    'Votre candidature a bien été envoyée',
    'Gracias por tu postulación',
    'Tu solicitud ha sido enviada',
    'Obrigado pela sua candidatura',
    'Grazie per la tua candidatura',
    'Dziękujemy za aplikację',
    'Tack för din ansökan',
    'Спасибо за отклик',
    'Başvurunuz alındı',
    'Terima kasih telah melamar',
    'Cảm ơn bạn đã ứng tuyển',
    'تم إرسال طلبك',
    'आपका आवेदन सफलतापूर्वक भेज दिया गया',
    '感谢您的申请',
    '応募が完了しました',
    '지원이 완료되었습니다',
  ])('counts "%s" as a confirmation', (text) => expect(CONFIRMED_WORLDWIDE.test(text)).toBe(true));

  it.each([
    'Solliciteer nu',
    'Jetzt bewerben - Ihre Bewerbung in 3 Minuten',
    'Envoyer ma candidature',
    'Enviar solicitud',
    '立即申请',
    '지원하기',
    'Отправить отклик',
  ])('never counts an apply page ("%s")', (text) => expect(CONFIRMED_WORLDWIDE.test(text)).toBe(false));
});
