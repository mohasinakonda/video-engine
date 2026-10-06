import {
  Subtitles,
  Smartphone,
  Move,
  CloudLightning,
  Languages,
  ShieldCheck,
  FileCode2,
  BadgeDollarSign,
  Camera,
  Play,
  Film,
  Sparkles,
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
    title: 'Cinematic Film',
    tag: 'Documentary & Sci-Fi',
    description: 'Volumetric atmospheric lighting, anamorphic 35mm lens grain, deep shadows, and cinematic color science.',
    prompt: '70mm IMAX documentary cinematography, photorealistic 8k, pristine optical clarity, natural balanced lighting',
    images: [
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278399392_70mm_imax_photorealism.jpg',
        caption: '70mm IMAX Photorealism',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281261838_35mm_vintage_kodachrome.jpg',
        caption: '35mm Vintage Kodachrome',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281283943_classic_film_noir.jpg',
        caption: 'Classic Film Noir',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281310550_bbc_earth_macro_cosmos.jpg',
        caption: 'BBC Earth Macro Cosmos',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281330212_cyberpunk_neon_noir.jpg',
        caption: 'Cyberpunk Neon Noir',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278736152_16mm_gritty_documentary.jpg',
        caption: '16mm Gritty Documentary',
      },
    ],
  },
  {
    id: 'animation',
    title: 'Animation & Anime',
    tag: 'Studio & Stop-Motion',
    description: 'Nostalgic watercolor skies, cyberpunk anime linework, tactile stop-motion clay, and hand-drawn character design.',
    prompt: 'Studio Ghibli nostalgic anime aesthetic, lush watercolor meadows, painterly clouds, gentle emotional atmosphere',
    images: [
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281431651_studio_ghibli_nostalgia.jpg',
        caption: 'Studio Ghibli Nostalgia',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281463993_90s_retro_cyberpunk_anime.jpg',
        caption: '90s Retro Cyberpunk Anime',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281486029_makoto_shinkai_high_gloss.jpg',
        caption: 'Makoto Shinkai High-Gloss',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281505995_claymation___stop_motion_3d.jpg',
        caption: 'Claymation & Stop-Motion 3D',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281528176_1930s_rubber_hose_animation.jpg',
        caption: '1930s Rubber Hose Animation',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281549673_papercraft___shadowbox_3d.jpg',
        caption: 'Papercraft & Shadowbox 3D',
      },
    ],
  },
  {
    id: 'printmaking',
    title: 'Print & Relief',
    tag: 'Woodblock & Risograph',
    description: 'Hand-carved linocut grooves, traditional Japanese Ukiyo-e, Franco-Belgian ligne claire, and tactile screenprints.',
    prompt: 'Intricate masterwork linocut relief print by an artisan printmaker, deeply carved woodblock style on cream archival paper',
    images: [
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278794685_artisan_linocut_relief.jpg',
        caption: 'Artisan Linocut Relief',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281358860_japanese_ukiyo_e_woodblock.jpg',
        caption: 'Japanese Ukiyo-e Woodblock',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278915070_french_ligne_claire_comic.jpg',
        caption: 'French Ligne Claire Comic',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281384842_risograph_screenprint.jpg',
        caption: 'Risograph Screenprint',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791279321369_editorial_gouache___collage.jpg',
        caption: 'Editorial Gouache & Collage',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281408125_copperplate_etching___engraving.jpg',
        caption: 'Copperplate Etching & Engraving',
      },
    ],
  },
  {
    id: 'painting',
    title: 'Fine Art Painting',
    tag: 'Oil, Ink & Chiaroscuro',
    description: 'Rich impasto oil canvas strokes, meditative sumi-e zen ink washes, dramatic baroque light, and wet watercolors.',
    prompt: 'Impressionist oil painting on linen canvas, visible textured palette knife marks, rich impasto, museum masterpiece',
    images: [
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281588480_impressionist_oil_canvas.jpg',
        caption: 'Impressionist Oil Canvas',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281610044_sumi_e_zen_ink_wash.jpg',
        caption: 'Sumi-e Zen Ink Wash',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281640375_baroque_dramatic_chiaroscuro.jpg',
        caption: 'Baroque Dramatic Chiaroscuro',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281859509_surrealist_symbolic_dreamscape.jpg',
        caption: 'Surrealist Symbolic Dreamscape',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281838961_wet_on_wet_luminous_watercolor.jpg',
        caption: 'Wet-on-Wet Luminous Watercolor',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281697861_1970s_polaroid_sx_70.jpg',
        caption: '1970s Polaroid SX-70',
      },
    ],
  },
  {
    id: 'graphic',
    title: 'Graphic & Digital',
    tag: 'Vector, Isometric & Retro',
    description: 'Clean modern 2D flat vectors, Bauhaus constructivism, isometric 3D dioramas, and retro synthwave wireframes.',
    prompt: 'Modern 2D flat vector graphic illustration, clean geometric shapes, balanced minimalist negative space',
    images: [
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281813178_modern_2d_flat_vector.jpg',
        caption: 'Modern 2D Flat Vector',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281786610_bauhaus___constructivism.jpg',
        caption: 'Bauhaus & Constructivism',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281764443_isometric_3d_diorama.jpg',
        caption: 'Isometric 3D Diorama',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281742344_cyanotype_technical_blueprint.jpg',
        caption: 'Cyanotype Technical Blueprint',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281720461_retro_synthwave___wireframe.jpg',
        caption: 'Retro Synthwave & Wireframe',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281676476_1980s_vhs_magnetic_tape.jpg',
        caption: '1980s VHS Magnetic Tape',
      },
    ],
  },
];

// ─── Dedicated curated unique presets for each landing section (Zero duplicates across the page) ───
export const LANDING_SECTION_IMAGES = {
  hero: [
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281330212_cyberpunk_neon_noir.jpg',
      caption: 'Cyberpunk Neon Noir',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281463993_90s_retro_cyberpunk_anime.jpg',
      caption: '90s Retro Cyberpunk Anime',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278399392_70mm_imax_photorealism.jpg',
      caption: '70mm IMAX Photorealism',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281431651_studio_ghibli_nostalgia.jpg',
      caption: 'Studio Ghibli Nostalgia',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281859509_surrealist_symbolic_dreamscape.jpg',
      caption: 'Surrealist Symbolic Dreamscape',
    },
  ],
  howItWorks: {
    visualGeneration: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281486029_makoto_shinkai_high_gloss.jpg',
    finalVideo: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281261838_35mm_vintage_kodachrome.jpg',
  },
  sceneBuilder: [
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278736152_16mm_gritty_documentary.jpg',
      title: 'Scene 01: 16mm Gritty Documentary',
      duration: '7s',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281310550_bbc_earth_macro_cosmos.jpg',
      title: 'Scene 02: BBC Earth Macro Cosmos',
      duration: '7s',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281283943_classic_film_noir.jpg',
      title: 'Scene 03: Classic Film Noir',
      duration: '6s',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281588480_impressionist_oil_canvas.jpg',
      title: 'Scene 04: Impressionist Oil Canvas',
      duration: '6s',
    },
  ],
  narrationTimeline: [
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281358860_japanese_ukiyo_e_woodblock.jpg',
      title: 'Japanese Ukiyo-e Woodblock',
      duration: '7s',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281838961_wet_on_wet_luminous_watercolor.jpg',
      title: 'Luminous Watercolor',
      duration: '8s',
    },
    {
      url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281610044_sumi_e_zen_ink_wash.jpg',
      title: 'Sumi-e Zen Ink Wash',
      duration: '9s',
    },
  ],
  storyboard: {
    viewport: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281640375_baroque_dramatic_chiaroscuro.jpg',
    scrubber: [
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278794685_artisan_linocut_relief.jpg',
        title: 'Artisan Linocut Relief',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791278915070_french_ligne_claire_comic.jpg',
        title: 'French Ligne Claire Comic',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281384842_risograph_screenprint.jpg',
        title: 'Risograph Screenprint',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791279321369_editorial_gouache___collage.jpg',
        title: 'Editorial Gouache & Collage',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281408125_copperplate_etching___engraving.jpg',
        title: 'Copperplate Etching',
      },
      {
        url: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281505995_claymation___stop_motion_3d.jpg',
        title: 'Claymation & Stop-Motion 3D',
      },
    ],
  },
  readyToCreate: [
    'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281528176_1930s_rubber_hose_animation.jpg',
    'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281549673_papercraft___shadowbox_3d.jpg',
    'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281813178_modern_2d_flat_vector.jpg',
    'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281764443_isometric_3d_diorama.jpg',
    'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/thumb_1791281742344_cyanotype_technical_blueprint.jpg',
  ],
};

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
    icon: Subtitles,
    title: 'Auto Subtitle Sync',
    desc: 'Generates precision word-by-word animated captions and exports .srt / .vtt files.',
  },
  {
    icon: Smartphone,
    title: 'Multi-Aspect Ratio',
    desc: 'Instant 1-click toggle between 16:9 Landscape (YouTube) and 9:16 Vertical (Shorts/Reels).',
  },
  {
    icon: Move,
    title: 'Ken Burns Motion Engine',
    desc: 'Cinematic pans, zooms, and camera tilt animations breathe dynamic life into static scenes.',
  },
  {
    icon: CloudLightning,
    title: 'High-Speed Cloud Render',
    desc: 'Lightning-fast cloud processing renders 1080p MP4s without heating your device or draining battery.',
  },
  {
    icon: Languages,
    title: 'Multi-Language Voices',
    desc: 'Lifelike emotional AI voiceovers in Bangla, English, Hindi, and 30+ international languages.',
  },
  {
    icon: ShieldCheck,
    title: 'Zero Watermark Masters',
    desc: '100% clean, high-bitrate MP4 exports ready for television, advertising, or online release.',
  },
  {
    icon: FileCode2,
    title: 'NLE Timeline Export',
    desc: 'Export structured XML/EDL timelines directly into Adobe Premiere Pro and DaVinci Resolve.',
  },
  {
    icon: BadgeDollarSign,
    title: 'Commercial License',
    desc: 'Full monetization rights on YouTube Partner Program, Facebook Reels, client gigs, and agency work.',
  },
];

export const SAMPLE_SCRIPTS = [
  "In 1969, humanity took its first steps on the lunar surface. Looking back at Earth from the quiet desert of space, the view reshaped our destiny forever.",
  "Deep beneath the ancient ocean trenches lies an unexplored biosphere illuminated only by bioluminescent creatures that defy our understanding of biology.",
  "Artificial intelligence has transformed from simple algorithmic logic into creative partners that can visualize dreams and bring stories to life in seconds.",
];
