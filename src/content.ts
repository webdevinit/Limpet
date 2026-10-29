/**
 * ALL COPY, PRICES, SPECS AND LINKS LIVE HERE.
 *
 * Anything wrapped in TBD('…') is a placeholder that has NOT been confirmed by Pat Pending.
 * It renders with a dashed outline so it cannot be mistaken for a real claim.
 * Replace the text and remove the TBD() wrapper once the fact is confirmed.
 *
 * Copy marked "(existing site)" is taken word for word from patpending.com (2026-10-29).
 * Everything else is written in the same voice: short lines, plain words, full stops.
 */

export type Placeholder = { tbd: true; text: string };
export const TBD = (text: string): Placeholder => ({ tbd: true, text });
export type Text = string | Placeholder;

export const site = {
  brand: 'Limpet',
  company: 'Pat Pending Ltd',
  productName: 'Limpet',
  tagline: 'Feels built in.', // (existing site)
  language: 'en',
  links: {
    preorder: 'https://www.patpending.com/configure', // (existing site) – the order path
    configureLite: 'https://www.patpending.com/configure-lite', // (existing site)
    configurePro: 'https://www.patpending.com/configure-pro', // (existing site)
    waitlist: 'https://www.patpending.com/join-waitlist.html', // (existing site)
    founders: 'https://www.patpending.com/founders.html',
    mission: 'https://www.patpending.com/mission.html',
    email: 'mailto:info@patpending.com',
    instagram: 'https://www.instagram.com/limpet_patpending/',
    linkedin: 'https://www.linkedin.com/company/pat-pending-ltd/',
    x: 'https://x.com/PatPendingLTD',
  },
};

export const firstBatch = {
  units: 250,
};

export const pricing = {
  headline: 'Make room for more.', // (existing site)
  batchLabel: 'First batch · launch price',
  currency: '£', // (existing site)
  lite: {
    name: 'Limpet Lite', // (existing site)
    capacities: ['125 GB', '250 GB', '500 GB'], // (existing site)
    launchPriceFrom: 99, // (existing site) – launch price only, no struck-through price
    href: site.links.configureLite,
    cta: 'Configure Lite', // (existing site)
  },
  pro: {
    name: 'Limpet Pro', // (existing site)
    capacities: ['500 GB', '1 TB'], // (existing site)
    launchPriceFrom: 199, // (existing site)
    href: site.links.configurePro,
    cta: 'Configure Pro', // (existing site)
  },
  orderStatus: 'Pre-order', // (existing site)
  delivery: {
    headline: 'Free worldwide delivery.', // (existing site)
    lead: TBD('First 50 per configuration: within 2 weeks. Later orders: 3–6 months. (existing site wording – confirm for launch)'),
  },
};

export const hero = {
  headline: 'Feels built in.', // (existing site)
  sub: 'Limpet extends your laptop.\nMore room for your apps, projects and ideas.', // (existing site)
  cta: 'Pre-order your Limpet', // (existing site)
};

export const scenes = {
  macbook: {
    headline: 'Space to do\nyour best.', // (existing site)
    body: 'Dock it onto your laptop lid. Run apps and work on projects directly from Limpet. Same laptop. Same workflow.', // (existing site)
    detail: 'The included flat, non-proprietary USB-C cable is designed for low interference and flexes with your laptop’s hinge.', // (existing site)
    /** callout next to the docked Limpet (Pro: up to 1 TB, existing site) */
    fact: 'Up to 1 TB more storage',
  },
  iphone: {
    headline: 'Your studio.\nOn the go.', // (existing site)
    body: 'Snap onto your phone. Record ProRes straight to Limpet, or move a year’s photos in one click.', // (existing site)
    detail: 'MagSafe holds it. USB-C connects it.', // (existing site)
    /** callout next to the Limpet on the iPhone (96 × 63 × 8.5 mm, from the supplied CAD model) */
    fact: 'Just 8.5 mm thin',
  },
  batch: {
    headline: 'Built by hand.\n250 of them.',
    body: 'The first batch. At the launch price.',
    cta: 'Pre-order your Limpet', // (existing site)
  },
};

export const whatItIs = {
  headline: 'Your storage.\nNo cloud.\nNo subscription.', // (existing site)
  body: 'Keep your apps and projects on Limpet. Open them like they were built in.',
  caption: 'Right-click any folder. Save to Limpet.',
};

export const craft = {
  headline: 'Made by hand.\nAll 250 of them.',
  body: 'Sandblasted aluminium on top. Black leather underneath. Every shell finished by hand.',
  detail: 'The scalloped shell, inspired by the limpet mollusk, gives your lid room to open flatter.', // (existing site)
};

export const specs = {
  headline: 'Tech specs.',
  rows: [
    { label: 'Storage', value: '125 GB · 250 GB · 500 GB · 1 TB' }, // (existing site, across Lite/Pro)
    { label: 'Drive', value: 'M.2 NVMe SSD' }, // from the supplied CAD model
    { label: 'Interface', value: TBD('USB-C. Confirm protocol and speed, e.g. USB 3.2 Gen 2, 10 Gb/s') },
    { label: 'Read / write', value: TBD('Sequential read/write in MB/s') },
    { label: 'Dimensions', value: '96 × 63 × 8.5 mm' }, // from the supplied CAD model
    { label: 'Weight', value: TBD('Weight in grams') },
    { label: 'Cable', value: 'Flat, non-proprietary USB-C. Included.' }, // (existing site)
    { label: 'Laptop dock', value: 'Adhesive dock plate for the lid. Limpet Pro.' }, // (existing site + CAD)
    { label: 'Phone mount', value: 'MagSafe-compatible ring.' }, // (existing site)
    { label: 'In the box', value: TBD('Confirm contents for Lite and Pro') },
    { label: 'MacBook', value: TBD('Supported MacBook models and years') },
    { label: 'iPhone', value: TBD('Supported iPhones (MagSafe iPhones with USB-C, e.g. iPhone 15 and later – confirm)') },
  ],
};

export const faq = {
  headline: 'Good to know.',
  items: [
    { q: 'Is this a pre-order?', a: 'Yes. Your delivery allocation is confirmed before payment. You only pay once it is.' }, // (existing site)
    { q: 'When will my Limpet ship?', a: TBD('Shipping window for the first batch and for later orders') },
    { q: 'Lite or Pro?', a: 'Lite is Limpet plus a phone cable. 125, 250 or 500 GB. Pro adds the laptop dock. 500 GB or 1 TB.' }, // (existing site)
    { q: 'Does it work with my MacBook?', a: TBD('Supported MacBook models') },
    { q: 'Does it work with my iPhone?', a: TBD('Supported iPhone models') },
    { q: 'Do I need software or a subscription?', a: 'No. Limpet is a standard external drive. No cloud. No subscription.' }, // (existing site)
  ],
};

export const finalCta = {
  headline: 'Your next chapter. Built in.', // (existing site)
  cta: 'Pre-order your Limpet', // (existing site)
  waitlist: 'Not ready? Join the waitlist.', // (existing site)
};

export const footer = {
  pages: [
    { label: 'Founders', href: site.links.founders },
    { label: 'Mission', href: site.links.mission },
    { label: 'Join the waitlist', href: site.links.waitlist },
    { label: 'Contact', href: site.links.email },
  ],
  legal: `© ${new Date().getFullYear()} ${site.company}. iPhone 16 model by Zvoni10 (CC BY 4.0).`,
};
