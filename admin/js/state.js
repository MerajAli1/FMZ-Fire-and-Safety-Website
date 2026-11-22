/** Shared, live inquiry list (one Firestore listener for badge, overview and title). */
let inquiries = null;
const listeners = new Set();

export function setInquiries(list) {
  inquiries = list;
  listeners.forEach((fn) => fn(list));
}

export function onInquiries(fn) {
  listeners.add(fn);
  if (inquiries) fn(inquiries);
  return () => listeners.delete(fn);
}
