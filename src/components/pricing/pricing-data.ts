export interface CreatorFaqItem {
  q: string;
  a: string;
}

export interface ComparisonRowItem {
  name: string;
  starter: string;
  creator: string;
  studio: string;
}

export const CREATOR_FAQS: CreatorFaqItem[] = [
  {
    q: 'How are credits calculated and how many credits does one video require?',
    a: 'Each newly generated scene image costs 2 credits. Generating a full YouTube Launch Kit (viral CTR titles, 3 thumbnail prompts, description, tags, and market intelligence) costs 15 credits. A typical 1-minute video contains 10–12 scenes (~20–24 credits). On our Creator plan (2,000 credits), you can generate up to 1,000 images or 35–45 complete videos with full launch kits. AI voiceovers and MP4 rendering are 100% free!',
  },
  {
    q: 'Can I monetize the generated videos on YouTube and Facebook?',
    a: 'Yes, 100% monetization-safe! All videos produced under paid subscriptions include a Full Commercial License. You have complete commercial rights to publish and monetize on YouTube, Facebook Reels, Instagram, and TikTok with zero copyright strike issues.',
  },
  {
    q: 'How quickly are credits activated after bKash or Nagad payment?',
    a: 'Once you submit the payment form and tap "Message Admin on WhatsApp", our team receives your verification request immediately. During active hours, your account and credits are typically activated within 5 to 15 minutes.',
  },
  {
    q: 'Will there be any watermark or logo on my exported videos?',
    a: 'No! There are absolutely zero watermarks or logos on any paid subscription (Starter, Creator, or Studio Pro). You receive pristine, high-definition video files ready for professional publishing.',
  },
  {
    q: 'Does it support Bengali scripts and voiceovers?',
    a: 'Yes! Our engine has native support for both Bengali and English scripts. Simply paste your narration script, and our AI Director will generate culturally coherent scene prompts while syncing natural AI narration (male & female voices).',
  },
  {
    q: 'Do unused credits roll over to the next month?',
    a: 'Yes! If you renew your subscription before your active billing cycle expires, all unused credits automatically roll over and stack on top of your fresh monthly quota.',
  },
  {
    q: 'How do instant credit top-up packs work?',
    a: 'If you exhaust your monthly quota early, active plan subscribers can instantly purchase 50, 100, or 250 credit packs via bKash or Nagad. Top-up credits never expire.',
  },
];

export const COMPARISON_ROWS: ComparisonRowItem[] = [
  {
    name: 'Monthly Credits Quota',
    starter: '600 Credits (300 Images)',
    creator: '2,000 Credits (1,000 Images)',
    studio: '3,500 Credits (1,750 Images)',
  },
  {
    name: 'Credit Consumption Rate',
    starter: '2 cr/img · 15 cr/YouTube kit',
    creator: '2 cr/img · 15 cr/YouTube kit',
    studio: '2 cr/img · 15 cr/YouTube kit',
  },
  {
    name: 'Estimated Finished Videos',
    starter: '~12–15 Full Videos',
    creator: '~35–45 Full Videos',
    studio: '~80+ Full Videos',
  },
  {
    name: 'Max Video Length (Per Project)',
    starter: '3 Minutes (Shorts/Reels)',
    creator: '10 Minutes (Mid-form & Stories)',
    studio: '20 Minutes (Long Documentaries)',
  },
  {
    name: 'Video Export Resolution',
    starter: '1080p Full HD',
    creator: '1080p Full HD',
    studio: '4K Ultra HD Crisp',
  },
  {
    name: 'Aspect Ratios (16:9, 9:16, 1:1)',
    starter: 'All 3 Formats Supported',
    creator: 'All 3 Formats Supported',
    studio: 'All 3 Formats Supported',
  },
  {
    name: 'Watermark Policy',
    starter: 'Zero Watermark (Clean)',
    creator: 'Zero Watermark (Clean)',
    studio: 'Zero Watermark (Clean)',
  },
  {
    name: 'AI Voiceover Narration (TTS)',
    starter: 'Bengali & English Included',
    creator: 'Bengali, English & 30+ Accents',
    studio: 'Studio Quality Voices + Audio FX',
  },
  {
    name: 'Script-to-Scenes AI Director',
    starter: 'Standard AI Director',
    creator: 'Advanced Visual Director',
    studio: 'Deep Storyboard AI Director',
  },
  {
    name: 'Visual Art Style Presets',
    starter: '10+ Curated Styles',
    creator: '20+ Styles + Character Consistency',
    studio: 'Unlimited Styles + VIP Prompt Fine-tuning',
  },
  {
    name: 'Cloud Rendering Queue Speed',
    starter: 'Standard Cloud Queue',
    creator: 'Priority Cloud Processing',
    studio: 'Instant Dedicated Supercluster',
  },
  {
    name: 'Simultaneous Active Projects',
    starter: 'Up to 3 Projects',
    creator: 'Up to 10 Projects',
    studio: 'Unlimited Projects',
  },
  {
    name: 'Commercial Use License',
    starter: 'Included (100% Monetizable)',
    creator: 'Included (100% Monetizable)',
    studio: 'Full Enterprise Commercial License',
  },
  {
    name: 'Customer Support SLA',
    starter: 'Standard Email & Ticket Support',
    creator: 'Priority WhatsApp Live Chat',
    studio: '1-on-1 Dedicated Account Manager',
  },
];
