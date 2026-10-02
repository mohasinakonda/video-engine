import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing URL or key');
  process.exit(1);
}

const client = createClient(url, key);

// Read style-taxonomy.ts and extract presets
const code = fs.readFileSync('src/lib/style-taxonomy.ts', 'utf8');

// Match all objects in SUB_STYLES_CATALOG
const regex = /{\s*id:\s*'([^']+)',\s*familyId:\s*'([^']+)',\s*name:\s*'([^']+)',\s*tag:\s*'([^']*)',\s*description:\s*'([^']*)',\s*stylePrompt:\s*'([^']*)',\s*negativePrompt:\s*'([^']*)',\s*aspectRatio:\s*'([^']*)',\s*isDefault:\s*(true|false),\s*isBuiltIn:\s*(true|false),\s*createdAt:\s*(\d+),\s*thumbnailUrl:\s*'([^']*)'/g;

let match;
const styles = [];

while ((match = regex.exec(code)) !== null) {
  styles.push({
    id: match[1],
    family_id: match[2],
    name: match[3],
    tag: match[4] || null,
    description: match[5] || null,
    style_prompt: match[6],
    negative_prompt: match[7] || null,
    aspect_ratio: match[8] || '16:9',
    is_default: match[9] === 'true',
    is_active: true,
    sort_order: (styles.length + 1) * 10,
    thumbnail_url: match[12],
    updated_at: new Date().toISOString(),
  });
}

console.log('Parsed', styles.length, 'styles from style-taxonomy.ts');

if (styles.length > 0) {
  const { data, error } = await client.from('art_styles').upsert(styles);
  if (error) {
    console.error('Upsert error:', error);
  } else {
    console.log('SUCCESS! Seeded all', styles.length, 'styles to Supabase table public.art_styles.');
  }
}
