# Product Requirements Document (PRD) — Phase 3: Assembly, Sync & Final Export

---

## 1. Executive Summary & Objective

Phase 3 হলো সম্পূর্ণ পাইপলাইনের সমাপনী ধাপ। এই ধাপে Phase 1-এর অডিও চাঙ্ক এবং Phase 2-এর মোশন অ্যানিমেটেড ভিডিও ক্লিপগুলোকে একটি সুসংগত টাইমলাইনে জোড়া লাগানো হবে। ব্যাকগ্রাউন্ড মিউজিক (BGM) ও অটো-ডাক্কিং সমন্বয় করে লোকাল FFmpeg-এর মাধ্যমে ফাইনাল ৩০ মিনিটের ফুল এইচডি (1080p) বা ৪K রেজ্যুলেশনের `.mp4` ভিডিও এক্সপোর্ট করা হবে।

* **Final Deliverable:** একটি সম্পূর্ণ প্রস্তুত ৩০ মিনিটের লং-ফর্ম ভিডিও ফাইল (`.mp4`)।
* **Core Tech:** Local Bundled FFmpeg (Tauri Sidecar), Tauri File Dialog & Notification API।

---

## 2. Technical Stack Additions

* **Native Dialogs:** `@tauri-apps/plugin-dialog` (আউটপুট ডিরেক্টরি এবং কাস্টম BGM ফাইল বাছাইয়ের জন্য)
* **System Notifications:** `@tauri-apps/plugin-notification` (দীর্ঘ রেন্ডারিং শেষে ওএস নোটিফিকেশন পাঠানোর জন্য)
* **FFmpeg Pipeline:** Complex Filter Graph (`concat`, `amix`, `sidechaincompress` for ducking)

---

## 3. Scope of Phase 3

### In-Scope:

* **Master Audio Stitching:** Phase 1-এর ৩ মিনিটের চাঙ্কগুলোকে ফ্রেম-অ্যাকুরেটভাবে জোড়া দিয়ে পূর্ণাঙ্গ ৩০ মিনিটের মাস্টার অডিও ট্র্যাক তৈরি।
* **Video Concatenation & Crossfade:** ৫০০+ মোশন ক্লিপকে নির্বিঘ্ন ট্রানজিশন সহ একক ভিডিও ট্র্যাকে রূপান্তর।
* **Background Music (BGM) & Auto-Ducking:** ব্যবহারকারীর মিউজিক ফাইল যুক্ত করা এবং ভয়েস চলাকালীন মিউজিকের সাউন্ড স্বয়ংক্রিয়ভাবে কমিয়ে দেওয়ার মেকানিজম।
* **FFmpeg Final Hardware Accelerated Render:** লোকাল মেশিনের CPU/GPU (NVENC/QuickSync) ব্যবহার করে দ্রুত এনকোডিং।
* **Live Rendering Progress & Crash Recovery:** লাইভ ফ্রেম কাউন্ট, পারসেন্টেজ বার এবং ব্যর্থ হলে রিকভারি।
* **Disk Space & Temp Asset Cleaner:** রেন্ডার শেষে গিগাবাইট সাইজের টেম্পোরারি ফাইলগুলো মুছে ড্রাইভ খালি করা।

### Out-of-Scope:

* ক্লাউডে সরাসরি অটো-ইউটিউব আপলোড (ভবিষ্যৎ আপডেটের জন্য সংরক্ষিত)।
* জটিল মাল্টি-লেয়ার ভিডিও এডিটর (যেমন: Premiere Pro বা CapCut-এর মতো ফ্রিহ্যান্ড টাইমলাইন)।

---

## 4. Detailed Functional Requirements

### 4.1 Master Audio Assembly

* **FR-3.1.1 (Audio Concat):** Phase 1-এর সবকটি `.wav` অডিও ক্লিপকে ক্রমানুসারে জোড়া লাগিয়ে একটি একক মাস্টার ভয়েস ট্র্যাক (`master_voice.wav`) তৈরি করা হবে।
* **FR-3.1.2 (Silence Trimming):** প্রতিটি চাঙ্কের শুরুতে বা শেষে থাকা অপ্রয়োজনীয় নীরবতা (dead silence) স্বয়ংক্রিয়ভাবে ট্রিম করে মসৃণ অডিও প্রবাহ বজায় রাখা হবে।

---

### 4.2 Background Music (BGM) & Auto-Ducking Engine

* **FR-3.2.1 (BGM Import):** ব্যবহারকারী লোকাল স্টোরেজ থেকে যেকোনো অডিও ফাইল (`.mp3`, `.wav`) ব্যাকগ্রাউন্ড মিউজিক হিসেবে লোড করতে পারবেন।
* **FR-3.2.2 (Loop & Fade):** মিউজিকের দৈর্ঘ্য ৩০ মিনিটের চেয়ে কম হলে তা স্বয়ংক্রিয়ভাবে লুপ হবে এবং ভিডিওর শেষ ৩ সেকেন্ডে মসৃণ ফেড-আউট (Fade-out) হবে।
* **FR-3.2.3 (Dynamic Auto-Ducking):**
* FFmpeg-এর `sidechaincompress` বা `amix` ফিল্টার ব্যবহার করা হবে।
* ভয়েসওভার যখন চলবে, BGM ভলিউম নিজে থেকেই -18dB থেকে -24dB পর্যন্ত ড্রপ করবে। ভয়েস শেষ বা বিরতি পেলে মিউজিক স্বাভাবিক মাত্রায় ফিরে আসবে।



---

### 4.3 Timeline Assembly & Video Concatenation

* **FR-3.3.1 (Concatenation Demuxer):** ৫০০+ ক্লিপ রেন্ডার করার জন্য FFmpeg Concat Demuxer ব্যবহার করা হবে, যাতে কোনো কোয়ালিটি ড্রপ না হয় এবং অতি দ্রুত ফাইল জোড়া লাগে।
* **FR-3.3.2 (Scene Transition):** দৃশ্যের পরিবর্তন যাতে দৃষ্টিকটু না লাগে, সেজন্য প্রতিটি ক্লিপের সংযোগস্থলে হালকা 0.3-সেকেন্ডের ক্রস-ডিসলভ (Cross-dissolve/Fade) ট্রানজিশন যুক্ত থাকবে।
* **FR-3.3.3 (Perfect Drift Correction):** অডিও এবং ভিডিওর চূড়ান্ত দৈর্ঘ্যের মাঝে মিলি-সেকেন্ডের অমিল থাকলে ফাইনাল ভিডিওর শেষ ফ্রেম ফ্রিজ করে অথবা হালকা প্যাডিং দিয়ে নিখুঁতভাবে সিঙ্ক করা হবে (Zero Audio-Video Drift)।

---

### 4.4 Final Rendering & Encoding Profiles

* **FR-3.4.1 (Quality Presets):**
* **1080p FHD (Default):** 1920x1080, 30fps, Bitrate: 8–10 Mbps (H.264 / AAC)।
* **4K UHD (Optional):** 3840x2160, 30fps, Bitrate: 25–35 Mbps।


* **FR-3.4.2 (Hardware Acceleration):** ইউজারের পিসিতে সমর্থিত হার্ডওয়্যার অনুযায়ী FFmpeg এনকোডার নির্বাচন করবে:
* NVIDIA GPU থাকলে: `h264_nvenc` (দ্রুততম রেন্ডার)।
* Intel থাকলে: `h264_qsv`।
* ফলব্যাক (Fallback): `libx264` (স্ট্যান্ডার্ড CPU এনকোডিং)।



---

### 4.5 Rendering Progress, Notifications & Post-Processing

* **FR-3.5.1 (Live Progress Parser):** FFmpeg-এর `stdout` থেকে রিয়েল-টাইম ফ্রেম ট্র্যাক করে UI-তে শতাংশ ও আনুমানিক অবশিষ্ট সময় (ETA) দেখানো হবে।
* **FR-3.5.2 (OS Notification):** ৩০ মিনিটের রেন্ডার সম্পূর্ণ হলে Tauri Notification প্লাগইন ব্যবহার করে ডেস্কটপে সাউন্ড সহ নোটিফিকেশন পাঠানো হবে: *"Your 30-minute video is ready!"*।
* **FR-3.5.3 (Disk Cache Management):**
* এক্সপোর্ট শেষে অ্যাপ একটি পপ-আপ দেবে: *"Clean temporary project files? (Frees up ~4.2 GB)"*।
* ব্যবহারকারী রাজি হলে শুধুমাত্র ফাইনাল `.mp4` ফাইলটি রেখে মাঝের টেম্পোরারি ইমেজ ও মোশন খণ্ডগুলো স্থায়ীভাবে ডিলিট করে দেওয়া হবে।



---

## 5. UI & UX Requirements

1. **Export Configuration Screen:**
* আউটপুট রেজ্যুলেশন সিলেক্টর (1080p / 4K)।
* BGM মডিউল: ফাইল সিলেক্টর, বেস ভলিউম স্লাইডার (Default: 15%) এবং "Enable Auto-Ducking" চেকবক্স।
* এক্সপোর্ট পাথ সিলেক্টর (e.g., `D:/YouTube Exports/Project_Universe_30m.mp4`)।


2. **Rendering State Screen:**
* বৃত্তাকার প্রোগ্রেস বার (0% থেকে 100%)।
* টেক্সট লগ: `Stitching Audio Tracks...` ➔ `Applying Crossfade & Ducking...` ➔ `Encoding Final MP4 (Hardware Accelerated)...`।
* রেন্ডার শেষে "Open in Folder" এবং "Play Video" বাটন দৃশ্যমান হবে।



---

## 6. Definition of Done (DoD) for Phase 3

* [ ] সবকটি অডিও চাঙ্ক জোড়া লেগে একটি মসৃণ মাস্টার অডিও ট্র্যাক তৈরি হচ্ছে।
* [ ] ব্যাকগ্রাউন্ড মিউজিক ভয়েসের নিচে স্বয়ংক্রিয়ভাবে ভলিউম কমিয়ে (Ducking) প্রফেশনাল মিক্সিং তৈরি করছে।
* [ ] ৫০০+ মোশন ভিডিও ক্লিপ অডিওর সাথে নিখুঁতভাবে সিঙ্ক হয়ে কোনো ব্ল্যাক ফ্রেম বা ড্রাফট ছাড়াই যুক্ত হচ্ছে।
* [ ] লোকাল FFmpeg সফলভাবে একটি একক 1080p/4K `.mp4` ভিডিও ফাইল ইউজারের নির্বাচিত ডিরেক্টরিতে এক্সপোর্ট করছে।
* [ ] রেন্ডারিং সম্পন্ন হলে ওএস নোটিফিকেশন আসছে এবং ব্যবহারকারী চাইলে এক ক্লিকে অপ্রয়োজনীয় ক্যাশ ফাইল মুছে ফেলতে পারছেন।