let reveal = () => {};
export function setInviteReveal(callback) { reveal = callback; }
export function revealInvite() { reveal(); }

export function revealLinkWindow({ tray, windows, activate, open }) {
  if (tray()?.show()) return;
  if (activate(windows())) return;
  open();
}
