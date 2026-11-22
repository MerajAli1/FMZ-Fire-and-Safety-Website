# FMZ Fire & Safety Engineering — Website

Static, dependency-free website with a Firebase-backed admin dashboard.
No build step: upload the folder to any static host (Netlify, Vercel, Firebase Hosting, cPanel, GitHub Pages).

## Structure

```
index.html, about.html, training.html, equipments.html,
clients.html, gallery.html, contact.html, 404.html   Public pages
css/style.css                                         Design system + all public styles
js/config.js                                          Firebase / Cloudinary config, admin emails, defaults
js/site.js                                            Shared behaviour (nav, reveals, counters, site settings)
js/lib/                                               Firestore REST client, cache, DOM helpers
js/components/                                        Cards, hero slider, filters, lightbox, product modal
js/pages/                                             One small script per page
js/data/defaults.js                                   Built-in clients & training programs
assets/img/                                           Optimised WebP images, logo, icons
assets/icons.svg                                      SVG icon sprite (replaces Font Awesome)
admin/                                                Admin dashboard (login.html, index.html)
firestore.rules                                       Security rules — publish these!
```

## Performance notes

- Public pages do **not** load the Firebase SDK. Content is read through the Firestore REST API
  (`js/lib/firestore-rest.js`) — roughly 400 KB less JavaScript per page.
- Content is cached in `localStorage` and shown instantly on repeat visits, then refreshed in the background.
- Bootstrap, Font Awesome and SweetAlert were removed from the public site; icons are an 18 KB SVG sprite.
- Photos were converted to WebP with responsive sizes (the hero image dropped from 630 KB to 60–150 KB).
- Cloudinary images are served with `f_auto,q_auto` and width limits automatically.
- Admin uploads are resized and compressed in the browser before upload.

## Admin dashboard

Open `/admin/` (or `/admin/login.html`) and sign in with the admin account.

| Section | What it manages |
|---|---|
| Overview | Live KPIs, 14-day inquiry chart, recent messages, setup checklist |
| Inquiries | Contact-form messages: status workflow (New → In progress → Resolved), internal notes, reply by email/WhatsApp, bulk actions, CSV export, live notifications |
| Equipment | Products with photo, category, description; feature on homepage; show/hide; ordering |
| Clients | Client logos; import the built-in logos once so they become editable |
| Gallery | Multi-photo upload with albums/categories; appears on Gallery page and homepage |
| Training programs | Courses with icon, duration and key topics |
| Hero slides | Homepage banner images and text |
| Testimonials / Team | Optional homepage and About-page sections (hidden until content exists) |
| Settings | Phone, WhatsApp, email, address, hours, social links, homepage figures, announcement bar, Google Map, password reset |

## First-time setup (important)

1. **Publish the new Firestore rules.** Copy `firestore.rules` into Firebase console → Firestore Database → Rules → Publish
   (or run `firebase deploy --only firestore:rules`). Without this, the new sections (gallery, settings, slides…)
   cannot be read or saved. The new rules also stop the public from reading contact-form submissions.
2. Sign in to the dashboard → **Settings**: enter your real phone, email and address.
3. **Clients** → *Import built-in clients*; **Training programs** → *Import default programs*.
4. Upload photos in **Gallery**.

## Adding another admin

1. Create the user in Firebase console → Authentication.
2. Add the email to `ADMIN_EMAILS` in `js/config.js` **and** to `isAdmin()` in `firestore.rules`, then publish the rules.

## Images (Cloudinary)

Uploads use the unsigned preset `fmz_unsigned` on cloud `dfyvwloys` (see `js/config.js`).
Deleting an item removes it from the website but not from Cloudinary — clean up old files from the Cloudinary
media library occasionally if you approach the free-tier storage limit.

## Local preview

Any static server works, e.g. `python -m http.server 5500`, then open http://localhost:5500.
(Opening the HTML files directly with `file://` will not work because the pages use ES modules.)
