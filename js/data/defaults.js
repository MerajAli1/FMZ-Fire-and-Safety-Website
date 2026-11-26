/**
 * Built-in content shown until the admin adds their own in the dashboard.
 * - Training programs / hero slides: replaced entirely once any exist in Firestore.
 * - Clients: shown alongside Firestore clients until the admin clicks
 *   "Import built-in clients" (which copies them into Firestore so they can be edited).
 */
export const BUILTIN_CLIENTS = [
  { name: 'Indus Motor Company', location: 'Port Qasim', category: 'automotive', imageUrl: 'assets/img/clients/indus-motor.webp', featured: true },
  { name: 'Iqra University', location: 'Karachi', category: 'education', imageUrl: 'assets/img/clients/iqra-university.webp', featured: true },
  { name: 'Meezan Bank', location: 'Pakistan', category: 'banking', imageUrl: 'assets/img/clients/meezan-bank.webp', featured: true },
  { name: 'Hilton Pharma', location: 'Karachi', category: 'pharma', imageUrl: 'assets/img/clients/hilton-pharma.webp', featured: true },
  { name: 'Nestlé Pakistan', location: 'Karachi', category: 'fmcg', imageUrl: 'assets/img/clients/nestle.webp', featured: true },
  { name: 'Younus Textile Mills', location: 'Group of Companies', category: 'textile', imageUrl: 'assets/img/clients/younus-textile.webp', featured: true },
  { name: 'Al Rahim Textile', location: 'Karachi', category: 'textile', imageUrl: 'assets/img/clients/al-rahim-textile.webp', featured: true },
  { name: 'Olympia Group of Companies', location: 'Karachi', category: 'textile', imageUrl: 'assets/img/clients/olympia.webp', featured: true },
  { name: 'Grace Apparel (Pvt) Ltd', location: 'Karachi', category: 'textile', imageUrl: 'assets/img/clients/grace-apparel.webp' },
  { name: 'Bin Qasim Packages', location: 'Karachi', category: 'packaging', imageUrl: 'assets/img/clients/bin-qasim.webp' },
  { name: 'Lucky Textile Mills', location: 'Karachi', category: 'textile', imageUrl: 'assets/img/clients/lucky-textile.webp' },
  { name: 'The City School', location: 'Karachi', category: 'education', imageUrl: 'assets/img/clients/city-school.webp', featured: true },
].map((c, i) => ({ id: `builtin-${i}`, order: i, ...c }));

export const DEFAULT_TRAININGS = [
  {
    title: 'Fire Safety Training', icon: 'fire-extinguisher', duration: '1 day',
    description: 'Fire prevention and response training including hands-on fire extinguisher practice.',
    features: ['Fire prevention techniques', 'Emergency response', 'Evacuation procedures'],
  },
  {
    title: 'First Aid Training', icon: 'first-aid', duration: '1–2 days',
    description: 'Essential first aid skills and emergency medical response for the workplace.',
    features: ['Basic life support', 'Wound management', 'CPR techniques'],
  },
  {
    title: 'Workplace Safety', icon: 'hard-hat', duration: '1 day',
    description: 'General workplace safety covering common hazards and preventive measures.',
    features: ['Hazard identification', 'Safe work practices', 'PPE usage'],
  },
  {
    title: 'Working at Height', icon: 'ladder', duration: '1 day',
    description: 'Specialised training for working at heights and fall-protection systems.',
    features: ['Fall protection systems', 'Safety harness use', 'Rescue procedures'],
  },
  {
    title: 'Chemical Safety', icon: 'flask', duration: '1 day',
    description: 'Safe handling and storage of hazardous materials and chemical safety protocols.',
    features: ['HAZMAT handling', 'Spill control', 'Safety data sheets'],
  },
  {
    title: 'Emergency Response', icon: 'heart-pulse', duration: '2 days',
    description: 'Emergency planning, crisis management and response-team coordination.',
    features: ['Crisis management', 'Emergency planning', 'Team coordination'],
  },
].map((t, i) => ({ id: `default-${i}`, order: i, ...t }));

/** The three hero slides hard-coded in index.html (shown until the admin adds slides). */
export const DEFAULT_SLIDES = [
  {
    imageUrl: 'assets/img/hero-1.webp',
    title: 'Protecting people, property & peace of mind',
    subtitle: 'Certified fire-safety training, quality safety equipment and expert consultancy for businesses across Pakistan.',
    ctaText: 'Get a free quote',
    ctaLink: 'contact.html',
  },
  {
    imageUrl: 'assets/img/hero-2.webp',
    title: 'Professional safety training that sticks',
    subtitle: 'Hands-on fire safety, first aid and emergency response courses delivered by certified trainers — at your site or ours.',
    ctaText: 'View training programs',
    ctaLink: 'training.html',
  },
  {
    imageUrl: 'assets/img/hero-3.webp',
    title: 'Safety equipment you can depend on',
    subtitle: 'Fire extinguishers, PPE, first-aid and emergency equipment for every type of workplace.',
    ctaText: 'Browse equipment',
    ctaLink: 'equipments.html',
  },
].map((s, i) => ({ id: `builtin-slide-${i}`, order: i + 1, ...s }));
