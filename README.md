# 🖨️ Cyber Cafe Helper

> A QR-powered print management system built for modern cyber cafés.

Cyber Cafe Helper simplifies the process of receiving and managing customer print requests.

Instead of customers sending documents through WhatsApp, email, or repeatedly connecting their phones to a computer, each cyber café gets its own **unique QR code**. Customers scan the QR code, upload their documents, choose their print requirements, and submit the job.

The café owner receives the request directly in the **owner dashboard** and can manage the print queue from one place.

🔗 **Live Demo:** https://cybercafe-helper.vercel.app/

---

## ✨ Features

### 📱 Customer Print Flow

* Scan a café-specific QR code
* Upload documents directly from a phone
* Support for common document/image formats
* Specify printing requirements
* Submit a print request without creating an account
* Receive a simple, mobile-friendly experience

### 🖥️ Owner Dashboard

* View incoming print requests
* Manage the print queue
* Review uploaded documents
* Track print-job status
* Manage café/workspace information
* Centralized dashboard for day-to-day operations

### 🔐 Authentication & Workspaces

* Secure user authentication
* Workspace-based architecture
* Owner/admin access control
* Workspace-specific QR identification
* Data isolation between cafés

### 🤖 AI-Powered Functionality

* AI-assisted features integrated into the application
* Designed to reduce repetitive work for cyber café operators

### 💳 Billing Infrastructure

* Pro subscription plan infrastructure
* Razorpay integration
* Subscription creation and verification flow
* Test-mode payment integration

> Recurring subscription activation is currently dependent on Razorpay's Test Mode card-mandate processing and is intentionally not a blocker for the deployed V1 application.

---

## 🔄 How It Works

```text
                    ┌──────────────────┐
                    │    Cyber Café    │
                    │      Owner       │
                    └────────┬─────────┘
                             │
                             │ Generates / displays
                             │ café-specific QR
                             ▼
                    ┌──────────────────┐
                    │   Café QR Code   │
                    └────────┬─────────┘
                             │
                         Customer
                           scans
                             │
                             ▼
                    ┌──────────────────┐
                    │ Customer Upload  │
                    │    & Request     │
                    └────────┬─────────┘
                             │
                       Print Job
                       submitted
                             │
                             ▼
                    ┌──────────────────┐
                    │  Owner Dashboard │
                    │                  │
                    │   Print Queue    │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Print / Process │
                    │      Job         │
                    └──────────────────┘
```

### Typical print-job lifecycle

```text
Submitted
    ↓
Accepted
    ↓
Printing
    ↓
Ready
```

---

## 🏗️ Architecture

Cyber Cafe Helper uses a modern web application architecture:

```text
┌───────────────────────────────────────────┐
│                  Customer                 │
│              Mobile Browser               │
└─────────────────────┬─────────────────────┘
                      │
                      │ QR Code
                      ▼
┌───────────────────────────────────────────┐
│             React + Vite Frontend         │
│                                           │
│  Customer Flow │ Owner Dashboard │ Auth  │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│                  Supabase                 │
│                                           │
│  Authentication │ Database │ Storage      │
│                                           │
│             Edge Functions                │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────┐
│          External Integrations            │
│                                           │
│              Razorpay                    │
└───────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend

* **React**
* **Vite**
* **JavaScript**
* **CSS**

### Backend & Infrastructure

* **Supabase**
* Supabase Authentication
* PostgreSQL database
* Supabase Storage
* Supabase Edge Functions

### Payments

* **Razorpay**

### Deployment

* **Vercel**

---

## 📂 Project Structure

```text
cybercafe-helper/
│
├── src/
│   ├── lib/
│   │   └── supabaseClient.js
│   │
│   ├── main.jsx
│   └── styles.css
│
├── index.html
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have:

* Node.js installed
* npm installed
* A Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/cybercafe-helper.git
cd cybercafe-helper
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### 4. Start the development server

```bash
npm run dev
```

The application will be available at the local Vite development URL.

### 5. Build for production

```bash
npm run build
```

---

## 🔐 Environment Variables

The frontend requires:

| Variable                        | Description                   |
| ------------------------------- | ----------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |

**Never commit secret credentials to GitHub.**

Server-side secrets such as Supabase service-role credentials and Razorpay secrets must remain inside the appropriate server-side environment.

---

## 🎯 Product Goal

Cyber Cafe Helper is designed around a simple problem:

> **Customers shouldn't have to figure out how to get their documents onto a cyber café computer.**

A QR code turns the café's physical location into a simple digital entry point.

The customer scans → uploads → submits.

The owner receives → reviews → prints.

The goal is to make everyday cyber café operations faster, simpler, and more organized.

---

## 📌 Project Status

**V1 — Live**

The current V1 application is deployed and operational.

🔗 **Live Application:** https://cybercafe-helper.vercel.app/

The project is currently focused on the core customer print-request and café management workflow.

---

## 🧠 What This Project Demonstrates

Cyber Cafe Helper demonstrates practical experience with:

* React application development
* Vite-based frontend architecture
* Supabase integration
* Authentication
* PostgreSQL-backed application design
* File uploads and storage
* Role-based workspace access
* QR-based workflows
* Serverless Edge Functions
* Third-party API integration
* Payment integration
* Production deployment with Vercel
* SaaS-style product architecture

---

## 📄 License

This project is currently maintained as a personal software project.

---

<p align="center">
  Built with ❤️ for the next generation of cyber cafés.
</p>
