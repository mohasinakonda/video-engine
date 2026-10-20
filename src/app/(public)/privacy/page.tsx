import React from 'react';
import { ShieldCheck, Lock, Eye, FileText, Youtube } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | Rendoza AI',
  description: 'Privacy Policy and Data Protection standards for Rendoza AI Video Studio.',
};

export default function PrivacyPage() {
  return (
    <div className="py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-3 border-b border-[#E5E0D8] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-mono font-semibold border border-emerald-200">
            <ShieldCheck size={14} />
            <span>Compliance & Security</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-950 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 font-mono">
            Last Updated: October 2026 • Effective for all Rendoza AI users
          </p>
        </div>

        {/* Policy Content Card */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] p-6 sm:p-10 shadow-sm space-y-8 text-sm leading-relaxed text-zinc-700">
          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Eye size={18} className="text-[#E05A30]" />
              1. Information We Collect
            </h2>
            <p>
              When you use Rendoza AI, we collect minimal data required to render your scripts into videos:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li><strong>Account Information:</strong> Your Google OAuth profile (name, email address, avatar).</li>
              <li><strong>Content & Scripts:</strong> Script text, narration ideas, prompt parameters, and audio inputs submitted for video generation.</li>
              <li><strong>Payment & Verification Data:</strong> Transaction IDs (TrxID) submitted for bKash, Nagad, or Bank transfers for credit purchases. We do not store PINs or banking credentials.</li>
              <li><strong>Usage Analytics:</strong> Credit consumption rates, rendering times, and error telemetry to improve our cloud engine.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Lock size={18} className="text-[#E05A30]" />
              2. How We Protect & Use Your Data
            </h2>
            <p>
              We treat your creative intellectual property with strict confidentiality:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li>Your scripts and private video projects are never sold to data brokers or third-party advertisers.</li>
              <li>AI inference requests to our AI providers and speech synthesis APIs are processed securely over encrypted HTTPS connections.</li>
              <li>Rendered video outputs and intermediate image frames are stored in secure cloud storage and are only accessible by your authenticated account.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <FileText size={18} className="text-[#E05A30]" />
              3. Data Retention & Deletion Rights
            </h2>
            <p>
              You maintain full ownership of your created videos. You may delete individual scenes, projects, or request complete account deletion at any time by contacting our support team via WhatsApp or email.
            </p>
          </section>

          <section id="youtube-data" className="space-y-3">
            <h2 className="text-base font-bold text-zinc-950 flex items-center gap-2">
              <Youtube size={18} className="text-[#E05A30]" />
              4. YouTube Data (Channel Doctor, Discover and Create)
            </h2>
            <p>
              Channel Doctor, Discover and Create use YouTube API Services. If you choose to connect your YouTube channel, you authorize read-only access
              with two Google permissions: <code>youtube.readonly</code> (your channel and video details) and{' '}
              <code>yt-analytics.readonly</code> (your channel&apos;s YouTube Analytics and reach reports, including impressions and
              click-through rate). We cannot upload, edit or delete anything on your channel.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li>
                <strong>What we store:</strong> your channel ID, name and profile image, the permissions you granted, and your Google
                access and refresh tokens, encrypted at rest. We also keep the ID of a YouTube reporting job that prepares your
                impressions data. For Discover, we store the channel IDs of the competitors you choose to follow, with your optional
                label and group, until you remove them or disconnect.
              </li>
              <li>
                <strong>Create:</strong> the video plans you make (title, brief, script, packaging ideas) are your content and are stored
                until you delete them. When you link a published video to a plan, we store only the link: the video ID, your channel ID,
                its publish time and how it was linked. To check its performance, we read your Analytics on demand and do not store the
                numbers; from day 7 we keep only labels (for example &quot;above your usual&quot; or &quot;click rate was the weak
                point&quot;) with the number of videos compared, so we can show what tends to work on your channel. The latest check stays
                in your browser tab for the day.
              </li>
              <li>
                <strong>What we do not store:</strong> your analytics, video statistics, retention curves, thumbnails and the reports we
                generate are processed on demand and are not saved on our servers. A finished report is kept only in your browser tab
                (session storage) until you close it, sign out or disconnect.
              </li>
              <li>
                <strong>Other channels&apos; public data (Discover):</strong> to research your market, we read public information about
                the channels you follow or that YouTube search returns (names, video titles, view counts, durations, thumbnails). Competitor
                channels never sign in to our app. This data is processed in memory for each research run and is not saved on our servers;
                results stay in your browser tab. Scores, ratios and relevance labels shown in Discover are calculated by us and are not
                YouTube metrics. When you analyze a channel or video, we read the same kind of public information plus up to 100 of the
                video&apos;s public comments (the comment text only, without author names), on your request and in memory only.
              </li>
              <li>
                <strong>AI processing:</strong> to write a report or research ideas, we send video titles, thumbnail images and summary
                metrics (not your tokens or raw API data) to our AI provider, DeepInfra, for processing. To write a brief, script or
                packaging ideas in Create, we send your plan&apos;s text; your YouTube analytics are not sent. To summarise what viewers
                say about an analyzed video, we send its public comment text without author names.
              </li>
              <li>
                <strong>Use:</strong> we use YouTube data only to show you your channel diagnosis, market research and how your planned videos performed. We do not sell it, use it for
                advertising, or share it with anyone except as described here. Our use of information received from Google APIs adheres
                to the{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-[#E05A30] underline" target="_blank" rel="noopener noreferrer">
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </li>
              <li>
                <strong>Disconnect and deletion:</strong> disconnecting in Channel Doctor stops the reporting job, asks Google to revoke our
                access and deletes the stored connection, tokens, your followed competitors, and Create&apos;s links to your videos with the
                labels learned from them (your video plans stay). Deleting your account deletes all of it. You can also revoke access at
                any time at{' '}
                <a href="https://myaccount.google.com/permissions" className="text-[#E05A30] underline" target="_blank" rel="noopener noreferrer">
                  myaccount.google.com/permissions
                </a>
                .
              </li>
            </ul>
            <p>
              By connecting YouTube you also agree to the{' '}
              <a href="https://www.youtube.com/t/terms" className="text-[#E05A30] underline" target="_blank" rel="noopener noreferrer">
                YouTube Terms of Service
              </a>{' '}
              and the{' '}
              <a href="https://policies.google.com/privacy" className="text-[#E05A30] underline" target="_blank" rel="noopener noreferrer">
                Google Privacy Policy
              </a>
              .
            </p>
          </section>

          <section className="space-y-3 border-t border-[#E5E0D8] pt-6">
            <h2 className="text-base font-bold text-zinc-950">
              5. Contact Us
            </h2>
            <p>
              If you have any questions or data privacy inquiries, please reach out to our privacy officer via our official WhatsApp Support channel or email us at support@rendoza.ai.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
