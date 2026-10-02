// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

const KEY = 'sudarshan.desktopNotify';

/** Desktop notifications are a choice of this browser (they need its permission), so the choice is kept here. */
export function desktopNotifyOn(): boolean {
  try {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem(KEY) !== '0';
  } catch {
    return false;
  }
}

export async function setDesktopNotify(on: boolean): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (on && Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return false;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Private window: the browser's permission alone decides.
  }
  return on;
}

export function showDesktop(title: string, body: string): void {
  if (!desktopNotifyOn()) return;
  try {
    const n = new Notification(title, { body, icon: '/sudarshan.svg', tag: title });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    // Some browsers allow notifications only from a service worker; the flight log still has it.
  }
}
