// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CookieInfo, newLoginCookies } from './login-cookies.util';

// Cookie names (with httpOnly / session) as Foundit and Hirist set them, logged out and then logged in (2026-10-02).
const cookie = (spec: string): CookieInfo => ({ name: spec.replace(/\(.*$/, ''), httpOnly: spec.includes('(http)'), expires: spec.includes('(session)') ? -1 : 1_900_000_000 });

describe('learning which cookies are a login', () => {
  it("finds Foundit's sign-in tokens", () => {
    const before = new Set('_clck FCNEC WZRK_G bm_so bm_lso _abck _ga g_state __rtbh.lid _clsk bm_sv FCCDCF bm_sz _uetsid cto_bundle _uetvid _gcl_au _fbp ak_bmsc'.split(' '));
    const after = 'FCCDCF FCNEC JSESSIONID(http)(session) MSAL(http) MSSOAT(http) MSSOCLIENT RT WZRK_G WZRK_X __eoi __gads __rtbh.uid _abck _ga ak_bmsc(http) bm_s(http) preferences profileScore(session) userData(session)'
      .split(' ')
      .map(cookie);
    expect(newLoginCookies(before, after)).toEqual(['MSAL', 'MSSOAT']);
  });

  it("finds Hirist's, and ignores its plain session id and bot shield", () => {
    const before = new Set('PHPSESSID _ga _t_ds _fbp _rdt_pn _gcl_au _rdt_uuid _clarity_ab_variant _gid ak_bmsc'.split(' '));
    const after = 'HIRIST_CK1(http) HIRIST_LASTACT(http) PHPSESSID(http) _clarity_ab_variant(http) _ga _t_ds(http) ak_bmsc(http) chatSdkToken(http)(session) filter(session) hirist_seeker_enc(http)'
      .split(' ')
      .map(cookie);
    expect(newLoginCookies(before, after)).toEqual(['HIRIST_CK1', 'HIRIST_LASTACT', 'hirist_seeker_enc']);
  });

  it('learns nothing while nothing new appears (already logged in, or not yet)', () => {
    expect(newLoginCookies(new Set(['a', 'b']), [cookie('a(http)'), cookie('b')])).toEqual([]);
    expect(newLoginCookies(new Set(), [cookie('PHPSESSID(http)'), cookie('cf_clearance(http)'), cookie('_session(http)')])).toEqual([]);
  });
});
