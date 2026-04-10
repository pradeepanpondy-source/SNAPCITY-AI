# 🏙️ SnapCity — AI Civic Reporter

*Snap it. Report it. Fix it. Turn a 10-second photo into a fully filed civic complaint — automatically.*

![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue)
![Gemini AI](https://img.shields.io/badge/Google-Gemini_AI-orange)
![Firebase](https://img.shields.io/badge/Firebase-Database-yellow)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

## 📖 Introduction
Every day, citizens walk past broken roads, overflowing garbage bins, busted streetlights, and water leaks — and do nothing. Not because they don't care, but because reporting a civic issue is painful. Wrong departments, endless forms, zero follow-up.

**SnapCity changes all of that.**

Upload a photo. Our AI agent instantly identifies the problem, estimates its severity, generates a professional complaint, and routes it to the correct municipal department — all in under 10 seconds. Citizens finally have a voice, and city authorities finally have structured, actionable data.

*Built for hackathons. Built for cities. Built for impact.*

---

## ✨ Features

### 🧠 AI-Powered Core
- **📸 Image Upload with Preview** — Drag-and-drop or tap to upload any civic issue photo
- **🔍 Auto Issue Classification** — Google Gemini Vision detects potholes, garbage, broken streetlights, water leaks, fallen trees, and more
- **⚠️ Severity Detection** — AI rates urgency as Low, Medium, High, or Critical
- **🏛️ Smart Department Routing** — Automatically maps each issue to the correct municipal department
- **📝 AI-Generated Formal Complaint** — Gemini writes a professional, structured complaint letter instantly
- **📊 Confidence Score** — Know how certain the AI is, with a recommended action plan
- **📍 Auto Location Detection** — GPS-based location tagging with address resolution

### 📋 Complaint Management
- **🎫 Unique Complaint ID** — Every report gets a trackable reference number
- **🔎 Token ID Tracking** — Paste your unique token into the dashboard search bar to instantly isolate and track your specific report
- **🔄 Status Tracking** — Real-time updates: Pending → Under Review → In Progress → Resolved
- **🗂️ Complaint History** — Full personal dashboard of all past submissions
- **🔔 Email Notifications** — Alerts when complaint status changes

### 📊 Analytics Dashboard
- **🗺️ City Heatmap** — Visual hotspot map of complaint density
- **📈 Issue Trend Charts** — Track which problems are rising or falling
- **🏆 Department Scorecards** — Resolution rates and average response times
- **📅 Monthly City Health Report** — AI-generated civic health summaries

### 🔐 Security & Trust
- **🔒 Secure Authentication** — Protected user accounts with session management
- **👤 Anonymous Mode** — Report issues without revealing identity
- **🛡️ Spam Detection** — AI filters fake or duplicate complaints
- **📷 Photo Authenticity Check** — Verifies images are genuine civic issues (Dual-Mode: Strict Camera vs. Demo)

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + Tailwind CSS | Responsive web interface |
| **AI Vision & LLM** | Google Gemini | Image analysis & complaint generation |
| **Database** | Firebase | Complaint records & user data |
| **Email** | Nodemailer / SMTP | Department & Citizen notifications |
| **Hosting** | Vercel | Serverless functions and deployment |

---

## 🏗️ Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                     CITIZEN (Browser)                   │
│              React Frontend — SnapCity UI               │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                     API LAYER                           │
│              Vercel Serverless Functions                │
└──────┬──────────────────┬───────────────────────────────┘
       │                  │
┌──────▼──────┐   ┌───────▼──────────────────────────────┐
│  Firebase   │   │         Google Gemini AI             │
│  Database   │   │  • Image Classification              │
│  + Auth     │   │  • Severity Detection                │
│             │   │  • Complaint Generation              │
└──────┬──────┘   │  • Department Routing                │
       │          └──────────────────────────────────────┘
┌──────▼──────────────────────────────────────────────────┐
│                   NOTIFICATION LAYER                    │
│                 Email (Nodemailer)                      │
└─────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User uploads photo → strictly checked for hardware metadata (EXIF).
2. Photo sent to Gemini Vision API → issue detected and analyzed.
3. Gemini LLM generates formal complaint text and routes to specific municipal department.
4. Complaint saved to Database (Firebase/LocalStorage).
5. Email auto-sent to relevant municipal department and citizen tracking.
6. User dashboard updated with live tracking status.

---

## ⚙️ Installation Steps

### Prerequisites
Make sure you have the following installed:
- Node.js v18 or higher
- npm or yarn
- Git
- A Google AI Studio account (for Gemini API key)

### 1. Clone the Repository
```bash
git clone https://github.com/mohamedjabrijs2005/Snapcity.git
cd Snapcity
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
# Google Gemini AI
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Firebase (Database)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket

# Email System (Vercel Serverless)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
```

### 4. Run the Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 📱 Usage Guide

### For Citizens
**Step 1 — Upload a Photo:** Upload an authentic image using "Live Camera Mode" (strict EXIF check) or "Demo Mode" for hackathon screenshots.  
**Step 2 — Auto Location:** The browser will auto-detect GPS coordinates and resolve the street name.  
**Step 3 — AI Analysis:** Within seconds, Gemini detects the issue, severity, department, and generates a formal complaint letter.  
**Step 4 — Review & Submit:** Review the letter, click Submit, and wait for your Trackable Token ID.  
**Step 5 — Track by Token:** Go to your Citizen Dashboard (*My Reports*), paste your **Token ID** in the new Search Bar, and securely monitor live status updates and admin feedback.  

### For Municipal Officers
Log in to the **Admin Dashboard** to view all generated complaints routed to your specific department. Click **"AI Draft"** to instantly formulate a professional response for dispatch.

---

## 🚀 Future Enhancements
- **Phase 2 — Community Features:** Neighbors upvote complaints to boost priority.
- **Phase 3 — Predictive Intelligence:** Forecast problem areas before they worsen based on weather data.
- **Phase 4 — Vernacular Voice:** Tamil, Hindi, Telugu voice reporting input.

---

## 🤝 Contributing
Contributions are what make open source amazing. Any contributions you make are greatly appreciated!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
Distributed under the MIT License.

## 👥 Team
- **Pradeepan M** — Team Lead, Architecture, AI & Deployment
- **Mohamed Jabri J S** — Frontend, Backend & Integration

*Built with ❤️ for citizens. Built with 🧠 by AI.*
