# 🖨️ CyberCafe Helper

> A QR-powered print management and cyber café operations platform built for modern cyber cafés.

CyberCafe Helper makes it easier for cyber café owners to receive, organize, and process customer print requests.

Instead of customers sending documents through WhatsApp, email, or repeatedly connecting their phones to a computer, each café gets a **café-specific QR code**.

Customers scan the QR code → upload their documents → choose print requirements → submit the request.

The café owner receives the request directly in the **owner dashboard**, where they can review documents, manage the print queue, track customers, schedule follow-ups, and manage day-to-day café operations.

---

## 🚀 Live Application

**Live Demo:** https://www.cybercafehelper.in/

**GitHub:** https://github.com/Uttam888/cybercafe-helper

---

## ✨ Key Features

### 📱 QR-Based Customer Print Flow

Customers can submit print requests directly from their phones without creating an account.

- Scan a café-specific QR code
- Upload documents or images
- Enter customer details
- Select print requirements
- Choose B&W or color printing
- Select paper size
- Select number of copies
- Enable duplex printing
- Add notes for the café operator
- Submit the print request

The customer does not need access to the café's computer or messaging applications.

---

### 🖨️ Print Job Management

Café operators get a centralized print queue inside the dashboard.

- View incoming print requests
- Review customer information
- Open uploaded documents securely
- Accept or reject requests
- Track printing progress
- Mark completed jobs
- Track pending and completed work
- View print specifications
- Manage multiple print jobs from one place

### Print Job Lifecycle

```text
Pending
   ↓
Accepted
   ↓
Printing
   ↓
Completed

Jobs can also be rejected when necessary.

👥 Customer Management

The application maintains customer information associated with the café workspace.

Customer records
Customer contact information
Customer print activity
Workspace-specific customer access
Customer history for operational use

This gives café operators a foundation for managing repeat customers rather than treating every print request as an isolated transaction.

🤖 AI-Powered Operations

CyberCafe Helper includes AI-assisted functionality designed to reduce repetitive work for café operators.

The application uses AI for operational intelligence and customer-related assistance, allowing the dashboard to provide more useful information than a basic CRUD application.

AI functionality is integrated through server-side application logic rather than exposing sensitive credentials in the browser.

📅 Follow-Ups

The dashboard supports customer follow-up workflows.

Operators can:

Schedule follow-ups
Track follow-up status
Manage customer-related reminders
Keep important customer interactions organized

This helps extend the application beyond simple print-job management.

💰 Earnings & Business Tracking

The application includes operational earnings functionality for tracking printing revenue.

Supported pricing includes:

Service	Price
A4 B&W	₹2
A4 Color	₹10
A3 B&W	₹4
A3 Color	₹20
Duplex	10% discount

The system tracks actual paid amounts and outstanding amounts rather than relying only on static estimates.

🔗 Quick Links & Café Tools

The dashboard provides quick access to frequently used resources and café-specific links.

This allows operators to keep common services and resources organized within the application instead of maintaining separate browser bookmarks.

🏢 Workspace Architecture

CyberCafe Helper is designed as a multi-workspace application.

Each café operates within its own workspace with workspace-specific:

Customers
Print jobs
QR identification
Quick links
Services
Operational data

Workspace access is controlled through authenticated membership and role-based permissions.

👤 Authentication & Roles

The application supports authenticated users and workspace-based authorization.

The architecture supports roles such as:

Owner
Admin
Staff

Access to operational data is restricted according to workspace membership and permissions.

💳 Subscription & Billing Infrastructure

The application includes subscription infrastructure using Razorpay.

Implemented functionality includes:

Subscription creation
Subscription verification
Payment integration
Webhook processing
Payment records
Pro subscription infrastructure

The production V1 currently focuses on the core café workflow while payment functionality continues to operate through the configured Razorpay environment.

🔄 How It Works
                    ┌─────────────────────┐
                    │     Café Owner      │
                    │       Dashboard     │
                    └──────────┬──────────┘
                               │
                               │ Café QR
                               ▼
                    ┌─────────────────────┐
                    │    Café QR Code     │
                    └──────────┬──────────┘
                               │
                          Customer scans
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Customer Web App  │
                    │                     │
                    │ Upload + Print      │
                    │ Requirements        │
                    └──────────┬──────────┘
                               │
                          Print Request
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Print Queue      │
                    │                     │
                    │ Pending → Accepted  │
                    │ → Printing          │
                    │ → Completed         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Café Operator     │
                    │   Processes Job     │
                    └─────────────────────┘
Customer Experience
Scan QR
   ↓
Open café page
   ↓
Enter details
   ↓
Upload documents
   ↓
Select print requirements
   ↓
Submit
Owner Experience
Receive request
   ↓
Review print job
   ↓
Open document securely
   ↓
Accept / Reject
   ↓
Print
   ↓
Mark completed
🏗️ Architecture

CyberCafe Helper uses a modern client + backend-as-a-service architecture.

┌──────────────────────────────────────────────┐
│                 Customers                    │
│              Mobile Browsers                │
└──────────────────────┬───────────────────────┘
                       │
                       │ QR Code
                       ▼
┌──────────────────────────────────────────────┐
│             React + Vite Frontend            │
│                                              │
│ Customer Flow │ Dashboard │ Auth │ Settings  │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                  Supabase                    │
│                                              │
│ Authentication                              │
│ PostgreSQL                                   │
│ Storage                                      │
│ Row Level Security                           │
│ Edge Functions                               │
└──────────────────────┬───────────────────────┘
                       │
              ┌────────┴─────────┐
              ▼                  ▼
┌──────────────────────┐  ┌───────────────────┐
│ Server-side Services │  │ External Services │
│                      │  │                   │
│ AI Functions         │  │ Razorpay          │
│ Print Processing     │  │                   │
│ Secure File Access   │  │                   │
└──────────────────────┘  └───────────────────┘
🔐 Security

Security was treated as a core part of the application rather than an afterthought.

Row Level Security

Supabase PostgreSQL tables use Row Level Security (RLS) to enforce workspace-level data isolation.

Users should only be able to access data belonging to workspaces they are authorized to access.

Private Document Storage

Customer-uploaded print documents are stored in a private Supabase Storage bucket.

Documents are not exposed through permanent public URLs.

When an authorized café operator requests a document, the backend generates a temporary signed URL.

Owner
  ↓
Authenticated Request
  ↓
Edge Function
  ↓
Verify Workspace Membership
  ↓
Generate Temporary Signed URL
  ↓
Open Private Document
Server-Side Secrets

Sensitive credentials such as:

Supabase service-role credentials
Razorpay secrets
Webhook secrets
AI API credentials

are kept server-side and are never intended to be exposed through the frontend.

Rate Limiting

The public print submission endpoint includes rate limiting to reduce abuse.

The submission endpoint uses Redis-backed request limiting with separate short-term and rolling request limits.

🛠️ Tech Stack
Frontend
React
Vite
JavaScript
CSS
Backend
Supabase
PostgreSQL
Supabase Authentication
Supabase Storage
Supabase Edge Functions
Row Level Security
AI
Google Gemini
Payments
Razorpay
Rate Limiting
Upstash Redis
Deployment
Vercel
📂 Project Structure
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
├── vercel.json
└── README.md

Backend functionality is implemented through Supabase Edge Functions.

🚀 Getting Started
Prerequisites

Make sure you have:

Node.js
npm
A Supabase project
1. Clone the repository
git clone https://github.com/Uttam888/cybercafe-helper.git

cd cybercafe-helper
2. Install dependencies
npm install
3. Configure environment variables

Create a .env file in the project root:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
4. Start the development server
npm run dev

The application will be available at the local Vite development URL.

5. Build for production
npm run build
🔑 Environment Variables

The frontend requires:

Variable	Description
VITE_SUPABASE_URL	Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY	Supabase publishable/anon key
Important

Never commit secret credentials to GitHub.

Server-side credentials and secrets should remain inside the appropriate server-side environment.

Examples include:

SUPABASE_SERVICE_ROLE_KEY
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
AI API credentials
Redis credentials

The exact server-side configuration depends on the deployed Supabase Edge Functions.

📱 Responsive Design

The application is designed to work across:

Desktop
Laptop
Tablet
Mobile devices

The customer QR flow is specifically designed around mobile usage, while the owner dashboard provides a responsive interface for café operators.

🎯 Product Goal

CyberCafe Helper is built around a simple problem:

Customers shouldn't have to figure out how to get their documents onto a cyber café computer.

A QR code turns the café's physical location into a simple digital entry point.

Customer

Scan
  ↓
Upload
  ↓
Submit
Café

Receive
  ↓
Review
  ↓
Print
  ↓
Complete

The broader goal is to turn common cyber café workflows into a centralized digital operating system.

🧠 Engineering Highlights

This project demonstrates practical experience with:

React application architecture
Vite-based frontend development
Responsive UI design
Supabase integration
PostgreSQL database design
Row Level Security
Authentication and authorization
Workspace-based multi-tenant architecture
Role-based access control
Private file storage
Temporary signed URLs
Serverless Edge Functions
QR-based workflows
Public-to-authenticated workflow boundaries
AI integration
Payment integration
Webhook processing
Redis-backed rate limiting
Production deployment
SaaS-style application architecture

The project also required designing secure boundaries between:

Public Customer
       ↓
Public QR Workflow
       ↓
Backend Validation
       ↓
Workspace
       ↓
Authorized Operator
       ↓
Private Documents
📌 Project Status
V1 — Live

CyberCafe Helper V1 is deployed and operational.

Live Application:

https://cybercafe-helper.vercel.app/

The current version focuses on:

QR-based print requests
Print queue management
Customer management
Workspace-based operations
AI-assisted functionality
Follow-ups
Earnings tracking
Secure document access
Subscription infrastructure

The application is being developed iteratively as a production-oriented SaaS project.

🗺️ Future Improvements

Potential future improvements include:

More advanced café analytics
Printer/device integration
Automated print-cost calculation
Additional payment workflows
Expanded AI automation
Improved operational reporting
Additional customer self-service features
Native mobile experience
📄 License

This project is currently maintained as a personal software project.

<p align="center"> Built with ❤️ for the next generation of cyber cafés. </p> 

