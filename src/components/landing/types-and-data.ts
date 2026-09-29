import {
  FileText,
  Split,
  Camera,
  AudioLines,
  SlidersHorizontal,
  Sparkles,
  Clock,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Style Presets with Multi-Scene Cohesive Galleries ─────────────────────────

export interface ArtStylePreset {
  id: string;
  title: string;
  tag: string;
  description: string;
  prompt: string;
  images: {
    url: string;
    caption: string;
    aspect?: string;
  }[];
}

export const FEATURED_STYLES: ArtStylePreset[] = [
  {
    id: 'cinematic',
    title: 'Cinematic',
    tag: 'Film & Scenic',
    description: 'Natural volumetric lighting, Kodak 500T 35mm grain, anamorphic shallow depth of field, and documentary warmth.',
    prompt: 'Cinematic wide shot, soft golden haze, anamorphic 35mm film photography, 8k resolution, natural color grading',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
        caption: 'Alpine mountain valley and clear stream',
      },
      {
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        caption: 'River canyon and pine forest reflection',
      },
      {
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        caption: 'Sunset silhouette facing the golden horizon',
      },
      {
        url: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80',
        caption: 'Dramatic coastal fjord and ocean cliffs',
      },
      {
        url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80',
        caption: 'Sports car on scenic forest highway',
      },
      {
        url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
        caption: 'Desert sandstone peaks at twilight',
      },
    ],
  },
  {
    id: 'documentary',
    title: 'Documentary',
    tag: 'Historical & Lore',
    description: 'Historical authenticity, aged stone textures, golden hour dust particles, and timeless architectural grandeur.',
    prompt: 'Ancient palace courtyard, dramatic dust beams through carved stone pillars, historical documentary photography, hyper-detailed',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=800&q=80',
        caption: 'Ancient terracotta palace',
      },
      {
        url: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80',
        caption: 'Mountain stone citadel',
      },
      {
        url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80',
        caption: 'Golden desert expedition',
      },
      {
        url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=800&q=80',
        caption: 'Archive library sanctuary',
      },
      {
        url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80',
        caption: 'Classical amphitheater dusk',
      },
      {
        url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80',
        caption: 'Misty fortress courtyard',
      },
    ],
  },
  {
    id: 'editorial',
    title: 'Editorial',
    tag: 'Fashion & Polish',
    description: 'Crisp studio lighting, high-fashion compositions, elegant color blocking, and refined visual aesthetics.',
    prompt: 'Editorial fashion portrait, clean studio lighting, high key elegance, contemporary color grading',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        caption: 'High fashion portrait',
      },
      {
        url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
        caption: 'Editorial studio composition',
      },
      {
        url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
        caption: 'Minimal fashion colorblock',
      },
      {
        url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
        caption: 'Haute couture texture study',
      },
      {
        url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=800&q=80',
        caption: 'Runway silhouette motion',
      },
      {
        url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
        caption: 'Metropolitan fashion aesthetic',
      },
    ],
  },
  {
    id: 'vintage',
    title: 'Vintage',
    tag: 'Warm 35mm Retro',
    description: 'Hand-painted watercolor aesthetic, nostalgic pastel skies, emotional warmth, and classic analog character.',
    prompt: 'Vintage 35mm warm film photography, nostalgic color palette, golden sun rays, retro aesthetic',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80',
        caption: 'Vintage train journey',
      },
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        caption: 'Warm retro room interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80',
        caption: 'Sunbeam enchanted forest',
      },
      {
        url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
        caption: 'Pastoral countryside dawn',
      },
      {
        url: 'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=800&q=80',
        caption: 'Retro coastline warm hour',
      },
      {
        url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
        caption: 'Riverside misty sunrise',
      },
    ],
  },
  {
    id: 'minimal',
    title: 'Minimal',
    tag: 'Architectural Clean',
    description: 'Pure geometry, balanced negative space, subtle monochromes, and refined architectural structure.',
    prompt: 'Architectural minimalism, crisp geometric lines, balanced negative space, clean modernist aesthetics',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
        caption: 'Modernist skyscraper geometry',
      },
      {
        url: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80',
        caption: 'Clean white facade architecture',
      },
      {
        url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80',
        caption: 'Minimalist creative workspace',
      },
      {
        url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
        caption: 'Clean silhouette monochrome',
      },
      {
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
        caption: 'Spacious contemporary interior',
      },
      {
        url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
        caption: 'Cosmic orbit horizon',
      },
    ],
  },
  {
    id: 'custom',
    title: 'Custom',
    tag: 'Creative Prompting',
    description: 'Dynamic cyberpunk neon, futuristic textures, rain reflections, and bespoke artistic direction.',
    prompt: 'Cyberpunk mega-city street at midnight in heavy neon rain, holographic billboards reflecting on wet pavement',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80',
        caption: 'Rain-slicked neon street',
      },
      {
        url: 'https://images.unsplash.com/photo-1515260268569-9271009adfdb?auto=format&fit=crop&w=800&q=80',
        caption: 'Cybernetic character study',
      },
      {
        url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
        caption: 'Skyline highway overpass lights',
      },
      {
        url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=800&q=80',
        caption: 'Underground city alley',
      },
      {
        url: 'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80',
        caption: 'Dynamic velocity light trail',
      },
      {
        url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
        caption: 'Digital abstract matrix',
      },
    ],
  },
];

// ─── 6 Process Steps ──────────────────────────────────────────────────────────

export const PROCESS_STEPS = [
  {
    num: '01',
    label: 'Script',
    title: 'Add your script',
    desc: 'Paste your story, video narration, or upload a custom MP3 audio recording.',
    badge: 'Text or Audio',
  },
  {
    num: '02',
    label: 'Analyze',
    title: 'AI analyzes',
    desc: 'The intelligent NLP engine identifies key visual points, pacing, and emotional tone.',
    badge: 'Gemini NLP',
  },
  {
    num: '03',
    label: 'Scenes',
    title: 'Scene planning',
    desc: 'Breaks down narration into timed scenes with prompt direction and camera motion.',
    badge: 'Autonomous Director',
  },
  {
    num: '04',
    label: 'Visuals',
    title: 'Visual generation',
    desc: 'Generates cohesive 8K resolution images adhering to your chosen master style.',
    badge: 'Pollinations AI',
  },
  {
    num: '05',
    label: 'Narration',
    title: 'Voiceover & Audio',
    desc: 'Synthesizes realistic human voices or aligns your uploaded voiceover with Whisper.',
    badge: 'Whisper Sync',
  },
  {
    num: '06',
    label: 'Video',
    title: 'Final 1080p video',
    desc: 'Hardware-accelerated muxing produces a smooth MP4 video with synced subtitles.',
    badge: 'Single-Pass MP4',
  },
];

// ─── Key Features Matrix ──────────────────────────────────────────────────────

export interface CoreFeatureItem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export const CORE_FEATURES: CoreFeatureItem[] = [
  {
    icon: FileText,
    title: 'Script Analysis',
    desc: 'Understand your story and structure.',
  },
  {
    icon: Split,
    title: 'Automatic Scene Planning',
    desc: 'Turn long-form narration into editable scenes.',
  },
  {
    icon: Camera,
    title: 'AI Visual Generation',
    desc: 'Create relevant visuals for each scene.',
  },
  {
    icon: AudioLines,
    title: 'Voice Generation',
    desc: 'Natural, expressive narration.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Scene Controls',
    desc: 'Regenerate, reorder and customize scenes.',
  },
  {
    icon: Sparkles,
    title: 'Style Consistency',
    desc: 'Keep a unified visual style across your video.',
  },
  {
    icon: Clock,
    title: 'Timeline Export',
    desc: 'Continue editing in Premiere Pro or DaVinci Resolve.',
  },
  {
    icon: Video,
    title: 'Multiple Formats',
    desc: 'Download in HD, 4K and other formats.',
  },
];

export const SAMPLE_SCRIPTS = [
  "In 1969, humanity took its first steps on the lunar surface. Looking back at Earth from the quiet desert of space, the view reshaped our destiny forever.",
  "Deep beneath the ancient ocean trenches lies an unexplored biosphere illuminated only by bioluminescent creatures that defy our understanding of biology.",
  "Artificial intelligence has transformed from simple algorithmic logic into creative partners that can visualize dreams and bring stories to life in seconds.",
];
