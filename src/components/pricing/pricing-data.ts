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
    q: 'What are Channel Doctor, Discover and Create?',
    a: 'They are the YouTube growth tools. Channel Doctor reads your own YouTube Analytics and explains why your channel is or isn’t growing. Discover follows your competitors and suggests what to make next. Create turns an idea into a brief, a script, titles and thumbnails, ready for the video maker. You can also analyze any video or channel to see why it works. The comparison table shows which plans include each one, and the growth tools section above shows what each run costs.',
  },
  {
    q: 'Is it safe to connect my YouTube channel?',
    a: 'Yes. We use YouTube’s official API with read-only permissions (your channel and video details, and your YouTube Analytics). We can never upload, edit, delete or comment on anything. Your access is stored encrypted, and you can disconnect at any time, which deletes it. See our Privacy Policy for exactly what we read and keep.',
  },
  {
    q: 'How are credits calculated and how many credits does one video require?',
    a: 'Scene images cost 2 credits each with the standard image model; higher-quality models cost more (see the comparison table). A full YouTube Launch Kit costs 15 credits, and AI voiceover costs about 3 credits per minute of narration. A typical 3-minute video uses about 70–90 credits, so the Creator plan’s 2,000 credits make about 22–28 such videos. The growth tools are charged per run, as shown above. MP4 rendering and downloads are free.',
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
    q: 'Does it support Bangla scripts and voiceovers?',
    a: 'Bangla scripts, yes: paste a Bangla or English script and the AI Director plans the scenes from it. Create also writes briefs, scripts, titles and hashtags in Bangla. For the voice, upload your own Bangla narration and the scenes and subtitles sync to it automatically. The AI voices speak English and 22 other languages; Bangla AI voices are not available yet.',
  },
  {
    q: 'Do unused credits roll over to the next month?',
    a: 'Yes! Renew before your plan ends (or within 24 hours after) and all unused credits roll over on top of your new quota, and any days left on your plan are added to the new period. If a plan is not renewed within 24 hours of expiring, the remaining credits (including top-ups) expire and the account returns to the free Trial.',
  },
  {
    q: 'How do instant credit top-up packs work?',
    a: 'If you run out of credits early, you can buy a top-up pack from your Plan page and pay via bKash or Nagad. Top-up credits stay valid as long as your plan is active.',
  },
];

/**
 * Rows that are the same on every plan. Credits, video estimates, growth tools and image models
 * are built from live data in the comparison table; nothing here claims a plan difference the
 * app doesn't enforce.
 */
export const COMPARISON_ROWS: ComparisonRowItem[] = [
  {
    name: 'Video export',
    starter: '1080p & 4K MP4',
    creator: '1080p & 4K MP4',
    studio: '1080p & 4K MP4',
  },
  {
    name: 'Aspect ratios (16:9, 9:16, 1:1)',
    starter: 'All 3',
    creator: 'All 3',
    studio: 'All 3',
  },
  {
    name: 'Watermark',
    starter: 'None',
    creator: 'None',
    studio: 'None',
  },
  {
    name: 'AI voiceover',
    starter: '23 languages + your own Bangla recording',
    creator: '23 languages + your own Bangla recording',
    studio: '23 languages + your own Bangla recording',
  },
  {
    name: 'Commercial use (YouTube, Facebook)',
    starter: 'Included',
    creator: 'Included',
    studio: 'Included',
  },
  {
    name: 'Support',
    starter: 'Email & ticket',
    creator: 'Priority WhatsApp',
    studio: '1-on-1 account manager',
  },
];
