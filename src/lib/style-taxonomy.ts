import type { BaseStylePreset } from '@/types';

export interface StyleFamily {
  id: string;
  name: string;
  icon: string;
  tagline: string;
}

export interface SubStylePreset extends BaseStylePreset {
  familyId: string;
  tag: string;
  description: string;
  thumbnailUrl: string;
}

export const CORE_FAMILIES: StyleFamily[] = [
  {
    id: 'all',
    name: 'All Styles',
    icon: 'Sparkles',
    tagline: 'Browse complete catalog',
  },
  {
    id: 'cinematic',
    name: 'Cinematic Film',
    icon: 'Camera',
    tagline: 'Real lenses, film grain & documentary scale',
  },
  {
    id: 'printmaking',
    name: 'Print & Relief',
    icon: 'Layers',
    tagline: 'Linocut, woodblock, risograph & etching',
  },
  {
    id: 'animation',
    name: 'Animation & Anime',
    icon: 'Film',
    tagline: 'Studio Ghibli, 90s anime, claymation & papercraft',
  },
  {
    id: 'painting',
    name: 'Fine Art Painting',
    icon: 'Palette',
    tagline: 'Oil canvas, sumi-e ink, baroque & watercolor',
  },
  {
    id: 'graphic',
    name: 'Graphic & Digital',
    icon: 'Sliders',
    tagline: '2D flat vector, isometric 3D & bauhaus',
  },
  {
    id: 'vintage',
    name: 'Retro Analog',
    icon: 'Clock',
    tagline: '1970s polaroid, 16mm indie & 80s VHS',
  },
];

export const SUB_STYLES_CATALOG: SubStylePreset[] = [
  // ─── 1. Cinematic Film ────────────────────────────────────────────────────────
  {
    id: 'sub_imax_doc',
    familyId: 'cinematic',
    name: '70mm IMAX Photorealism',
    tag: 'Ultra-High Clarity',
    description: 'Pristine 8K documentary cinematography, natural lighting, exceptional realism, IMAX standard.',
    stylePrompt:
      '70mm IMAX documentary cinematography, photorealistic 8k, pristine optical clarity, natural balanced lighting, subtle cinematic depth of field, authentic real-world textures, masterwork composition, shot on Panavision 70mm lens',
    negativePrompt:
      'cartoon, anime, 3D render, CGI, glossy, blurry, distorted faces, low resolution, oversaturated, text, watermark, signature',
    aspectRatio: '16:9',
    isDefault: true,
    isBuiltIn: true,
    createdAt: 1,
    thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_35mm_kodachrome',
    familyId: 'cinematic',
    name: '35mm Vintage Kodachrome',
    tag: 'Warm 1970s Cinema',
    description: 'Rich archival film grain, warm earthy tones, gentle halation, and nostalgic documentary warmth.',
    stylePrompt:
      'Authentic 35mm Kodachrome color film photography, warm golden highlight halation, organic silver halide grain texture, muted archival color grade, soft shadows, 1970s National Geographic documentary look, master framing',
    negativePrompt:
      'digital render, glossy, CGI, flat vector, neon, oversaturated, modern digital sensor look, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 2,
    thumbnailUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_classic_noir',
    familyId: 'cinematic',
    name: 'Classic Film Noir',
    tag: 'Monochrome Chiaroscuro',
    description: 'High-contrast black & white, deep theatrical shadows, Venetian blind light beams, and dramatic tension.',
    stylePrompt:
      'Classic black and white 35mm film noir cinematography, dramatic chiaroscuro high-contrast lighting, deep pitch shadows, silvery specular highlights, volumetric haze, atmospheric smoke, sharp focus, 1940s cinema aesthetic',
    negativePrompt:
      'color, sepia, cartoon, anime, blurry, low contrast, washed out, modern digital graphics, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 3,
    thumbnailUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_macro_wildlife',
    familyId: 'cinematic',
    name: 'BBC Earth Macro Cosmos',
    tag: 'Microscopic Detail',
    description: 'Extreme micro detail, shallow depth of field bokeh, tactile surface textures, and scientific wonder.',
    stylePrompt:
      'BBC Earth macro cinematography, ultra-detailed micro lens photography, tactile crystalline surface textures, shallow depth of field with creamy circular bokeh, natural diffused ambient lighting, 8k scientific clarity',
    negativePrompt:
      'illustration, flat, anime, CGI video game, blurry subject, oversaturated, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 4,
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_cyberpunk_neon',
    familyId: 'cinematic',
    name: 'Cyberpunk Neon Noir',
    tag: 'Rain & Holographic Fog',
    description: 'Futuristic night metropolis, rain-slicked asphalt, vibrant cyan/magenta reflections, volumetric atmosphere.',
    stylePrompt:
      'Futuristic cyberpunk neon noir cinematography, anamorphic lens flare, rain-slicked reflective pavement, volumetric atmospheric fog, cyan and magenta rim lighting, deep shadows, Blade Runner 2049 aesthetic, photorealistic 8k',
    negativePrompt:
      'daylight, countryside, rustic, flat illustration, cartoon, low resolution, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 5,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_16mm_indie',
    familyId: 'cinematic',
    name: '16mm Gritty Documentary',
    tag: 'Textured Analog Grain',
    description: 'Raw tactile cinema vérité, visible film gate weave, authentic analog color fidelity, and gritty realism.',
    stylePrompt:
      'Raw 16mm motion picture film stock, visible organic grain, tactile cinema vérité style, naturalistic documentary framing, slight edge vignette, muted natural tones, vintage Bolex camera aesthetic',
    negativePrompt:
      'smooth digital, plastic 3D, CGI, glossy, oversaturated, modern 4k sharpness, cartoon, text, watermark',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 6,
    thumbnailUrl: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80',
  },

  // ─── 2. Printmaking & Relief ──────────────────────────────────────────────────
  {
    id: 'sub_artisan_linocut',
    familyId: 'printmaking',
    name: 'Artisan Linocut Relief',
    tag: 'Hand-Carved Woodblock',
    description: 'Deeply carved grooves, tactile ink press texture on fibrous archival cream paper, and bold chiseled contrast.',
    stylePrompt:
      'Intricate masterwork linocut relief print by an artisan printmaker, deeply carved woodblock style, chiseled relief grooves, rough tactile ink press texture on fibrous cream archival paper (#FAF8F5), heavy contrasting black ink, organic cross-hatching, museum-quality editorial relief art',
    negativePrompt:
      'photorealism, 3D render, CGI, glossy, smooth vector gradients, plastic, modern UI, neon, oversaturated, pure white, pure black, blurry, text, watermark',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 7,
    thumbnailUrl: 'https://xvctobddvxmvohicrenf.supabase.co/storage/v1/object/public/scene-images/styles/1790875798525_image.webp',
  },
  {
    id: 'sub_ukiyo_e',
    familyId: 'printmaking',
    name: 'Japanese Ukiyo-e Woodblock',
    tag: 'Hokusai & Edo Period',
    description: 'Traditional Japanese woodblock print, washi paper texture, mineral pigment colors, and iconic wave curves.',
    stylePrompt:
      'Traditional Japanese Ukiyo-e woodblock print, Edo period aesthetic, hand-pressed on textured washi mulberry paper, mineral pigment color palette of indigo blue, muted vermilion and tea-leaf green, fine inked keylines, wood grain texture, Hokusai and Hiroshige masterwork',
    negativePrompt:
      'photorealistic, 3D CGI, western cartoon, neon colors, plastic, modern digital gradients, text, watermark',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 8,
    thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_ligne_claire',
    familyId: 'printmaking',
    name: 'French Ligne Claire Comic',
    tag: 'Tintin Franco-Belgian Line',
    description: 'Crisp uniform black ink outlines, flat solid color tones, architectural perspective, and classic European comic art.',
    stylePrompt:
      'Ligne claire Franco-Belgian comic illustration, strong uniform weight black ink linework, clean flat solid color fills, zero shading gradients, precise architectural perspective, clear readability, Hergé and Moebius classic graphic novel aesthetic',
    negativePrompt:
      'photorealism, 3D render, blurry, messy sketches, digital airbrush, dark muddy shadows, text, watermark',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 9,
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_risograph',
    familyId: 'printmaking',
    name: 'Risograph Screenprint',
    tag: 'Halftone Duotone Zine',
    description: 'Vibrant soy-based ink layering, tactile halftone dot screens, slight ink misalignment, and indie press zine charm.',
    stylePrompt:
      'Authentic Risograph duotone art print, vibrant overlapping translucent inks in teal and fluorescent coral, organic halftone dot texture, visible paper fiber on warm uncoated paper stock, slight registration misprint aesthetic, award-winning indie press publication',
    negativePrompt:
      'glossy 3D render, photorealism, smooth gradients, airbrushed, CGI, generic vector, text, watermark',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 10,
    thumbnailUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_botanical_etching',
    familyId: 'printmaking',
    name: 'Copperplate Etching & Engraving',
    tag: 'Archival Scientific Lore',
    description: 'Intricate cross-hatched copperplate engraving on aged parchment, tea-stained sepia tones, and antique heritage.',
    stylePrompt:
      'Antique copperplate intaglio etching, fine cross-hatching and stippled shading, hand-printed on aged foxed vellum parchment, rich sepia and charcoal ink, vintage scientific expedition documentation aesthetic, museum archive engraving',
    negativePrompt:
      'modern digital art, 3D, CGI, neon colors, plastic, glossy, cartoon, anime, watermark, signature',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 11,
    thumbnailUrl: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_editorial_gouache',
    familyId: 'printmaking',
    name: 'Editorial Gouache & Collage',
    tag: 'New Yorker Cover Art',
    description: 'Opaque matte paint, dry brush texture on toothy paper, sophisticated limited palette, and poetic storytelling.',
    stylePrompt:
      'Editorial gouache illustration on heavy rough paper, opaque matte paint layers, dry brushstroke textures, limited harmonious palette of terracotta, sage olive and slate blue, poetic visual metaphor, New Yorker magazine cover art quality',
    negativePrompt:
      'photorealism, 3D CGI, smooth plastic gradients, glossy, neon, oversaturated, amateur sketch, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 12,
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
  },

  // ─── 3. Animation & Anime ─────────────────────────────────────────────────────
  {
    id: 'sub_ghibli_watercolor',
    familyId: 'animation',
    name: 'Studio Ghibli Nostalgia',
    tag: 'Lush Hand-Painted Skies',
    description: 'Breathtaking hand-painted gouache backgrounds, majestic cumulus clouds, emotional warmth, and Miyazaki magic.',
    stylePrompt:
      'Studio Ghibli hand-painted anime background, lush verdant landscapes, majestic billowing summer clouds, soft emotional sunlight, hand-painted gouache and watercolor textures, Hayao Miyazaki film aesthetic, master animation art',
    negativePrompt:
      'photorealistic, 3D CGI render, dark gritty, modern harsh vectors, airbrushed plastic, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 13,
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_90s_akira_anime',
    familyId: 'animation',
    name: '90s Retro Cyberpunk Anime',
    tag: 'Hand-Inked Cel Shading',
    description: 'Classic 1980s-90s anime film aesthetic, hand-inked acetate cels, dramatic shadow cuts, and analog warmth.',
    stylePrompt:
      '1990s retro anime film aesthetic, hand-painted animation cels, crisp dark ink lines, sharp cel shading with two-tone shadows, subtle 35mm film grain and gate blur, Akira and Ghost in the Shell vintage OVA animation aesthetic',
    negativePrompt:
      'photorealistic, modern 3D CGI, flat corporate vector, blurry, oversaturated modern digital gradients, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 14,
    thumbnailUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_makoto_shinkai',
    familyId: 'animation',
    name: 'Makoto Shinkai High-Gloss',
    tag: 'Luminous Sky Illumination',
    description: 'Hyper-detailed twilight skies, vibrant cinematic lens flares, reflective raindrops, and stunning emotional scale.',
    stylePrompt:
      'Makoto Shinkai modern anime cinema style, hyper-detailed twilight sky with radiant light beams, vibrant atmospheric reflections, glowing city lights, dramatic emotional color palette of violet, gold and azure, Your Name animation fidelity',
    negativePrompt:
      'photorealistic 3D, dull colors, rough sketches, low resolution, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 15,
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_claymation_stopmotion',
    familyId: 'animation',
    name: 'Claymation & Stop-Motion 3D',
    tag: 'Handcrafted Plasticine',
    description: 'Physical handcrafted clay figures, visible fingerprint impressions, studio miniature lighting, and tactile warmth.',
    stylePrompt:
      'Authentic claymation stop-motion animation aesthetic, sculpted plasticine clay characters with visible subtle fingerprint textures, miniature practical studio lighting, shallow depth of field, Aardman and Laika handcrafted film aesthetic',
    negativePrompt:
      'smooth digital 3D CGI, 2D vector, anime, photoreal humans, flat colors, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 16,
    thumbnailUrl: 'https://images.unsplash.com/photo-1560421683-680b9383563b?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_rubber_hose_1930',
    familyId: 'animation',
    name: '1930s Rubber Hose Animation',
    tag: 'Vintage Fleischer & Cuphead',
    description: 'Black and white hand-inked vintage cartoon, pie eyes, bendy limbs, film grain scratches, and jazz age rhythm.',
    stylePrompt:
      '1930s vintage rubber hose animation, hand-inked black contours on aged sepia celluloid, pie-eyed expressive characters, bendy curvilinear limbs, visible film dust, jitter and edge vignette, Fleischer Studios and Cuphead aesthetic',
    negativePrompt:
      'modern 3D CGI, realistic photograph, modern color gradients, neon colors, high-tech, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 17,
    thumbnailUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_papercraft_shadowbox',
    familyId: 'animation',
    name: 'Papercraft & Shadowbox 3D',
    tag: 'Layered Cut Cardstock',
    description: 'Multi-layered paper sculpture silhouettes, tactile paper grain edges, and soft physical ambient cast shadows.',
    stylePrompt:
      'Layered 3D papercraft shadowbox art, precision laser-cut heavy cardstock layers, subtle physical paper edges and textures, warm backlighting creating soft realistic cast shadows between depth tiers, handcrafted paper sculpture',
    negativePrompt:
      'photorealism, smooth plastic, digital gradients, glossy 3D render, cartoon, anime, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 18,
    thumbnailUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80',
  },

  // ─── 4. Fine Art Painting ─────────────────────────────────────────────────────
  {
    id: 'sub_impressionist_oil',
    familyId: 'painting',
    name: 'Impressionist Oil Canvas',
    tag: 'Monet Dappled Sunlight',
    description: 'Thick impasto brushstrokes, vibrant optical color mixing, dappled sunlight, and timeless museum canvas richness.',
    stylePrompt:
      'Masterwork impressionist oil painting on coarse linen canvas, thick visible impasto brushstrokes with heavy paint texture, optical color mixing, vibrant dappled sunlight and ambient color vibration, Claude Monet and Van Gogh fine art quality',
    negativePrompt:
      'photograph, flat digital vector, 3D CGI render, smooth airbrushed, cartoon, neon, watermark, signature',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 19,
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_sumi_e_ink',
    familyId: 'painting',
    name: 'Sumi-e Zen Ink Wash',
    tag: 'Minimalist Black Ink Wash',
    description: 'Meditative Japanese brush calligraphy, spontaneous wet washes on rice paper, poetic negative space, and calm.',
    stylePrompt:
      'Traditional Japanese Sumi-e black ink wash painting, master calligraphic brushwork, spontaneous wet bleeding washes on raw fibrous Xuan rice paper, delicate tonal range from charcoal black to misty grey, poetic Zen negative space',
    negativePrompt:
      'bright vibrant colors, photorealism, western 3D, neon, busy clutter, digital gradients, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 20,
    thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_baroque_chiaroscuro',
    familyId: 'painting',
    name: 'Baroque Dramatic Chiaroscuro',
    tag: 'Caravaggio Dark Oil',
    description: 'Heroic dramatic lighting piercing pitch-black shadows, rich oil glazes, museum-quality Old Masters grandeur.',
    stylePrompt:
      'Baroque masterwork oil painting, dramatic tenebrism and chiaroscuro lighting, single warm light source piercing rich deep black shadows, golden oil glazes on primed wood panel, Caravaggio and Rembrandt classical museum fine art',
    negativePrompt:
      'flat vector, modern cartoon, anime, bright pastel, digital CGI, washed out, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 21,
    thumbnailUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_surrealist_dream',
    familyId: 'painting',
    name: 'Surrealist Symbolic Dreamscape',
    tag: 'Salvador Dalí Illusion',
    description: 'Poetic symbolic metamorphosis, vast barren desert horizons, razor-sharp classical technique, and dream logic.',
    stylePrompt:
      'Surrealist fine art painting, dreamlike symbolic transformations, vast infinite horizon under luminous atmospheric skies, crisp academic painting technique with uncanny impossible juxtapositions, Salvador Dalí and René Magritte masterpiece',
    negativePrompt:
      'generic cartoon, blurry, low resolution, cheap CGI, modern flat vector, amateur sketch, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 22,
    thumbnailUrl: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_wet_watercolor',
    familyId: 'painting',
    name: 'Wet-on-Wet Luminous Watercolor',
    tag: 'Translucent Pigment Bleed',
    description: 'Fluid translucent pigments bleeding across heavy cotton cold-pressed paper, delicate blooming edges.',
    stylePrompt:
      'Luminous fine art watercolor painting, wet-on-wet technique with delicate pigment blooming, translucent color washes on rough 300gsm cold-pressed cotton paper, preserved white paper highlights, organic spontaneous water drips',
    negativePrompt:
      'heavy opaque paint, digital flat vector, photorealism, harsh black lines, CGI, plastic, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 23,
    thumbnailUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80',
  },

  // ─── 5. Graphic Design & Digital ──────────────────────────────────────────────
  {
    id: 'sub_2d_flat_vector',
    familyId: 'graphic',
    name: 'Modern 2D Flat Vector',
    tag: 'Clean Explainer Graphics',
    description: 'Crisp geometric vector shapes, balanced corporate color blocking, minimal shadows, and high-end explainer polish.',
    stylePrompt:
      'Modern 2D flat design editorial vector illustration, bold geometric forms, clean lines, balanced harmonious color palette, subtle grain texture, zero gradient clutter, professional corporate technology and documentary explainer aesthetic',
    negativePrompt:
      'photorealistic, 3D render, CGI, glossy, dirty, messy sketches, blurry, dark gothic, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 24,
    thumbnailUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_bauhaus_constructivism',
    familyId: 'graphic',
    name: 'Bauhaus & Constructivism',
    tag: 'Strict Primary Geometry',
    description: 'Dynamic diagonal compositions, bold geometric red/black/cream typography, and European modernist movement art.',
    stylePrompt:
      'Bauhaus modernist graphic art, bold constructivist geometric compositions, strict palette of vermilion red, jet black, and warm aged cream, strong diagonal focal lines, circle and triangle motifs, 1920s Weimar avant-garde poster aesthetic',
    negativePrompt:
      'photorealism, 3D CGI, organic landscape, messy brushstrokes, cartoon, anime, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 25,
    thumbnailUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_isometric_3d',
    familyId: 'graphic',
    name: 'Isometric 3D Diorama',
    tag: 'Miniature Architecture',
    description: 'Precision orthographic 30-degree perspective, clean clay-matte studio lighting, and intricate miniature worlds.',
    stylePrompt:
      'Precision isometric 3D miniature diorama, orthographic perspective, clean clay-matte material surfaces, soft studio ambient occlusion, miniature architectural details, clean modern tech aesthetic, award-winning 3D illustration',
    negativePrompt:
      'photorealism, 2D flat sketch, blurry, perspective distortion, dark messy, noisy textures, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 26,
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_blueprint_schematic',
    familyId: 'graphic',
    name: 'Cyanotype Technical Blueprint',
    tag: 'Architectural Schematics',
    description: 'Deep Prussian blue cyanotype background, razor-sharp white architectural drafting lines, and engineering lore.',
    stylePrompt:
      'Architectural cyanotype technical blueprint, deep Prussian blue paper background (#0B2545), razor-sharp crisp white drafting lines, coordinate grid overlays, dimensional callout annotations, antique engineering patent documentation aesthetic',
    negativePrompt:
      'photorealistic colors, colorful paints, blurry, 3D CGI, cartoon, anime, organic nature, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 27,
    thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_retro_synthwave',
    familyId: 'graphic',
    name: 'Retro Synthwave & Wireframe',
    tag: '1980s Neon Sunset Grid',
    description: 'Wireframe perspective grids vanishing into a glowing magenta sunset horizon, chrome reflections, and 80s arcade pulse.',
    stylePrompt:
      '1980s retro synthwave digital art, neon perspective wireframe grid vanishing into distant glowing horizon, giant retro sun, chrome metallic reflections, deep violet and hot magenta color palette, CRT scanline aesthetic, Outrun aesthetic',
    negativePrompt:
      'dull colors, daytime natural sunlight, rustic, vintage painting, black and white, blurry, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 28,
    thumbnailUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=600&q=80',
  },

  // ─── 6. Retro Analog & Vintage Media ──────────────────────────────────────────
  {
    id: 'sub_polaroid_sx70',
    familyId: 'vintage',
    name: '1970s Polaroid SX-70',
    tag: 'Soft Faded Analog Border',
    description: 'Creamy square analog color emulsion, soft atmospheric vignetting, warm nostalgic pastel glow, and vintage soul.',
    stylePrompt:
      'Original 1970s Polaroid SX-70 instant photography, soft analog color chemical emulsion, warm pastel tonality with slight color shift, creamy shallow focus, soft natural light, authentic vintage photographic soul',
    negativePrompt:
      'modern crisp 8k, digital sharpness, CGI, neon, 3D, cartoon, anime, flat vector, modern UI, watermark, text',
    aspectRatio: '1:1',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 29,
    thumbnailUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'sub_vhs_camcorder',
    familyId: 'vintage',
    name: '1980s VHS Magnetic Tape',
    tag: 'Analog Scanlines & Glitch',
    description: 'Nostalgic analog magnetic tape artifacts, horizontal scanlines, subtle chromatic aberration, and authentic 80s tape aura.',
    stylePrompt:
      '1980s analog VHS magnetic tape capture, visible subtle CRT phosphor scanlines, organic magnetic noise, subtle chromatic aberration on high-contrast edges, warm analog color bleeding, authentic vintage broadcast videotape texture',
    negativePrompt:
      'pristine 4k digital, glossy modern CGI, 3D render, cartoon, anime, flat vector, watermark, text',
    aspectRatio: '16:9',
    isDefault: false,
    isBuiltIn: true,
    createdAt: 30,
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80',
  },
];

export function getSubStylesByFamily(familyId: string): SubStylePreset[] {
  if (familyId === 'all') return SUB_STYLES_CATALOG;
  return SUB_STYLES_CATALOG.filter((s) => s.familyId === familyId);
}

export function searchSubStyles(query: string): SubStylePreset[] {
  const q = query.toLowerCase().trim();
  if (!q) return SUB_STYLES_CATALOG;
  return SUB_STYLES_CATALOG.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.tag.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.stylePrompt.toLowerCase().includes(q)
  );
}
