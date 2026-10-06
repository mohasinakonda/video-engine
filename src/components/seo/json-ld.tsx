import React from 'react';

export default function JsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rendoza.com';

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Rendoza AI',
    operatingSystem: 'Web Browser (Cloud-based)',
    applicationCategory: 'MultimediaApplication',
    url: baseUrl,
    description:
      'AI-powered video studio that transforms long-form scripts into cinematic scenes, synchronized audio narration, and exportable 1080p MP4 videos with zero watermarks.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: '30 Free Credits on Signup',
    },
    featureList: [
      'Script to AI Video generation',
      'High-quality visual scenes and styles',
      'Realistic voiceover narration sync',
      'Full storyboard and shot-by-shot timeline control',
      '1080p HD MP4 video export with zero watermarks',
      'Commercial usage license for YouTube and social media',
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '150',
    },
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Rendoza AI',
    url: baseUrl,
    logo: `${baseUrl}/icon.png`,
    sameAs: [],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </>
  );
}
