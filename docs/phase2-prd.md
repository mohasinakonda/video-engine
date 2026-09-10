# Product Requirements Document (PRD) — Phase 2: Image Engine & Motion Animation

---

## 1. Executive Summary & Objective

Phase 2-এর মূল লক্ষ্য হলো Phase 1-এ উৎপন্ন নিখুঁত অডিও দৈর্ঘ্যের ওপর ভিত্তি করে স্ক্রিপ্টকে দৃশ্যভিত্তিক ছোট ছোট সিনে (Scene breakdown) রূপান্তর করা, সুসংগত আর্ট স্টাইল (Base Style) বজায় রেখে ব্যাচ আকারে ইমেজ জেনারেট করা এবং লোকাল FFmpeg ব্যবহার করে প্রতিটি স্থির চিত্রে গতিশীল অ্যানিমেশন (Ken Burns / Pan & Zoom effect) প্রয়োগ করা।

* **Target Output:** প্রায় ৫০০+ দৃশ্যভিত্তিক ইমেজ এবং প্রতিটি ইমেজের ৩-৪ সেকেন্ডের অ্যানিমেটেড ভিডিও ক্লিপ (`.mp4` / `.ts` খণ্ড)।
* **Core Engine:** Gemini Multimodal (Prompt & Scene Engine), Image Generation API (Imagen 3 / Flux via API), Bundled Local FFmpeg Sidecar।

---

## 2. Technical Stack Additions

* **Motion & Encoding:** Bundled FFmpeg Binary (via Tauri Sidecar)
* **Image Processing & Storage:** Tauri FS API (`@tauri-apps/plugin-fs`), Local App Data Directory
* **Queue & Throttling:** Custom Client-side Rate Limiter & Concurrency Worker (Max 3-5 concurrent image requests)

---

## 3. Scope of Phase 2

### In-Scope:

* **Audio-Synced Scene Breakdown:** Phase 1-এর অডিও চাঙ্কের টাইমলাইনের ওপর ভিত্তি করে পুরো স্ক্রিপ্টকে ৩-৪ সেকেন্ডের সিন ব্লকে ভাগ করা।
* **Base Style Preset Manager:** আর্ট স্টাইল প্রিসেট তৈরি, এডিট এবং ইমেজ প্রম্পটের সাথে যুক্ত করার মেকানিজম।
* **Batch Image Generation Queue:** কোটা ও রেট লিমিট সুরক্ষিত রেখে স্বয়ংক্রিয় ইমেজ ডাউনলোড ও লোকাল স্টোরেজে ক্যাশ করা।
* **Scene Inspector & Regenerator UI:** ব্যবহারকারী যাতে ফাইনাল অ্যাসেম্বলির আগেই থাম্বনেইল দেখতে পান এবং নির্দিষ্ট ছবি পছন্দ না হলে এককভাবে রি-জেনারেট করতে পারেন।
* **FFmpeg Ken Burns Animation:** স্থির ইমেজে মসৃণ প্যান ও জুম ডিরেকশন প্রয়োগ করে মোশন ভিডিও চাঙ্ক প্রস্তুত করা।

### Out-of-Scope (Phase 3-এর জন্য সংরক্ষিত):

* অডিওর সাথে সব ক্লিপ জোড়া দিয়ে পূর্ণাঙ্গ ৩০ মিনিটের ভিডিও রেন্ডার।
* ব্যাকগ্রাউন্ড মিউজিক (BGM) ও অডিও ডাক্কিং।
* সাবটাইটেল (SRT/VTT) জেনারেশন ও ফাইনাল MP4 এক্সপোর্ট।

---

## 4. Detailed Functional Requirements

### 4.1 Base Style Preset Manager (Visual Consistency)

৩০ মিনিটের ভিডিওতে ৫০০+ ছবির আর্ট স্টাইলে সামঞ্জস্য রক্ষা করতে এই মডিউলটি কাজ করবে।

* **FR-2.1.1 (Style Schema):** লোকাল স্টোরেজে সংরক্ষিত প্রিসেট স্কিমা:
```typescript
export interface BaseStylePreset {
  id: string;
  name: string;              // e.g., "Dark Cinematic Documentary"
  stylePrompt: string;       // e.g., "Photorealistic, cinematic lighting, 8k resolution, muted colors, high-end documentary look, shot on 35mm lens"
  negativePrompt?: string;   // e.g., "cartoon, blurry, distorted faces, low resolution"
  aspectRatio: "16:9" | "9:16"; // Default: "16:9"
  isDefault: boolean;
}

```


* **FR-2.1.2 (Pre-built Templates):** অ্যাপে কিছু বিল্ট-ইন স্টাইল থাকবে (যেমন: *Cinematic Realistic, Anime/Manga, Cyberpunk, 2D Flat Vector, Vintage Oil Painting*)। ব্যবহারকারী কাস্টম স্টাইল তৈরি ও সেভ করতে পারবেন।

---

### 4.2 Script-to-Scene Breakdown Engine

* **FR-2.2.1 (Dynamic Timing Sync):** Phase 1-এর প্রতিটি ৩ মিনিটের অডিও চাঙ্কের সঠিক ডিউরেশন নেওয়া হবে।
* ফর্মুলা: $\text{Total Scenes} \approx \frac{\text{Total Audio Duration (in seconds)}}{3.5\text{ seconds}}$


* **FR-2.2.2 (Gemini Scene Extractor):** Gemini API-তে স্ক্রিপ্ট পাঠিয়ে প্রতি ৩-৪ সেকেন্ডের জন্য ভিজ্যুয়াল ডেসক্রিপশন তৈরি করা হবে:
```json
[
  {
    "scene_id": 1,
    "audio_start_sec": 0.0,
    "audio_end_sec": 3.4,
    "narration_line": "The ocean depths hide secrets older than human memory.",
    "visual_prompt": "An extreme wide shot of a deep dark ocean trench, glowing bioluminescent organisms floating silently"
  }
]

```


* **FR-2.2.3 (Prompt Assembly):** জেনারেট হওয়া `visual_prompt`-এর শেষে স্বয়ংক্রিয়ভাবে ইউজারের নির্বাচিত `BaseStylePreset.stylePrompt` যুক্ত হবে।

---

### 4.3 Batch Image Generation Queue (Rate-Limit Resilient)

* **FR-2.3.1 (Throttled Worker):** ৫০০টি ইমেজ একসাথে না পাঠিয়ে কিউ সিস্টেমে কনকারেন্সি কন্ট্রোল থাকবে (ডিফল্ট: ৩টি ইমেজ একযোগে)।
* **FR-2.3.2 (Disk Storage Path):** ডাউনলোড হওয়া প্রতিটি ইমেজ সরাসরি লোকাল ডিরেক্টরিতে সেভ হবে:
* `{AppLocalDataDir}/projects/{project_id}/scenes/scene_{index}.jpg`


* **FR-2.3.3 (Rate Limit & Resume Checkpoint):**
* API থেকে `429 Too Many Requests` পেলে কিউ স্বয়ংক্রিয়ভাবে ১০ সেকেন্ড পজ হবে।
* প্রজেক্ট স্ট্যাটাস লোকাল ডেটাবেসে ট্র্যাক থাকবে (যেমন: `scene_154_downloaded`), যাতে ক্র্যাশ করলে পুনরায় প্রথম থেকে ডাউনলোড না করতে হয়।



---

### 4.4 Scene Inspector UI (Review & Regeneration)

* **FR-2.4.1 (Storyboard Grid):** ফ্রন্টএন্ডে একটি স্ক্রোলযোগ্য গ্রিড থাকবে যেখানে প্রতিটি সিনের থাম্বনেইল, সময়সীমা (Duration), এবং সংশ্লিষ্ট স্ক্রিপ্ট লাইন দেখা যাবে।
* **FR-2.4.2 (Single Scene Regenerate):** কোনো নির্দিষ্ট সিন পছন্দ না হলে ইউজার সেই ছবির প্রম্পট সামান্য এডিট করে শুধু ওই নির্দিষ্ট ইমেজটি রি-জেনারেট করতে পারবেন।
* **FR-2.4.3 (Manual Upload Replacement):** ইউজার চাইলে যেকোনো সিনে নিজের কম্পিউটার থেকে লোকাল ছবি আপলোড করে রিপ্লেস করতে পারবেন।

---

### 4.5 FFmpeg Motion Animation Engine (Ken Burns Effect)

স্থির ইমেজকে জীবন্ত করার জন্য লোকাল FFmpeg বাইনারি দিয়ে মোশন প্রয়োগ করা হবে।

* **FR-2.5.1 (Random Motion Profiles):** প্রতি ইমেজের জন্য স্বয়ংক্রিয়ভাবে নিচের ৪টি মোশনের যেকোনো একটি র‍্যান্ডমভাবে নির্ধারিত হবে:
1. **Zoom In:** সেন্টারে বা নির্দিষ্ট ফোকাসে ১.০x থেকে ১.১৫x পর্যন্ত মসৃণ জুম।
2. **Zoom Out:** ১.১৫x থেকে ১.০x-এ জুম আউট।
3. **Pan Left to Right:** ডানদিকে হালকা স্লাইড।
4. **Pan Right to Left:** বামদিকে হালকা স্লাইড।


* **FR-2.5.2 (FFmpeg Filter Execution):** Tauri Sidecar-এর মাধ্যমে ব্যাকগ্রাউন্ডে কমান্ড এক্সিকিউট হবে:
* ফিল্টার এক্সাম্পল: `zoompan=z='min(zoom+0.0015,1.15)':d={duration_in_frames}:s=1920x1080:fps=30`


* **FR-2.5.3 (Intermediate Motion Chunks):** প্রতিটি সিনের মোশন সম্পন্ন ভিডিও ক্লিপ ক্যাশে সংরক্ষিত হবে:
* `{AppLocalDataDir}/projects/{project_id}/motion_clips/clip_{index}.mp4`



---

## 5. UI & UX Requirements

1. **Storyboard & Generation View:**
* উপরে: সার্বিক প্রোগ্রেস বার (e.g., `Generating Scenes: 245/520 Images Ready | 180 Motion Clips Rendered`).
* নিচে: ইন্টারেক্টিভ সিন গ্রিড কার্ডস (কার্ডের ওপর হোভার করলে অ্যানিমেশন প্লে হবে, এডিট প্রম্পট ও রি-জেনারেট বাটন আসবে)।


2. **Base Style Configuration Modal:**
* ড্রপডাউন থেকে প্রিসেট বাছাই এবং কাস্টম স্টাইল টেক্সটবক্স।
* "Test Style" বাটন (একটি একক ইমেজ তৈরি করে স্টাইল টেস্ট করা)।



---

## 6. Definition of Done (DoD) for Phase 2

* [ ] স্ক্রিপ্ট থেকে অডিও টাইমলাইন অনুযায়ী প্রায় ৫০০টি দৃশ্যের জন্য প্রম্পট নির্ভুলভাবে ভেঙে আসছে।
* [ ] Base Style কনফিগারেশন প্রতিটি প্রম্পটের সাথে যুক্ত হয়ে ধারাবাহিক ভিজ্যুয়াল কোয়ালিটি দিচ্ছে।
* [ ] ইমেজ জেনারেশন কিউ রেট লিমিট হ্যান্ডেল করে সমস্ত ইমেজ লোকাল ডিস্কে সফলভাবে সেভ করতে পারছে।
* [ ] স্টোরিবোর্ড UI-তে দৃশ্যগুলো দেখা যাচ্ছে এবং কোনো নির্দিষ্ট সিন রি-জেনারেট করা সম্ভব হচ্ছে।
* [ ] Tauri Sidecar FFmpeg ব্যবহার করে প্রতিটি স্থির ইমেজে মসৃণ Ken Burns মোশন ক্লিপ তৈরি হচ্ছে।