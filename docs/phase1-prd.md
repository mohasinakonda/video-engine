# Product Requirements Document (PRD) — Phase 1 (Updated)

---

## 1. Executive Summary & Objective

Phase 1-এর মূল উদ্দেশ্য হলো একটি সম্পূর্ণ ক্রস-প্ল্যাটফর্ম লাইটওয়েট ডেস্কটপ অ্যাপ্লিকেশনের ভিত্তি তৈরি করা। এতে ব্যবহারকারী তার নিজস্ব Gemini API Key কনফিগার করতে পারবেন, Google AI Studio-র অনুরূপ ডিরেকশনাল প্যারামিটারসমূহ (**Scene** এবং **Sample Context**) সহ বিস্তারিত ভয়েস প্রোফাইল তৈরি ও সংরক্ষণ করতে পারবেন, এবং একটি লং-ফর্ম স্ক্রিপ্ট ইনপুট দিয়ে সেটিকে ৩ মিনিটের অর্থপূর্ণ ব্লকে বিভক্ত করে নির্ভরযোগ্যভাবে অডিও জেনারেট ও লোকালি ক্যাশ করতে পারবেন।

* **Target Platforms:** Windows (x64) ও macOS (Apple Silicon / Intel)
* **Architecture Model:** Desktop Local-first, BYOK (Bring Your Own Key)

---

## 2. Tech Stack & Infrastructure

* **Desktop Runtime:** Tauri v2
* **Frontend Framework:** Next.js (Static HTML Export via `output: 'export'`), React, TypeScript, Tailwind CSS
* **Local Storage & Persistence:** `@tauri-apps/plugin-store` (লোকাল সেটিংস, API Key এবং Voice Presets সংরক্ষণের জন্য)
* **File System Layer:** `@tauri-apps/plugin-fs` (লোকাল অডিও ক্যাশিংয়ের জন্য)
* **API Engine:** Google Gemini API (Multimodal Audio/Speech Output)

---

## 3. Scope of Phase 1

### In-Scope:

* Tauri v2 + Next.js প্রজেক্ট স্কাফোল্ডিং এবং স্ট্যাটিক এক্সপোর্ট কনফিগারেশন।
* Secure API Key Management (BYOK) এবং রিয়েল-টাইম কানেকশন ভ্যালিডেশন।
* **Advanced Voice Profile Manager (CRUD):** Voice Character, Pace, Accent, এবং Google AI Studio ফিচার সমন্বিত **Scene** ও **Sample Context** কনফিগারেশন।
* ৫–১০ সেকেন্ডের স্যাম্পল অডিও প্রিভিউ প্লেয়ার।
* লং-ফর্ম স্ক্রিপ্ট ইনপুট, ওয়ার্ড কাউন্ট ও Gemini-চালিত ৩-মিনিট স্ক্রিপ্ট স্প্লিটিং ইঞ্জিন।
* ৩-মিনিট অডিও ব্যাচ জেনারেশন এবং লোকাল ডিরেক্টরিতে সংরক্ষণ (`.wav` বা `.mp3`)।
* অডিও মেটাডেটা ও মোট সময় গণনা (Duration calculation & Project state checkpointing)।

### Out-of-Scope (Phase 2 ও 3-এর জন্য সংরক্ষিত):

* ইমেজ প্রম্পট জেনারেশন ও ব্যাচ ডাউনলোড।
* FFmpeg মোশন অ্যানিমেশন (Ken Burns effect) ও ট্রানজিশন।
* ভিডিও রেন্ডারিং ও এক্সপোর্ট।
* ব্যাকগ্রাউন্ড মিউজিক (BGM) ও অটো-ডাক্কিং।

---

## 4. Detailed Functional Requirements

### 4.1 System Initialization & Settings (BYOK Vault)

* **FR-1.1:** ব্যবহারকারী সেটিংসে গিয়ে নিজের Gemini API Key ইনপুট দিতে পারবেন।
* **FR-1.2:** API Key লোকাল মেমোরিতে এনক্রিপ্ট করে সেভ হবে; কখনো কোনো এক্সটার্নাল সার্ভারে পাঠানো হবে না।
* **FR-1.3 (Test Connection):** একটি "Test Key" বাটন থাকবে, যা একটি ছোট টেস্ট প্রম্পট পাঠিয়ে কি এবং কোটা সঠিক আছে কিনা যাচাই করবে। সফল হলে সবুজ স্ট্যাটাস এবং ত্রুটি থাকলে নির্দিষ্ট মেসেজ (যেমন: `Invalid Key`, `Quota Exceeded (429)`) দেখাবে।

---

### 4.2 Voice Profile Manager (With Scene & Sample Context)

ব্যবহারকারী একাধিক ভয়েস প্রোফাইল তৈরি, সংরক্ষণ, এডিট এবং ডিফল্ট হিসেবে সেট করতে পারবেন।

* **FR-2.1 (Voice Character):** Google AI Studio অডিও মডেলের সমর্থিত ভয়েস সিলেক্টর ড্রপডাউন (e.g., *Aoede, Charon, Fenrir, Kore, Puck* ইত্যাদি)।
* **FR-2.2 (Scene):** সিঙ্গেল-লাইন ইনপুট ফিল্ড।
* *উদ্দেশ্য:* ভয়েস যে পরিবেশ বা আবহে উচ্চারিত হবে তার ব্যাকগ্রাউন্ড এনভায়রনমেন্ট সেট করা।
* *উদাহরণ:* `A quiet, professional remote workspace.` বা `A dimly lit room with an intense documentary mood.`


* **FR-2.3 (Sample Context):** মাল্টি-লাইন টেক্সট এরিয়া।
* *উদ্দেশ্য:* মডেলকে কনটেক্সচুয়াল স্টার্টিং পয়েন্ট দেওয়া, যাতে ভয়েসের এন্ট্রি একদম ন্যাচারাল হয়।
* *টুলটিপ:* *"Gives the model a contextual starting point, so the voice enters the scene naturally."*
* *উদাহরণ:* `Pace is calm and unhurried. Tone is empathetic, crisp, and reassuring.`


* **FR-2.4 (Pace / Speed Slider):** 0.75x থেকে 1.5x রেঞ্জে স্টেপ সাইজ 0.05 সহ স্লাইডার কন্ট্রোল। ডিফল্ট মান: `1.0x`।
* **FR-2.5 (Accent / Language Style):** ড্রপডাউন সিলেক্টর (e.g., *American English, British English, Neutral Global*)।
* **FR-2.6 (Data Schema):** `@tauri-apps/plugin-store`-এ সংরক্ষিত ডেটা স্কিমা:
```typescript
export interface VoicePreset {
  id: string;
  name: string;
  voiceCharacter: string;
  scene: string;          // Added environmental context
  sampleContext: string;  // Added delivery contextual starting point
  pace: number;
  accent: string;
  isDefault: boolean;
  createdAt: number;
}

```


* **FR-2.7 (Live Preview):** একটি "Listen Preview" বাটন থাকবে। ক্লিক করলে `Scene` এবং `Sample Context` প্যারামিটার সহ ৫–১০ সেকেন্ডের একটি ফিক্সড বাক্যের স্যাম্পল অডিও জেনারেট হয়ে ইন-অ্যাপ প্লেয়ারে বাজবে।

---

### 4.3 Script Parser & 3-Minute Chunking Engine

* **FR-3.1:** ইউজার পুরো ৩০ মিনিটের স্ক্রিপ্ট পেস্ট করবেন। রিয়েল-টাইমে ওয়ার্ড কাউন্ট এবং আনুমানিক রিডিং টাইম (১৩৫ শব্দ/মিনিট হিসেবে) ক্যালকুলেট হবে।
* **FR-3.2 (Semantic Splitting):** Gemini API ব্যবহার করে স্ক্রিপ্টটি语义িকভাবে (semantically) ৩ মিনিটের ব্লকে ভাগ হবে:
* কোনো বাক্য বা প্যারাগ্রাফের মাঝখানে ভাঙা হবে না।
* প্রতিটি ব্লকের সাইজ হবে গড়ে ৩৮০–৪৫০ শব্দ।


* **FR-3.3 (Chunk Review UI):** ইউজার স্ক্রিপ্ট স্প্লিট হওয়ার পর প্রতিটি চাঙ্ক (Chunk 1, Chunk 2...) কার্ড আকারে দেখতে পারবেন এবং প্রয়োজনে ম্যানুয়ালি টেক্সট এডিট করতে পারবেন।

---

### 4.4 Audio Generation Queue & Local Storage

* **FR-4.1 (Sequential Worker):** রেট লিমিট সুরক্ষিত রাখতে অডিও চাঙ্কগুলো ব্যাকগ্রাউন্ড কিউতে ধারাবাহিকভাবে একটির পর একটি জেনারেট হবে।
* **FR-4.2 (Director System Instruction Injection):** প্রতিটি অডিও রিকোয়েস্টে নির্বাচিত Voice Preset-এর মেটাডেটা প্রম্পট আকারে ইনজেক্ট হবে:
```text
Role: Professional Voice Actor
Director Instructions:
- Scene: {preset.scene}
- Context & Delivery Style: {preset.sampleContext}
- Voice Persona: {preset.voiceCharacter}
- Speaking Pace: {preset.pace}x
- Accent: {preset.accent}

Execution:
Enter the scene naturally adhering to the Scene and Context provided. 
Read the provided script strictly as written. Do not add introductory remarks, greetings, or meta commentary.

```


* **FR-4.3 (Local Caching via Tauri FS):** অডিও ফাইল ক্লাউডে না রেখে সরাসরি লোকাল ডিরেক্টরিতে সেভ হবে:
* পাথ: `{AppLocalDataDir}/projects/{project_id}/audio/chunk_{index}.wav`


* **FR-4.4 (Retry Mechanism):** কোনো চাঙ্ক ফেইল করলে স্বয়ংক্রিয়ভাবে ৩ বার এক্সপোনেনশিয়াল ব্যাক-অফ সহ রিট্রাই হবে। ফেইল্ড চাঙ্কের পাশে ম্যানুয়াল "Retry" বাটন দৃশ্যমান থাকবে।
* **FR-4.5 (Playback & Duration Tracking):** প্রতিটি অডিও তৈরি হলে তার সুনির্দিষ্ট দৈর্ঘ্য (Duration in milliseconds) প্রজেক্ট মেটাডেটায় সেভ হবে এবং ইন-অ্যাপ প্লেয়ারের মাধ্যমে প্রতিটি চাঙ্ক শোনার সুযোগ থাকবে।

---

## 5. UI & UX Requirements

1. **Dashboard Layout:** ডার্ক মোড ডিফল্ট, বামে নেভিগেশন (New Project, Voice Studio, Settings)।
2. **Voice Studio UI:**
* বামে সেভ করা প্রিসেটগুলোর তালিকা (Edit, Delete, Set Default অপশন সহ)।
* ডানে প্রিসেট কনফিগারেশন ফর্ম: Character ড্রপডাউন, `Scene` ইনপুট, `Sample Context` টেক্সট এরিয়া, Pace স্লাইডার, এবং নিচে "Listen Preview" ও "Save Preset" অ্যাকশন বাটন।


3. **Project Generation Screen:**
* স্ক্রিপ্ট ইনপুট এবং চাঙ্কিং প্রোগ্রেস বার।
* প্রতিটি চাঙ্কের জন্য স্ট্যাটাস ব্যাজ: `Queued`, `Generating`, `Completed`, `Failed`।
* প্রতি চাঙ্কের পাশে অডিও প্লেয়ার কন্ট্রোল (Play/Pause, Timeline, Duration)।



---

## 6. Error Handling & Edge Cases

| ইভেন্ট / সমস্যা | সিস্টেম রেসপন্স |
| --- | --- |
| **অবৈধ বা খালি API Key** | রিকোয়েস্ট ব্লক করে সরাসরি সেটিংসে রিডাইরেক্ট করবে এবং ইনপুট ফিল্ড হাইলাইট করবে। |
| **API Rate Limit (429)** | ৫ সেকেন্ড পজ নিয়ে ব্যাক-অফ অ্যালগরিদমে অটোমেটিক রিট্রাই করবে। |
| **Scene / Context ফিল্ড খালি থাকলে** | সিস্টেম ডিফল্ট ফলব্যাক ব্যবহার করবে (e.g., `Scene: Studio setting`, `Context: Natural pacing`). |
| **খুব ছোট স্ক্রিপ্ট (< ৩ মিনিট)** | কোনো বিভাজন ছাড়াই সরাসরি ১টি একক অডিও চাঙ্ক হিসেবে প্রসেস হবে। |

---

## 7. Definition of Done (DoD)

* [ ] Gemini API Key সেভ ও টেস্ট কানেকশন সফলভাবে কাজ করছে।
* [ ] `Scene` এবং `Sample Context` সহ ভয়েস প্রিসেট সফলভাবে তৈরি, এডিট এবং লোকাল স্টোরেজে সেভ থাকছে।
* [ ] "Listen Preview" বাটনে ক্লিক করলে কনটেক্সট অনুযায়ী টেস্ট অডিও প্লে হচ্ছে।
* [ ] ৩০ মিনিটের স্ক্রিপ্ট পেস্ট করলে তা ৩ মিনিটের ব্লকে অর্থপূর্ণভাবে ভাগ হচ্ছে।
* [ ] সব কটি অডিও চাঙ্ক ধারাবাহিকভাবে জেনারেট হয়ে লোকাল অ্যাপ ডিরেক্টরিতে `.wav` ফাইল হিসেবে জমা হচ্ছে।
* [ ] প্রতিটি চাঙ্কের অডিও অ্যাপের ভেতর প্লে করা যাচ্ছে এবং নিখুঁত সময় মেটাডেটায় সংরক্ষিত হচ্ছে।