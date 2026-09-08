import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { supabase } from "./lib/supabaseClient";

import {
  Search,
  LayoutDashboard,
  Link2,
  Users,
  Calculator,
  Settings,
  Plus,
  ExternalLink,
  CheckCircle2,
  CircleAlert,
  Trash2,
  Menu,
  X,
  FileText,
  CreditCard,
  GraduationCap,
  Landmark,
  Bookmark,
  IndianRupee,
  Phone,
  Receipt,
  ClipboardList,
  Monitor,
  Zap,
  ShieldCheck,
  Clock3,
  MessageCircle,
  MapPin,
  Hash,
  CalendarDays,
  UserRound,
  ChevronRight,
  Pencil,
  Wallet,
  Banknote,
  History,
  BarChart3,
  TrendingUp,
  PieChart,
  Download,
  Sun,
  Moon,
  Database,
  Upload,
  RotateCcw,
  SearchX,
  Globe2,
  Sparkles,
  LogOut,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  QrCode,
  Printer as PrinterIcon,
  Bell
} from "lucide-react";

const getSafeUiError = (error, fallback = "Something went wrong. Please try again.") => {
  const message = String(error?.message || "").trim();
  if (!message) return fallback;
  if (message.length > 180) return fallback;
  if (/supabase|postgres|postgrest|row[- ]level|rls|policy|relation|schema|jwt|function|stack|sql|database|permission denied|violates/i.test(message)) {
    return fallback;
  }
  return message;
};


/**
 * Call a Supabase Edge Function with a current access token.
 *
 * Authentication recovery is intentionally limited:
 * - use the current session first
 * - if the function rejects the access token with 401, refresh once
 * - if Supabase reports an invalid/missing refresh token, clear the
 *   broken local session and require a fresh sign-in
 * - retry the Edge Function exactly once after a successful refresh
 */
async function invokeAuthenticatedFunction(functionName, options = {}) {
  const isInvalidRefreshTokenError = (error) => {
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found") ||
      message.includes("refresh token is not found")
    );
  };

  const clearBrokenLocalSession = async () => {
    try {
      // scope: "local" clears the invalid browser session without depending
      // on the server accepting the already-invalid refresh token.
      await supabase.auth.signOut({ scope: "local" });
    } catch (signOutError) {
      console.warn("Could not clear the broken local auth session:", signOutError);
    }
  };

  const getUsableSession = async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    let session = data?.session || null;

    if (!session?.access_token) {
      const refreshResult = await supabase.auth.refreshSession();

      if (refreshResult.error) {
        if (isInvalidRefreshTokenError(refreshResult.error)) {
          await clearBrokenLocalSession();
          throw new Error("Your session has expired. Please sign in again.");
        }

        throw refreshResult.error;
      }

      session = refreshResult.data?.session || null;
    }

    if (!session?.access_token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    return session;
  };

  const invoke = (accessToken) =>
    supabase.functions.invoke(functionName, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let session;

  try {
    session = await getUsableSession();
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearBrokenLocalSession();
      throw new Error("Your session has expired. Please sign in again.");
    }
    throw error;
  }

  let result = await invoke(session.access_token);

  const responseStatus =
    result?.error?.context?.status ??
    result?.error?.status ??
    result?.error?.context?.response?.status;

  if (responseStatus === 401) {
    let refreshedSession;

    try {
      const refreshResult = await supabase.auth.refreshSession();

      if (refreshResult.error) {
        if (isInvalidRefreshTokenError(refreshResult.error)) {
          await clearBrokenLocalSession();
          throw new Error("Your session has expired. Please sign in again.");
        }

        throw refreshResult.error;
      }

      refreshedSession = refreshResult.data?.session || null;
    } catch (refreshError) {
      if (isInvalidRefreshTokenError(refreshError)) {
        await clearBrokenLocalSession();
        throw new Error("Your session has expired. Please sign in again.");
      }
      throw refreshError;
    }

    if (!refreshedSession?.access_token) {
      await clearBrokenLocalSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    result = await invoke(refreshedSession.access_token);
  }

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

const DEFAULT_PRINT_PRICING = {
  bwPrice: 2,
  colorPrice: 10,
  a3BwPrice: 4,
  a3ColorPrice: 20,
  duplexDiscount: 10
};

const getPrintPricing = (workspace) => ({
  bwPrice: Number(workspace?.print_bw_price ?? DEFAULT_PRINT_PRICING.bwPrice),
  colorPrice: Number(workspace?.print_color_price ?? DEFAULT_PRINT_PRICING.colorPrice),
  a3BwPrice: Number(workspace?.print_a3_bw_price ?? DEFAULT_PRINT_PRICING.a3BwPrice),
  a3ColorPrice: Number(workspace?.print_a3_color_price ?? DEFAULT_PRINT_PRICING.a3ColorPrice),
  duplexDiscount: Number(workspace?.print_duplex_discount ?? DEFAULT_PRINT_PRICING.duplexDiscount)
});

const calculatePrintEstimate = ({ workspace, colorMode, paperSize, copies, duplex, fileCount }) => {
  const pricing = getPrintPricing(workspace);
  const base = paperSize === "A3"
    ? (colorMode === "color" ? pricing.a3ColorPrice : pricing.a3BwPrice)
    : (colorMode === "color" ? pricing.colorPrice : pricing.bwPrice);
  const fileUnits = Math.max(0, Number(fileCount) || 0);
  if (!fileUnits) return 0;
  const units = fileUnits * Math.max(1, Number(copies) || 1);
  const discountMultiplier = duplex ? Math.max(0, 1 - Math.min(100, Math.max(0, pricing.duplexDiscount)) / 100) : 1;
  return Math.max(0, base * units * discountMultiplier);
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSafeExternalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function getSafePhoneUrl(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 15);
  return digits ? `tel:${digits}` : "";
}

function getSafeWhatsAppUrl(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(-15);
  return digits ? `https://wa.me/${digits}` : "";
}

const services = [
  {
    title: "Aadhaar Services",
    icon: <CreditCard size={22} />,
    links: [
      { name: "UIDAI", url: "https://uidai.gov.in/" },
      {
        name: "My Aadhaar",
        url: "https://myaadhaar.uidai.gov.in/"
      }
    ]
  },
  {
    title: "PAN Card",
    icon: <FileText size={22} />,
    links: [
      {
        name: "Income Tax e-Filing",
        url: "https://www.incometax.gov.in/"
      },
      {
        name: "Protean eGov",
        url: "https://www.protean-tinpan.com/"
      }
    ]
  },
  {
    title: "Exams & Jobs",
    icon: <GraduationCap size={22} />,
    links: [
      {
        name: "National Career Service",
        url: "https://www.ncs.gov.in/"
      },
      {
        name: "NTA",
        url: "https://www.nta.ac.in/"
      }
    ]
  },
  {
    title: "Banking & Finance",
    icon: <Landmark size={22} />,
    links: [
      {
        name: "EPFO",
        url: "https://www.epfindia.gov.in/"
      },
      {
        name: "GST Portal",
        url: "https://www.gst.gov.in/"
      }
    ]
  }
];

const defaultTasks = [
  {
    id: 1,
    name: "Rahul Kumar",
    phone: "9876543210",
    reference: "PAN123456",
    address: "Delhi",
    service: "PAN Correction",
    amount: 150,
    paid: 150,
    status: "Pending",
    documents: ["Aadhaar", "Photo"],
    notes: "Customer requested quick processing.",
    dueDate: "2026-09-05",
    created: "2026-09-03",
    payments: [
      {
        id: 1001,
        amount: 150,
        method: "Cash",
        note: "Full payment",
        date: "2026-09-03"
      }
    ]
  },
  {
    id: 2,
    name: "Priya Sharma",
    phone: "9812345678",
    reference: "AAD789012",
    address: "Delhi",
    service: "Aadhaar Update",
    amount: 80,
    paid: 40,
    status: "Processing",
    documents: ["Aadhaar"],
    notes: "Address proof needs verification.",
    dueDate: "2026-09-06",
    created: "2026-09-03",
    payments: [
      {
        id: 1002,
        amount: 40,
        method: "UPI",
        note: "Advance payment",
        date: "2026-09-03"
      }
    ]
  },
  {
    id: 3,
    name: "Amit Verma",
    phone: "9123456780",
    reference: "EXM456789",
    address: "Delhi",
    service: "Exam Form",
    amount: 120,
    paid: 120,
    status: "Completed",
    documents: ["Photo", "Signature"],
    notes: "Form successfully submitted.",
    dueDate: "2026-09-03",
    created: "2026-09-02",
    payments: [
      {
        id: 1003,
        amount: 120,
        method: "UPI",
        note: "Full payment",
        date: "2026-09-02"
      }
    ]
  }
];

const docOptions = [
  "Aadhaar",
  "PAN",
  "Photo",
  "Signature",
  "Address Proof",
  "Marksheet",
  "Bank Passbook"
];

const requiredDocumentsByService = {
  "PAN Correction": ["Aadhaar", "Photo", "Signature"],
  "PAN Card": ["Aadhaar", "Photo", "Signature"],
  "Aadhaar Update": ["Aadhaar", "Address Proof"],
  "Aadhaar Services": ["Aadhaar", "Photo"],
  "Exam Form": ["Aadhaar", "Photo", "Signature"],
  "Bank Account Work": ["Aadhaar", "PAN", "Photo", "Bank Passbook"],
  "Banking & Finance": ["Aadhaar", "PAN", "Photo", "Bank Passbook"]
};

const workflowStagesByService = {
  "PAN Correction": ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
  "PAN Card": ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
  "Aadhaar Update": ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
  "Aadhaar Services": ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
  "Exam Form": ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
  "Bank Account Work": ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
  "Banking & Finance": ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"]
};

const serviceTrackingLabels = {
  "PAN Correction": "PAN Application / Acknowledgement No.",
  "PAN Card": "PAN Application / Acknowledgement No.",
  "Aadhaar Update": "Aadhaar Update Reference No.",
  "Aadhaar Services": "Aadhaar Reference No.",
  "Exam Form": "Exam / Application No.",
  "Bank Account Work": "Bank Application / Reference No.",
  "Banking & Finance": "Transaction / Reference No."
};

const defaultServiceTemplates = [
  {
    id: "pan-correction",
    name: "PAN Correction",
    price: 150,
    completionDays: 7,
    requiredDocuments: ["Aadhaar", "Photo", "Signature"],
    workflowStages: ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
    trackingLabel: "PAN Application / Acknowledgement No."
  },
  {
    id: "pan-card",
    name: "PAN Card",
    price: 120,
    completionDays: 7,
    requiredDocuments: ["Aadhaar", "Photo", "Signature"],
    workflowStages: ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
    trackingLabel: "PAN Application / Acknowledgement No."
  },
  {
    id: "aadhaar-update",
    name: "Aadhaar Update",
    price: 100,
    completionDays: 5,
    requiredDocuments: ["Aadhaar", "Address Proof"],
    workflowStages: ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
    trackingLabel: "Aadhaar Update Reference No."
  },
  {
    id: "exam-form",
    name: "Exam Form",
    price: 120,
    completionDays: 3,
    requiredDocuments: ["Aadhaar", "Photo", "Signature"],
    workflowStages: ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
    trackingLabel: "Exam / Application No."
  },
  {
    id: "bank-account-work",
    name: "Bank Account Work",
    price: 200,
    completionDays: 5,
    requiredDocuments: ["Aadhaar", "PAN", "Photo", "Bank Passbook"],
    workflowStages: ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"],
    trackingLabel: "Bank Application / Reference No."
  }
];


function getServiceTemplate(service) {
  const value = String(service || "").trim();
  const templates = defaultServiceTemplates;
  return templates.find((item) => String(item.name || "").trim() === value) || null;
}

function getWorkflowStages(service) {
  const value = String(service || "").trim();
  const template = getServiceTemplate(value);
  if (template?.workflowStages?.length) return template.workflowStages;
  if (workflowStagesByService[value]) return workflowStagesByService[value];
  const lower = value.toLowerCase();
  if (lower.includes("pan")) return workflowStagesByService["PAN Card"];
  if (lower.includes("aadhaar")) return workflowStagesByService["Aadhaar Update"];
  if (lower.includes("exam") || lower.includes("form")) return workflowStagesByService["Exam Form"];
  if (lower.includes("bank")) return workflowStagesByService["Bank Account Work"];
  return ["New", "Documents", "Processing", "Ready", "Completed"];
}

function getTrackingLabel(service) {
  const value = String(service || "").trim();
  const template = getServiceTemplate(value);
  if (template?.trackingLabel) return template.trackingLabel;
  if (serviceTrackingLabels[value]) return serviceTrackingLabels[value];
  const lower = value.toLowerCase();
  if (lower.includes("pan")) return serviceTrackingLabels["PAN Card"];
  if (lower.includes("aadhaar")) return serviceTrackingLabels["Aadhaar Update"];
  if (lower.includes("exam") || lower.includes("form")) return serviceTrackingLabels["Exam Form"];
  if (lower.includes("bank")) return serviceTrackingLabels["Bank Account Work"];
  return "Application / Reference No.";
}

function getWorkflowProgress(task) {
  const stages = getWorkflowStages(task?.service);
  const current = task?.workflowStage || stages[0];
  const index = Math.max(stages.indexOf(current), 0);
  const percent = stages.length > 1 ? Math.round((index / (stages.length - 1)) * 100) : 100;
  return { stages, current, index, percent };
}

function statusForWorkflowStage(stage, stages) {
  if (stage === stages[stages.length - 1]) return "Completed";
  if (stage === stages[0]) return "Pending";
  return "Processing";
}

function getRequiredDocuments(service) {
  const value = String(service || "").trim();
  const template = getServiceTemplate(value);
  if (template?.requiredDocuments?.length) return template.requiredDocuments;
  if (requiredDocumentsByService[value]) return requiredDocumentsByService[value];
  const lower = value.toLowerCase();
  if (lower.includes("pan")) return requiredDocumentsByService["PAN Correction"];
  if (lower.includes("aadhaar")) return requiredDocumentsByService["Aadhaar Update"];
  if (lower.includes("exam") || lower.includes("form")) return requiredDocumentsByService["Exam Form"];
  if (lower.includes("bank")) return requiredDocumentsByService["Bank Account Work"];
  return ["Aadhaar", "Photo", "Signature"];
}

function getDocumentProgress(task) {
  const required = getRequiredDocuments(task?.service);
  const received = Array.isArray(task?.documents) ? task.documents : [];
  const receivedRequired = required.filter((doc) => received.includes(doc));
  return {
    required,
    receivedRequired,
    missing: required.filter((doc) => !received.includes(doc)),
    percent: required.length ? Math.round((receivedRequired.length / required.length) * 100) : 100
  };
}

function normalizeTask(task) {
  const stages = getWorkflowStages(task?.service);
  let workflowStage = task?.workflowStage;

  if (!workflowStage || !stages.includes(workflowStage)) {
    if (task?.status === "Completed") {
      workflowStage = stages[stages.length - 1];
    } else if (task?.status === "Processing") {
      workflowStage = stages.includes("Processing") ? "Processing" : stages[Math.min(2, stages.length - 1)];
    } else {
      workflowStage = stages[0];
    }
  }

  return {
    ...task,
    documents: Array.isArray(task?.documents) ? task.documents : [],
    payments: Array.isArray(task?.payments) ? task.payments : [],
    followUps: Array.isArray(task?.followUps) ? task.followUps : [],
    workflowStage,
    applicationNumber: task?.applicationNumber || ""
  };
}



// ============================================================
// STEP 18E — SUPABASE SERVICE TEMPLATE DATA LAYER
// ============================================================

const SERVICE_TEMPLATE_DB_COLUMNS = [
  "id",
  "workspace_id",
  "name",
  "price",
  "completion_days",
  "required_documents",
  "workflow_stages",
  "tracking_label",
  "created_at",
  "updated_at"
];

function mapServiceTemplateFromDatabase(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name || "",
    price: Number(row.price || 0),
    completionDays: Number(row.completion_days || 0),
    requiredDocuments: Array.isArray(row.required_documents) ? row.required_documents : [],
    workflowStages: Array.isArray(row.workflow_stages) ? row.workflow_stages : [],
    trackingLabel: row.tracking_label || "Application / Reference No.",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeServiceTemplateForDatabase(service, workspaceId) {
  return {
    workspace_id: workspaceId,
    name: String(service?.name || "").trim(),
    price: Number.isFinite(Number(service?.price)) ? Number(service.price) : 0,
    completion_days: Number.isFinite(Number(service?.completionDays)) ? Math.max(Number(service.completionDays), 0) : 0,
    required_documents: Array.isArray(service?.requiredDocuments) ? service.requiredDocuments.filter(Boolean) : [],
    workflow_stages: Array.isArray(service?.workflowStages) ? service.workflowStages.filter(Boolean) : ["New", "Processing", "Ready", "Completed"],
    tracking_label: String(service?.trackingLabel || "Application / Reference No.").trim()
  };
}

async function getServiceTemplatesFromSupabase(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to load service templates.");

  const { data, error } = await supabase
    .from("service_templates")
    .select(SERVICE_TEMPLATE_DB_COLUMNS.join(","))
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapServiceTemplateFromDatabase);
}

async function createServiceTemplateInSupabase(service, workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to create a service template.");

  const payload = normalizeServiceTemplateForDatabase(service, workspaceId);
  if (!payload.name) throw new Error("Service name is required.");

  const { data, error } = await supabase
    .from("service_templates")
    .insert(payload)
    .select(SERVICE_TEMPLATE_DB_COLUMNS.join(","))
    .single();

  if (error) throw error;
  return mapServiceTemplateFromDatabase(data);
}

async function updateServiceTemplateInSupabase(service, workspaceId) {
  if (!workspaceId || !service?.id) {
    throw new Error("Workspace and service template ID are required to update a service.");
  }

  const payload = normalizeServiceTemplateForDatabase(service, workspaceId);
  delete payload.workspace_id;

  const { data, error } = await supabase
    .from("service_templates")
    .update(payload)
    .eq("id", service.id)
    .eq("workspace_id", workspaceId)
    .select(SERVICE_TEMPLATE_DB_COLUMNS.join(","))
    .single();

  if (error) throw error;
  return mapServiceTemplateFromDatabase(data);
}

async function deleteServiceTemplateFromSupabase(serviceId, workspaceId) {
  if (!workspaceId || !serviceId) {
    throw new Error("Workspace and service template ID are required to delete a service.");
  }

  const { error } = await supabase
    .from("service_templates")
    .delete()
    .eq("id", serviceId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  return true;
}

// ============================================================
// STEP 18F — SUPABASE QUICK LINKS DATA LAYER
// ============================================================

const QUICK_LINK_DB_COLUMNS = [
  "id",
  "workspace_id",
  "name",
  "url",
  "created_at",
  "updated_at"
];

function mapQuickLinkFromDatabase(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name || "",
    url: row.url || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeQuickLinkForDatabase(link, workspaceId) {
  return {
    workspace_id: workspaceId,
    name: String(link?.name || "").trim(),
    url: getSafeExternalUrl(link?.url)
  };
}

async function getQuickLinksFromSupabase(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to load quick links.");

  const { data, error } = await supabase
    .from("quick_links")
    .select(QUICK_LINK_DB_COLUMNS.join(","))
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapQuickLinkFromDatabase);
}

async function createQuickLinkInSupabase(link, workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to create a quick link.");

  const payload = normalizeQuickLinkForDatabase(link, workspaceId);
  if (!payload.name || !payload.url) throw new Error("Quick link name and a valid http(s) URL are required.");

  const { data, error } = await supabase
    .from("quick_links")
    .insert(payload)
    .select(QUICK_LINK_DB_COLUMNS.join(","))
    .single();

  if (error) throw error;
  return mapQuickLinkFromDatabase(data);
}

async function updateQuickLinkInSupabase(link, workspaceId) {
  if (!workspaceId || !link?.id) {
    throw new Error("Workspace and quick link ID are required to update a quick link.");
  }

  const payload = normalizeQuickLinkForDatabase(link, workspaceId);
  delete payload.workspace_id;

  const { data, error } = await supabase
    .from("quick_links")
    .update(payload)
    .eq("id", link.id)
    .eq("workspace_id", workspaceId)
    .select(QUICK_LINK_DB_COLUMNS.join(","))
    .single();

  if (error) throw error;
  return mapQuickLinkFromDatabase(data);
}

async function deleteQuickLinkFromSupabase(linkId, workspaceId) {
  if (!workspaceId || !linkId) {
    throw new Error("Workspace and quick link ID are required to delete a quick link.");
  }

  const { error } = await supabase
    .from("quick_links")
    .delete()
    .eq("id", linkId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  return true;
}


// ============================================================
// STEP 18B-1 — SUPABASE CUSTOMER DATA LAYER
// ============================================================

const CUSTOMER_DB_COLUMNS = [
  "id",
  "workspace_id",
  "name",
  "phone",
  "reference",
  "service",
  "total_amount",
  "paid_amount",
  "due_date",
  "address",
  "documents",
  "custom_documents",
  "notes",
  "status",
  "workflow_stage",
  "application_number",
  "tracking_label",
  "created_at",
  "updated_at"
];

function normalizeCustomerForDatabase(customer, workspaceId) {
  const safeNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };

  return {
    workspace_id: workspaceId,
    name: String(customer?.name || "").trim(),
    phone: customer?.phone || null,
    reference: customer?.reference || null,
    service: customer?.service || null,
    total_amount: safeNumber(customer?.amount ?? customer?.total),
    paid_amount: safeNumber(customer?.paid),
    due_date: customer?.dueDate || null,
    address: customer?.address || null,
    documents: Array.isArray(customer?.documents) ? customer.documents : [],
    custom_documents: Array.isArray(customer?.customDocuments)
      ? customer.customDocuments
      : [],
    notes: customer?.notes || null,
    status: customer?.status || "Pending",
    workflow_stage: customer?.workflowStage || "New",
    application_number: customer?.applicationNumber || null,
    tracking_label: customer?.trackingLabel || null
  };
}

function mapCustomerFromDatabase(row) {
  if (!row) return null;

  const total = Number(row.total_amount || 0);
  const paid = Number(row.paid_amount || 0);

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name || "",
    phone: row.phone || "",
    reference: row.reference || "",
    service: row.service || "",
    total,
    amount: total,
    paid,
    due: Math.max(0, total - paid),
    dueDate: row.due_date || "",
    address: row.address || "",
    documents: Array.isArray(row.documents) ? row.documents : [],
    customDocuments: Array.isArray(row.custom_documents)
      ? row.custom_documents
      : [],
    notes: row.notes || "",
    status: row.status || "Pending",
    workflowStage: row.workflow_stage || "New",
    applicationNumber: row.application_number || "",
    trackingLabel: row.tracking_label || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getCustomersFromSupabase(workspaceId) {
  if (!workspaceId) {
    throw new Error("Workspace is required to load customers.");
  }

  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_DB_COLUMNS.join(","))
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapCustomerFromDatabase);
}

async function createCustomerInSupabase(customer, workspaceId) {
  if (!workspaceId) {
    throw new Error("Workspace is required to create a customer.");
  }

  const payload = normalizeCustomerForDatabase(customer, workspaceId);

  if (!payload.name) {
    throw new Error("Customer name is required.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select(CUSTOMER_DB_COLUMNS.join(","))
    .single();

  if (error) {
    throw error;
  }

  return mapCustomerFromDatabase(data);
}

async function updateCustomerInSupabase(customer, workspaceId) {
  if (!workspaceId || !customer?.id) {
    throw new Error("Workspace and customer ID are required to update a customer.");
  }

  const payload = normalizeCustomerForDatabase(customer, workspaceId);

  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customer.id)
    .eq("workspace_id", workspaceId)
    .select(CUSTOMER_DB_COLUMNS.join(","))
    .single();

  if (error) {
    throw error;
  }

  return mapCustomerFromDatabase(data);
}

async function deleteCustomerFromSupabase(customerId, workspaceId) {
  if (!workspaceId || !customerId) {
    throw new Error("Workspace and customer ID are required to delete a customer.");
  }

  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  return true;
}

const PAYMENT_DB_COLUMNS = [
  "id",
  "workspace_id",
  "customer_id",
  "amount",
  "method",
  "note",
  "payment_date",
  "created_at"
];

function mapPaymentFromDatabase(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id,
    amount: Number(row.amount || 0),
    method: row.method || "Other",
    note: row.note || "",
    date: row.payment_date || row.created_at || new Date().toISOString().slice(0, 10),
    createdAt: row.created_at
  };
}

async function getPaymentsFromSupabase(workspaceId, customerIds = []) {
  if (!workspaceId) throw new Error("Workspace is required to load payments.");

  let query = supabase
    .from("payments")
    .select(PAYMENT_DB_COLUMNS.join(","))
    .eq("workspace_id", workspaceId)
    .order("payment_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (customerIds.length) {
    query = query.in("customer_id", customerIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPaymentFromDatabase);
}

async function createPaymentInSupabase(payment, workspaceId) {
  if (!workspaceId || !payment?.customerId) {
    throw new Error("Workspace and customer ID are required to create a payment.");
  }

  const amount = Number(payment.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const payload = {
    workspace_id: workspaceId,
    customer_id: payment.customerId,
    amount,
    method: payment.method || "Other",
    note: payment.note || null,
    payment_date: payment.date || new Date().toISOString().slice(0, 10)
  };

  const { data, error } = await supabase
    .from("payments")
    .insert(payload)
    .select(PAYMENT_DB_COLUMNS.join(","))
    .single();

  if (error) throw error;
  return mapPaymentFromDatabase(data);
}

async function deletePaymentFromSupabase(paymentId, workspaceId) {
  if (!workspaceId || !paymentId) {
    throw new Error("Workspace and payment ID are required to delete a payment.");
  }

  const { error } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  return true;
}

const FOLLOW_UP_DB_COLUMNS = [
  "id",
  "workspace_id",
  "customer_id",
  "title",
  "type",
  "due_at",
  "note",
  "completed",
  "created_at"
];

function splitDueAt(dueAt) {
  if (!dueAt) return { date: "", time: "" };
  const value = String(dueAt);
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) return { date: match[1], time: match[2] };
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, time: "" };
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return { date: parsed.toISOString().slice(0, 10), time: parsed.toISOString().slice(11, 16) };
  }
  return { date: "", time: "" };
}

function buildDueAt(date, time) {
  const safeDate = date || new Date().toISOString().slice(0, 10);
  const safeTime = time || "00:00";
  return `${safeDate}T${safeTime}:00`;
}

function mapFollowUpFromDatabase(row) {
  if (!row) return null;
  const due = splitDueAt(row.due_at);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    customerId: row.customer_id,
    title: row.title || "",
    type: row.type || "Follow-up",
    date: due.date,
    time: due.time,
    note: row.note || "",
    completed: Boolean(row.completed),
    createdAt: row.created_at
  };
}

async function getFollowUpsFromSupabase(workspaceId, customerIds = []) {
  if (!workspaceId) throw new Error("Workspace is required to load follow-ups.");

  let query = supabase
    .from("follow_ups")
    .select(FOLLOW_UP_DB_COLUMNS.join(","))
    .eq("workspace_id", workspaceId)
    .order("due_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (customerIds.length) query = query.in("customer_id", customerIds);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapFollowUpFromDatabase);
}

async function createFollowUpInSupabase(followUp, workspaceId) {
  if (!workspaceId || !followUp?.customerId) {
    throw new Error("Workspace and customer ID are required to create a follow-up.");
  }

  const payload = {
    workspace_id: workspaceId,
    customer_id: followUp.customerId,
    title: String(followUp.title || "").trim(),
    type: followUp.type || "Follow-up",
    due_at: buildDueAt(followUp.date, followUp.time),
    note: followUp.note || null,
    completed: Boolean(followUp.completed)
  };

  if (!payload.title) throw new Error("Follow-up title is required.");

  const { data, error } = await supabase
    .from("follow_ups")
    .insert(payload)
    .select(FOLLOW_UP_DB_COLUMNS.join(","))
    .single();

  if (error) throw error;
  return mapFollowUpFromDatabase(data);
}

async function updateFollowUpInSupabase(followUp, workspaceId) {
  if (!workspaceId || !followUp?.id || !followUp?.customerId) {
    throw new Error("Workspace, follow-up ID and customer ID are required to update a follow-up.");
  }

  const payload = {
    title: String(followUp.title || "").trim(),
    type: followUp.type || "Follow-up",
    due_at: buildDueAt(followUp.date, followUp.time),
    note: followUp.note || null,
    completed: Boolean(followUp.completed)
  };

  const { data, error } = await supabase
    .from("follow_ups")
    .update(payload)
    .eq("id", followUp.id)
    .eq("workspace_id", workspaceId)
    .eq("customer_id", followUp.customerId)
    .select(FOLLOW_UP_DB_COLUMNS.join(","))
    .single();

  if (error) throw error;
  return mapFollowUpFromDatabase(data);
}

async function deleteFollowUpFromSupabase(followUpId, workspaceId) {
  if (!workspaceId || !followUpId) {
    throw new Error("Workspace and follow-up ID are required to delete a follow-up.");
  }

  const { error } = await supabase
    .from("follow_ups")
    .delete()
    .eq("id", followUpId)
    .eq("workspace_id", workspaceId);

  if (error) throw error;
  return true;
}



// ============================================================
// STEP 19D — TEAM / STAFF MANAGEMENT DATA LAYER
// ============================================================

async function getWorkspaceTeamMembers(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to load team members.");

  const { data, error } = await supabase.rpc("get_workspace_team_members", {
    _workspace_id: workspaceId
  });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function addWorkspaceMemberByEmail(workspaceId, email, role) {
  if (!workspaceId) throw new Error("Workspace is required.");
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("Email address is required.");

  const { data, error } = await supabase.rpc("add_workspace_member_by_email", {
    _workspace_id: workspaceId,
    _email: cleanEmail,
    _role: role
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function updateWorkspaceMemberRole(memberId, role) {
  if (!memberId) throw new Error("Team member is required.");
  const { error } = await supabase.rpc("update_workspace_member_role", {
    _member_id: memberId,
    _role: role
  });
  if (error) throw error;
  return true;
}

async function removeWorkspaceMember(memberId) {
  if (!memberId) throw new Error("Team member is required.");
  const { error } = await supabase.rpc("remove_workspace_member", {
    _member_id: memberId
  });
  if (error) throw error;
  return true;
}

const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free Trial",
    customerLimit: 50,
    staffLimit: 1,
    serviceTemplateLimit: 10,
    quickLinkLimit: 25
  },
  pro: {
    name: "Pro",
    customerLimit: Infinity,
    staffLimit: 10,
    serviceTemplateLimit: Infinity,
    quickLinkLimit: Infinity
  }
};

function getPlanLimits(subscriptionOrPlan) {
  const plan = typeof subscriptionOrPlan === "string"
    ? subscriptionOrPlan
    : subscriptionOrPlan?.plan;

  return SUBSCRIPTION_PLANS[plan === "pro" ? "pro" : "free"];
}

function formatLimit(limit) {
  return Number.isFinite(limit) ? limit.toLocaleString("en-IN") : "Unlimited";
}

async function ensureWorkspaceSubscription(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to initialize subscription.");
  const { data, error } = await supabase.rpc("ensure_workspace_subscription", { _workspace_id: workspaceId });
  if (error) throw error;
  return data;
}

async function getWorkspaceSubscription(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to load subscription.");
  const { data, error } = await supabase.rpc("get_workspace_subscription", { _workspace_id: workspaceId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function getWorkspaceBilling(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to load billing.");

  const { data, error } = await supabase.rpc("get_workspace_billing", {
    _workspace_id: workspaceId
  });

  if (error) throw error;

  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  return data || {};
}

async function refreshWorkspaceSubscriptionStatus(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required to refresh subscription.");
  const { data, error } = await supabase.rpc("refresh_workspace_subscription_status", { _workspace_id: workspaceId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

function formatSubscriptionDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(value) {
  if (!value) return 0;

  const endDate = new Date(value);
  if (Number.isNaN(endDate.getTime())) return 0;

  // Count calendar days rather than 24-hour periods. This keeps the
  // displayed trial countdown consistent with the visible expiry date.
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );
  const nowDate = new Date();
  const now = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  );

  return Math.max(0, Math.round((end - now) / 86400000));
}

function getSubscriptionLifecycle(subscription) {
  const status = subscription?.status || "trial";
  const isPro = subscription?.plan === "pro";
  const expiryValue = isPro ? subscription?.current_period_end : subscription?.trial_ends_at;
  const expiryTime = expiryValue ? new Date(expiryValue).getTime() : null;
  const expiredByDate = expiryTime !== null && !Number.isNaN(expiryTime) && expiryTime <= Date.now();
  if (status === "cancelled") return { key:"cancelled", label:"Cancelled", description:"Your subscription is cancelled.", daysRemaining:0, expired:true, urgent:true };
  if (status === "expired" || expiredByDate) return { key:"expired", label:"Expired", description:isPro ? "Your Pro subscription has ended." : "Your free trial has ended.", daysRemaining:0, expired:true, urgent:true };
  if (status === "active" || isPro) return { key:"active", label:"Pro Active", description:"Your Pro workspace is active.", daysRemaining:expiryTime ? daysUntil(expiryValue) : null, expired:false, urgent:false };
  const daysRemaining = expiryValue ? daysUntil(expiryValue) : 0;
  if (daysRemaining <= 1) return { key:"ending", label:daysRemaining === 0 ? "Expires today" : "1 day remaining", description:"Your free trial is about to expire.", daysRemaining, expired:false, urgent:true };
  if (daysRemaining <= 3) return { key:"ending", label:`${daysRemaining} days remaining`, description:"Your free trial is ending soon.", daysRemaining, expired:false, urgent:true };
  return { key:"trial", label:`${daysRemaining} days remaining`, description:"Your free trial is active.", daysRemaining, expired:false, urgent:false };
}

async function getCurrentWorkspaceRole(workspaceId) {
  if (!workspaceId) return null;

  const { data, error } = await supabase.rpc("current_workspace_role", {
    _workspace_id: workspaceId
  });

  if (error) throw error;
  return data || null;
}

async function getMyCustomerWorkspace(workspaceId) {
  if (!workspaceId) throw new Error("Workspace is required.");

  const { data, error } = await supabase.rpc("get_my_customer_workspace", {
    _workspace_id: workspaceId
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function linkCustomerAccount(workspaceId, customerId, email) {
  if (!workspaceId || !customerId) throw new Error("Workspace and customer are required.");
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("Customer account email is required.");

  const { data, error } = await supabase.rpc("link_customer_account", {
    _workspace_id: workspaceId,
    _customer_id: customerId,
    _email: cleanEmail
  });

  if (error) throw error;
  return data;
}

async function unlinkCustomerAccount(workspaceId, customerId) {
  if (!workspaceId || !customerId) throw new Error("Workspace and customer are required.");

  const { data, error } = await supabase.rpc("unlink_customer_account", {
    _workspace_id: workspaceId,
    _customer_id: customerId
  });

  if (error) throw error;
  return data;
}

function CustomerAccessModal({ customer, workspace, onClose, onLinked }) {
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await linkCustomerAccount(workspace.id, customer.id, email);
      onLinked(result);
    } catch (err) {
      console.error("Failed to link customer account:", err);
      setError(getSafeUiError(err, "Could not link the customer account."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modalOverlay">
      <div className="modalCard" style={{ maxWidth: 520 }}>
        <div className="modalHeader">
          <div>
            <div className="modalEyebrow">// CUSTOMER PORTAL ACCESS</div>
            <h2>Link Customer Account</h2>
            <p>Connect a CyberCafe Helper account to {customer.name}.</p>
          </div>
          <button className="iconButton" onClick={onClose}><X size={19} /></button>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e5e7eb", marginBottom: 18 }}>
          <strong style={{ display: "block", marginBottom: 5 }}>{customer.name}</strong>
          <span style={{ color: "#64748b", fontSize: 13 }}>The linked account will be able to see this customer's portal information.</span>
        </div>

        <form onSubmit={submit}>
          <label>
            Customer's CyberCafe Helper Email *
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              autoFocus
              required
            />
          </label>

          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 16, padding: "11px 12px", borderRadius: 10, background: "#eff6ff", color: "#1e40af", fontSize: 13 }}>
            The customer must already have a CyberCafe Helper account. This action does not send an email invitation.
          </div>

          <div className="modalFooter">
            <button type="button" className="secondaryButton" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="primaryButton" disabled={saving || !email.trim()}>
              <Link2 size={16} />
              {saving ? "Linking…" : "Link Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerPortal({ user, workspace, onSignOut }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!workspace?.id) return;
      setLoading(true);
      setError("");
      try {
        const data = await getMyCustomerWorkspace(workspace.id);
        if (!cancelled) setCustomer(data);
      } catch (err) {
        console.error("Customer portal load failed:", err);
        if (!cancelled) setError(getSafeUiError(err, "Could not load your customer workspace."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [workspace?.id]);

  const due = Math.max(Number(customer?.due_amount || 0), 0);
  const total = Number(customer?.total_amount || 0);
  const paid = Number(customer?.paid_amount || 0);
  const documents = Array.isArray(customer?.documents) ? customer.documents : [];
  const customDocuments = Array.isArray(customer?.custom_documents) ? customer.custom_documents : [];
  const allDocuments = [...documents, ...customDocuments];
  const receivedDocuments = allDocuments.filter((doc) => typeof doc === "object" ? doc.received : true).length;
  const workflow = ["New", "Documents", "Form Filled", "Submitted", "Processing", "Ready", "Completed"];
  const currentStage = customer?.workflow_stage || customer?.status || "New";
  const stageIndex = Math.max(0, workflow.findIndex((stage) => stage.toLowerCase() === String(currentStage).toLowerCase()));

  return (
    <div className="customerPortalShell">
      <style>{`
        .customerPortalShell { min-height:100vh; background:#f8fafc; color:#0f172a; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .customerPortalTop { height:72px; padding:0 28px; box-sizing:border-box; display:flex; align-items:center; justify-content:space-between; background:#fff; border-bottom:1px solid #e5e7eb; }
        .customerPortalBrand { display:flex; align-items:center; gap:10px; }
        .customerPortalBrandIcon { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; background:#2563eb; color:#fff; }
        .customerPortalBrand strong { display:block; font-size:14px; }
        .customerPortalBrand span { display:block; color:#64748b; font-size:8px; margin-top:2px; }
        .customerPortalUser { display:flex; align-items:center; gap:12px; }
        .customerPortalUserEmail { color:#64748b; font-size:9px; }
        .customerPortalSignOut { border:1px solid #dbe3ef; background:#fff; border-radius:9px; padding:8px 10px; color:#475569; cursor:pointer; font:inherit; font-size:9px; font-weight:750; }
        .customerPortalContent { max-width:1050px; margin:0 auto; padding:38px 24px 60px; }
        .customerPortalWelcome { margin-bottom:24px; }
        .customerPortalWelcome span { color:#2563eb; font-size:9px; font-weight:850; letter-spacing:1.4px; text-transform:uppercase; }
        .customerPortalWelcome h1 { margin:7px 0 5px; font-size:29px; letter-spacing:-1px; }
        .customerPortalWelcome p { margin:0; color:#64748b; font-size:11px; }
        .customerPortalGrid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px; }
        .customerPortalCard { background:#fff; border:1px solid #e2e8f0; border-radius:15px; padding:18px; box-shadow:0 8px 24px rgba(15,23,42,.04); }
        .customerPortalMetric span { display:block; color:#94a3b8; font-size:8px; font-weight:750; text-transform:uppercase; letter-spacing:.7px; margin-bottom:7px; }
        .customerPortalMetric strong { font-size:22px; }
        .customerPortalMetric em { display:block; margin-top:4px; color:#64748b; font-size:8px; font-style:normal; }
        .customerPortalMainGrid { display:grid; grid-template-columns:1.15fr .85fr; gap:14px; }
        .customerPortalCardHeader { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        .customerPortalCardHeader strong { font-size:12px; }
        .customerPortalBadge { padding:6px 9px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:8px; font-weight:850; }
        .customerPortalInfoRows { display:flex; flex-direction:column; gap:12px; }
        .customerPortalInfoRow { display:flex; align-items:flex-start; gap:10px; }
        .customerPortalInfoIcon { width:29px; height:29px; flex:none; border-radius:9px; background:#f8fafc; color:#2563eb; display:flex; align-items:center; justify-content:center; border:1px solid #e5e7eb; }
        .customerPortalInfoRow span { display:block; color:#94a3b8; font-size:8px; margin-bottom:3px; }
        .customerPortalInfoRow strong { display:block; font-size:10px; }
        .customerPortalWorkflow { display:flex; flex-direction:column; gap:9px; }
        .customerPortalStage { display:flex; align-items:center; gap:9px; font-size:9px; color:#64748b; }
        .customerPortalStageDot { width:23px; height:23px; flex:none; border-radius:50%; display:flex; align-items:center; justify-content:center; background:#e2e8f0; color:#64748b; font-size:8px; font-weight:850; }
        .customerPortalStage.done { color:#166534; font-weight:700; }
        .customerPortalStage.done .customerPortalStageDot { background:#dcfce7; color:#15803d; }
        .customerPortalStage.current { color:#1d4ed8; font-weight:800; }
        .customerPortalStage.current .customerPortalStageDot { background:#dbeafe; color:#2563eb; }
        .customerPortalDocuments { display:flex; flex-direction:column; gap:8px; }
        .customerPortalDoc { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border-radius:9px; background:#f8fafc; }
        .customerPortalDoc span { font-size:9px; }
        .customerPortalDocStatus { font-size:8px; font-weight:800; }
        .customerPortalDocStatus.received { color:#15803d; }
        .customerPortalDocStatus.pending { color:#b45309; }
        .customerPortalError { padding:14px; border:1px solid #fecaca; border-radius:11px; background:#fff1f2; color:#b91c1c; font-size:10px; }
        .customerPortalEmpty { padding:34px 18px; text-align:center; color:#64748b; font-size:10px; }
        @media (max-width:760px) { .customerPortalTop { padding:0 16px; } .customerPortalUserEmail { display:none; } .customerPortalContent { padding:25px 16px 40px; } .customerPortalGrid,.customerPortalMainGrid { grid-template-columns:1fr; } }
      `}</style>

      <header className="customerPortalTop">
        <div className="customerPortalBrand">
          <div className="customerPortalBrandIcon"><Monitor size={20} /></div>
          <div><strong>CyberCafe Helper</strong><span>Customer Workspace</span></div>
        </div>
        <div className="customerPortalUser">
          <span className="customerPortalUserEmail">{user?.email || "Signed in"}</span>
          <button className="customerPortalSignOut" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>

      <main className="customerPortalContent">
        <div className="customerPortalWelcome">
          <span>Your application</span>
          <h1>{loading ? "Loading your workspace…" : customer ? `Hello, ${customer.name || "Customer"}` : "Customer Workspace"}</h1>
          <p>Track your service request, documents, payment and application progress.</p>
        </div>

        {loading && <div className="customerPortalCard customerPortalEmpty">Loading your application details…</div>}
        {!loading && error && <div className="customerPortalError">{error}</div>}
        {!loading && !error && !customer && (
          <div className="customerPortalCard customerPortalEmpty">No customer record has been linked to this account yet. Please contact the cyber café.</div>
        )}

        {!loading && !error && customer && (
          <>
            <div className="customerPortalGrid">
              <div className="customerPortalCard customerPortalMetric"><span>Service</span><strong style={{fontSize:16}}>{customer.service || "—"}</strong><em>{customer.reference ? `Reference: ${customer.reference}` : "No reference added"}</em></div>
              <div className="customerPortalCard customerPortalMetric"><span>Payment</span><strong>₹{paid.toLocaleString("en-IN")}</strong><em>₹{due.toLocaleString("en-IN")} remaining of ₹{total.toLocaleString("en-IN")}</em></div>
              <div className="customerPortalCard customerPortalMetric"><span>Current Status</span><strong style={{fontSize:16}}>{currentStage}</strong><em>{customer.tracking_label ? `${customer.tracking_label}: ${customer.application_number || "Not added"}` : "Application details"}</em></div>
            </div>

            <div className="customerPortalMainGrid">
              <div className="customerPortalCard">
                <div className="customerPortalCardHeader"><strong>Application Details</strong><span className="customerPortalBadge">{customer.status || currentStage}</span></div>
                <div className="customerPortalInfoRows">
                  <div className="customerPortalInfoRow"><div className="customerPortalInfoIcon"><FileText size={14} /></div><div><span>Service</span><strong>{customer.service || "Not specified"}</strong></div></div>
                  <div className="customerPortalInfoRow"><div className="customerPortalInfoIcon"><Hash size={14} /></div><div><span>Reference</span><strong>{customer.reference || "Not provided"}</strong></div></div>
                  <div className="customerPortalInfoRow"><div className="customerPortalInfoIcon"><Hash size={14} /></div><div><span>Application Number</span><strong>{customer.application_number || "Not provided"}</strong></div></div>
                  <div className="customerPortalInfoRow"><div className="customerPortalInfoIcon"><CalendarDays size={14} /></div><div><span>Expected Completion</span><strong>{customer.due_date || "Not specified"}</strong></div></div>
                </div>
              </div>

              <div className="customerPortalCard">
                <div className="customerPortalCardHeader"><strong>Work Progress</strong></div>
                <div className="customerPortalWorkflow">
                  {workflow.map((stage, index) => {
                    const isCurrent = index === stageIndex;
                    const isDone = index < stageIndex || String(currentStage).toLowerCase() === "completed";
                    return <div key={stage} className={`customerPortalStage ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}`}><div className="customerPortalStageDot">{isDone ? "✓" : index + 1}</div><span>{stage}</span></div>;
                  })}
                </div>
              </div>

              <div className="customerPortalCard">
                <div className="customerPortalCardHeader"><strong>Documents</strong><span className="customerPortalBadge">{receivedDocuments} / {allDocuments.length || 0}</span></div>
                {allDocuments.length ? <div className="customerPortalDocuments">{allDocuments.map((doc, index) => { const name = typeof doc === "object" ? doc.name : doc; const received = typeof doc === "object" ? !!doc.received : true; return <div className="customerPortalDoc" key={`${name}-${index}`}><span>{name}</span><span className={`customerPortalDocStatus ${received ? "received" : "pending"}`}>{received ? "Received" : "Pending"}</span></div>; })}</div> : <div className="customerPortalEmpty">No document checklist has been added.</div>}
              </div>

              <div className="customerPortalCard">
                <div className="customerPortalCardHeader"><strong>Payment Summary</strong></div>
                <div className="customerPortalInfoRows">
                  <div className="customerPortalInfoRow"><div className="customerPortalInfoIcon"><Wallet size={14} /></div><div><span>Total</span><strong>₹{total.toLocaleString("en-IN")}</strong></div></div>
                  <div className="customerPortalInfoRow"><div className="customerPortalInfoIcon"><CheckCircle2 size={14} /></div><div><span>Paid</span><strong>₹{paid.toLocaleString("en-IN")}</strong></div></div>
                  <div className="customerPortalInfoRow"><div className="customerPortalInfoIcon"><CircleAlert size={14} /></div><div><span>Remaining</span><strong>₹{due.toLocaleString("en-IN")}</strong></div></div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function LandingPage({ onSignIn, onSignUp }) {
  const features = [
    [Users, "Customer CRM", "Keep every customer, service, reference and note organized in one place."],
    [ClipboardList, "Application Workflow", "Move work from new request to completed without losing track of the next step."],
    [FileText, "Document Control", "Know which documents are received, missing or ready before submitting an application."],
    [Wallet, "Payments & Earnings", "Record paid and outstanding amounts and understand what your café is actually collecting."],
    [CalendarDays, "Follow-ups", "Schedule calls, reminders, document requests and pickup follow-ups so nothing gets forgotten."],
    [BarChart3, "Business Reports", "See collections, outstanding work and service activity without maintaining separate spreadsheets."],
    [QrCode, "QR Print Requests", "Let customers scan your café QR, upload documents and send a print request directly to your queue."],
    [Sparkles, "AI Assistance", "Get concise customer summaries and useful next actions from information already in your workspace."]
  ];

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landingShell">
      <style>{`
        .landingShell { min-height:100vh; background:#f8fafc; color:#0f172a; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow-x:hidden; }
        .landingShell * { box-sizing:border-box; }
        .landingNav { position:sticky; top:0; z-index:50; height:72px; display:flex; align-items:center; justify-content:space-between; max-width:1240px; margin:0 auto; padding:0 24px; background:rgba(248,250,252,.88); backdrop-filter:blur(16px); border-bottom:1px solid rgba(226,232,240,.72); }
        .landingBrand { display:flex; align-items:center; gap:10px; cursor:pointer; }
        .landingBrandIcon { width:39px; height:39px; border-radius:11px; display:flex; align-items:center; justify-content:center; background:#2563eb; color:#fff; box-shadow:0 8px 20px rgba(37,99,235,.2); }
        .landingBrandName { font-size:15px; font-weight:850; letter-spacing:-.3px; color:#0f172a; }
        .landingBrandSub { color:#2563eb; font-size:8px; font-weight:850; letter-spacing:2.5px; margin-top:1px; }
        .landingNavLinks { display:flex; align-items:center; gap:3px; margin-left:auto; margin-right:18px; }
        .landingNavLink { border:0; background:transparent; color:#64748b; padding:8px 11px; border-radius:9px; cursor:pointer; font:inherit; font-size:10px; font-weight:750; }
        .landingNavLink:hover { background:#eef2ff; color:#1d4ed8; }
        .landingNavActions { display:flex; align-items:center; gap:8px; }
        .landingNavButton { border:0; background:transparent; color:#475569; padding:9px 13px; border-radius:9px; cursor:pointer; font:inherit; font-size:11px; font-weight:750; }
        .landingNavButton:hover { background:#eef2ff; color:#1d4ed8; }
        .landingNavPrimary { background:#2563eb; color:#fff; box-shadow:0 7px 16px rgba(37,99,235,.18); }
        .landingNavPrimary:hover { background:#1d4ed8; color:#fff; }

        .landingHero { position:relative; max-width:1240px; margin:0 auto; padding:82px 24px 92px; display:grid; grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr); gap:64px; align-items:center; }
        .landingGlowOne,.landingGlowTwo { position:absolute; border-radius:50%; filter:blur(80px); pointer-events:none; }
        .landingGlowOne { width:500px; height:500px; background:#dbeafe; opacity:.72; top:-170px; left:-220px; }
        .landingGlowTwo { width:360px; height:360px; background:#e0e7ff; opacity:.5; right:-150px; bottom:-100px; }
        .landingHeroCopy { position:relative; z-index:1; }
        .landingEyebrow { display:inline-flex; align-items:center; gap:7px; padding:7px 10px; border:1px solid #bfdbfe; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:9px; font-weight:850; letter-spacing:1.15px; text-transform:uppercase; }
        .landingEyebrow svg { width:13px; height:13px; }
        .landingHero h1 { max-width:720px; margin:18px 0 18px; font-size:60px; line-height:1.01; letter-spacing:-3.6px; color:#0f172a; }
        .landingHero h1 span { color:#2563eb; }
        .landingHeroText { max-width:625px; margin:0; color:#64748b; font-size:15px; line-height:1.78; }
        .landingHeroActions { display:flex; align-items:center; gap:11px; margin-top:29px; flex-wrap:wrap; }
        .landingCta { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid #2563eb; border-radius:11px; padding:13px 17px; background:#2563eb; color:#fff; cursor:pointer; font:inherit; font-size:11px; font-weight:850; box-shadow:0 10px 24px rgba(37,99,235,.2); transition:transform .18s ease,background .18s ease,box-shadow .18s ease; }
        .landingCta:hover { background:#1d4ed8; transform:translateY(-2px); box-shadow:0 14px 28px rgba(37,99,235,.24); }
        .landingSecondary { background:#fff; border-color:#cbd5e1; color:#334155; box-shadow:none; }
        .landingSecondary:hover { background:#fff; color:#1d4ed8; box-shadow:0 8px 20px rgba(15,23,42,.07); }
        .landingTrust { display:flex; align-items:center; gap:8px; margin-top:20px; color:#64748b; font-size:10px; }
        .landingTrust svg { color:#16a34a; }
        .landingHeroMini { display:flex; gap:19px; margin-top:28px; flex-wrap:wrap; }
        .landingHeroMiniItem { display:flex; align-items:center; gap:7px; color:#475569; font-size:9px; font-weight:700; }
        .landingHeroMiniItem svg { color:#2563eb; }

        .landingPreview { position:relative; z-index:1; }
        .landingPreviewBadge { position:absolute; top:-22px; right:-10px; z-index:3; display:flex; align-items:center; gap:7px; padding:8px 10px; border:1px solid #bfdbfe; border-radius:10px; background:#fff; color:#1d4ed8; box-shadow:0 12px 28px rgba(15,23,42,.1); font-size:8px; font-weight:850; }
        .landingPreviewBadge svg { width:13px; height:13px; }
        .landingDashboardCard { border:1px solid #dbe3ef; border-radius:22px; background:#fff; box-shadow:0 30px 80px rgba(15,23,42,.14); overflow:hidden; transform:rotate(1deg); transition:transform .25s ease,box-shadow .25s ease; }
        .landingDashboardCard:hover { transform:rotate(0deg) translateY(-4px); box-shadow:0 36px 90px rgba(15,23,42,.17); }
        .landingPreviewTop { height:44px; display:flex; align-items:center; gap:6px; padding:0 15px; border-bottom:1px solid #edf2f7; background:#f8fafc; }
        .landingDot { width:7px; height:7px; border-radius:50%; background:#cbd5e1; }
        .landingPreviewTopTitle { margin-left:8px; color:#94a3b8; font-size:8px; font-weight:750; }
        .landingPreviewBody { padding:17px; }
        .landingPreviewTitle { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
        .landingPreviewTitle strong { font-size:13px; }
        .landingPreviewTitle span { font-size:8px; color:#64748b; }
        .landingStats { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-bottom:12px; }
        .landingStat { padding:12px; border:1px solid #e5e7eb; border-radius:11px; background:#fff; }
        .landingStat span { display:block; color:#94a3b8; font-size:8px; margin-bottom:6px; }
        .landingStat strong { font-size:17px; letter-spacing:-.4px; }
        .landingStat em { display:block; margin-top:4px; color:#16a34a; font-size:7px; font-style:normal; font-weight:750; }
        .landingPreviewTable { border:1px solid #e5e7eb; border-radius:11px; overflow:hidden; }
        .landingPreviewRow { min-height:43px; display:grid; grid-template-columns:1.4fr .8fr .65fr; align-items:center; gap:8px; padding:0 11px; border-bottom:1px solid #f1f5f9; }
        .landingPreviewRow:last-child { border-bottom:0; }
        .landingPreviewRow > div { min-width:0; }
        .landingPreviewCustomer { display:flex; align-items:center; gap:8px; }
        .landingPreviewAvatar { width:25px; height:25px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#eff6ff; color:#2563eb; font-size:8px; font-weight:850; }
        .landingPreviewCustomer strong { display:block; font-size:8px; }
        .landingPreviewCustomer span { display:block; margin-top:2px; color:#94a3b8; font-size:7px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .landingPreviewStatus { display:inline-flex; width:max-content; padding:4px 7px; border-radius:999px; background:#ecfdf5; color:#15803d; font-size:7px; font-weight:800; }
        .landingPreviewAmount { text-align:right; font-size:8px; font-weight:800; }
        .landingPreviewFooter { display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding:10px 11px; border:1px dashed #bfdbfe; border-radius:10px; background:#eff6ff; }
        .landingPreviewFooter span { color:#475569; font-size:8px; }
        .landingPreviewFooter strong { color:#1d4ed8; font-size:9px; }

        .landingSection { max-width:1240px; margin:0 auto; padding:88px 24px; scroll-margin-top:72px; }
        .landingSectionSoft { background:#fff; border-top:1px solid #e8edf4; border-bottom:1px solid #e8edf4; }
        .landingKicker { display:inline-flex; color:#2563eb; font-size:9px; font-weight:850; letter-spacing:1.4px; text-transform:uppercase; }
        .landingSectionHead { max-width:700px; margin-bottom:34px; }
        .landingSectionHead h2 { margin:9px 0 10px; font-size:34px; line-height:1.12; letter-spacing:-1.7px; color:#0f172a; }
        .landingSectionHead p { margin:0; color:#64748b; font-size:13px; line-height:1.75; }

        .landingProof { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:-6px; }
        .landingProofCard { padding:17px 18px; border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 10px 25px rgba(15,23,42,.035); }
        .landingProofCard strong { display:block; margin-bottom:5px; font-size:11px; }
        .landingProofCard p { margin:0; color:#64748b; font-size:9px; line-height:1.65; }

        .landingFeatureGrid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .landingFeatureCard { min-height:182px; padding:20px; border:1px solid #e2e8f0; border-radius:15px; background:#fff; transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease; }
        .landingFeatureCard:hover { transform:translateY(-4px); border-color:#bfdbfe; box-shadow:0 16px 35px rgba(15,23,42,.07); }
        .landingFeatureIcon { width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:10px; background:#eff6ff; color:#2563eb; margin-bottom:15px; }
        .landingFeatureIcon svg { width:16px; height:16px; }
        .landingFeatureCard strong { display:block; margin-bottom:7px; font-size:11px; }
        .landingFeatureCard p { margin:0; color:#64748b; font-size:9px; line-height:1.7; }

        .landingProduct { display:grid; grid-template-columns:.88fr 1.12fr; gap:55px; align-items:center; }
        .landingProductMock { padding:17px; border:1px solid #dbe3ef; border-radius:18px; background:#0f172a; box-shadow:0 25px 65px rgba(15,23,42,.16); }
        .landingMockTop { display:flex; justify-content:space-between; align-items:center; margin-bottom:13px; color:#94a3b8; font-size:8px; }
        .landingMockTitle { color:#f8fafc; font-size:11px; font-weight:800; }
        .landingMockGrid { display:grid; grid-template-columns:1.15fr .85fr; gap:10px; }
        .landingMockPanel { padding:13px; border:1px solid #263449; border-radius:11px; background:#111c2e; }
        .landingMockPanel strong { display:block; color:#f8fafc; font-size:9px; }
        .landingMockPanel span { display:block; color:#64748b; font-size:7px; margin-top:4px; }
        .landingMockQueue { margin-top:10px; display:grid; gap:7px; }
        .landingMockQueueRow { display:flex; align-items:center; justify-content:space-between; padding:8px 9px; border:1px solid #263449; border-radius:8px; background:#0d1727; }
        .landingMockQueueRow > div { display:flex; align-items:center; gap:7px; }
        .landingMockQueueDot { width:7px; height:7px; border-radius:50%; background:#22c55e; }
        .landingMockQueueRow span { color:#cbd5e1; font-size:7px; }
        .landingMockQueueRow em { color:#93c5fd; font-size:7px; font-style:normal; font-weight:750; }
        .landingProductCopy h2 { margin:9px 0 12px; font-size:34px; line-height:1.12; letter-spacing:-1.7px; }
        .landingProductCopy p { margin:0 0 18px; color:#64748b; font-size:13px; line-height:1.75; }
        .landingCheckList { display:grid; gap:11px; }
        .landingCheckItem { display:flex; align-items:flex-start; gap:9px; color:#334155; font-size:10px; line-height:1.5; font-weight:700; }
        .landingCheckItem svg { flex:0 0 auto; margin-top:1px; color:#16a34a; }

        .landingHow { max-width:1240px; margin:0 auto; padding:88px 24px; scroll-margin-top:72px; }
        .landingHowGrid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .landingHowCard { position:relative; min-height:190px; padding:20px; border:1px solid #e2e8f0; border-radius:15px; background:#fff; }
        .landingHowNumber { display:inline-flex; width:30px; height:30px; align-items:center; justify-content:center; border-radius:9px; background:#eff6ff; color:#2563eb; font-size:9px; font-weight:900; margin-bottom:18px; }
        .landingHowCard strong { display:block; font-size:11px; margin-bottom:7px; }
        .landingHowCard p { margin:0; color:#64748b; font-size:9px; line-height:1.7; }
        .landingHowCard:not(:last-child)::after { content:""; position:absolute; width:28px; height:1px; background:#cbd5e1; right:-21px; top:35px; z-index:2; }

        .landingBottom { max-width:1240px; margin:0 auto; padding:0 24px 88px; }
        .landingBottomCard { position:relative; overflow:hidden; padding:52px 48px; border-radius:22px; background:#0f172a; color:#fff; box-shadow:0 25px 60px rgba(15,23,42,.15); }
        .landingBottomCard::after { content:""; position:absolute; width:360px; height:360px; border-radius:50%; background:#2563eb; opacity:.22; filter:blur(65px); right:-100px; top:-160px; pointer-events:none; }
        .landingBottomCard h2 { position:relative; z-index:1; max-width:700px; margin:9px 0 10px; font-size:34px; line-height:1.12; letter-spacing:-1.7px; }
        .landingBottomCard p { position:relative; z-index:1; max-width:650px; margin:0; color:#94a3b8; font-size:12px; line-height:1.75; }
        .landingBottomCard .landingKicker { position:relative; z-index:1; color:#93c5fd; }
        .landingBottomCard .landingHeroActions { position:relative; z-index:1; }
        .landingBottomCard .landingSecondary { background:transparent; border-color:#334155; color:#e2e8f0; }
        .landingBottomCard .landingSecondary:hover { background:#1e293b; color:#fff; }
        .landingFooter { max-width:1240px; margin:0 auto; padding:0 24px 30px; color:#94a3b8; text-align:center; font-size:9px; }
        .landingMobileCta { display:none; }
        .landingMobileCta button { display:flex; align-items:center; justify-content:center; gap:6px; width:100%; min-height:44px; border:1px solid #2563eb; border-radius:11px; background:#2563eb; color:#fff; font:inherit; font-size:11px; font-weight:800; cursor:pointer; box-shadow:0 8px 24px rgba(37,99,235,.22); }
        .landingFooterInner { display:flex; align-items:center; justify-content:center; gap:14px; flex-wrap:wrap; }
        .landingFooterLinks { display:flex; align-items:center; gap:7px; }
        .landingFooterLinks button { border:0; padding:0; background:transparent; color:#60a5fa; cursor:pointer; font:inherit; }
        .landingFooterLinks button:hover { color:#93c5fd; text-decoration:underline; }

        @media (max-width:950px) {
          .landingNavLinks { display:none; }
          .landingHero { grid-template-columns:1fr; gap:45px; padding-top:58px; }
          .landingHero h1 { font-size:52px; }
          .landingPreview { max-width:720px; width:100%; margin:0 auto; }
          .landingFeatureGrid { grid-template-columns:repeat(2,1fr); }
          .landingProduct { grid-template-columns:1fr; gap:35px; }
          .landingHowGrid { grid-template-columns:repeat(2,1fr); }
          .landingHowCard:not(:last-child)::after { display:none; }
        }
        @media (max-width:650px) {
          .landingNav { height:64px; padding:0 15px; }
          .landingBrandSub { display:none; }
          .landingNavButton { padding:8px 9px; font-size:10px; }
          .landingHero { padding:46px 16px 65px; gap:38px; }
          .landingHero h1 { font-size:40px; letter-spacing:-2.3px; }
          .landingHeroText { font-size:13px; }
          .landingHeroActions { display:grid; grid-template-columns:1fr; }
          .landingCta { width:100%; }
          .landingHeroMini { gap:11px; }
          .landingHeroMiniItem { font-size:8px; }
          .landingPreviewBadge { right:4px; top:-17px; }
          .landingDashboardCard { transform:none; border-radius:16px; }
          .landingPreviewBody { padding:11px; }
          .landingStats { gap:6px; }
          .landingStat { padding:9px; }
          .landingStat strong { font-size:14px; }
          .landingPreviewRow { grid-template-columns:1.5fr .75fr .55fr; padding:0 8px; }
          .landingSection,.landingHow { padding:65px 16px; }
          .landingSectionHead h2,.landingProductCopy h2,.landingBottomCard h2 { font-size:28px; }
          .landingProof { grid-template-columns:1fr; }
          .landingFeatureGrid,.landingHowGrid { grid-template-columns:1fr; }
          .landingFeatureCard,.landingHowCard { min-height:auto; }
          .landingProductMock { padding:11px; }
          .landingBottom { padding:0 16px 65px; }
          .landingBottomCard { padding:35px 23px; border-radius:17px; }
          .landingFooter { padding:0 16px 90px; line-height:1.6; }
          .landingMobileCta { display:block; position:fixed; left:12px; right:12px; bottom:12px; z-index:60; padding:0; }
        }
        @media (prefers-reduced-motion:reduce) {
          .landingDashboardCard,.landingFeatureCard,.landingCta { transition:none; }
        }
      `}</style>

      <nav className="landingNav">
        <div className="landingBrand" onClick={() => scrollTo("landing-top")}>
          <div className="landingBrandIcon"><Monitor size={20} /></div>
          <div>
            <div className="landingBrandName">CyberCafe Helper</div>
            <div className="landingBrandSub">WORKSPACE</div>
          </div>
        </div>

        <div className="landingNavLinks">
          <button className="landingNavLink" onClick={() => scrollTo("landing-features")}>Features</button>
          <button className="landingNavLink" onClick={() => scrollTo("landing-product")}>How it helps</button>
          <button className="landingNavLink" onClick={() => scrollTo("landing-how")}>How it works</button>
        </div>

        <div className="landingNavActions">
          <button className="landingNavButton" onClick={onSignIn}>Sign In</button>
          <button className="landingNavButton landingNavPrimary" onClick={onSignUp}>Get Started</button>
        </div>
      </nav>

      <main id="landing-top">
        <section className="landingHero">
          <div className="landingGlowOne" />
          <div className="landingGlowTwo" />
          <div className="landingHeroCopy">
            <div className="landingEyebrow"><Zap /> Built for everyday cyber café work</div>
            <h1>Run your cyber café with <span>less chaos.</span></h1>
            <p className="landingHeroText">Customers, applications, documents, payments, follow-ups and print requests — organized in one workspace built around how cyber cafés actually operate.</p>
            <div className="landingHeroActions">
              <button className="landingCta" onClick={onSignUp}>Create Your Free Workspace <ChevronRight size={15} /></button>
              <button className="landingCta landingSecondary" onClick={() => scrollTo("landing-product")}>See How It Works</button>
            </div>
            <div className="landingTrust"><ShieldCheck size={13} /> Your workspace keeps operational data organized and access-controlled.</div>
            <div className="landingHeroMini">
              <div className="landingHeroMiniItem"><Users size={13} /> Customer records</div>
              <div className="landingHeroMiniItem"><ClipboardList size={13} /> Application tracking</div>
              <div className="landingHeroMiniItem"><QrCode size={13} /> QR print requests</div>
            </div>
          </div>

          <div className="landingPreview">
            <div className="landingPreviewBadge"><QrCode size={13} /> Customer → Café → Print Queue</div>
            <div className="landingDashboardCard">
              <div className="landingPreviewTop">
                <span className="landingDot" /><span className="landingDot" /><span className="landingDot" />
                <span className="landingPreviewTopTitle">CyberCafe Helper · Workspace</span>
              </div>
              <div className="landingPreviewBody">
                <div className="landingPreviewTitle"><strong>Today's workspace</strong><span>Live overview</span></div>
                <div className="landingStats">
                  <div className="landingStat"><span>Customers</span><strong>128</strong><em>+12 this week</em></div>
                  <div className="landingStat"><span>Open work</span><strong>24</strong><em>5 need attention</em></div>
                  <div className="landingStat"><span>Collected</span><strong>₹8.4k</strong><em>+18.6%</em></div>
                </div>
                <div className="landingPreviewTable">
                  <div className="landingPreviewRow">
                    <div className="landingPreviewCustomer"><div className="landingPreviewAvatar">RS</div><div><strong>Rahul Sharma</strong><span>PAN application</span></div></div>
                    <div><span className="landingPreviewStatus">Processing</span></div><div className="landingPreviewAmount">₹350</div>
                  </div>
                  <div className="landingPreviewRow">
                    <div className="landingPreviewCustomer"><div className="landingPreviewAvatar">PK</div><div><strong>Priya Kumari</strong><span>Document print · 6 pages</span></div></div>
                    <div><span className="landingPreviewStatus">Printing</span></div><div className="landingPreviewAmount">₹12</div>
                  </div>
                  <div className="landingPreviewRow">
                    <div className="landingPreviewCustomer"><div className="landingPreviewAvatar">AM</div><div><strong>Amit Meena</strong><span>Certificate application</span></div></div>
                    <div><span className="landingPreviewStatus">Ready</span></div><div className="landingPreviewAmount">₹220</div>
                  </div>
                </div>
                <div className="landingPreviewFooter"><span>New customer print request</span><strong>QR request received</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="landingSection" style={{paddingTop:0}}>
          <div className="landingProof">
            <div className="landingProofCard"><strong>One workspace</strong><p>Keep customer and operational information together instead of spreading it across notebooks and chats.</p></div>
            <div className="landingProofCard"><strong>Less manual tracking</strong><p>Use statuses, reminders and payment records to reduce the work of remembering what happens next.</p></div>
            <div className="landingProofCard"><strong>Built around the counter</strong><p>Fast customer entry, practical workflows and a dedicated QR print experience for daily café operations.</p></div>
          </div>
        </section>

        <section className="landingSection landingSectionSoft" id="landing-features">
          <div className="landingSectionHead">
            <span className="landingKicker">Everything in one place</span>
            <h2>Tools for the work you already do.</h2>
            <p>CyberCafe Helper brings the operational pieces of a modern cyber café into one simple workspace, so your team can spend less time maintaining records and more time serving customers.</p>
          </div>
          <div className="landingFeatureGrid">
            {features.map(([Icon, title, text]) => (
              <div className="landingFeatureCard" key={title}>
                <div className="landingFeatureIcon"><Icon /></div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landingSection" id="landing-product">
          <div className="landingProduct">
            <div className="landingProductMock">
              <div className="landingMockTop"><span>LIVE WORKSPACE PREVIEW</span><span>Today</span></div>
              <div className="landingMockGrid">
                <div className="landingMockPanel"><strong>Print Queue</strong><span>Requests arriving from your café QR</span>
                  <div className="landingMockQueue">
                    <div className="landingMockQueueRow"><div><span className="landingMockQueueDot" /><span>Priya · 6 pages</span></div><em>₹12</em></div>
                    <div className="landingMockQueueRow"><div><span className="landingMockQueueDot" /><span>Arjun · 3 pages</span></div><em>₹6</em></div>
                    <div className="landingMockQueueRow"><div><span className="landingMockQueueDot" /><span>Neha · 8 pages</span></div><em>₹16</em></div>
                  </div>
                </div>
                <div className="landingMockPanel"><strong>Follow-ups</strong><span>Things that need attention</span>
                  <div className="landingMockQueue">
                    <div className="landingMockQueueRow"><div><span>Document request</span></div><em>2:00 PM</em></div>
                    <div className="landingMockQueueRow"><div><span>Payment reminder</span></div><em>4:30 PM</em></div>
                    <div className="landingMockQueueRow"><div><span>Pickup reminder</span></div><em>6:00 PM</em></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="landingProductCopy">
              <span className="landingKicker">Designed for the counter</span>
              <h2>One place to see what needs to happen next.</h2>
              <p>Instead of jumping between paper notes, spreadsheets and messaging apps, use one workspace to keep the customer, their work, payment status and next action connected.</p>
              <div className="landingCheckList">
                <div className="landingCheckItem"><CheckCircle2 size={14} /> Track every application through clear workflow stages.</div>
                <div className="landingCheckItem"><CheckCircle2 size={14} /> Record collections and outstanding amounts against completed work.</div>
                <div className="landingCheckItem"><CheckCircle2 size={14} /> Receive customer print requests through a café-specific QR code.</div>
                <div className="landingCheckItem"><CheckCircle2 size={14} /> Keep follow-ups visible so important tasks do not disappear.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="landingHow landingSectionSoft" id="landing-how">
          <div className="landingSectionHead">
            <span className="landingKicker">Simple daily workflow</span>
            <h2>From customer visit to completed work.</h2>
            <p>CyberCafe Helper fits into the normal flow of a cyber café instead of forcing you to redesign how you work.</p>
          </div>
          <div className="landingHowGrid">
            <div className="landingHowCard"><div className="landingHowNumber">01</div><strong>Add the customer</strong><p>Capture the customer's details, service, reference and expected amount.</p></div>
            <div className="landingHowCard"><div className="landingHowNumber">02</div><strong>Track the work</strong><p>Use documents and workflow stages to see exactly where the application stands.</p></div>
            <div className="landingHowCard"><div className="landingHowNumber">03</div><strong>Collect & follow up</strong><p>Record payments and schedule reminders for anything that needs attention.</p></div>
            <div className="landingHowCard"><div className="landingHowNumber">04</div><strong>Complete & report</strong><p>Finish the work, issue a receipt and understand your business activity through reports.</p></div>
          </div>
        </section>

        <section className="landingBottom">
          <div className="landingBottomCard">
            <span className="landingKicker">Start your workspace</span>
            <h2>Spend less time remembering. More time serving customers.</h2>
            <p>Create your CyberCafe Helper workspace and bring customers, applications, documents, payments, follow-ups and print requests together.</p>
            <div className="landingHeroActions">
              <button className="landingCta" onClick={onSignUp}>Create Your Free Workspace <ChevronRight size={15} /></button>
              <button className="landingCta landingSecondary" onClick={onSignIn}>I Already Have an Account</button>
            </div>
          </div>
        </section>
      </main>

      <div className="landingMobileCta">
        <button type="button" onClick={onSignUp}>Create Your Free Workspace <ChevronRight size={14} /></button>
      </div>

      <footer className="landingFooter">
        <div className="landingFooterInner">
          <div>© {new Date().getFullYear()} CyberCafe Helper • Professional workspace for cyber café operators</div>
          <div className="landingFooterLinks">
            <button onClick={() => window.dispatchEvent(new CustomEvent("cc-open-legal", { detail: "privacy" }))}>Privacy Policy</button>
            <span>•</span>
            <button onClick={() => window.dispatchEvent(new CustomEvent("cc-open-legal", { detail: "terms" }))}>Terms &amp; Conditions</button>
          </div>
        </div>
      </footer>
    </div>
  );
}


const LEGAL_VERSION = "1.0";

function LegalPage({ type, onBack, onSignUp }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms & Conditions";
  const updated = "September 8, 2026";

  return (
    <div className="legalPage">
      <style>{`
        .legalPage{min-height:100vh;background:#0b1220;color:#cbd5e1;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .legalNav{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px 24px;border-bottom:1px solid #1e293b;background:rgba(11,18,32,.94);backdrop-filter:blur(12px);}
        .legalBrand{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#f8fafc;cursor:pointer;font:inherit;font-weight:800;}
        .legalBrandIcon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#2563eb;color:#fff;}
        .legalNavActions{display:flex;align-items:center;gap:8px;}
        .legalNavButton{border:1px solid #334155;border-radius:9px;background:#111827;color:#cbd5e1;padding:8px 11px;cursor:pointer;font:inherit;font-size:10px;font-weight:700;}
        .legalNavButton:hover{background:#1e293b;color:#fff;}
        .legalNavPrimary{border-color:#2563eb;background:#2563eb;color:#fff;}
        .legalWrap{width:min(900px,100%);margin:0 auto;padding:55px 24px 80px;box-sizing:border-box;}
        .legalKicker{color:#60a5fa;font-size:10px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;}
        .legalWrap h1{margin:8px 0 8px;color:#f8fafc;font-size:38px;letter-spacing:-1.2px;}
        .legalUpdated{margin:0 0 35px;color:#64748b;font-size:10px;}
        .legalIntro{margin:0 0 28px;padding:16px 17px;border:1px solid #26354b;border-radius:13px;background:#101827;color:#cbd5e1;font-size:12px;line-height:1.75;}
        .legalWrap section{margin:0 0 30px;}
        .legalWrap h2{margin:0 0 9px;color:#f8fafc;font-size:18px;letter-spacing:-.3px;}
        .legalWrap h3{margin:17px 0 7px;color:#e2e8f0;font-size:13px;}
        .legalWrap p,.legalWrap li{color:#94a3b8;font-size:11px;line-height:1.8;}
        .legalWrap p{margin:0 0 10px;}
        .legalWrap ul{margin:7px 0 0;padding-left:20px;}
        .legalWrap a{color:#60a5fa;text-decoration:none;}
        .legalWrap a:hover{text-decoration:underline;}
        .legalFooter{border-top:1px solid #1e293b;padding:22px 24px 30px;text-align:center;color:#64748b;font-size:9px;}
        .legalFooter button{border:0;background:transparent;color:#60a5fa;cursor:pointer;font:inherit;}
        @media(max-width:650px){.legalNav{padding:12px 15px}.legalBrand span{display:none}.legalNavButton{padding:8px 9px}.legalWrap{padding:38px 16px 60px}.legalWrap h1{font-size:31px}.legalWrap p,.legalWrap li{font-size:10.5px}}
      `}</style>

      <nav className="legalNav">
        <button className="legalBrand" onClick={onBack} aria-label="Back to CyberCafe Helper home">
          <span className="legalBrandIcon"><Monitor size={17} /></span>
          <span>CyberCafe Helper</span>
        </button>
        <div className="legalNavActions">
          <button className="legalNavButton" onClick={onBack}>Back to Home</button>
          <button className="legalNavButton legalNavPrimary" onClick={onSignUp}>Get Started</button>
        </div>
      </nav>

      <main className="legalWrap">
        <div className="legalKicker">CyberCafe Helper · Legal</div>
        <h1>{title}</h1>
        <p className="legalUpdated">Effective / last updated: {updated} · Version {LEGAL_VERSION}</p>

        {isPrivacy ? (
          <>
            <div className="legalIntro">
              This Privacy Policy explains how CyberCafe Helper handles personal data when you use the website, create a workspace, use café-management features, or submit information through a café's customer print QR flow. We aim to collect only what is reasonably needed to provide the requested service and to keep access controlled.
            </div>

            <section><h2>1. Who this policy applies to</h2><p>This policy applies to users of CyberCafe Helper, including café owners, administrators, staff, customer accounts, and visitors or customers who use a café-specific QR page to submit a print request.</p><p>For customer information entered into a café workspace, the café may also have responsibilities as the party deciding why that customer information is collected and how it is used. CyberCafe Helper provides the technical workspace and processing service.</p></section>

            <section><h2>2. Information we collect</h2><p>Depending on how you use the service, we may process:</p><ul><li><strong>Account data:</strong> email address, authentication information, account metadata, and the business/café name supplied during signup.</li><li><strong>Workspace data:</strong> café name, phone, address, GSTIN or other business details you choose to enter, service templates, quick links, follow-ups, and workspace settings.</li><li><strong>Customer data:</strong> customer name, phone number, service/application details, notes, payment status and related operational records entered by a café.</li><li><strong>Print-job data:</strong> customer name and optional phone number, selected print settings, status, pricing, payment information, timestamps, and uploaded file metadata.</li><li><strong>Uploaded documents:</strong> files submitted through the café QR print flow, such as PDFs, images and supported office documents. These files are stored in the private print-document storage used by the service.</li><li><strong>Technical information:</strong> information necessary for authentication, security, error handling and normal operation of the website and hosting infrastructure.</li></ul></section>

            <section><h2>3. Why we use personal data</h2><p>We use personal data for specific operational purposes, including:</p><ul><li>creating and securing user accounts;</li><li>providing the café workspace and its requested features;</li><li>managing customers, applications, print requests, follow-ups and payment records;</li><li>receiving and processing customer print requests through a café's QR code;</li><li>showing print-job status and estimated pricing to the person who submitted a request;</li><li>providing requested AI-assisted customer summaries where that feature is used;</li><li>responding to support requests and maintaining service security;</li><li>preventing misuse, unauthorized access and security incidents; and</li><li>meeting applicable legal or regulatory obligations.</li></ul></section>

            <section><h2>4. Consent and choice</h2><p>Where we rely on consent, we ask for it through a clear affirmative action and describe the relevant processing in understandable language. You should not provide personal data that is not needed for the service you are requesting.</p><p>You may withdraw consent where consent is the basis for processing. Withdrawal does not invalidate processing that was already lawful before withdrawal. Some service features may no longer be available if the data required to provide them is no longer available.</p></section>

            <section><h2>5. Customer QR print requests</h2><p>A café-specific QR page allows a customer to submit files without creating a CyberCafe Helper account. The information submitted through that page is used to create and fulfill the requested print job and to provide status information.</p><p>Uploaded documents are private rather than publicly listed. Authorized café managers can access the files needed to process the print job. Temporary signed download links are used for authorized file access rather than exposing the private storage location directly.</p><p>Customers should submit only documents necessary for the requested service and should avoid sending sensitive information that the café does not need.</p></section>

            <section><h2>6. Service providers and infrastructure</h2><p>CyberCafe Helper relies on third-party infrastructure and service providers to operate the application, including cloud database/authentication/storage infrastructure, hosting, payment processing where enabled, and AI processing where the AI feature is used. Data is shared with such providers only as reasonably necessary to provide the requested functionality, secure the service, or comply with law.</p><p>The service currently uses Supabase for authentication, database and private file storage, Vercel for web hosting, Razorpay for payment-related processing where enabled, and Gemini through a server-side integration for the AI customer-summary feature. Provider practices may change as the service evolves, and this policy will be updated when material changes require it.</p></section>

            <section><h2>7. Security</h2><p>We use access controls, authenticated workspace permissions, database row-level security, private document storage, short-lived signed file URLs, server-side handling of sensitive API credentials, and other reasonable technical safeguards appropriate to the service.</p><p>No internet service can guarantee absolute security. If we become aware of a security incident requiring notification under applicable law, we will follow the applicable notification requirements.</p></section>

            <section><h2>8. Retention and deletion</h2><p>We retain information for as long as reasonably necessary to provide the service, maintain business records, resolve disputes, enforce agreements, protect the service, or satisfy legal obligations. Retention periods may differ between account records, operational records and uploaded documents.</p><p>Because café customers and café operators may have different relationships with the data, a request concerning a café's customer records may need to be coordinated with the relevant café. We do not promise automatic deletion immediately after every print job unless a specific retention feature or policy says otherwise.</p></section>

            <section><h2>9. Your rights and requests</h2><p>Subject to applicable law, you may have rights relating to access to information about processing, correction, updating, withdrawal of consent where consent is the basis, and grievance or complaint mechanisms. Requests should clearly identify the account, workspace or print request involved and the action being requested.</p><p>For café-managed customer information, the café may need to participate in the response because it determines parts of the processing purpose and business context.</p></section>

            <section><h2>10. Children's data</h2><p>CyberCafe Helper is intended for business and general public service use and is not designed to knowingly collect children's personal data for an independent purpose. A café or adult using the service should not submit a child's information unless they are authorized to do so and the applicable requirements have been satisfied.</p></section>

            <section><h2>11. Changes to this policy</h2><p>We may update this Privacy Policy as the service, technology, legal requirements or data practices change. Material changes will be reflected by updating the version and effective date shown at the top of this page.</p></section>

            <section><h2>12. Contact and grievances</h2><p>For privacy questions, data requests or grievances, use the support/contact method made available by CyberCafe Helper on the website or within the service. When making a request, provide enough information for us to identify the relevant account, workspace or request without sending unnecessary personal data.</p></section>
          </>
        ) : (
          <>
            <div className="legalIntro">
              These Terms & Conditions govern your use of CyberCafe Helper. By creating an account or using the service, you agree to these terms. If you do not agree, do not create an account or use the service.
            </div>

            <section><h2>1. The service</h2><p>CyberCafe Helper is a software service designed to help cyber café operators organize customers, applications, documents, print requests, payments, follow-ups and related operational work.</p><p>Features may change over time. We may add, remove, improve or discontinue features, including integrations and third-party services, subject to applicable law.</p></section>

            <section><h2>2. Accounts and access</h2><p>You are responsible for providing accurate account information, protecting your credentials, and using your account only for lawful purposes. Do not share credentials in a way that allows unauthorized access to another person's account or workspace.</p><p>Workspace owners and administrators are responsible for assigning appropriate roles and ensuring that staff access is limited to people who need it.</p></section>

            <section><h2>3. Café and customer responsibilities</h2><p>Café operators are responsible for the accuracy and lawfulness of the customer information they enter, the services they provide, their pricing, their payment collection, and their compliance with applicable laws.</p><p>Customers are responsible for submitting files and information they are authorized to provide. Do not upload unlawful, malicious, infringing or otherwise prohibited content.</p></section>

            <section><h2>4. Uploaded documents</h2><p>The print QR feature is intended for legitimate document-printing workflows. You must not use it to distribute malware, unlawful material, content that infringes another person's rights, or information you are not authorized to submit.</p><p>CyberCafe Helper provides storage and delivery functionality but does not review every uploaded file. A café is responsible for handling the customer's print request appropriately.</p></section>

            <section><h2>5. Payments and pricing</h2><p>Where payment features are enabled, the café controls its service pricing and is responsible for confirming the amount actually collected. Third-party payment providers may apply their own terms, fees and processing rules.</p><p>CyberCafe Helper is not the seller of the café's underlying services unless expressly stated otherwise. Disputes about a café's service, printing charge, refund or customer transaction should ordinarily be resolved with the relevant café.</p></section>

            <section><h2>6. Acceptable use</h2><p>You must not use CyberCafe Helper to:</p><ul><li>break the law or facilitate unlawful activity;</li><li>attempt to gain unauthorized access to another workspace, account, document or system;</li><li>upload malware or intentionally harmful files;</li><li>probe, disrupt, overload or circumvent security controls;</li><li>impersonate another person or organization;</li><li>use the service to infringe intellectual-property, privacy or other rights; or</li><li>abuse public QR endpoints, automated requests or the service infrastructure.</li></ul></section>

            <section><h2>7. Intellectual property</h2><p>CyberCafe Helper's software, branding, interface and original content are owned by or licensed to the service operator unless otherwise stated. These terms do not transfer ownership of the customer's or café's own data or documents.</p></section>

            <section><h2>8. Third-party services</h2><p>The service may depend on third-party providers for hosting, authentication, storage, payments, AI functionality and other infrastructure. Third-party services may have their own terms and availability limitations. CyberCafe Helper is not responsible for failures caused solely by a third-party provider, except where applicable law provides otherwise.</p></section>

            <section><h2>9. Availability and changes</h2><p>We aim to keep the service reliable but do not guarantee uninterrupted availability, error-free operation, or that every feature will always remain available. Maintenance, outages, security events, provider failures and other circumstances may temporarily affect the service.</p></section>

            <section><h2>10. Suspension and termination</h2><p>We may suspend or terminate access where reasonably necessary to protect the service, comply with law, investigate abuse, address security risks, or enforce these terms. You may stop using the service at any time.</p><p>Termination does not remove obligations or rights that by their nature should continue, including provisions concerning misuse, intellectual property, liability and disputes.</p></section>

            <section><h2>11. Disclaimer and limitation of liability</h2><p>To the extent permitted by law, the service is provided on an "as available" basis without guarantees that it will meet every particular business requirement. You remain responsible for verifying important customer, application, payment and print information.</p><p>To the extent permitted by applicable law, CyberCafe Helper will not be liable for indirect, incidental, special or consequential losses arising from use of the service. Nothing in these terms excludes liability that cannot lawfully be excluded.</p></section>

            <section><h2>12. Indemnity</h2><p>To the extent permitted by law, you are responsible for claims, losses or expenses arising from your unlawful use of the service, your violation of these terms, or your submission or handling of data or content that you were not authorized to use.</p></section>

            <section><h2>13. Governing law</h2><p>These terms are intended to be governed by the laws of India, subject to applicable mandatory legal rights and protections. Any dispute will be subject to the jurisdiction of the courts or dispute-resolution forum legally competent to hear it.</p></section>

            <section><h2>14. Changes to these terms</h2><p>We may update these terms as the service changes or legal requirements develop. The version and effective date shown on this page will identify the current version. Continued use after an updated version becomes effective constitutes acceptance to the extent permitted by law.</p></section>

            <section><h2>15. Contact</h2><p>For questions about these terms, use the support/contact method made available by CyberCafe Helper on the website or within the service.</p></section>
          </>
        )}
      </main>

      <footer className="legalFooter">© {new Date().getFullYear()} CyberCafe Helper · <button onClick={onBack}>Home</button></footer>
    </div>
  );
}

function AuthScreen({ initialMode = "login", onBackToLanding, onForgotPassword }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [consentAccepted, setConsentAccepted] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setFieldErrors({});

    const cleanEmail = email.trim();
    const cleanBusinessName = businessName.trim();

    if (!cleanEmail) {
      setFieldErrors({ email: "Please enter your email address." });
      return;
    }

    if (!password) {
      setFieldErrors({ password: "Please enter your password." });
      return;
    }

    if (mode === "signup" && !cleanBusinessName) {
      setFieldErrors({ businessName: "Please enter your cyber café / business name." });
      return;
    }

    if (mode === "signup" && !consentAccepted) {
      setFieldErrors({ consent: "Please accept the Terms & Privacy Policy to continue." });
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password
          });

        if (signInError) {
          const message = signInError.message?.toLowerCase() || "";

          if (
            message.includes("invalid login credentials") ||
            message.includes("invalid credentials")
          ) {
            throw new Error(
              "The email or password is incorrect. Please check your details and try again."
            );
          }

          if (message.includes("email not confirmed")) {
            throw new Error(
              "Please confirm your email address before signing in."
            );
          }

          throw new Error(
            "We couldn't sign you in right now. Please check your details and try again."
          );
        }
      } else {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                business_name: cleanBusinessName,
                terms_accepted_at: new Date().toISOString(),
                terms_version: LEGAL_VERSION,
                privacy_policy_version: LEGAL_VERSION
              }
            }
          });

        if (signUpError) {
          const message = signUpError.message?.toLowerCase() || "";

          if (message.includes("already registered")) {
            throw new Error(
              "This email may already have an account. Try signing in instead."
            );
          }

          throw new Error(
            "We couldn't create your account right now. Please check your details and try again."
          );
        }

        if (!data.session) {
          setMessage(
            "Account created. Check your email to confirm your account, then sign in."
          );
          setMode("login");
          setPassword("");
          setShowPassword(false);
        }
      }
    } catch (err) {
      setError(
        err?.message ||
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
    setFieldErrors({});
    setPassword("");
    setShowPassword(false);
    setConsentAccepted(false);
  };

  return (
    <>
      <style>{`
        .authShell {
          min-height:100vh;
          width:100%;
          position:relative;
          overflow:hidden;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:28px;
          background:#0b1220;
          color:#e2e8f0;
          box-sizing:border-box;
          font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .authBackgroundGlow {
          position:absolute;
          width:430px;
          height:430px;
          border-radius:50%;
          filter:blur(80px);
          opacity:.22;
          pointer-events:none;
        }

        .authGlowOne {
          background:#2563eb;
          top:-180px;
          left:-130px;
        }

        .authGlowTwo {
          background:#06b6d4;
          right:-170px;
          bottom:-190px;
        }

        .authCard {
          position:relative;
          z-index:1;
          width:min(450px,100%);
          box-sizing:border-box;
          padding:32px;
          border:1px solid #26354b;
          border-radius:20px;
          background:rgba(17,24,39,.96);
          box-shadow:0 28px 80px rgba(0,0,0,.38);
          backdrop-filter:blur(12px);
        }

        .authBack {
          display:inline-flex;
          align-items:center;
          gap:5px;
          border:0;
          background:transparent;
          color:#64748b;
          padding:0;
          margin-bottom:19px;
          cursor:pointer;
          font:inherit;
          font-size:9px;
          font-weight:700;
        }

        .authBack:hover {
          color:#93c5fd;
        }

        .authBrand {
          display:flex;
          align-items:center;
          gap:11px;
          margin-bottom:31px;
        }

        .authBrandIcon {
          width:42px;
          height:42px;
          border-radius:12px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#2563eb;
          color:#fff;
          box-shadow:0 8px 24px rgba(37,99,235,.28);
        }

        .authBrandName {
          color:#f8fafc;
          font-size:16px;
          font-weight:800;
          letter-spacing:-.3px;
        }

        .authBrandSub {
          color:#60a5fa;
          font-size:9px;
          font-weight:800;
          letter-spacing:3px;
          margin-top:1px;
        }

        .authIntro span {
          color:#60a5fa;
          font-size:9px;
          font-weight:800;
          letter-spacing:1.7px;
        }

        .authIntro h1 {
          margin:7px 0 6px;
          color:#f8fafc;
          font-size:27px;
          line-height:1.15;
          letter-spacing:-.6px;
        }

        .authIntro p {
          margin:0 0 25px;
          color:#94a3b8;
          font-size:11px;
          line-height:1.6;
        }

        .authForm {
          display:flex;
          flex-direction:column;
          gap:15px;
        }

        .authForm label {
          display:flex;
          flex-direction:column;
          gap:7px;
        }

        .authForm label span {
          color:#cbd5e1;
          font-size:10px;
          font-weight:700;
        }

        .authInputWrap {
          position:relative;
        }

        .authForm input {
          width:100%;
          box-sizing:border-box;
          padding:12px 42px 12px 12px;
          border:1px solid #334155;
          border-radius:10px;
          outline:none;
          background:#0f172a;
          color:#f8fafc;
          font:inherit;
          font-size:11px;
          transition:.18s ease;
        }

        .authForm input:not(.authPasswordInput) {
          padding-right:12px;
        }

        .authForm input::placeholder {
          color:#64748b;
        }

        .authForm input:focus {
          border-color:#3b82f6;
          box-shadow:0 0 0 3px rgba(59,130,246,.13);
        }

        .authPasswordToggle {
          position:absolute;
          top:50%;
          right:11px;
          transform:translateY(-50%);
          width:25px;
          height:25px;
          display:flex;
          align-items:center;
          justify-content:center;
          border:0;
          padding:0;
          border-radius:6px;
          background:transparent;
          color:#64748b;
          cursor:pointer;
        }

        .authPasswordToggle:hover {
          background:#1e293b;
          color:#cbd5e1;
        }

        .authPasswordToggle:focus-visible {
          outline:2px solid #3b82f6;
          outline-offset:2px;
        }

        .authPasswordHint {
          margin-top:-2px;
          color:#64748b;
          font-size:9px;
          line-height:1.45;
        }

        .authSubmit {
          width:100%;
          border:1px solid #2563eb;
          border-radius:10px;
          padding:12px 14px;
          background:#2563eb;
          color:#fff;
          cursor:pointer;
          font:inherit;
          font-size:11px;
          font-weight:800;
          margin-top:2px;
          transition:.18s ease;
        }

        .authSubmit:hover:not(:disabled) {
          background:#1d4ed8;
          transform:translateY(-1px);
          box-shadow:0 8px 20px rgba(37,99,235,.22);
        }

        .authSubmit:disabled {
          opacity:.65;
          cursor:wait;
          transform:none;
        }

        .authAlert {
          display:flex;
          align-items:flex-start;
          gap:8px;
          padding:10px 11px;
          border-radius:10px;
          font-size:10px;
          line-height:1.5;
        }

        .authAlert svg {
          flex:none;
          margin-top:1px;
        }

        .authAlertError {
          border:1px solid #7f1d1d;
          background:#2a1518;
          color:#fca5a5;
        }

        .authAlertSuccess {
          border:1px solid #14532d;
          background:#10251a;
          color:#86efac;
        }

        .authSwitch {
          display:flex;
          align-items:center;
          justify-content:center;
          gap:5px;
          margin-top:19px;
          color:#64748b;
          font-size:10px;
        }

        .authSwitch button {
          border:0;
          padding:0;
          background:transparent;
          color:#60a5fa;
          cursor:pointer;
          font:inherit;
          font-weight:700;
        }

        .authSwitch button:hover {
          color:#93c5fd;
        }

        .authForgot {
          display:flex;
          justify-content:flex-end;
          margin-top:-7px;
        }

        .authForgot button {
          border:0;
          padding:0;
          background:transparent;
          color:#60a5fa;
          cursor:pointer;
          font:inherit;
          font-size:9px;
          font-weight:700;
        }

        .authForgot button:hover {
          color:#93c5fd;
        }

        .authConsentBlock {
          margin-top:-1px;
        }

        .authConsentLabel {
          display:flex !important;
          flex-direction:row !important;
          align-items:flex-start;
          gap:9px !important;
          color:#94a3b8;
          font-size:9px !important;
          line-height:1.55;
        }

        .authConsentLabel input {
          width:15px !important;
          height:15px !important;
          flex:none;
          margin:1px 0 0;
          padding:0 !important;
          accent-color:#2563eb;
          cursor:pointer;
          border:0 !important;
          box-shadow:none !important;
        }

        .authLegalLink {
          border:0;
          padding:0;
          background:transparent;
          color:#60a5fa;
          cursor:pointer;
          font:inherit;
          font-weight:700;
          text-decoration:none;
        }

        .authLegalLink:hover {
          color:#93c5fd;
          text-decoration:underline;
        }

        .authSecurityNote {
          display:flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          margin-top:22px;
          padding-top:16px;
          border-top:1px solid #253044;
          color:#64748b;
          font-size:9px;
          text-align:center;
        }

        .authSecurityNote svg {
          color:#34d399;
          flex:none;
        }

        @media (max-width:520px) {
          .authShell {
            padding:14px;
          }

          .authCard {
            padding:24px 20px;
            border-radius:16px;
          }

          .authIntro h1 {
            font-size:24px;
          }

          .authBrand {
            margin-bottom:25px;
          }
        }
      `}</style>

      <div className="authShell">
        <div className="authBackgroundGlow authGlowOne" />
        <div className="authBackgroundGlow authGlowTwo" />

        <div className="authCard">
          {onBackToLanding && (
            <button
              className="authBack"
              type="button"
              onClick={onBackToLanding}
            >
              <ChevronRight
                size={12}
                style={{ transform: "rotate(180deg)" }}
              />
              Back to CyberCafe Helper
            </button>
          )}

          <div className="authBrand">
            <div className="authBrandIcon">
              <Monitor size={24} />
            </div>

            <div>
              <div className="authBrandName">CyberCafe</div>
              <div className="authBrandSub">HELPER</div>
            </div>
          </div>

          <div className="authIntro">
            <span>
              {mode === "login" ? "SECURE WORKSPACE" : "GET STARTED"}
            </span>

            <h1>
              {mode === "login"
                ? "Welcome back"
                : "Create your workspace"}
            </h1>

            <p>
              {mode === "login"
                ? "Sign in to manage your cyber café operations."
                : "Set up your workspace and bring your daily café operations into one place."}
            </p>
          </div>

          <form className="authForm" onSubmit={submit}>
            {mode === "signup" && (
              <label>
                <span>Business / Cyber Café Name</span>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => {
                    setBusinessName(e.target.value);
                    if (fieldErrors.businessName) {
                      setFieldErrors((current) => ({ ...current, businessName: "" }));
                    }
                  }}
                  placeholder="e.g. Sharma Digital Seva"
                  autoComplete="organization"
                  maxLength={100}
                  aria-invalid={Boolean(fieldErrors.businessName)}
                  aria-describedby={fieldErrors.businessName ? "business-name-error" : undefined}
                />
                {fieldErrors.businessName && (
                  <div id="business-name-error" className="authFieldError">{fieldErrors.businessName}</div>
                )}
              </label>
            )}

            <label>
              <span>Email Address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>

            <label>
              <span>Password</span>

              <div className="authInputWrap">
                <input
                  className="authPasswordInput"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "signup"
                      ? "At least 6 characters"
                      : "Enter your password"
                  }
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={6}
                  maxLength={128}
                />

                <button
                  className="authPasswordToggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {mode === "signup" && (
                <div className="authPasswordHint">
                  Use at least 6 characters. A longer password is recommended.
                </div>
              )}
            </label>

            {mode === "login" && (
              <div className="authForgot">
                <button
                  type="button"
                  onClick={onForgotPassword}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {mode === "signup" && (
              <div className="authConsentBlock">
                <label className="authConsentLabel">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => {
                      setConsentAccepted(e.target.checked);
                      if (fieldErrors.consent) {
                        setFieldErrors((current) => ({ ...current, consent: "" }));
                      }
                    }}
                    aria-invalid={Boolean(fieldErrors.consent)}
                    aria-describedby={fieldErrors.consent ? "consent-error" : undefined}
                  />
                  <span>
                    I agree to the <button type="button" onClick={() => window.open("/?legal=terms", "_blank", "noopener,noreferrer")} className="authLegalLink">Terms &amp; Conditions</button> and acknowledge the <button type="button" onClick={() => window.open("/?legal=privacy", "_blank", "noopener,noreferrer")} className="authLegalLink">Privacy Policy</button>.
                  </span>
                </label>
                {fieldErrors.consent && <div id="consent-error" className="authFieldError" style={{ fontSize: "9px", lineHeight: 1.4, marginTop: "5px", fontWeight: 500 }}>{fieldErrors.consent}</div>}
              </div>
            )}

            {error && (
              <div
                className="authAlert authAlertError"
                role="alert"
                aria-live="polite"
              >
                <CircleAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div
                className="authAlert authAlertSuccess"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 size={16} />
                <span>{message}</span>
              </div>
            )}

            <button
              className="authSubmit"
              type="submit"
              disabled={loading}
            >
              {loading
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating workspace…"
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <div className="authSwitch">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              type="button"
              onClick={() =>
                switchMode(mode === "login" ? "signup" : "login")
              }
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </div>

          <div className="authSecurityNote">
            <ShieldCheck size={15} />
            <span>
              Your account and workspace access are protected with secure authentication.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function ForgotPasswordScreen({ onBackToLogin, onBackToLanding }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter the email address linked to your account.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for this email, a password reset link has been sent. Please check your inbox.");
    } catch (err) {
      setError(getSafeUiError(err, "Could not send the reset link. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .authShell { min-height:100vh; width:100%; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:28px; background:#0b1220; color:#e2e8f0; box-sizing:border-box; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .authBackgroundGlow { position:absolute; width:430px; height:430px; border-radius:50%; filter:blur(80px); opacity:.22; pointer-events:none; }
        .authGlowOne { background:#2563eb; top:-180px; left:-130px; }
        .authGlowTwo { background:#06b6d4; right:-170px; bottom:-190px; }
        .resetCard { position:relative; z-index:1; width:min(450px,100%); box-sizing:border-box; padding:32px; border:1px solid #26354b; border-radius:20px; background:rgba(17,24,39,.96); box-shadow:0 28px 80px rgba(0,0,0,.38); backdrop-filter:blur(12px); }
        .resetIcon { width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:#172554; color:#60a5fa; margin-bottom:18px; }
        .resetCard h1 { margin:0 0 7px; color:#f8fafc; font-size:26px; letter-spacing:-.6px; }
        .resetCard p { margin:0 0 23px; color:#94a3b8; font-size:11px; line-height:1.65; }
        .authForm { display:flex; flex-direction:column; gap:15px; }
        .authForm label { display:flex; flex-direction:column; gap:7px; }
        .authForm label span { color:#cbd5e1; font-size:10px; font-weight:700; }
        .authForm input { width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid #334155; border-radius:10px; outline:none; background:#0f172a; color:#f8fafc; font:inherit; font-size:11px; transition:.18s ease; }
        .authForm input::placeholder { color:#64748b; }
        .authForm input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.13); }
        .authForm input[aria-invalid="true"] { border:2px solid #ef4444 !important; box-shadow:0 0 0 3px rgba(239,68,68,.18) !important; }
        .authFieldError { color:#dc2626; font-size:9px !important; line-height:1.4; margin-top:-2px; }
        .authConsentBlock > .authFieldError { display:block !important; color:#dc2626 !important; font-size:9px !important; line-height:1.4 !important; font-weight:500 !important; margin:5px 0 0 !important; padding:0 !important; }
        .authSubmit { width:100%; border:1px solid #2563eb; border-radius:10px; padding:11px 14px; background:#2563eb; color:#fff; cursor:pointer; font:inherit; font-size:11px; font-weight:800; margin-top:2px; transition:.18s ease; }
        .authSubmit:hover:not(:disabled) { background:#1d4ed8; transform:translateY(-1px); box-shadow:0 8px 20px rgba(37,99,235,.22); }
        .authSubmit:disabled { opacity:.65; cursor:wait; }
        .authAlert { display:flex; align-items:flex-start; gap:8px; padding:10px 11px; border-radius:10px; font-size:10px; line-height:1.5; }
        .authAlert svg { flex:none; margin-top:1px; }
        .authAlertError { border:1px solid #7f1d1d; background:#2a1518; color:#fca5a5; }
        .authAlertSuccess { border:1px solid #14532d; background:#10251a; color:#86efac; }
        .authSwitch { display:flex; align-items:center; justify-content:center; gap:5px; margin-top:19px; color:#64748b; font-size:10px; }
        .authSwitch button { border:0; padding:0; background:transparent; color:#60a5fa; cursor:pointer; font:inherit; font-weight:700; }
        .authSecurityNote { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:22px; padding-top:16px; border-top:1px solid #253044; color:#64748b; font-size:9px; }
        .authSecurityNote svg { color:#34d399; }
        @media (max-width:520px) { .authShell { padding:14px; } .resetCard { padding:24px 20px; border-radius:16px; } }
      `}</style>
      <div className="authShell">
        <div className="authBackgroundGlow authGlowOne" />
        <div className="authBackgroundGlow authGlowTwo" />
        <div className="resetCard">
          <div className="resetIcon"><Mail size={22} /></div>
          <h1>Reset your password</h1>
          <p>Enter the email address associated with your CyberCafe Helper account and we'll send you a secure reset link.</p>
          <form className="authForm" onSubmit={submit}>
            <label><span>Email Address</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus /></label>
            {error && <div className="authAlert authAlertError"><CircleAlert size={16} /><span>{error}</span></div>}
            {message && <div className="authAlert authAlertSuccess"><CheckCircle2 size={16} /><span>{message}</span></div>}
            <button className="authSubmit" type="submit" disabled={loading}>{loading ? "Sending…" : "Send Reset Link"}</button>
          </form>
          <div className="authSwitch"><button type="button" onClick={onBackToLogin}><ChevronRight size={12} style={{ transform: "rotate(180deg)", verticalAlign: "-2px" }} /> Back to Sign In</button></div>
          <div className="authSwitch" style={{ marginTop: 10 }}><button type="button" onClick={onBackToLanding}>Back to landing page</button></div>
        </div>
      </div>
    </>
  );
}

function ResetPasswordScreen({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been updated successfully.");
      setPassword("");
      setConfirmPassword("");
      setTimeout(onComplete, 1200);
    } catch (err) {
      setError(getSafeUiError(err, "Could not update your password. Please request a new reset link."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .authShell { min-height:100vh; width:100%; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:28px; background:#0b1220; color:#e2e8f0; box-sizing:border-box; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .authBackgroundGlow { position:absolute; width:430px; height:430px; border-radius:50%; filter:blur(80px); opacity:.22; pointer-events:none; }
        .authGlowOne { background:#2563eb; top:-180px; left:-130px; }
        .authGlowTwo { background:#06b6d4; right:-170px; bottom:-190px; }
        .authCard { position:relative; z-index:1; width:min(450px,100%); box-sizing:border-box; padding:32px; border:1px solid #26354b; border-radius:20px; background:rgba(17,24,39,.96); box-shadow:0 28px 80px rgba(0,0,0,.38); backdrop-filter:blur(12px); }
        .authBrand { display:flex; align-items:center; gap:11px; margin-bottom:31px; }
        .authBrandIcon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:#2563eb; color:#fff; box-shadow:0 8px 24px rgba(37,99,235,.28); }
        .authBrandName { color:#f8fafc; font-size:16px; font-weight:800; letter-spacing:-.3px; }
        .authBrandSub { color:#60a5fa; font-size:9px; font-weight:800; letter-spacing:3px; margin-top:1px; }
        .authIntro span { color:#60a5fa; font-size:9px; font-weight:800; letter-spacing:1.7px; }
        .authIntro h1 { margin:7px 0 6px; color:#f8fafc; font-size:27px; line-height:1.15; letter-spacing:-.6px; }
        .authIntro p { margin:0 0 25px; color:#94a3b8; font-size:11px; line-height:1.6; }
        .authForm { display:flex; flex-direction:column; gap:15px; }
        .authForm label { display:flex; flex-direction:column; gap:7px; }
        .authForm label span { color:#cbd5e1; font-size:10px; font-weight:700; }
        .authForm input { width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid #334155; border-radius:10px; outline:none; background:#0f172a; color:#f8fafc; font:inherit; font-size:11px; transition:.18s ease; }
        .authForm input::placeholder { color:#64748b; }
        .authForm input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.13); }
        .authSubmit { width:100%; border:1px solid #2563eb; border-radius:10px; padding:11px 14px; background:#2563eb; color:#fff; cursor:pointer; font:inherit; font-size:11px; font-weight:800; margin-top:2px; transition:.18s ease; }
        .authSubmit:hover:not(:disabled) { background:#1d4ed8; transform:translateY(-1px); box-shadow:0 8px 20px rgba(37,99,235,.22); }
        .authSubmit:disabled { opacity:.65; cursor:wait; }
        .authAlert { display:flex; align-items:flex-start; gap:8px; padding:10px 11px; border-radius:10px; font-size:10px; line-height:1.5; }
        .authAlert svg { flex:none; margin-top:1px; }
        .authAlertError { border:1px solid #7f1d1d; background:#2a1518; color:#fca5a5; }
        .authAlertSuccess { border:1px solid #14532d; background:#10251a; color:#86efac; }
        .resetPasswordNote { color:#94a3b8; font-size:10px; line-height:1.6; margin-top:14px; text-align:center; }
        @media (max-width:520px) { .authShell { padding:14px; } .authCard { padding:24px 20px; border-radius:16px; } .authIntro h1 { font-size:24px; } }
      `}</style>
      <div className="authShell">
        <div className="authBackgroundGlow authGlowOne" />
        <div className="authBackgroundGlow authGlowTwo" />
        <div className="authCard">
          <div className="authBrand"><div className="authBrandIcon"><LockKeyhole size={23} /></div><div><div className="authBrandName">CyberCafe</div><div className="authBrandSub">HELPER</div></div></div>
          <div className="authIntro"><span>ACCOUNT SECURITY</span><h1>Create a new password</h1><p>Choose a new password for your CyberCafe Helper account.</p></div>
          <form className="authForm" onSubmit={submit}>
            <label><span>New Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" autoFocus /></label>
            <label><span>Confirm New Password</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter password again" autoComplete="new-password" /></label>
            {error && <div className="authAlert authAlertError"><CircleAlert size={16} /><span>{error}</span></div>}
            {message && <div className="authAlert authAlertSuccess"><CheckCircle2 size={16} /><span>{message}</span></div>}
            <button className="authSubmit" type="submit" disabled={loading}>{loading ? "Updating…" : "Update Password"}</button>
          </form>
          <div className="resetPasswordNote">After updating your password, you'll return to the sign-in screen.</div>
        </div>
      </div>
    </>
  );
}

let razorpayScriptPromise = null;

async function loadRazorpayCheckoutScript() {
  if (window.Razorpay) return;
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay Checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout. Please check your internet connection."));
    document.body.appendChild(script);
  }).catch((error) => {
    razorpayScriptPromise = null;
    throw error;
  });

  return razorpayScriptPromise;
}


function CafeQRPage({ workspace, businessProfile }) {
  const workspaceId = workspace?.id || "";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://cybercafe-helper.vercel.app";
  const qrUrl = workspaceId
    ? `${baseUrl}/?workspace=${encodeURIComponent(workspaceId)}&mode=customer`
    : "";
  const [copied, setCopied] = useState(false);

  const downloadQr = () => {
    const svg = document.querySelector("#cafe-qr-code svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(businessProfile?.businessName || workspace?.name || "cybercafe").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const copyQrLink = async () => {
    if (!qrUrl) return;

    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Could not copy QR link:", error);
    }
  };

  const printQr = () => {
    const printWindow = window.open("", "_blank", "width=700,height=800");
    if (!printWindow) return;

    const qrSvg = document.querySelector("#cafe-qr-code svg");
    if (!qrSvg) {
      printWindow.close();
      return;
    }
    const qrMarkup = qrSvg.outerHTML;
    const businessName = escapeHtml(businessProfile?.businessName || workspace?.name || "CyberCafe Helper");
    const safeQrUrl = escapeHtml(qrUrl);

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${businessName} - Customer QR</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Inter, Arial, sans-serif;
              background: #fff;
              color: #111827;
            }
            .sheet {
              width: 520px;
              padding: 42px;
              text-align: center;
              border: 1px solid #e5e7eb;
              border-radius: 20px;
            }
            h1 { margin: 0 0 8px; font-size: 28px; }
            p { margin: 0 0 26px; color: #64748b; font-size: 15px; line-height: 1.5; }
            .qr { display: flex; justify-content: center; margin: 20px 0 26px; }
            .scan { font-size: 18px; font-weight: 800; }
            .url { margin-top: 10px; color: #94a3b8; font-size: 10px; word-break: break-all; }
            @media print {
              .sheet { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <h1>${businessName}</h1>
            <p>Scan this QR code to open our CyberCafe Helper customer portal.</p>
            <div class="qr">${qrMarkup}</div>
            <div class="scan">Scan to continue</div>
            <div class="url">${safeQrUrl}</div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="cafeQrPage">
      <style>{`
        .cafeQrGrid { display:grid; grid-template-columns:minmax(300px,430px) minmax(0,1fr); gap:20px; align-items:start; }
        .cafeQrCodeWrap { display:inline-flex; padding:18px; }
        .cafeQrCodeWrap svg { display:block; width:280px; height:280px; max-width:100%; }
        .cafeQrActions { display:flex; justify-content:center; gap:10px; margin-top:20px; flex-wrap:wrap; }
        .cafeQrHowItem { display:flex; gap:13px; padding:15px; }
        @media (max-width:700px) {
          .cafeQrPage { width:100%; overflow-x:hidden; }
          .cafeQrPage .pageHeading { margin-bottom:14px; }
          .cafeQrGrid { grid-template-columns:1fr; gap:14px; }
          .cafeQrCard { padding:18px !important; }
          .cafeQrCodeWrap { padding:12px; border-radius:15px !important; max-width:100%; }
          .cafeQrCodeWrap svg { width:min(280px,72vw); height:min(280px,72vw); }
          .cafeQrActions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:16px; }
          .cafeQrActions button { width:100%; min-height:42px; justify-content:center; padding:9px 10px !important; }
          .cafeQrActions button:last-child { grid-column:1 / -1; }
          .cafeQrHowItem { padding:12px; gap:10px; }
          .cafeQrHowItem strong { font-size:12px !important; }
          .cafeQrHowItem span { font-size:10px !important; }
        }
        @media (max-width:380px) {
          .cafeQrCard { padding:14px !important; }
          .cafeQrCodeWrap { padding:9px; }
          .cafeQrCodeWrap svg { width:68vw; height:68vw; }
          .cafeQrActions { grid-template-columns:1fr; }
          .cafeQrActions button:last-child { grid-column:auto; }
        }
      `}</style>
      <PageHeading
        eyebrow="CUSTOMER ACCESS"
        title="My Café QR"
        subtitle="Give customers a simple way to open your café's CyberCafe Helper portal."
      />

      <div className="cafeQrGrid" style={{ margin: 0 }}>
        <section className="dashboardCard cafeQrCard" style={{ padding: 28, textAlign: "center" }}>
          <div
            id="cafe-qr-code"
            className="cafeQrCodeWrap"
            style={{
              display: "inline-flex",
              padding: 18,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 18,
              boxShadow: "0 12px 30px rgba(15,23,42,.06)"
            }}
          >
            {workspaceId ? (
              <QRCodeSVG
                value={qrUrl}
                size={280}
                level="H"
                marginSize={4}
                title={`${businessProfile?.businessName || workspace?.name || "CyberCafe"} customer QR`}
              />
            ) : (
              <div style={{ width: 280, height: 280, display: "grid", placeItems: "center", color: "#94a3b8" }}>
                Workspace unavailable
              </div>
            )}
          </div>

          <h2 style={{ margin: "20px 0 7px", fontSize: 20 }}>
            {businessProfile?.businessName || workspace?.name || "My Café"}
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
            Customers can scan this code with their phone camera.
          </p>

          <div className="cafeQrActions">
            <button className="secondaryButton" onClick={downloadQr} disabled={!workspaceId}>
              <Download size={16} />
              Download QR
            </button>
            <button className="secondaryButton" onClick={copyQrLink} disabled={!workspaceId}>
              {copied ? <CheckCircle2 size={16} /> : <Link2 size={16} />}
              {copied ? "Link copied" : "Copy link"}
            </button>
            <button className="primaryButton" onClick={printQr} disabled={!workspaceId}>
              <FileText size={16} />
              Print QR
            </button>
          </div>

          <div style={{
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 11,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            color: "#64748b",
            fontSize: 10,
            lineHeight: 1.5,
            textAlign: "left"
          }}>
            <strong style={{ color: "#334155" }}>Tip:</strong> Print this QR and place it near the counter so customers can send documents from their phones.
          </div>
        </section>

        <section className="dashboardCard cafeQrCard" style={{ padding: 24 }}>
          <span className="sectionEyebrow">HOW IT WORKS</span>
          <h2 style={{ margin: "7px 0 16px", fontSize: 20 }}>One QR for your café</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              ["01", "Print or display the QR", "Put it on your reception desk, wall, counter or customer waiting area."],
              ["02", "Customer scans it", "The QR opens a customer-facing CyberCafe Helper entry point for this workspace."],
              ["03", "Workspace stays connected", "The QR contains your unique workspace ID, so it always points back to your café."]
            ].map(([number, title, description]) => (
              <div key={number} style={{
                display: "flex",
                gap: 13,
                padding: 15,
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e5e7eb"
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: "#eff6ff",
                  color: "#2563eb",
                  fontSize: 11,
                  fontWeight: 850,
                  flexShrink: 0
                }}>{number}</div>
                <div>
                  <strong style={{ display: "block", fontSize: 13 }}>{title}</strong>
                  <span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 11, lineHeight: 1.55 }}>{description}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 18,
            padding: 13,
            borderRadius: 12,
            background: "#eff6ff",
            color: "#1e40af",
            fontSize: 11,
            lineHeight: 1.55
          }}>
            <strong>QR destination:</strong>
            <div style={{ marginTop: 5, wordBreak: "break-all", fontFamily: "monospace", fontSize: 10 }}>
              {qrUrl || "Workspace unavailable"}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PrintJobsPage({ workspace }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [filter, setFilter] = useState("all");
  const [queueView, setQueueView] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [paymentJob, setPaymentJob] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [paymentNote, setPaymentNote] = useState("");
  const [newJobNotice, setNewJobNotice] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem("cc_print_notification_sound") !== "off";
    } catch {
      return true;
    }
  });
  const playNotificationSound = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174, now + 0.12);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.45);
      osc.onended = () => ctx.close().catch(() => {});
    } catch (soundError) {
      console.warn("Notification sound could not play:", soundError);
    }
  };
  const toggleNotificationSound = () => {
    setSoundEnabled((current) => {
      const next = !current;
      try { localStorage.setItem("cc_print_notification_sound", next ? "on" : "off"); } catch {}
      if (next) {
        // This user interaction also unlocks audio in browsers that require it.
        setTimeout(() => playNotificationSound(), 0);
      }
      return next;
    });
  };
  const loadJobs = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: jobsError } = await supabase
        .from("print_jobs")
        .select("id, workspace_id, customer_name, customer_phone, status, color_mode, copies, paper_size, duplex, notes, created_at, completed_at, final_amount, payment_method, payment_status, paid_at, payment_note")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      if (jobsError) throw jobsError;
      const jobRows = data || [];
      if (!jobRows.length) {
        setJobs([]);
        return;
      }
      const jobIds = jobRows.map((job) => job.id);
      const { data: fileRows, error: filesError } = await supabase
        .from("print_job_files")
        .select("id, print_job_id, file_name, storage_path, file_size, mime_type, created_at")
        .in("print_job_id", jobIds)
        .order("created_at", { ascending: true });
      if (filesError) throw filesError;

      const filesByJob = (fileRows || []).reduce((acc, file) => {
        if (!acc[file.print_job_id]) acc[file.print_job_id] = [];
        acc[file.print_job_id].push(file);
        return acc;
      }, {});

      setJobs(jobRows.map((job) => ({ ...job, files: filesByJob[job.id] || [] })));
    } catch (err) {
      console.error("Print jobs load failed:", err);
      setError(getSafeUiError(err, "Could not load print jobs."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const timer = setInterval(loadJobs, 15000);

    if (!workspace?.id) {
      return () => clearInterval(timer);
    }

    const channel = supabase
      .channel(`print-jobs-${workspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "print_jobs",
          filter: `workspace_id=eq.${workspace.id}`,
        },
        (payload) => {
          const job = payload?.new;
          if (!job?.id) return;

          setNewJobNotice({
            id: job.id,
            customerName: job.customer_name || "Customer",
          });
          playNotificationSound();
          loadJobs();

          window.setTimeout(() => {
            setNewJobNotice((current) => current?.id === job.id ? null : current);
          }, 8000);
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Print job realtime subscription failed; polling remains active.");
        }
      });

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [workspace?.id]);

  const updateStatus = async (job, status) => {
    if (status === "completed") {
      const estimate = calculatePrintEstimate({
        workspace,
        colorMode: job.color_mode,
        paperSize: job.paper_size,
        copies: job.copies,
        duplex: job.duplex,
        fileCount: job.files?.length || 0
      });
      setPaymentJob(job);
      setPaymentAmount(job.final_amount != null ? String(job.final_amount) : String(estimate || 0));
      setPaymentMethod(job.payment_method || "cash");
      setPaymentStatus(job.payment_status || "paid");
      setPaymentNote(job.payment_note || "");
      return;
    }
    setBusyId(job.id);
    setError("");
    try {
      const payload = { status, updated_at: new Date().toISOString() };
      if (status === "completed") payload.completed_at = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("print_jobs")
        .update(payload)
        .eq("id", job.id)
        .eq("workspace_id", workspace.id);
      if (updateError) throw updateError;

      // Tell the customer tracking page to fetch the latest status immediately.
      // The customer still validates the real status through the secure RPC.
      try {
        const statusChannel = supabase.channel(`print-job-status-${workspace.id}-${job.id}`);
        await statusChannel.send({
          type: "broadcast",
          event: "status_update",
          payload: { jobId: job.id, status },
        });
        supabase.removeChannel(statusChannel);
      } catch (broadcastError) {
        console.warn("Customer status broadcast failed; polling remains active.", broadcastError);
      }

      await loadJobs();
    } catch (err) {
      console.error("Print job status update failed:", err);
      setError(getSafeUiError(err, "Could not update print job."));
    } finally {
      setBusyId("");
    }
  };

  const completePrintJobWithPayment = async () => {
    if (!paymentJob) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid final amount.");
      return;
    }

    setBusyId(paymentJob.id);
    setError("");
    try {
      const now = new Date().toISOString();
      const payload = {
        status: "completed",
        updated_at: now,
        completed_at: now,
        final_amount: Number(amount.toFixed(2)),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        paid_at: paymentStatus === "paid" ? now : null,
        payment_note: paymentNote.trim() || null
      };
      const { error: updateError } = await supabase
        .from("print_jobs")
        .update(payload)
        .eq("id", paymentJob.id)
        .eq("workspace_id", workspace.id);
      if (updateError) throw updateError;

      try {
        const statusChannel = supabase.channel(`print-job-status-${workspace.id}-${paymentJob.id}`);
        await statusChannel.send({
          type: "broadcast",
          event: "status_update",
          payload: { jobId: paymentJob.id, status: "completed" }
        });
        supabase.removeChannel(statusChannel);
      } catch (broadcastError) {
        console.warn("Customer status broadcast failed; polling remains active.", broadcastError);
      }

      setPaymentJob(null);
      await loadJobs();
    } catch (err) {
      console.error("Print job completion failed:", err);
      setError(getSafeUiError(err, "Could not complete print job."));
    } finally {
      setBusyId("");
    }
  };

  const downloadFile = async (file) => {
    let newWindow = null;

    try {
      setBusyId(file.id);
      setError("");

      // Resolve authentication and the secure URL before opening the document.
      // This avoids leaving a blank tab behind when authentication fails.
      const data = await invokeAuthenticatedFunction("get-print-file-url", {
        body: { fileId: file.id },
      });

      if (!data?.signedUrl) {
        throw new Error(
          data?.error || "Could not create a secure file URL."
        );
      }

      // Open only after the signed URL has been authorized.
      newWindow = window.open(data.signedUrl, "_blank");

      if (!newWindow) {
        throw new Error(
          "Your browser blocked the document window. Please allow pop-ups for CyberCafe Helper."
        );
      }

      try {
        newWindow.opener = null;
      } catch {}

    } catch (err) {
      console.error("Print file download failed:", err);

      if (newWindow && !newWindow.closed) {
        newWindow.close();
      }

      setError(getSafeUiError(err, "Could not open the file."));
    } finally {
      setBusyId("");
    }
  };

  const counts = {
    all: jobs.length,
    pending: jobs.filter((job) => job.status === "pending").length,
    accepted: jobs.filter((job) => job.status === "accepted").length,
    printing: jobs.filter((job) => job.status === "printing").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    rejected: jobs.filter((job) => job.status === "rejected").length,
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayJobs = jobs.filter((job) => new Date(job.created_at).getTime() >= todayStart.getTime());
  const todayCompleted = todayJobs.filter((job) => job.status === "completed").length;
  const todayRejected = todayJobs.filter((job) => job.status === "rejected").length;
  const todayFinished = todayCompleted + todayRejected;
  const todayCompletionRate = todayJobs.length
    ? Math.round((todayCompleted / todayJobs.length) * 100)
    : 0;

  const activeQueueCount = jobs.filter((job) =>
    ["pending", "accepted", "printing"].includes(job.status)
  ).length;

  const filteredJobs = jobs.filter((job) => {
    const isHistoryJob = job.status === "completed" || job.status === "rejected";
    const matchesView = queueView === "history" ? isHistoryJob : !isHistoryJob;
    const matchesStatus = queueView === "history"
      ? (filter === "history" || filter === "all" || job.status === filter)
      : (filter === "all" || job.status === filter);
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      String(job.customer_name || "").toLowerCase().includes(query) ||
      String(job.customer_phone || "").toLowerCase().includes(query) ||
      String(job.id || "").toLowerCase().includes(query);

    let matchesDate = true;
    if (dateFilter !== "all") {
      const created = new Date(job.created_at);
      const now = new Date();
      if (dateFilter === "today") {
        matchesDate = created.toDateString() === now.toDateString();
      } else if (dateFilter === "7days") {
        matchesDate = created.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === "30days") {
        matchesDate = created.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
      }
    }

    return matchesView && matchesStatus && matchesSearch && matchesDate;
  });
  const sortedJobs = [...filteredJobs].sort((a, b) => sortOrder === "oldest" ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at));
  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) : null;

  const statusMeta = {
    pending: { label: "Pending", bg: "#fff7ed", color: "#c2410c", dot: "#f97316" },
    accepted: { label: "Accepted", bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6" },
    printing: { label: "Printing", bg: "#f5f3ff", color: "#6d28d9", dot: "#8b5cf6" },
    completed: { label: "Completed", bg: "#ecfdf5", color: "#047857", dot: "#10b981" },
    rejected: { label: "Rejected", bg: "#fef2f2", color: "#b91c1c", dot: "#ef4444" },
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (value) => {
    const date = new Date(value);
    const diff = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return date.toLocaleDateString();
  };

  const formatExactTime = (value) => {
    const date = new Date(value);
    return date.toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "4px 2px 18px" }}>
        <PageHeading
          eyebrow="PRINT QUEUE"
          title="Print Jobs"
          subtitle={queueView === "history" ? "Review completed and rejected print requests." : "Manage documents submitted through your café QR code."}
        />
        <button
          onClick={toggleNotificationSound}
          title={soundEnabled ? "Mute notification sound" : "Enable notification sound"}
          aria-label={soundEnabled ? "Mute notification sound" : "Enable notification sound"}
          style={{ marginTop: 4, border: "1px solid #dbe4ef", background: "#fff", color: soundEnabled ? "#2563eb" : "#94a3b8", borderRadius: 12, padding: "9px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 10, fontWeight: 800, boxShadow: "0 2px 8px rgba(15,23,42,.04)" }}
        >
          {soundEnabled ? "🔊 Sound on" : "🔇 Sound off"}
        </button>
      </div>

      <style>{`@media (max-width: 640px) { .printJobsPage { width:100%; overflow-x:hidden; } .printJobsHeader { flex-direction:column; gap:10px !important; } .printJobsHeader > button { margin-top:0 !important; align-self:flex-end; } .printJobsTabs { width:100% !important; display:grid !important; grid-template-columns:1fr 1fr; } .printJobsTabs button { width:100%; padding:10px 8px !important; } .printJobsKpis { grid-template-columns:1fr 1fr !important; gap:8px !important; } .printJobsStatusGrid { grid-template-columns:1fr 1fr !important; gap:8px !important; } .printJobsToolbar { align-items:stretch !important; } .printJobsToolbar > div:last-child { width:100% !important; justify-content:stretch !important; } .printJobsToolbar > div:last-child > div { min-width:0 !important; max-width:none !important; flex:1 1 100% !important; } .printJobsToolbar select, .printJobsToolbar .secondaryButton { flex:1 1 auto; min-height:38px; } .printJobsPage section.dashboardCard > div:first-child { padding:13px 14px !important; } .printJobsPage section.dashboardCard > div:nth-child(2) { padding:12px 14px !important; } .printJobsPage section.dashboardCard h3 { font-size:15px !important; } .printJobFiles > div { align-items:flex-start !important; } .printJobFiles .secondaryButton { padding:8px 10px !important; } .printJobActions { justify-content:stretch !important; } .printJobActions button { flex:1 1 140px; min-height:40px; } }`}</style>

      {newJobNotice && (
        <div
          role="status"
          style={{
            marginBottom: 18,
            padding: "13px 15px",
            borderRadius: 15,
            background: "linear-gradient(135deg, #eff6ff, #f8fbff)",
            border: "1px solid #bfdbfe",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 8px 24px rgba(37,99,235,.08)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, display: "grid", placeItems: "center", background: "#dbeafe", color: "#2563eb" }}>
              <Bell size={17} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 850, color: "#1e3a8a" }}>New print request</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {newJobNotice.customerName} just submitted a print job.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setFilter("pending");
              setNewJobNotice(null);
            }}
            style={{
              flexShrink: 0, border: "1px solid #93c5fd", background: "#fff", color: "#1d4ed8",
              borderRadius: 9, padding: "7px 10px", fontSize: 10, fontWeight: 800, cursor: "pointer"
            }}
          >
            View pending
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 18, padding: 5, background: "#eef2f7", borderRadius: 15, width: "fit-content", maxWidth: "100%", border: "1px solid #e5eaf0" }}>
        {[
          ["active", "Active queue", counts.pending + counts.accepted + counts.printing],
          ["history", "History", counts.completed + counts.rejected],
        ].map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => {
              setQueueView(key);
              setFilter(key === "history" ? "history" : "all");
            }}
            style={{
              border: "none",
              background: queueView === key ? "#fff" : "transparent",
              color: queueView === key ? "#0f172a" : "#64748b",
              borderRadius: 10,
              padding: "10px 15px",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 800,
              boxShadow: queueView === key ? "0 2px 8px rgba(15,23,42,.08)" : "none",
            }}
          >
            {label} <span style={{ color: queueView === key ? "#2563eb" : "#94a3b8" }}>({count})</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["Active queue", activeQueueCount, "Jobs waiting or being processed"],
          ["Submitted today", todayJobs.length, "New requests received today"],
          ["Completed today", todayCompleted, `${todayCompletionRate}% completion rate`],
          ["Rejected today", todayRejected, "Requests not processed"]
        ].map(([label, value, helper]) => (
          <div
            key={label}
            className="dashboardCard"
            style={{
              padding: "15px 16px",
              border: "1px solid #e5eaf0",
              background: "linear-gradient(180deg, #fff, #fbfcfe)",
              boxShadow: "0 4px 14px rgba(15,23,42,.035)"
            }}
          >
            <div style={{ color: "#64748b", fontSize: 9, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".55px" }}>
              {label}
            </div>
            <div style={{ marginTop: 4, fontSize: 23, lineHeight: 1.1, fontWeight: 850, color: "#0f172a" }}>
              {value}
            </div>
            <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 9 }}>
              {helper}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[
          ["Pending", counts.pending, "pending"],
          ["Accepted", counts.accepted, "accepted"],
          ["Printing", counts.printing, "printing"],
          ["Completed", counts.completed, "completed"],
          ["Rejected", counts.rejected, "rejected"],
        ].map(([label, count, key]) => {
          const meta = statusMeta[key];
          return (
            <button
              key={key}
              onClick={() => {
                if (key === "completed" || key === "rejected") {
                  setQueueView("history");
                  setFilter(key);
                } else {
                  setQueueView("active");
                  setFilter(key);
                }
              }}
              style={{
                textAlign: "left", border: filter === key ? `2px solid ${meta.dot}` : "1px solid #e2e8f0",
                background: "#fff", borderRadius: 14, padding: "13px 15px", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(15,23,42,.045)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: meta.color, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px" }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: meta.dot }} />{label}
              </div>
              <div style={{ marginTop: 5, fontSize: 25, fontWeight: 850, color: "#0f172a" }}>{count}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16, padding: "12px 13px", border: "1px solid #e5eaf0", borderRadius: 15, background: "#fbfcfe" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(queueView === "history" ? ["history", "completed", "rejected"] : ["all", "pending", "accepted", "printing"]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                border: filter === key ? "1px solid #2563eb" : "1px solid #e2e8f0",
                background: filter === key ? "#eff6ff" : "#fff",
                color: filter === key ? "#1d4ed8" : "#64748b",
                borderRadius: 999, padding: "7px 12px", fontSize: 11, fontWeight: 750, cursor: "pointer"
              }}
            >
              {key === "history" ? "All history" : key === "all" ? "All active" : statusMeta[key].label} {key === "history" ? `(${counts.completed + counts.rejected})` : key !== "all" ? `(${counts[key]})` : `(${counts.pending + counts.accepted + counts.printing})`}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%", justifyContent: "flex-end" }}>
          <div style={{ position: "relative", minWidth: 220, flex: "1 1 260px", maxWidth: 340 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, phone or job ID"
              aria-label="Search print jobs"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #dfe6ee", borderRadius: 11, padding: "10px 11px 10px 31px", fontSize: 11, outline: "none", background: "#fff", color: "#334155", boxShadow: "0 2px 7px rgba(15,23,42,.025)" }}
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter print jobs by date"
            style={{ border: "1px solid #dfe6ee", borderRadius: 11, padding: "10px 10px", fontSize: 11, color: "#475569", background: "#fff", outline: "none" }}
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Sort print jobs" style={{ border: "1px solid #dfe6ee", borderRadius: 11, padding: "10px 10px", fontSize: 11, color: "#475569", background: "#fff", outline: "none" }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <button className="secondaryButton" onClick={loadJobs} disabled={loading} style={{ padding: "9px 12px", borderRadius: 11 }}>
            <RotateCcw size={14} /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {!searchQuery && dateFilter === "all" && todayJobs.length > 0 && (
        <div style={{ marginBottom: 14, color: "#64748b", fontSize: 10 }}>
          Today: <strong style={{ color: "#334155" }}>{todayJobs.length}</strong> submitted ·{" "}
          <strong style={{ color: "#047857" }}>{todayCompleted}</strong> completed ·{" "}
          <strong style={{ color: "#b91c1c" }}>{todayRejected}</strong> rejected.
        </div>
      )}

      {(searchQuery || dateFilter !== "all") && (
        <div style={{ marginBottom: 14, color: "#64748b", fontSize: 10 }}>
          Showing <strong style={{ color: "#334155" }}>{filteredJobs.length}</strong> matching print job{filteredJobs.length === 1 ? "" : "s"}.
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "#fff1f2", color: "#be123c", fontSize: 12 }}>
          {error}
        </div>
      )}

      {loading && !jobs.length ? (
        <div className="dashboardCard" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Loading print queue…
        </div>
      ) : !filteredJobs.length ? (
        <div className="dashboardCard" style={{ padding: 46, textAlign: "center" }}>
          <div style={{ width: 54, height: 54, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "#eff6ff", color: "#2563eb" }}>
            <PrinterIcon size={25} />
          </div>
          <h3 style={{ margin: "0 0 6px" }}>{jobs.length ? "No jobs in this view" : "No print jobs yet"}</h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>
            {jobs.length ? "Try another filter, search, or switch between Active queue and History." : "Jobs submitted through your café QR code will appear here."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sortedJobs.map((job) => {
            const meta = statusMeta[job.status] || statusMeta.pending;
            return (
              <section key={job.id} className="dashboardCard" style={{ padding: 0, overflow: "hidden", border: job.status === "pending" ? "1px solid #fed7aa" : "1px solid #e5eaf0", boxShadow: "0 5px 20px rgba(15,23,42,.045)" }}>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>{job.customer_name}</h3>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: meta.dot }} />{meta.label}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", color: "#64748b", fontSize: 11 }}>
                      {job.customer_phone ? <a href={getSafePhoneUrl(job.customer_phone)} style={{ color: "#475569", textDecoration: "none" }}>☎ {job.customer_phone}</a> : <span>No phone</span>}
                      <span>•</span><span title={`Submitted ${formatExactTime(job.created_at)}`}>{formatTime(job.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ color: "#94a3b8", fontSize: 9, fontFamily: "monospace" }}>JOB</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                      <button title="Copy job ID" aria-label="Copy job ID" onClick={() => navigator.clipboard?.writeText(job.id).catch(() => {})} style={{ border: "none", background: "transparent", padding: 0, color: "#334155", fontSize: 11, fontFamily: "monospace", fontWeight: 750, cursor: "pointer" }}>#{job.id.slice(0, 8).toUpperCase()} · Copy</button>
                      <button onClick={() => setSelectedJobId(job.id)} style={{ border: "1px solid #dbe4ef", background: "#fff", color: "#2563eb", borderRadius: 8, padding: "5px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>Details</button>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "14px 18px" }}>
                  <div style={{ marginBottom: 9, color: "#94a3b8", fontSize: 9, fontWeight: 850, letterSpacing: ".7px", textTransform: "uppercase" }}>Print request</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                    {[
                      ["Mode", job.color_mode === "color" ? "Color" : "B&W"],
                      ["Copies", `${job.copies} ${job.copies === 1 ? "copy" : "copies"}`],
                      ["Paper", job.paper_size],
                      ["Sides", job.duplex ? "Duplex" : "Single-sided"]
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: "10px 11px", border: "1px solid #e5eaf0", background: "#f8fafc", borderRadius: 11 }}>
                        <div style={{ color: "#94a3b8", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
                        <div style={{ marginTop: 3, color: "#334155", fontSize: 11, fontWeight: 800 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 11px", borderRadius: 11, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <div><div style={{ color: "#15803d", fontSize: 8, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".5px" }}>Estimated print price</div><div style={{ marginTop: 3, color: "#166534", fontSize: 9 }}>Based on {job.files.length} file{job.files.length === 1 ? "" : "s"} × {job.copies} {job.duplex ? "with duplex discount" : ""}</div></div>
                    <strong style={{ color: "#166534", fontSize: 16 }}>₹{calculatePrintEstimate({ workspace, colorMode: job.color_mode, paperSize: job.paper_size, copies: job.copies, duplex: job.duplex, fileCount: job.files.length }).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ marginTop: 9, color: "#94a3b8", fontSize: 9 }}>Submitted {formatExactTime(job.created_at)}</div>

                  {job.notes && (
                    <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 10, background: "#f8fafc", color: "#475569", fontSize: 11, lineHeight: 1.5 }}>
                      <strong>Note:</strong> {job.notes}
                    </div>
                  )}

                  <div className="printJobFiles" style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 7 }}>
                    {job.files.map((file) => (
                      <div key={file.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 11px", background: "#fff", border: "1px solid #e5eaf0", borderRadius: 11, boxShadow: "0 2px 8px rgba(15,23,42,.025)" }}>
                        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 9, display: "grid", placeItems: "center", background: "#eff6ff", color: "#2563eb" }}><FileText size={16} /></div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 750, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.file_name}</div>
                            {file.file_size ? <div style={{ marginTop: 2, color: "#94a3b8", fontSize: 9 }}>{formatSize(file.file_size)}</div> : null}
                          </div>
                        </div>
                        <button className="secondaryButton" style={{ padding: "7px 10px", flexShrink: 0 }} onClick={() => downloadFile(file)} disabled={busyId === file.id}>
                          <Download size={13} /> {busyId === file.id ? "Opening…" : "Open"}
                        </button>
                      </div>
                    ))}
                  </div>

                  {(job.status === "pending" || job.status === "accepted" || job.status === "printing") && (
                    <div className="printJobActions" style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      {job.status === "pending" && (
                        <button
                          className="secondaryButton"
                          onClick={() => {
                            const confirmed = window.confirm(
                              `Reject print job #${job.id.slice(0, 8).toUpperCase()} from ${job.customer_name || "this customer"}?`
                            );
                            if (confirmed) updateStatus(job, "rejected");
                          }}
                          disabled={busyId === job.id}
                          style={{ color: "#b91c1c" }}
                        >
                          Reject
                        </button>
                      )}
                      {job.status === "pending" && <button className="primaryButton" onClick={() => updateStatus(job, "accepted")} disabled={busyId === job.id}>{busyId === job.id ? "Accepting…" : "Accept Job"}</button>}
                      {job.status === "accepted" && <button className="primaryButton" onClick={() => updateStatus(job, "printing")} disabled={busyId === job.id}>{busyId === job.id ? "Starting…" : "Start Printing"}</button>}
                      {job.status === "printing" && <button className="primaryButton" onClick={() => updateStatus(job, "completed")} disabled={busyId === job.id}>{busyId === job.id ? "Saving…" : "Complete & Record Payment"}</button>}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {paymentJob && (
        <div role="dialog" aria-modal="true" aria-label="Record print payment" onClick={() => { if (busyId !== paymentJob.id) setPaymentJob(null); }} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,.48)", display: "grid", placeItems: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(430px, 100%)", background: "#fff", borderRadius: 18, padding: 22, boxShadow: "0 24px 70px rgba(15,23,42,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div><div style={{ color: "#64748b", fontSize: 9, fontWeight: 850, letterSpacing: ".7px", textTransform: "uppercase" }}>Complete print job</div><h2 style={{ margin: "5px 0 4px", fontSize: 20 }}>Record payment</h2><div style={{ color: "#64748b", fontSize: 10 }}>{paymentJob.customer_name} · #{paymentJob.id.slice(0, 8).toUpperCase()}</div></div>
              <button className="iconButton" onClick={() => setPaymentJob(null)} disabled={busyId === paymentJob.id} aria-label="Close payment dialog"><X size={18} /></button>
            </div>
            <div style={{ marginTop: 18, padding: 13, borderRadius: 12, background: "#f8fafc", border: "1px solid #e5eaf0" }}>
              <div style={{ color: "#94a3b8", fontSize: 9, textTransform: "uppercase", fontWeight: 800 }}>Estimated amount</div>
              <strong style={{ display: "block", marginTop: 4, fontSize: 18 }}>₹{calculatePrintEstimate({ workspace, colorMode: paymentJob.color_mode, paperSize: paymentJob.paper_size, copies: paymentJob.copies, duplex: paymentJob.duplex, fileCount: paymentJob.files?.length || 0 }).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
            </div>
            <label style={{ display: "block", marginTop: 15, fontSize: 10, fontWeight: 800, color: "#475569" }}>FINAL AMOUNT (₹)<input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} type="number" min="0" step="0.01" className="textInput" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} /></label>
            <label style={{ display: "block", marginTop: 12, fontSize: 10, fontWeight: 800, color: "#475569" }}>PAYMENT STATUS<select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="textInput" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></label>
            <label style={{ display: "block", marginTop: 12, fontSize: 10, fontWeight: 800, color: "#475569" }}>PAYMENT METHOD<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="textInput" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></label>
            <label style={{ display: "block", marginTop: 12, fontSize: 10, fontWeight: 800, color: "#475569" }}>NOTE (OPTIONAL)<input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="e.g. Paid in cash" className="textInput" style={{ width: "100%", marginTop: 6, boxSizing: "border-box" }} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><button className="secondaryButton" onClick={() => setPaymentJob(null)} disabled={busyId === paymentJob.id}>Cancel</button><button className="primaryButton" onClick={completePrintJobWithPayment} disabled={busyId === paymentJob.id}>{busyId === paymentJob.id ? "Saving…" : "Complete & Save Payment"}</button></div>
          </div>
        </div>
      )}
      {selectedJob && (
        <div role="dialog" aria-modal="true" aria-label="Print job details" onClick={() => setSelectedJobId(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.42)", display: "flex", justifyContent: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", height: "100%", overflowY: "auto", background: "#fff", boxShadow: "-12px 0 40px rgba(15,23,42,.18)", padding: 22, boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 16, borderBottom: "1px solid #e5eaf0" }}>
              <div>
                <div style={{ color: "#64748b", fontSize: 9, fontWeight: 850, letterSpacing: ".7px", textTransform: "uppercase" }}>Print job</div>
                <h2 style={{ margin: "5px 0 4px", fontSize: 20, color: "#0f172a" }}>{selectedJob.customer_name}</h2>
                <div style={{ color: "#64748b", fontSize: 10, fontFamily: "monospace" }}>#{selectedJob.id}</div>
              </div>
              <button className="iconButton" onClick={() => setSelectedJobId(null)} aria-label="Close print job details"><X size={19} /></button>
            </div>

            {(() => {
              const meta = statusMeta[selectedJob.status] || statusMeta.pending;
              return (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: meta.dot }} />{meta.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 16 }}>
                    {[
                      ["Customer phone", selectedJob.customer_phone || "Not provided"],
                      ["Submitted", formatExactTime(selectedJob.created_at)],
                      ["Mode", selectedJob.color_mode === "color" ? "Color" : "B&W"],
                      ["Copies", `${selectedJob.copies} ${selectedJob.copies === 1 ? "copy" : "copies"}`],
                      ["Paper", selectedJob.paper_size],
                      ["Sides", selectedJob.duplex ? "Duplex" : "Single-sided"],
                      ["Estimated price", `₹${calculatePrintEstimate({ workspace, colorMode: selectedJob.color_mode, paperSize: selectedJob.paper_size, copies: selectedJob.copies, duplex: selectedJob.duplex, fileCount: selectedJob.files.length }).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`],
                      ["Final amount", selectedJob.final_amount != null ? `₹${Number(selectedJob.final_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Not recorded"],
                      ["Payment", selectedJob.payment_status === "paid" ? `Paid · ${(selectedJob.payment_method || "").toUpperCase()}` : "Unpaid"]
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: "11px 12px", border: "1px solid #e5eaf0", borderRadius: 11, background: "#f8fafc" }}>
                        <div style={{ color: "#94a3b8", fontSize: 8, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".45px" }}>{label}</div>
                        <div style={{ marginTop: 4, color: "#334155", fontSize: 11, fontWeight: 750, wordBreak: "break-word" }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedJob.notes && (
                    <div style={{ marginTop: 14, padding: 12, borderRadius: 11, background: "#f8fafc", border: "1px solid #e5eaf0", color: "#475569", fontSize: 11, lineHeight: 1.55 }}><strong>Customer note:</strong> {selectedJob.notes}</div>
                  )}

                  <div style={{ marginTop: 20 }}>
                    <div style={{ color: "#64748b", fontSize: 9, fontWeight: 850, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 10 }}>Workflow progress</div>
                    {(() => {
                      const stages = [
                        ["pending", "Request received"],
                        ["accepted", "Job accepted"],
                        ["printing", "Printing"],
                        ["completed", "Completed"]
                      ];
                      const currentIndex = selectedJob.status === "rejected" ? 0 : Math.max(0, stages.findIndex(([key]) => key === selectedJob.status));
                      return (
                        <div style={{ border: "1px solid #e5eaf0", borderRadius: 12, padding: "11px 12px", background: "#fbfcfe" }}>
                          {stages.map(([key, label], index) => {
                            const done = selectedJob.status !== "rejected" && index < currentIndex;
                            const current = selectedJob.status !== "rejected" && index === currentIndex;
                            const rejected = selectedJob.status === "rejected" && index === 0;
                            return (
                              <div key={key} style={{ display: "flex", gap: 10, minHeight: index === stages.length - 1 ? 22 : 38 }}>
                                <div style={{ width: 18, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                                  <div style={{ width: 10, height: 10, borderRadius: 99, background: rejected ? "#ef4444" : done || current ? "#2563eb" : "#cbd5e1", boxShadow: current ? "0 0 0 4px #dbeafe" : "none" }} />
                                  {index < stages.length - 1 && <div style={{ width: 1, flex: 1, marginTop: 3, background: done ? "#93c5fd" : "#e2e8f0" }} />}
                                </div>
                                <div style={{ paddingBottom: index === stages.length - 1 ? 0 : 8, marginTop: -2 }}>
                                  <div style={{ fontSize: 10, fontWeight: current || rejected ? 800 : 700, color: rejected ? "#b91c1c" : done || current ? "#334155" : "#94a3b8" }}>{rejected ? "Request rejected" : label}</div>
                                  {index === 0 && <div style={{ marginTop: 2, fontSize: 8, color: "#94a3b8" }}>{formatExactTime(selectedJob.created_at)}</div>}
                                  {index === stages.length - 1 && selectedJob.completed_at && <div style={{ marginTop: 2, fontSize: 8, color: "#94a3b8" }}>{formatExactTime(selectedJob.completed_at)}</div>}
                                  {current && <div style={{ marginTop: 2, fontSize: 8, color: "#2563eb", fontWeight: 750 }}>Current stage</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <div style={{ color: "#64748b", fontSize: 9, fontWeight: 850, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 9 }}>Files ({selectedJob.files.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedJob.files.map((file) => (
                        <div key={file.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 12px", border: "1px solid #e5eaf0", borderRadius: 11 }}>
                          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                            <div style={{ width: 31, height: 31, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center", background: "#eff6ff", color: "#2563eb" }}><FileText size={15} /></div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 750, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.file_name}</div>
                              {file.file_size ? <div style={{ marginTop: 2, color: "#94a3b8", fontSize: 9 }}>{formatSize(file.file_size)}</div> : null}
                            </div>
                          </div>
                          <button className="secondaryButton" onClick={() => downloadFile(file)} disabled={busyId === file.id} style={{ padding: "7px 9px", flexShrink: 0 }}><Download size={12} /> Open</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedJob.status !== "pending" && selectedJob.completed_at && (
                    <div style={{ marginTop: 18, color: "#64748b", fontSize: 10 }}>Completed/closed: <strong style={{ color: "#334155" }}>{formatExactTime(selectedJob.completed_at)}</strong></div>
                  )}

                  {(selectedJob.status === "pending" || selectedJob.status === "accepted" || selectedJob.status === "printing") && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 22, paddingTop: 16, borderTop: "1px solid #e5eaf0" }}>
                      {selectedJob.status === "pending" && <button className="secondaryButton" onClick={() => { setSelectedJobId(null); const confirmed = window.confirm(`Reject print job #${selectedJob.id.slice(0, 8).toUpperCase()} from ${selectedJob.customer_name || "this customer"}?`); if (confirmed) updateStatus(selectedJob, "rejected"); }} style={{ color: "#b91c1c" }}>Reject</button>}
                      {selectedJob.status === "pending" && <button className="primaryButton" onClick={() => updateStatus(selectedJob, "accepted")}>Accept Job</button>}
                      {selectedJob.status === "accepted" && <button className="primaryButton" onClick={() => updateStatus(selectedJob, "printing")}>Start Printing</button>}
                      {selectedJob.status === "printing" && <button className="primaryButton" onClick={() => updateStatus(selectedJob, "completed")}>Mark Completed</button>}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function QRCustomerLanding({ workspaceId, onSignIn, onSignUp }) {
  const formatUploadFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [colorMode, setColorMode] = useState("bw");
  const [copies, setCopies] = useState(1);
  const [paperSize, setPaperSize] = useState("A4");
  const [duplex, setDuplex] = useState(false);
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [trackedJob, setTrackedJob] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const customerPrintEstimate = useMemo(() => calculatePrintEstimate({ workspace: workspaceInfo, colorMode, paperSize, copies, duplex, fileCount: files.length }), [workspaceInfo, colorMode, paperSize, copies, duplex, files.length]);

  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") return;
    const savedJobId = localStorage.getItem(`cc_print_job_${workspaceId}`);
    if (!savedJobId) return;

    setTrackedJob({ id: savedJobId });
    setSuccess({ id: savedJobId });
  }, [workspaceId]);

  const loadTrackedJob = async (jobId) => {
    if (!jobId || !workspaceId) return;
    setTrackingLoading(true);
    setTrackingError("");
    try {
      const { data, error } = await supabase.rpc("get_public_print_job_status", {
        p_job_id: jobId,
        p_workspace_id: workspaceId
      });
      if (error) throw error;
      const job = Array.isArray(data) ? data[0] || null : data || null;
      if (!job) throw new Error("This print request could not be found.");
      setTrackedJob(job);
    } catch (err) {
      console.error("Print job tracking failed:", err);
      setTrackingError(err?.message || "Could not load print request status.");
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (!trackedJob?.id || !workspaceId) return;

    const jobId = trackedJob.id;
    loadTrackedJob(jobId);
    const interval = setInterval(() => loadTrackedJob(jobId), 10000);
    // Listen for an immediate status-change signal from the café dashboard.
    // We still call the public RPC after receiving it, so the database remains
    // the source of truth and the broadcast itself cannot spoof a status.
    const channel = supabase
      .channel(`print-job-status-${workspaceId}-${jobId}`)
      .on(
        "broadcast",
        { event: "status_update" },
        (payload) => {
          if (payload?.payload?.jobId === jobId) {
            loadTrackedJob(jobId);
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Print job status realtime subscription failed; polling remains active.");
        }
      });

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [trackedJob?.id, workspaceId]);

  useEffect(() => {
    let mounted = true;
    const loadWorkspace = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc("get_public_workspace", {
          p_workspace_id: workspaceId
        });
        const workspace = Array.isArray(data) ? data[0] || null : data || null;
        if (error) console.error("QR workspace lookup failed:", error);
        if (mounted) setWorkspaceInfo(workspace);
      } catch (error) {
        console.error("QR workspace lookup failed:", error);
        if (mounted) setWorkspaceInfo(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadWorkspace();
    return () => { mounted = false; };
  }, [workspaceId]);

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    setError("");

    if (!selected.length) return;

    const existingKeys = new Set(
      files.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
    );

    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "doc", "docx"];
    const maxFileBytes = 10 * 1024 * 1024;
    const validFiles = [];
    const rejectedFiles = [];

    selected.forEach((file) => {
      const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
      if (!allowedExtensions.includes(extension)) {
        rejectedFiles.push(`${file.name}: unsupported format`);
        return;
      }
      if (file.size > maxFileBytes) {
        rejectedFiles.push(`${file.name}: over 10 MB`);
        return;
      }
      validFiles.push(file);
    });

    if (rejectedFiles.length) {
      setError(`Some files were not added. ${rejectedFiles.slice(0, 2).join("; ")}${rejectedFiles.length > 2 ? "; and more." : "."}`);
    }

    const newFiles = validFiles.filter(
      (file) =>
        !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`)
    );

    const combined = [...files, ...newFiles];

    if (combined.length > 10) {
      setError("You can upload up to 10 files.");
    }

    setFiles(combined.slice(0, 10));

    // Allow selecting the same file again after removing it.
    event.target.value = "";
  };

  const removeFile = (indexToRemove) => {
    setFiles((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  };

  const submitJob = async (event) => {
    event.preventDefault();
    setError("");
    if (!workspaceInfo?.id) return setError("This café could not be found.");
    if (!customerName.trim()) return setError("Please enter your name.");
    if (!files.length) return setError("Please upload at least one document.");
    if (files.length > 10) return setError("You can upload up to 10 files.");

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("workspaceId", workspaceInfo.id);
      formData.append("customerName", customerName.trim());
      formData.append("customerPhone", customerPhone.trim());
      formData.append("colorMode", colorMode);
      formData.append("copies", String(copies));
      formData.append("paperSize", paperSize);
      formData.append("duplex", String(duplex));
      formData.append("notes", notes.trim());
      files.forEach((file) => formData.append("files", file, file.name));

      const response = await fetch("https://nfwxxbwjdfadnolmzcxc.supabase.co/functions/v1/submit-print-job", {
        method: "POST",
        body: formData
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || "Could not submit the print request.");
      setSuccess(result.job);
      setTrackedJob(result.job);
      if (typeof window !== "undefined" && result.job?.id) {
        localStorage.setItem(`cc_print_job_${workspaceId}`, result.job.id);
      }
      setFiles([]);
      setCustomerName("");
      setCustomerPhone("");
      setNotes("");
    } catch (err) {
      console.error("Print job submission failed:", err);
      setError(getSafeUiError(err, "Could not submit the print request."));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    const status = trackedJob?.status || "pending";
    const statusMeta = {
      pending: { label: "Request received", color: "#2563eb", bg: "#eff6ff", text: "The café has received your print request." },
      accepted: { label: "Accepted", color: "#7c3aed", bg: "#f5f3ff", text: "The café has accepted your request." },
      printing: { label: "Printing now", color: "#d97706", bg: "#fffbeb", text: "Your documents are currently being printed." },
      completed: { label: "Completed", color: "#059669", bg: "#ecfdf5", text: "Your print request has been completed." },
      rejected: { label: "Rejected", color: "#be123c", bg: "#fff1f2", text: "The café could not process this print request." }
    }[status] || { label: status, color: "#64748b", bg: "#f8fafc", text: "Your print request status is being updated." };

    const clearTracking = () => {
      if (typeof window !== "undefined") localStorage.removeItem(`cc_print_job_${workspaceId}`);
      setTrackedJob(null);
      setSuccess(null);
      setTrackingError("");
    };

    return (
      <div className="qrCustomerPortal qrCustomerPortalSuccess" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f8fafc", fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <div className="dashboardCard qrSuccessCard" style={{ width: "100%", maxWidth: 520, padding: 30 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 60, height: 60, margin: "0 auto 16px", borderRadius: 18, display: "grid", placeItems: "center", background: statusMeta.bg, color: statusMeta.color }}><PrinterIcon size={30} /></div>
            <span style={{ color: "#2563eb", fontSize: 10, fontWeight: 850, letterSpacing: 1.4 }}>THANK YOU · PRINT REQUEST RECEIVED</span>
            <h1 className="qrSuccessTitle" style={{ margin: "8px 0 6px", fontSize: 26 }}>{workspaceInfo?.name || "Café"}</h1>
            <p style={{ margin: "0 auto", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>Track your request here. This page checks for status updates automatically.</p>
          </div>

          <div className="qrSuccessStatus" style={{ marginTop: 22, padding: 18, borderRadius: 16, background: statusMeta.bg, border: `1px solid ${statusMeta.color}22`, textAlign: "center" }}>
            <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Current status</div>
            <strong style={{ display: "block", marginTop: 6, color: statusMeta.color, fontSize: 20 }}>{statusMeta.label}</strong>
            <p style={{ margin: "7px 0 0", color: "#475569", fontSize: 11 }}>{statusMeta.text}</p>
          </div>

          {trackedJob?.estimated_price != null && (
            <div style={{ marginTop: 14, padding: 15, borderRadius: 14, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <div style={{ color: "#15803d", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Estimated price</div>
              <strong style={{ display: "block", marginTop: 5, color: "#166534", fontSize: 22 }}>₹{Number(trackedJob.estimated_price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
              <div style={{ marginTop: 4, color: "#4d7c5a", fontSize: 9 }}>Final amount may be adjusted by the café if the document requires a different page count.</div>
            </div>
          )}

          <div style={{ marginTop: 14, padding: 15, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Job number</div>
            <strong style={{ display: "block", marginTop: 5, fontSize: 21, fontFamily: "monospace" }}>#{success.id.slice(0, 8).toUpperCase()}</strong>
            {trackedJob?.updated_at && <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 10 }}>Last updated {new Date(trackedJob.updated_at).toLocaleTimeString()}</div>}
          </div>

          {trackingLoading && <div style={{ marginTop: 12, textAlign: "center", color: "#64748b", fontSize: 10 }}>Checking latest status…</div>}
          {trackingError && <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "#fff1f2", color: "#be123c", fontSize: 11 }}>{trackingError}</div>}

          <button className="primaryButton" style={{ width: "100%", marginTop: 18 }} onClick={clearTracking}>Send another request</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .qrCustomerPortal,
        .qrCustomerPortal * {
          box-sizing: border-box;
        }

        .qrCustomerPortal {
          width: 100%;
          overflow-x: hidden;
          -webkit-text-size-adjust: 100%;
        }

        .qrCustomerPortal input,
        .qrCustomerPortal select,
        .qrCustomerPortal textarea,
        .qrCustomerPortal button {
          -webkit-tap-highlight-color: transparent;
        }

        .qrCustomerPortal .input {
          min-height: 46px;
          border-radius: 11px;
        }

        .qrCustomerPortal .qrPortalContainer {
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
        }

        .qrCustomerPortal .qrPortalForm {
          width: 100%;
        }

        .qrCustomerPortal .qrPortalTwoColumn {
          width: 100%;
        }

        .qrCustomerPortal .qrPortalPrice {
          width: 100%;
        }

        .qrTrustRow span {
          display: inline-flex; align-items: center; padding: 5px 8px; border-radius: 999px;
          background: #ffffff; border: 1px solid #e2e8f0; color: #64748b; font-size: 9px; font-weight: 650;
        }
        .qrFormIntro, .qrFormSectionHeader {
          display: flex; align-items: flex-start; gap: 10px; margin-bottom: 11px;
        }
        .qrFormSectionHeader { margin-top: 2px; margin-bottom: -2px; }
        .qrFormStep {
          width: 25px; height: 25px; flex: 0 0 25px; border-radius: 8px; display: grid; place-items: center;
          background: #eff6ff; color: #2563eb; font-size: 10px; font-weight: 850;
        }
        .qrFormIntro strong, .qrFormSectionHeader strong { display: block; color: #1e293b; font-size: 12px; }
        .qrFormIntro span, .qrFormSectionHeader span { display: block; margin-top: 2px; color: #94a3b8; font-size: 9px; line-height: 1.45; }

        .qrUploadBox { transition: border-color .18s ease, background .18s ease, transform .18s ease, box-shadow .18s ease; }
        .qrUploadBox:hover { border-color:#60a5fa !important; background:#f0f7ff !important; }
        .qrUploadBox:active { transform:scale(.995); }
        .qrUploadIcon { width:48px; height:48px; margin:0 auto; border-radius:14px; display:grid; place-items:center; background:#eaf2ff; color:#2563eb; }
        .qrUploadCta { display:inline-flex; align-items:center; justify-content:center; margin-top:10px; padding:9px 14px; border-radius:10px; background:#2563eb; color:#fff; font-size:10px; font-weight:800; }
        .qrUploadMeta { display:flex; justify-content:center; flex-wrap:wrap; gap:6px; margin-top:9px; color:#94a3b8; font-size:8px; }
        .qrSelectedHeader { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:12px 0 7px; }
        .qrSelectedHeader strong { color:#334155; font-size:10px; }
        .qrTrackingTimeline { display:flex; align-items:flex-start; width:100%; margin-top:16px; padding:4px 2px 2px; }
        .qrTrackingStage { min-width:58px; flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:6px; color:#94a3b8; font-size:8px; font-weight:700; text-align:center; }
        .qrTrackingDot { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; background:#e2e8f0; color:#94a3b8; font-size:9px; font-weight:850; border:2px solid #fff; box-shadow:0 0 0 1px #e2e8f0; }
        .qrTrackingStage.done { color:#166534; }
        .qrTrackingStage.done .qrTrackingDot { background:#dcfce7; color:#15803d; box-shadow:0 0 0 1px #bbf7d0; }
        .qrTrackingStage.current { color:#1d4ed8; }
        .qrTrackingStage.current .qrTrackingDot { background:#dbeafe; color:#2563eb; box-shadow:0 0 0 2px #bfdbfe; }
        .qrTrackingLine { flex:1; min-width:10px; height:2px; margin:13px 2px 0; background:#e2e8f0; border-radius:99px; }
        .qrTrackingLine.done { background:#86efac; }
        .qrTrackingTimeline.rejected .qrTrackingStage:first-child { color:#be123c; }
        .qrTrackingTimeline.rejected .qrTrackingStage:first-child .qrTrackingDot { background:#ffe4e6; color:#be123c; box-shadow:0 0 0 1px #fecdd3; }
        .qrSelectedHeader button { border:0; background:transparent; color:#64748b; font-size:9px; font-weight:700; cursor:pointer; padding:4px 0; }
        .qrFileTotal { display:flex; justify-content:space-between; gap:8px; margin-top:7px; color:#94a3b8; font-size:8px; }
        @media (max-width: 600px) {
          .qrTrackingTimeline {
            display:flex;
            flex-direction:column;
            align-items:stretch;
            gap:0;
            margin-top:16px;
            padding:4px 2px;
          }
          .qrTrackingStage {
            min-width:0;
            width:100%;
            flex:0 0 auto;
            flex-direction:row;
            justify-content:flex-start;
            align-items:center;
            gap:11px;
            padding:8px 4px;
            font-size:10px;
            text-align:left;
          }
          .qrTrackingDot {
            width:30px;
            height:30px;
            flex:0 0 30px;
          }
          .qrTrackingLine {
            flex:0 0 auto;
            width:2px;
            min-width:2px;
            height:14px;
            margin:0 0 0 18px;
            border-radius:99px;
          }
          .qrCustomerPortal {
            min-height: 100dvh !important;
            padding: 16px 12px 28px !important;
          }

          .qrCustomerPortal .qrPortalContainer {
            max-width: 100%;
          }

          .qrCustomerPortal .qrPortalHeader {
            margin-bottom: 14px !important;
          }

          .qrCustomerPortal .qrPortalHeader h1 {
            font-size: 23px !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere;
          }

          .qrCustomerPortal .qrPortalHeader p {
            font-size: 11px !important;
            line-height: 1.5 !important;
          }

          .qrCustomerPortal .qrPortalForm {
            padding: 15px !important;
            border-radius: 16px !important;
          }

          .qrCustomerPortal .qrPortalTwoColumn {
            grid-template-columns: 1fr !important;
            gap: 11px !important;
          }

          .qrCustomerPortal .input {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 48px !important;
            padding: 12px 13px !important;
            font-size: 16px !important;
            border-radius: 12px !important;
          }

          .qrCustomerPortal select.input {
            padding-right: 34px !important;
          }

          .qrCustomerPortal textarea.input {
            min-height: 84px;
          }

          .qrCustomerPortal .qrUploadBox {
            padding: 16px 12px !important;
          }

          .qrCustomerPortal .qrUploadHint {
            line-height: 1.45 !important;
          }

          .qrCustomerPortal .qrFileRow {
            min-width: 0;
          }

          .qrCustomerPortal .qrFileName {
            max-width: 100%;
          }

          .qrCustomerPortal .qrFileFooter {
            gap: 8px !important;
            flex-wrap: wrap;
          }

          .qrCustomerPortal .qrPortalPrice {
            align-items: center !important;
            padding: 13px !important;
            gap: 10px !important;
          }

          .qrCustomerPortal .qrPortalPrice > div:first-child {
            min-width: 0;
          }

          .qrCustomerPortal .qrPortalPriceAmount {
            white-space: nowrap;
          }

          .qrCustomerPortal .qrPortalPriceAmount {
            flex-shrink: 0;
            font-size: 19px !important;
          }

          .qrCustomerPortal .primaryButton {
            width: 100%;
            min-height: 50px;
            padding: 12px 16px !important;
            font-size: 14px;
            border-radius: 12px !important;
          }

          .qrCustomerPortal .qrFileRow {
            width: 100%;
            overflow: hidden;
          }

          .qrCustomerPortal .qrFileName {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .qrCustomerPortalSuccess {
            display: block !important;
            padding: 16px 12px 28px !important;
          }

          .qrCustomerPortalSuccess .qrSuccessCard {
            max-width: 100% !important;
            padding: 20px 15px !important;
            border-radius: 16px !important;
          }

          .qrCustomerPortalSuccess .qrSuccessTitle {
            font-size: 23px !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere;
          }

          .qrCustomerPortalSuccess .qrSuccessStatus {
            padding: 14px !important;
          }
        }

        @media (max-width: 420px) {
          .qrCustomerPortal .qrPortalHeader h1 {
            font-size: 22px !important;
          }

          .qrCustomerPortal .qrPortalHeader p {
            max-width: 320px;
            margin-left: auto !important;
            margin-right: auto !important;
          }

          .qrCustomerPortal .qrPortalForm {
            padding: 13px !important;
          }

          .qrCustomerPortal .qrPortalTwoColumn {
            gap: 10px !important;
          }

          .qrCustomerPortal .qrPortalPrice {
            align-items: flex-start !important;
          }

          .qrCustomerPortal .qrPortalPriceAmount {
            font-size: 18px !important;
          }
        }

        @media (max-width: 360px) {
          .qrCustomerPortal {
            padding-left: 9px !important;
            padding-right: 9px !important;
          }

          .qrCustomerPortal .qrPortalForm,
          .qrCustomerPortalSuccess .qrSuccessCard {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .qrCustomerPortal .qrPortalHeader h1,
          .qrCustomerPortalSuccess .qrSuccessTitle {
            font-size: 21px !important;
          }
        }
      `}</style>
      <div className="qrCustomerPortal" style={{ minHeight: "100vh", padding: "24px 16px 40px", background: "#f8fafc", color: "#0f172a", fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div className="qrPortalContainer" style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div className="qrPortalHeader" style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "#eff6ff", color: "#2563eb" }}><QrCode size={25} /></div>
          <span style={{ color: "#2563eb", fontSize: 10, fontWeight: 850, letterSpacing: 1.4 }}>CYBERCAFE HELPER</span>
          <h1 style={{ margin: "7px 0 5px", fontSize: 27 }}>{loading ? "Opening café portal…" : workspaceInfo?.name || "Customer Print Portal"}</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>Send your documents to this café and collect your prints when they are ready.</p>
          <div className="qrTrustRow" style={{ marginTop: 12, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 7 }}>
            <span>🔒 Files sent securely</span><span>•</span><span>Quick print pickup</span>
          </div>
        </div>

        {!loading && !workspaceInfo && (
          <div className="dashboardCard" style={{ padding: 16, color: "#be123c", marginBottom: 14 }}>This café QR code could not be resolved. Please ask the café owner for a new QR code.</div>
        )}

        {workspaceInfo && (
          <form onSubmit={submitJob} className="dashboardCard qrPortalForm" style={{ padding: 20 }}>
            <div className="qrFormIntro">
              <div className="qrFormStep">1</div>
              <div><strong>Your details</strong><span>Tell the café who the print request belongs to.</span></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Your name<input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter your name" required /></label>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Phone number <span style={{ color: "#94a3b8", fontWeight: 500 }}>(optional)</span><input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="9876543210" inputMode="tel" /></label>

              <div>
                <div className="qrFormSectionHeader"><div className="qrFormStep">2</div><div><strong>Upload documents</strong><span>Choose the files you want this café to print.</span></div></div>
                <label className="qrUploadBox" style={{ display: "block", padding: 20, border: "1.5px dashed #93c5fd", borderRadius: 15, background: "#f8fbff", textAlign: "center", cursor: "pointer" }}>
                  <div className="qrUploadIcon"><Upload size={21} /></div>
                  <strong style={{ display: "block", marginTop: 10, fontSize: 13, color: "#1e293b" }}>
                    {files.length ? `${files.length} document${files.length > 1 ? "s" : ""} ready` : "Choose your documents"}
                  </strong>
                  <span className="qrUploadHint" style={{ display: "block", marginTop: 5, color: "#64748b", fontSize: 10 }}>
                    {files.length ? "Tap here to add more files" : "Select one or multiple files from your phone"}
                  </span>
                  <span className="qrUploadCta">{files.length ? "＋ Add more files" : "Choose files"}</span>
                  <div className="qrUploadMeta"><span>PDF</span><span>•</span><span>JPG</span><span>•</span><span>PNG</span><span>•</span><span>DOC/DOCX</span><span>•</span><span>10 MB each</span></div>
                  <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFiles} style={{ display: "none" }} />
                </label>
                {files.length > 0 && (
  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
    <div className="qrSelectedHeader">
      <strong>{files.length} selected {files.length === 1 ? "file" : "files"}</strong>
      <button type="button" onClick={() => setFiles([])}>Remove all</button>
    </div>
    {files.map((file, index) => (
      <div
        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "9px 10px",
          background: "#f8fafc",
          border: "1px solid #e5eaf0",
          borderRadius: 10
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: "#eff6ff",
            color: "#2563eb"
          }}
        >
          <FileText size={14} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 750,
              color: "#334155",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
            title={file.name}
          >
            {file.name}
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 9,
              color: "#94a3b8"
            }}
          >
            {formatUploadFileSize(file.size)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeFile(index)}
          aria-label={`Remove ${file.name}`}
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            border: "none",
            borderRadius: 8,
            background: "#fff1f2",
            color: "#be123c",
            cursor: "pointer",
            fontSize: 17,
            lineHeight: 1
          }}
        >
          ×
        </button>
      </div>
    ))}

    <div className="qrFileTotal">
      <span>{files.length} of 10 files selected</span>
      <span>{(files.reduce((total, file) => total + (file.size || 0), 0) / (1024 * 1024)).toFixed(1)} MB total</span>
    </div>
  </div>
)}
              </div>

              <div className="qrFormSectionHeader"><div className="qrFormStep">3</div><div><strong>Print settings</strong><span>Choose how you'd like your documents printed.</span></div></div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Color<select className="input" value={colorMode} onChange={(e) => setColorMode(e.target.value)}><option value="bw">B&W</option><option value="color">Color</option></select></label>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Paper size<select className="input" value={paperSize} onChange={(e) => setPaperSize(e.target.value)}><option>A4</option><option>A3</option><option>Letter</option><option>Legal</option></select></label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Copies<input className="input" type="number" min="1" max="999" value={copies} onChange={(e) => { const value = e.target.value; if (value === "") { setCopies(""); return; } const number = Number(value); if (Number.isFinite(number)) setCopies(Math.min(999, Math.max(1, number))); }} onBlur={() => { if (copies === "" || !Number.isFinite(Number(copies))) setCopies(1); }} /></label>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Printing<select className="input" value={duplex ? "duplex" : "single"} onChange={(e) => setDuplex(e.target.value === "duplex")}><option value="single">Single-sided</option><option value="duplex">Duplex</option></select></label>
              </div>

              <label style={{ fontSize: 12, fontWeight: 700 }}>Notes <span style={{ color: "#94a3b8", fontWeight: 500 }}>(optional)</span><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special instructions" rows="3" style={{ resize: "vertical" }} /></label>

              <div className="qrPortalPrice" style={{ padding: 14, borderRadius: 13, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div><div style={{ color: "#15803d", fontSize: 9, fontWeight: 850, textTransform: "uppercase", letterSpacing: ".8px" }}>Estimated price</div><div style={{ marginTop: 4, color: "#4d7c5a", fontSize: 9 }}>Based on {files.length} file{files.length === 1 ? "" : "s"} × {copies} {copies === 1 ? "copy" : "copies"}{duplex ? " · duplex discount applied" : ""}</div></div>
                <strong className="qrPortalPriceAmount" style={{ color: "#166534", fontSize: 21 }}>₹{customerPrintEstimate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
              </div>

              {error && <div style={{ padding: 10, borderRadius: 10, background: "#fff1f2", color: "#be123c", fontSize: 11 }}>{error}</div>}

              <button type="submit" className="primaryButton" disabled={submitting || loading || !workspaceInfo}>{submitting ? "Sending documents…" : "Send Print Request"}</button>
            </div>
          </form>
        )}

        {workspaceInfo?.phone && <div style={{ textAlign: "center", marginTop: 14, color: "#94a3b8", fontSize: 10 }}>Café contact: {workspaceInfo.phone}</div>}
      </div>
      </div>
    </>
  );
}

function App({ user, onSignOut, workspace, userProfile, workspaceRole }) {
  // Workspace membership is the source of truth for permissions.
  const role = workspaceRole || "owner";
  const isOwnerOrAdmin = role === "owner" || role === "admin";
  const isStaff = role === "staff";
  const isCustomer = role === "customer";

  const [page, setPage] = useState("Dashboard");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState(() => { const saved = localStorage.getItem("cc_theme"); return saved === "dark" ? "dark" : "light"; });

  // Remove legacy browser copies of workspace/customer data. Auth/session state remains
  // managed by Supabase Auth; only non-sensitive UI preferences and the public print
  // tracking ID are allowed to remain in localStorage.
  useEffect(() => {
    ["cc_tasks", "cc_links", "cc_service_templates", "cc_business_profile"].forEach((key) => {
      try { localStorage.removeItem(key); } catch {}
    });
  }, []);

  // Customer records are loaded from Supabase only. Never persist customer PII in browser storage.
  const [tasks, setTasks] = useState([])

  // Quick links are workspace data; keep them in Supabase rather than localStorage.
  const [links, setLinks] = useState([])

  const [modal, setModal] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [reminderCustomer, setReminderCustomer] = useState(null);
  const [aiCustomer, setAiCustomer] = useState(null);
  const [customerAccessCustomer, setCustomerAccessCustomer] = useState(null);

  const [serviceTemplates, setServiceTemplates] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [workspaceUsage, setWorkspaceUsage] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const proCheckoutInFlightRef = useRef(false);
  const [proCheckoutLoading, setProCheckoutLoading] = useState(false);
  const planLimits = useMemo(() => getPlanLimits(subscription), [subscription]);
  const subscriptionLifecycle = useMemo(() => getSubscriptionLifecycle(subscription), [subscription]);

  // Warm up Razorpay Checkout as soon as an owner/admin has a workspace.
  // Without this preload, the first Upgrade click can be spent loading the
  // checkout SDK, which makes the button appear to require a second click.
  useEffect(() => {
    if (!workspace?.id || !isOwnerOrAdmin) return;
    loadRazorpayCheckoutScript().catch((error) => {
      console.warn("Razorpay Checkout preload failed:", error);
    });
  }, [workspace?.id, isOwnerOrAdmin]);

  const [businessProfile, setBusinessProfile] = useState(() => ({
    businessName: workspace?.name || user?.user_metadata?.business_name || "CyberCafe Helper",
    ownerName: user?.user_metadata?.owner_name || "",
    phone: workspace?.phone || "",
    address: workspace?.address || "",
    gstin: workspace?.gstin || "",
    receiptFooter: user?.user_metadata?.receipt_footer || "Thank you for using our services."
  }));

  useEffect(() => {
    if (!workspace && !user) return;
    setBusinessProfile((prev) => ({
      ...prev,
      businessName: workspace?.name || user?.user_metadata?.business_name || prev.businessName || "CyberCafe Helper",
      phone: workspace?.phone ?? prev.phone,
      address: workspace?.address ?? prev.address,
      gstin: workspace?.gstin ?? prev.gstin,
      ownerName: user?.user_metadata?.owner_name ?? prev.ownerName,
      receiptFooter: user?.user_metadata?.receipt_footer ?? prev.receiptFooter
    }));
  }, [workspace?.id, user?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadCustomers = async () => {
      if (!workspace?.id) return;

      // Customer accounts must never load the workspace-wide customer list.
      // Their record is fetched only through get_my_customer_workspace().
      if (isCustomer) {
        setTasks([]);
        return;
      }

      try {
        const customers = await getCustomersFromSupabase(workspace.id);
        const customerIds = customers.map((customer) => customer.id);
        const payments = await getPaymentsFromSupabase(
          workspace.id,
          customerIds
        );
        const followUps = await getFollowUpsFromSupabase(
          workspace.id,
          customerIds
        );
        const paymentsByCustomer = payments.reduce((map, payment) => {
          if (!map[payment.customerId]) map[payment.customerId] = [];
          map[payment.customerId].push(payment);
          return map;
        }, {});

        const followUpsByCustomer = followUps.reduce((map, followUp) => {
          if (!map[followUp.customerId]) map[followUp.customerId] = [];
          map[followUp.customerId].push(followUp);
          return map;
        }, {});

        const hydratedCustomers = customers.map((customer) => {
          const customerPayments = paymentsByCustomer[customer.id] || [];
          const customerFollowUps = followUpsByCustomer[customer.id] || [];
          const paidFromPayments = customerPayments.reduce(
            (sum, payment) => sum + Number(payment.amount || 0),
            0
          );
          return normalizeTask({
            ...customer,
            paid: customerPayments.length ? paidFromPayments : customer.paid,
            payments: customerPayments,
            followUps: customerFollowUps
          });
        });

        if (!cancelled) {
          setTasks(hydratedCustomers);
          setSelectedCustomer(null);
          setEditingCustomer(null);
        }
      } catch (error) {
        console.error("Failed to load customers from Supabase:", error);
        if (!cancelled) {
          alert(`Could not load customers from Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
        }
      }
    };

    loadCustomers();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadQuickLinks = async () => {
      if (!workspace?.id) return;

      try {
        const remoteLinks = await getQuickLinksFromSupabase(workspace.id);
        if (!cancelled) setLinks(remoteLinks);
      } catch (error) {
        console.error("Failed to load quick links from Supabase:", error);
        // Keep the local copy as a safe fallback during migration.
      }
    };

    loadQuickLinks();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadTeam = async () => {
      if (!workspace?.id || !isOwnerOrAdmin) {
        setTeamMembers([]);
        return;
      }

      setTeamLoading(true);
      try {
        const members = await getWorkspaceTeamMembers(workspace.id);
        if (!cancelled) setTeamMembers(members);
      } catch (error) {
        console.error("Failed to load team members:", error);
        if (!cancelled) setTeamMembers([]);
      } finally {
        if (!cancelled) setTeamLoading(false);
      }
    };

    loadTeam();
    return () => { cancelled = true; };
  }, [workspace?.id, isOwnerOrAdmin]);

  useEffect(() => {
    let cancelled = false;
    const loadBilling = async () => {
      if (!workspace?.id || !isOwnerOrAdmin) {
        setSubscription(null);
        setWorkspaceUsage(null);
        return;
      }
      setBillingLoading(true);
      setBillingError("");
      try {
        // Refresh lifecycle first so an expired trial is reflected immediately.
        await refreshWorkspaceSubscriptionStatus(workspace.id);
        const billingData = await getWorkspaceBilling(workspace.id);

        if (!cancelled) {
          setSubscription(billingData?.subscription || null);
          setWorkspaceUsage(billingData?.usage || null);
        }
      } catch (error) {
        console.error("Failed to load billing information:", error);
        if (!cancelled) setBillingError(error?.message || "Could not load plan information.");
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    };
    loadBilling();
    return () => { cancelled = true; };
  }, [workspace?.id, isOwnerOrAdmin]);

  useEffect(() => {
    if (!workspace?.id || !isOwnerOrAdmin) return;
    const lifecycleTimer = setInterval(async () => {
      try {
        const updated = await refreshWorkspaceSubscriptionStatus(workspace.id);
        if (updated) setSubscription(updated);
        const billingData = await getWorkspaceBilling(workspace.id);
        setSubscription(billingData?.subscription || updated || null);
        setWorkspaceUsage(billingData?.usage || null);
      } catch (error) {
        console.error("Failed to refresh subscription lifecycle:", error);
      }
    }, 60000);
    return () => clearInterval(lifecycleTimer);
  }, [workspace?.id, isOwnerOrAdmin]);

  useEffect(() => {
    let cancelled = false;

    const loadServiceTemplates = async () => {
      if (!workspace?.id) return;

      try {
        const remoteServices = await getServiceTemplatesFromSupabase(workspace.id);
        if (!cancelled) setServiceTemplates(remoteServices);
      } catch (error) {
        console.error("Failed to load service templates from Supabase:", error);
      }
    };

    loadServiceTemplates();

    return () => {
      cancelled = true;
    };
  }, [workspace?.id]);

  useEffect(() => {
    localStorage.setItem("cc_theme", theme);
  }, [theme]);

  const generateAiCustomerSummary = async (customer, onProgress) => {
    const documents = Array.isArray(customer.documents) ? customer.documents : [];
    const receivedDocs = documents
      .filter((doc) => typeof doc === "object" ? doc.received : true)
      .map((doc) => typeof doc === "object" ? doc.name : doc);
    const pendingDocs = documents
      .filter((doc) => typeof doc === "object" ? !doc.received : false)
      .map((doc) => typeof doc === "object" ? doc.name : doc);
    const followUps = Array.isArray(customer.followUps) ? customer.followUps : [];
    const due = Math.max(Number(customer.amount || 0) - Number(customer.paid || 0), 0);

    const customerContext = {
      name: customer.name || "Unknown",
      service: customer.service || "Not specified",
      phone: customer.phone || "Not provided",
      reference: customer.reference || "Not provided",
      applicationNumber: customer.applicationNumber || "Not provided",
      workflowStage: customer.workflowStage || "Not specified",
      status: customer.status || "Not specified",
      dueDate: customer.dueDate || "Not provided",
      totalAmount: Number(customer.amount || 0),
      paidAmount: Number(customer.paid || 0),
      outstandingAmount: due,
      documentsReceived: receivedDocs,
      documentsPending: pendingDocs,
      followUps: followUps.map((x) => ({
        title: x.title,
        type: x.type,
        date: x.date,
        time: x.time,
        completed: !!x.completed,
        note: x.note || ""
      })),
      notes: customer.notes || "No notes"
    };

    onProgress?.("Generating quick summary…");

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-customer-summary", {
        body: { workspaceId: workspace.id, customer: customerContext }
      });

      onProgress?.("Finalizing summary…");

      if (error) {
        throw new Error(error.message || "Unable to connect to the secure AI service.");
      }

      if (!data?.success || !data?.result) {
        throw new Error(data?.error || "AI summary could not be generated. Please try again.");
      }

      const result = typeof data.result === "string" ? data.result : JSON.stringify(data.result);
      let parsed;
      try {
        parsed = JSON.parse(result.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim());
      } catch {
        throw new Error("AI returned an incomplete summary. Please try again.");
      }

      if (!parsed?.summary || !parsed?.pending || !parsed?.nextAction || !parsed?.customerMessage) {
        throw new Error("AI returned an incomplete summary. Please try again.");
      }

      return JSON.stringify(parsed);
    } catch (error) {
      throw error;
    }
  };

  const refreshWorkspaceBilling = async () => {
    if (!workspace?.id || !isOwnerOrAdmin) return;

    try {
      const billingData = await getWorkspaceBilling(workspace.id);

      setSubscription(billingData?.subscription || null);
      setWorkspaceUsage(billingData?.usage || null);
      setBillingError("");
    } catch (error) {
      console.error("Failed to refresh billing information:", error);
    }
  };

  const startProCheckout = async () => {
    // Synchronous lock: prevents rapid double-clicks before React can re-render.
    if (proCheckoutInFlightRef.current) return;

    if (!workspace?.id) {
      throw new Error("Workspace is not available. Please refresh and try again.");
    }

    if (!isOwnerOrAdmin) {
      throw new Error("Only the workspace owner or admin can start billing actions.");
    }

    if (subscription?.plan === "pro" && ["active", "trial"].includes(subscription?.status)) {
      throw new Error("This workspace already has Pro access.");
    }

    proCheckoutInFlightRef.current = true;
    setProCheckoutLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-razorpay-subscription", {
        body: {
          workspaceId: workspace.id
        }
      });

      if (error) throw error;
      if (!data?.success || !data?.subscriptionId || !data?.keyId) {
        throw new Error(data?.error || "Could not start the Pro subscription.");
      }

      await loadRazorpayCheckoutScript();

      await new Promise((resolve, reject) => {
        let settled = false;

        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          callback(value);
        };

        const checkout = new window.Razorpay({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: "CyberCafe Helper",
          description: "CyberCafe Helper Pro subscription",
          prefill: {
            name: user?.user_metadata?.full_name || userProfile?.full_name || "",
            email: user?.email || ""
          },
          notes: {
            workspace_id: workspace.id
          },
          theme: {
            color: "#2563eb"
          },
          handler: async (response) => {
            try {
              const verification = await verifyRazorpaySubscriptionPayment(response);

              if (!verification?.success) {
                throw new Error(verification?.error || "Payment verification failed.");
              }

              await refreshWorkspaceBilling();
              finish(resolve, verification);
            } catch (verificationError) {
              finish(reject, verificationError);
            }
          },
          modal: {
            ondismiss: () =>
              finish(
                reject,
                new Error("Payment window was closed before the subscription was completed.")
              )
          }
        });

        checkout.on("payment.failed", (response) => {
          const description =
            response?.error?.description ||
            "Razorpay could not complete the payment.";

          finish(reject, new Error(description));
        });

        checkout.open();
      });
    } finally {
      proCheckoutInFlightRef.current = false;
      setProCheckoutLoading(false);
    }
  };

  const startTestOneTimePayment = async () => {
    if (!workspace?.id) {
      throw new Error("Workspace is not available. Please refresh and try again.");
    }

    if (!isOwnerOrAdmin) {
      throw new Error("Only the workspace owner or admin can make this test payment.");
    }

    await loadRazorpayCheckoutScript();

    const { data, error } = await supabase.functions.invoke(
      "create-razorpay-test-order",
      {
        body: {
          workspaceId: workspace.id
        }
      }
    );

    if (error) throw error;

    if (!data?.success || !data?.orderId || !data?.keyId) {
      throw new Error(
        data?.error || "Could not create the Razorpay test order."
      );
    }

    await new Promise((resolve, reject) => {
      let settled = false;

      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };

      const checkout = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "CyberCafe Helper",
        description: "₹10 One-Time Payment Test",
        prefill: {
          name:
            user?.user_metadata?.full_name ||
            userProfile?.full_name ||
            "",
          email: user?.email || ""
        },
        notes: {
          workspace_id: workspace.id,
          test_payment: "true"
        },
        theme: {
          color: "#2563eb"
        },
        handler: async (response) => {
          finish(resolve, response);
        },
        modal: {
          ondismiss: () => {
            finish(
              reject,
              new Error(
                "Payment window was closed before the payment was completed."
              )
            );
          }
        }
      });

      checkout.on("payment.failed", (response) => {
        console.error("Razorpay one-time payment failed:", response);

        const description =
          response?.error?.description ||
          "Razorpay could not complete the payment.";

        finish(reject, new Error(description));
      });

      checkout.open();
    });
  };

  const verifyRazorpaySubscriptionPayment = async (paymentResponse) => {
    if (!workspace?.id) throw new Error("Workspace is not available. Please refresh and try again.");

    const { data, error } = await supabase.functions.invoke("verify-razorpay-subscription", {
      body: {
        workspaceId: workspace.id,
        razorpayPaymentId: paymentResponse?.razorpay_payment_id,
        razorpaySubscriptionId: paymentResponse?.razorpay_subscription_id,
        razorpaySignature: paymentResponse?.razorpay_signature
      }
    });

    if (error) throw error;
    if (!data?.success) {
      throw new Error(data?.error || "Payment verification failed.");
    }

    return data;
  };

  const refreshTeamMembers = async () => {
    if (!workspace?.id || !isOwnerOrAdmin) return;
    try {
      setTeamLoading(true);
      const members = await getWorkspaceTeamMembers(workspace.id);
      setTeamMembers(members);
    } catch (error) {
      console.error("Failed to refresh team members:", error);
      alert(`Could not load team members.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    } finally {
      setTeamLoading(false);
    }
  };

  const addTeamMember = async (email, role) => {
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return false;
    }
    try {
      await addWorkspaceMemberByEmail(workspace.id, email, role);
      await refreshTeamMembers();
      await refreshWorkspaceBilling();
      return true;
    } catch (error) {
      console.error("Failed to add team member:", error);
      alert(`Could not add team member.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
      return false;
    }
  };

  const changeTeamMemberRole = async (member, role) => {
    if (!member?.id || !isOwnerOrAdmin) return;
    if (member.user_id === user.id && role !== "owner") {
      alert("You cannot remove your own owner access from this workspace.");
      return;
    }
    try {
      await updateWorkspaceMemberRole(member.id, role);
      await refreshTeamMembers();
      await refreshWorkspaceBilling();
    } catch (error) {
      console.error("Failed to update team member role:", error);
      alert(`Could not update team member role.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const removeTeamMember = async (member) => {
    if (!member?.id || !isOwnerOrAdmin) return;
    if (member.user_id === user.id) {
      alert("You cannot remove yourself from your own workspace.");
      return;
    }
    if (!window.confirm(`Remove ${member.full_name || member.email || "this team member"} from the workspace?`)) return;
    try {
      await removeWorkspaceMember(member.id);
      await refreshTeamMembers();
      await refreshWorkspaceBilling();
    } catch (error) {
      console.error("Failed to remove team member:", error);
      alert(`Could not remove team member.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const saveServiceTemplate = async (service) => {
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return false;
    }

    try {
      const existing = serviceTemplates.find((item) => item.id === service.id);
      const saved = existing
        ? await updateServiceTemplateInSupabase(service, workspace.id)
        : await createServiceTemplateInSupabase(service, workspace.id);

      setServiceTemplates((prev) =>
        existing
          ? prev.map((item) => item.id === existing.id ? saved : item)
          : [saved, ...prev]
      );
      await refreshWorkspaceBilling();
      return true;
    } catch (error) {
      console.error("Failed to save service template:", error);
      alert(`Could not save service template to Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
      return false;
    }
  };

  const deleteServiceTemplate = async (id) => {
    if (!window.confirm("Delete this custom service template? Existing customer records will not be deleted.")) return;
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    try {
      await deleteServiceTemplateFromSupabase(id, workspace.id);
      setServiceTemplates((prev) => prev.filter((item) => item.id !== id));
      await refreshWorkspaceBilling();
    } catch (error) {
      console.error("Failed to delete service template:", error);
      alert(`Could not delete service template from Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return tasks;

    return tasks.filter((task) =>
      [
        task.name,
        task.phone,
        task.reference,
        task.applicationNumber,
        task.service,
        task.status
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q)
      )
    );
  }, [tasks, query]);

  const globalSearchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const customerResults = tasks
      .filter((task) => [task.name, task.phone, task.reference, task.applicationNumber, task.service]
        .some((value) => String(value || "").toLowerCase().includes(q)))
      .slice(0, 6)
      .map((task) => ({ type: "customer", id: task.id, title: task.name || "Customer", subtitle: `${task.service || "Work"} · ${task.phone || "No phone"}`, task }));

    const pageResults = [
      { name: "Dashboard", subtitle: "Workspace overview" },
      { name: "Print Jobs", subtitle: "QR document print queue" },
      { name: "Earnings", subtitle: "Print revenue and earnings" },
      { name: "Customer Work", subtitle: "Customer CRM and work queue" },
      { name: "Services", subtitle: "Government portals and service templates" },
      { name: "Follow-ups", subtitle: "Reminders and customer follow-ups" },
      { name: "Reports", subtitle: "Business analytics and exports" },
      { name: "Calculators", subtitle: "GST and EMI calculators" },
      { name: "My Quick Links", subtitle: "Saved portals and shortcuts" },
      { name: "Settings", subtitle: "Business profile and workspace preferences" }
    ]
      .filter((item) => `${item.name} ${item.subtitle}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({ type: "page", id: item.name, title: item.name, subtitle: item.subtitle, page: item.name }));

    const serviceResults = [...defaultServiceTemplates, ...serviceTemplates]
      .filter((item, index, array) => array.findIndex((x) => x.name === item.name) === index)
      .filter((item) => String(item.name || "").toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({ type: "service", id: item.id, title: item.name, subtitle: "Service template", page: "Services" }));

    const linkResults = links
      .filter((link) => `${link.name || ""} ${link.url || ""}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((link) => ({ type: "link", id: link.id, title: link.name, subtitle: link.url, link }));

    return [...customerResults, ...pageResults, ...serviceResults, ...linkResults].slice(0, 10);
  }, [query, tasks, links, serviceTemplates]);

  const addTask = async (data) => {
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    const initialPaid = Number(data.paid || 0);

    const localTask = {
      name: data.name,
      phone: data.phone,
      reference: data.reference,
      address: data.address,
      service: data.service,
      amount: Number(data.amount || 0),
      paid: 0,
      status: statusForWorkflowStage(
        data.workflowStage || getWorkflowStages(data.service)[0],
        getWorkflowStages(data.service)
      ),
      workflowStage: data.workflowStage || getWorkflowStages(data.service)[0],
      applicationNumber: data.applicationNumber || "",
      documents: data.documents || [],
      notes: data.notes,
      dueDate: data.dueDate,
      payments: []
    };

    try {
      let savedCustomer = await createCustomerInSupabase(localTask, workspace.id);
      let newTask = normalizeTask(savedCustomer);

      if (initialPaid > 0) {
        if (initialPaid > Number(newTask.amount || 0)) {
          throw new Error("Initial payment cannot exceed the total amount.");
        }

        const initialPayment = await createPaymentInSupabase({
          customerId: newTask.id,
          amount: initialPaid,
          method: "Other",
          note: "Initial payment",
          date: new Date().toISOString().slice(0, 10)
        }, workspace.id);

        savedCustomer = await updateCustomerInSupabase(
          { ...newTask, paid: initialPaid },
          workspace.id
        );

        newTask = normalizeTask({
          ...savedCustomer,
          paid: initialPaid,
          payments: [initialPayment]
        });
      }

      setTasks((prev) => [newTask, ...prev]);
      await refreshWorkspaceBilling();
      setModal(null);
    } catch (error) {
      console.error("Failed to create customer:", error);
      alert(`Could not save customer to Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const addLink = async (data) => {
    const name = String(data.name || "").trim();
    let url = String(data.url || "").trim();

    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    const duplicate = links.some(
      (item) => String(item.url || "").toLowerCase() === url.toLowerCase()
    );

    if (duplicate) {
      alert("This link is already saved.");
      return;
    }

    try {
      const saved = await createQuickLinkInSupabase({ name, url }, workspace.id);
      setLinks((prev) => [saved, ...prev]);
      await refreshWorkspaceBilling();
      setModal(null);
    } catch (error) {
      console.error("Failed to create quick link:", error);
      alert(`Could not save quick link to Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const deleteLink = async (linkId) => {
    if (!window.confirm("Delete this saved quick link?")) return;

    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    try {
      await deleteQuickLinkFromSupabase(linkId, workspace.id);
      setLinks((prev) => prev.filter((item) => item.id !== linkId));
      await refreshWorkspaceBilling();
    } catch (error) {
      console.error("Failed to delete quick link:", error);
      alert(`Could not delete quick link from Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const updateTask = async (id, changes) => {
    const existing = tasks.find((task) => task.id === id);

    if (!existing || !workspace?.id) {
      return false;
    }

    const nextTask = { ...existing, ...changes };

    try {
      let savedCustomer = await updateCustomerInSupabase(nextTask, workspace.id);
      let finalFollowUps = Array.isArray(existing.followUps) ? [...existing.followUps] : [];

      if (Object.prototype.hasOwnProperty.call(changes, "followUps")) {
        const requestedFollowUps = Array.isArray(changes.followUps) ? changes.followUps : [];
        const existingById = new Map(finalFollowUps.map((item) => [String(item.id), item]));
        const requestedIds = new Set(requestedFollowUps.map((item) => String(item.id)));

        for (const oldFollowUp of finalFollowUps) {
          if (!requestedIds.has(String(oldFollowUp.id)) && oldFollowUp.id) {
            try {
              await deleteFollowUpFromSupabase(oldFollowUp.id, workspace.id);
            } catch (deleteError) {
              if (!String(deleteError?.message || "").toLowerCase().includes("invalid input syntax")) throw deleteError;
            }
          }
        }

        finalFollowUps = [];
        for (const requested of requestedFollowUps) {
          const old = existingById.get(String(requested.id));

          if (!old || !requested.id || String(requested.id).length < 10) {
            const created = await createFollowUpInSupabase({
              ...requested,
              customerId: id
            }, workspace.id);
            finalFollowUps.push(created);
          } else {
            const changed =
              old.title !== requested.title ||
              old.type !== requested.type ||
              old.date !== requested.date ||
              old.time !== requested.time ||
              old.note !== requested.note ||
              Boolean(old.completed) !== Boolean(requested.completed);

            if (changed) {
              const updated = await updateFollowUpInSupabase({
                ...requested,
                customerId: id
              }, workspace.id);
              finalFollowUps.push(updated);
            } else {
              finalFollowUps.push(old);
            }
          }
        }
      }

      const updatedTask = normalizeTask({
        ...savedCustomer,
        payments: existing.payments || [],
        followUps: finalFollowUps
      });

      setTasks((prev) =>
        prev.map((task) => task.id === id ? updatedTask : task)
      );

      setSelectedCustomer((current) =>
        current && current.id === id ? updatedTask : current
      );

      return true;
    } catch (error) {
      console.error("Failed to update customer/follow-up:", error);
      alert(`Could not save changes to Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
      return false;
    }
  };

  const addPayment = async (customerId, payment) => {
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    const task = tasks.find((item) => item.id === customerId);
    if (!task) return;

    const amount = Number(payment.amount || 0);
    const due = Math.max(0, Number(task.amount || task.total || 0) - Number(task.paid || 0));

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (amount > due) {
      alert(`Payment cannot exceed the current due amount of ${money(due)}.`);
      return;
    }

    try {
      const savedPayment = await createPaymentInSupabase({
        customerId,
        amount,
        method: payment.method,
        note: payment.note,
        date: new Date().toISOString().slice(0, 10)
      }, workspace.id);

      const newPaid = Number(task.paid || 0) + amount;
      const savedCustomer = await updateCustomerInSupabase(
        { ...task, paid: newPaid },
        workspace.id
      );

      const updatedTask = normalizeTask({
        ...savedCustomer,
        paid: newPaid,
        payments: [...(Array.isArray(task.payments) ? task.payments : []), savedPayment],
        followUps: task.followUps || []
      });

      setTasks((prev) => prev.map((item) => item.id === customerId ? updatedTask : item));
      setSelectedCustomer((current) => current?.id === customerId ? updatedTask : current);
      setPaymentCustomer(null);
    } catch (error) {
      console.error("Failed to save payment:", error);
      alert(`Could not save payment to Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const deletePayment = async (customerId, paymentId) => {
    if (!window.confirm("Delete this payment record?")) return;
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    const task = tasks.find((item) => item.id === customerId);
    if (!task) return;

    const payments = Array.isArray(task.payments) ? task.payments : [];
    const paymentToDelete = payments.find((payment) => payment.id === paymentId);
    if (!paymentToDelete) return;

    try {
      await deletePaymentFromSupabase(paymentId, workspace.id);

      const remainingPayments = payments.filter((payment) => payment.id !== paymentId);
      const newPaid = remainingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

      const savedCustomer = await updateCustomerInSupabase(
        { ...task, paid: newPaid },
        workspace.id
      );

      const updatedTask = normalizeTask({
        ...savedCustomer,
        paid: newPaid,
        payments: remainingPayments,
        followUps: task.followUps || []
      });

      setTasks((prev) => prev.map((item) => item.id === customerId ? updatedTask : item));
      setSelectedCustomer((current) => current?.id === customerId ? updatedTask : current);
    } catch (error) {
      console.error("Failed to delete payment:", error);
      alert(`Could not delete payment from Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm("Delete this customer record?")) {
      return;
    }

    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    try {
      await deleteCustomerFromSupabase(id, workspace.id);

      setTasks((prev) => prev.filter((task) => task.id !== id));

      if (selectedCustomer?.id === id) {
        setSelectedCustomer(null);
      }

      await refreshWorkspaceBilling();
    } catch (error) {
      console.error("Failed to delete customer:", error);
      alert(`Could not delete customer from Supabase.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  // ============================================================
  // STEP 18G — SUPABASE DATA BACKUP & RESTORE
  // ============================================================

  const savePrintPricing = async (pricing) => {
    if (!workspace?.id) throw new Error("Workspace is still loading.");
    const update = {
      print_bw_price: Number(pricing.bwPrice),
      print_color_price: Number(pricing.colorPrice),
      print_a3_bw_price: Number(pricing.a3BwPrice),
      print_a3_color_price: Number(pricing.a3ColorPrice),
      print_duplex_discount: Number(pricing.duplexDiscount)
    };
    const { data, error } = await supabase
      .from("workspaces")
      .update(update)
      .eq("id", workspace.id)
      .select("id, name, owner_id, phone, address, gstin, print_bw_price, print_color_price, print_a3_bw_price, print_a3_color_price, print_duplex_discount, created_at, updated_at")
      .maybeSingle();
    if (error) throw error;
    return data || null;
  };

  const saveBusinessProfile = async (profile) => {
    const cleaned = {
      businessName: String(profile?.businessName || workspace?.name || "CyberCafe Helper").trim(),
      ownerName: String(profile?.ownerName || "").trim(),
      phone: String(profile?.phone || "").trim(),
      address: String(profile?.address || "").trim(),
      gstin: String(profile?.gstin || "").trim().toUpperCase(),
      receiptFooter: String(profile?.receiptFooter || "Thank you for using our services.").trim()
    };

    if (!workspace?.id) throw new Error("Workspace is not available.");

    const { error: workspaceError } = await supabase
      .from("workspaces")
      .update({
        name: cleaned.businessName,
        phone: cleaned.phone || null,
        address: cleaned.address || null,
        gstin: cleaned.gstin || null
      })
      .eq("id", workspace.id);
    if (workspaceError) throw workspaceError;

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { owner_name: cleaned.ownerName, receipt_footer: cleaned.receiptFooter }
    });
    if (metadataError) throw metadataError;

    setBusinessProfile(cleaned);
  };

  const exportBackup = async () => {
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    try {
      const [customersResult, paymentsResult, followUpsResult, servicesResult, linksResult, workspaceResult] = await Promise.all([
        supabase.from("customers").select("*").eq("workspace_id", workspace.id),
        supabase.from("payments").select("*").eq("workspace_id", workspace.id),
        supabase.from("follow_ups").select("*").eq("workspace_id", workspace.id),
        supabase.from("service_templates").select("*").eq("workspace_id", workspace.id),
        supabase.from("quick_links").select("*").eq("workspace_id", workspace.id),
        supabase.from("workspaces").select("*").eq("id", workspace.id).maybeSingle()
      ]);

      const firstError = [
        customersResult.error,
        paymentsResult.error,
        followUpsResult.error,
        servicesResult.error,
        linksResult.error,
        workspaceResult.error
      ].find(Boolean);

      if (firstError) throw firstError;

      const backup = {
        app: "CyberCafe Helper",
        backupVersion: 2,
        exportedAt: new Date().toISOString(),
        workspace: workspaceResult.data || workspace,
        customers: customersResult.data || [],
        payments: paymentsResult.data || [],
        followUps: followUpsResult.data || [],
        serviceTemplates: servicesResult.data || [],
        quickLinks: linksResult.data || [],
        settings: {
          businessProfile,
          theme
        }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `cybercafe-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);

      alert("Supabase workspace backup exported successfully.");
    } catch (error) {
      console.error("Failed to export Supabase backup:", error);
      alert(`Could not export workspace backup.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  const importBackup = (file) => {
    if (!file) return;
    const MAX_BACKUP_SIZE = 25 * 1024 * 1024;
    const MAX_RECORDS_PER_COLLECTION = 5000;

    if (file.size > MAX_BACKUP_SIZE) {
      alert("Backup file is too large. Please select a file smaller than 25 MB.");
      return;
    }
    if (file.type && file.type !== "application/json" && !file.name.toLowerCase().endsWith(".json")) {
      alert("Please select a valid CyberCafe Helper JSON backup file.");
      return;
    }
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    const asArray = (value) => Array.isArray(value) ? value : [];
    const isSafeDate = (value) => {
      if (!value) return true;
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime());
    };
    const isValidUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(String(event.target?.result || ""));
        if (!isPlainObject(data) || data.app !== "CyberCafe Helper" || ![1, 2].includes(Number(data.backupVersion || data.version || 1))) {
          throw new Error("Invalid CyberCafe Helper backup.");
        }

        const backupWorkspaceId = String(data.workspace?.id || "").trim();
        if (backupWorkspaceId && (!isValidUuid(backupWorkspaceId) || backupWorkspaceId !== workspace.id)) {
          throw new Error("This backup belongs to a different workspace.");
        }

        const customers = Array.isArray(data.customers)
          ? data.customers
          : Array.isArray(data.tasks)
            ? data.tasks
            : [];
        const payments = asArray(data.payments);
        const followUps = asArray(data.followUps);
        const serviceTemplates = asArray(data.serviceTemplates);
        const quickLinks = Array.isArray(data.quickLinks)
          ? data.quickLinks
          : Array.isArray(data.links)
            ? data.links
            : [];

        const collections = [customers, payments, followUps, serviceTemplates, quickLinks];
        if (collections.some((items) => items.length > MAX_RECORDS_PER_COLLECTION)) {
          throw new Error(`Backup exceeds the maximum of ${MAX_RECORDS_PER_COLLECTION.toLocaleString("en-IN")} records per collection.`);
        }
        if (collections.some((items) => items.some((item) => !isPlainObject(item)))) {
          throw new Error("Backup contains an invalid record structure.");
        }

        const totalRecords = collections.reduce((sum, items) => sum + items.length, 0);
        if (!totalRecords && !isPlainObject(data.settings?.businessProfile)) {
          throw new Error("This backup does not contain any restorable workspace data.");
        }

        const confirmed = window.confirm(
          `Restore this backup into your current workspace?\n\n${customers.length} customers\n${payments.length} payments\n${followUps.length} follow-ups\n${serviceTemplates.length} service templates\n${quickLinks.length} quick links\n\nExisting matching records may be replaced.`
        );
        if (!confirmed) return;

        // Never trust imported database IDs. Generate fresh IDs locally, keep a deterministic
        // old-ID -> new-ID map, and reject duplicate old IDs so relationships stay unambiguous.
        const customerIdMap = new Map();
        if (customers.length) {
          const customerRows = customers.map((customer) => {
            const oldId = String(customer.id || "").trim();
            if (oldId) {
              if (!isValidUuid(oldId)) throw new Error("Backup contains an invalid customer ID.");
              if (customerIdMap.has(oldId)) throw new Error("Backup contains duplicate customer IDs.");
            }

            const newId = crypto.randomUUID();
            if (oldId) customerIdMap.set(oldId, newId);

            const row = normalizeCustomerForDatabase(customer, workspace.id);
            return { ...row, id: newId, workspace_id: workspace.id };
          });

          const { error } = await supabase
            .from("customers")
            .insert(customerRows);
          if (error) throw error;
        }

        if (payments.length) {
          const paymentRows = payments
            .map((payment) => {
              const oldCustomerId = String(payment.customer_id || payment.customerId || "").trim();
              const customerId = customerIdMap.get(oldCustomerId);
              if (!customerId) return null;
              const amount = Number(payment.amount || 0);
              if (!Number.isFinite(amount) || amount <= 0) return null;
              return {
                workspace_id: workspace.id,
                customer_id: customerId,
                amount,
                method: String(payment.method || "Other").slice(0, 50),
                note: payment.note ? String(payment.note).slice(0, 2000) : null,
                payment_date: isSafeDate(payment.payment_date || payment.date) ? (payment.payment_date || payment.date || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10)
              };
            })
            .filter(Boolean);

          if (paymentRows.length) {
            const { error } = await supabase.from("payments").insert(paymentRows);
            if (error) throw error;
          }
        }

        if (followUps.length) {
          const followUpRows = followUps
            .map((followUp) => {
              const oldCustomerId = String(followUp.customer_id || followUp.customerId || "").trim();
              const customerId = customerIdMap.get(oldCustomerId);
              if (!customerId) return null;
              let dueAt = followUp.due_at || followUp.dueAt || null;
              if (!dueAt && followUp.date) {
                dueAt = `${followUp.date}${followUp.time ? `T${followUp.time}` : "T00:00:00"}`;
              }
              if (!isSafeDate(dueAt)) dueAt = new Date().toISOString();
              return {
                workspace_id: workspace.id,
                customer_id: customerId,
                title: String(followUp.title || "Follow-up").trim().slice(0, 200),
                type: String(followUp.type || "Follow-up").slice(0, 50),
                due_at: dueAt || new Date().toISOString(),
                note: followUp.note ? String(followUp.note).slice(0, 2000) : null,
                completed: Boolean(followUp.completed)
              };
            })
            .filter(Boolean);

          if (followUpRows.length) {
            const { error } = await supabase.from("follow_ups").insert(followUpRows);
            if (error) throw error;
          }
        }

        if (serviceTemplates.length) {
          const serviceRows = serviceTemplates.map((service) => ({
            workspace_id: workspace.id,
            name: String(service.name || "").trim().slice(0, 200),
            price: Number.isFinite(Number(service.price)) ? Math.max(0, Number(service.price)) : 0,
            completion_days: Number.isFinite(Number(service.completion_days ?? service.completionDays)) ? Math.max(0, Number(service.completion_days ?? service.completionDays)) : 0,
            required_documents: Array.isArray(service.required_documents ?? service.requiredDocuments) ? (service.required_documents ?? service.requiredDocuments).filter((item) => typeof item === "string").slice(0, 50) : [],
            workflow_stages: Array.isArray(service.workflow_stages ?? service.workflowStages) ? (service.workflow_stages ?? service.workflowStages).filter((item) => typeof item === "string").slice(0, 50) : ["New", "Processing", "Ready", "Completed"],
            tracking_label: String(service.tracking_label ?? service.trackingLabel ?? "Application / Reference No.").trim().slice(0, 200)
          })).filter((service) => service.name);

          if (serviceRows.length) {
            const { error } = await supabase.from("service_templates").insert(serviceRows);
            if (error) throw error;
          }
        }

        if (quickLinks.length) {
          const quickLinkRows = quickLinks.map((link) => ({
            workspace_id: workspace.id,
            name: String(link.name || link.title || "").trim().slice(0, 200),
            url: getSafeExternalUrl(link.url)
          })).filter((link) => link.name && link.url);

          if (quickLinkRows.length) {
            const { error } = await supabase.from("quick_links").insert(quickLinkRows);
            if (error) throw error;
          }
        }

        if (isPlainObject(data.workspace) && workspace?.id) {
          const workspaceUpdate = {};
          if (data.workspace.phone !== undefined) workspaceUpdate.phone = String(data.workspace.phone || "").slice(0, 50) || null;
          if (data.workspace.address !== undefined) workspaceUpdate.address = String(data.workspace.address || "").slice(0, 500) || null;
          if (data.workspace.gstin !== undefined) workspaceUpdate.gstin = String(data.workspace.gstin || "").slice(0, 50) || null;
          if (data.workspace.name !== undefined) workspaceUpdate.name = String(data.workspace.name || workspace.name).slice(0, 100) || workspace.name;

          if (Object.keys(workspaceUpdate).length) {
            const { error } = await supabase.from("workspaces").update(workspaceUpdate).eq("id", workspace.id);
            if (error) throw error;
          }
        }

        if (isPlainObject(data.settings?.businessProfile)) {
          setBusinessProfile((prev) => ({ ...prev, ...data.settings.businessProfile }));
        } else if (isPlainObject(data.businessProfile)) {
          setBusinessProfile((prev) => ({ ...prev, ...data.businessProfile }));
        }

        if (["dark", "light", "emerald"].includes(data.settings?.theme || data.theme)) {
          setTheme(data.settings?.theme || data.theme);
        }

        const restoredCustomers = await getCustomersFromSupabase(workspace.id);
        const customerIds = restoredCustomers.map((customer) => customer.id);
        const restoredPayments = await getPaymentsFromSupabase(workspace.id, customerIds);
        const restoredFollowUps = await getFollowUpsFromSupabase(workspace.id, customerIds);
        const paymentsByCustomer = restoredPayments.reduce((map, payment) => {
          if (!map[payment.customerId]) map[payment.customerId] = [];
          map[payment.customerId].push(payment);
          return map;
        }, {});
        const followUpsByCustomer = restoredFollowUps.reduce((map, followUp) => {
          if (!map[followUp.customerId]) map[followUp.customerId] = [];
          map[followUp.customerId].push(followUp);
          return map;
        }, {});

        const hydratedCustomers = restoredCustomers.map((customer) => {
          const customerPayments = paymentsByCustomer[customer.id] || [];
          const customerFollowUps = followUpsByCustomer[customer.id] || [];
          const paidFromPayments = customerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
          return normalizeTask({
            ...customer,
            paid: customerPayments.length ? paidFromPayments : customer.paid,
            payments: customerPayments,
            followUps: customerFollowUps
          });
        });

        const restoredServices = await getServiceTemplatesFromSupabase(workspace.id);
        const restoredLinks = await getQuickLinksFromSupabase(workspace.id);

        setTasks(hydratedCustomers);
        setServiceTemplates(restoredServices);
        setLinks(restoredLinks);
        setSelectedCustomer(null);
        setEditingCustomer(null);
        setQuery("");

        alert("Supabase workspace backup restored successfully.");
      } catch (error) {
        console.error("Failed to import Supabase backup:", error);
        alert(`Could not restore workspace backup.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
      }
    };
    reader.readAsText(file);
  };

  const resetWorkspace = async () => {
    if (!workspace?.id) {
      alert("Your workspace is still loading. Please try again in a moment.");
      return;
    }

    const confirmed = window.confirm(
      "Reset this workspace? This will permanently delete all customers, payments, follow-ups, custom services and quick links. Export a backup first if you may need the data later."
    );
    if (!confirmed) return;

    const secondConfirm = window.confirm(
      "Final confirmation: permanently delete all workspace data? This cannot be undone without a backup."
    );
    if (!secondConfirm) return;

    try {
      // Delete dependent records first, then customers.
      const deleteOperations = [
        supabase.from("payments").delete().eq("workspace_id", workspace.id),
        supabase.from("follow_ups").delete().eq("workspace_id", workspace.id),
        supabase.from("quick_links").delete().eq("workspace_id", workspace.id),
        supabase.from("service_templates").delete().eq("workspace_id", workspace.id),
        supabase.from("customers").delete().eq("workspace_id", workspace.id)
      ];

      const results = await Promise.all(deleteOperations);
      const firstError = results.map((result) => result.error).find(Boolean);
      if (firstError) throw firstError;

      setTasks([]);
      setLinks([]);
      setServiceTemplates([]);
      setSelectedCustomer(null);
      setEditingCustomer(null);
      setPaymentCustomer(null);
      setReminderCustomer(null);
      setAiCustomer(null);
      setQuery("");
      localStorage.removeItem("cc_tasks");
      localStorage.removeItem("cc_links");
      localStorage.removeItem("cc_service_templates");

      alert("Workspace data reset successfully.");
    } catch (error) {
      console.error("Failed to reset Supabase workspace:", error);
      alert(`Could not reset workspace data.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
    }
  };

  return (
    <>
      <style>{`
        .documentsChecklistSection { overflow: hidden; }
        .documentProgressHeader { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:10px; }
        .documentProgressHeader > div { display:flex; flex-direction:column; gap:4px; }
        .documentProgressHeader span, .formDocHeading small, .customDocumentHeading small { color:#7b8794; font-size:12px; }
        .documentProgressPercent { font-size:18px; }
        .documentProgressTrack { height:7px; background:#e8edf3; border-radius:99px; overflow:hidden; margin-bottom:16px; }
        .documentProgressFill { height:100%; background:#f59e0b; border-radius:inherit; transition:width .25s ease; }
        .documentProgressFill.complete { background:#10b981; }
        .documentChecklist { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
        .documentChecklistItem { display:flex; align-items:center; gap:10px; width:100%; padding:11px 12px; border:1px solid #e5eaf0; border-radius:10px; background:#fff; text-align:left; cursor:pointer; transition:.18s ease; }
        .documentChecklistItem:hover { transform:translateY(-1px); border-color:#cbd5e1; }
        .documentChecklistItem.received { background:#f0fdf4; border-color:#bbf7d0; }
        .documentChecklistItem.missing { background:#fffaf0; border-color:#fde68a; }
        .documentChecklistItem span { display:flex; flex-direction:column; gap:2px; min-width:0; }
        .documentChecklistItem strong { font-size:13px; color:#172033; }
        .documentChecklistItem small { font-size:11px; color:#7b8794; }
        .customDocumentArea { margin-top:17px; padding-top:15px; border-top:1px solid #edf0f4; }
        .customDocumentHeading, .formDocHeading { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:9px; font-size:12px; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:.04em; }
        .customDocumentPill { display:inline-flex; align-items:center; gap:6px; margin:0 6px 7px 0; padding:6px 9px; border:1px solid #dbeafe; border-radius:999px; background:#eff6ff; color:#2563eb; font-size:12px; cursor:pointer; }
        .customDocumentInputRow, .customDocumentFormRow { display:flex; gap:8px; align-items:center; margin-top:7px; }
        .customDocumentInput, .customDocumentFormRow input { min-width:0; flex:1; }
        .smallButton { white-space:nowrap; padding:9px 12px !important; }
        .formRequiredDocuments { margin-top:12px; padding:12px; border:1px solid #e7ecf2; border-radius:10px; background:#f8fafc; }
        .formRequiredDocList { display:flex; flex-wrap:wrap; gap:7px; }
        .formRequiredDoc { display:inline-flex; align-items:center; gap:5px; padding:5px 8px; border-radius:999px; font-size:11px; }
        .formRequiredDoc.received { background:#dcfce7; color:#15803d; }
        .formRequiredDoc.missing { background:#fef3c7; color:#b45309; }
        .tableDocumentProgress { display:flex; align-items:center; gap:6px; margin-top:7px; font-size:11px; color:#b45309; font-weight:600; }
        .tableDocumentProgress.complete { color:#15803d; }
        .tableDocumentProgress small { font-weight:500; color:#94a3b8; }
        @media (max-width:640px) { .documentChecklist { grid-template-columns:1fr; } .customDocumentInputRow, .customDocumentFormRow { align-items:stretch; } }

        /* STEP 13 — service management */
        .serviceManagementHeader { display:flex; align-items:flex-end; justify-content:space-between; gap:24px; margin:28px 0 18px; padding:22px; border:1px solid #e6ebf2; border-radius:14px; background:#fff; box-shadow:0 5px 18px rgba(15,23,42,.045); }
        .serviceManagementHeader h2, .serviceDirectoryBlock h2 { margin:6px 0 5px; color:#172033; font-size:19px; }
        .serviceManagementHeader p, .serviceDirectorySubtitle { margin:0; color:#7b8794; font-size:12px; line-height:1.55; }
        .managedServiceGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
        .managedServiceCard { padding:18px; border:1px solid #e5eaf0; border-radius:13px; background:#fff; box-shadow:0 4px 14px rgba(15,23,42,.035); }
        .managedServiceTop { display:flex; align-items:center; gap:11px; }
        .managedServiceTitle { min-width:0; flex:1; }
        .managedServiceTitle h3 { margin:0 0 3px; font-size:14px; color:#172033; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .managedServiceTitle span { font-size:11px; color:#8a94a3; }
        .servicePrice { font-size:15px; font-weight:800; color:#2563eb; white-space:nowrap; }
        .managedServiceMeta { display:flex; gap:8px; margin:16px 0; padding-top:12px; border-top:1px solid #edf1f5; }
        .managedServiceMeta span { padding:5px 8px; border-radius:999px; background:#f5f7fa; color:#64748b; font-size:10px; font-weight:700; }
        .managedServiceActions { display:flex; gap:8px; }
        .secondaryButton, .dangerButton { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:34px; padding:7px 11px; border-radius:8px; cursor:pointer; font-size:11px; font-weight:700; }
        .secondaryButton { border:1px solid #dfe5ee; background:#fff; color:#475569; }
        .secondaryButton:hover { background:#f8fafc; }
        .dangerButton { border:1px solid #fecaca; background:#fff; color:#dc2626; }
        .dangerButton:hover { background:#fef2f2; }
        .serviceManagementEmpty { grid-column:1/-1; display:flex; flex-direction:column; align-items:center; gap:7px; padding:34px 20px; border:1px dashed #d7dee8; border-radius:13px; color:#94a3b8; background:#fbfcfe; text-align:center; }
        .serviceManagementEmpty strong { color:#475569; font-size:13px; }
        .serviceManagementEmpty span { font-size:11px; }
        .serviceDirectoryBlock { margin-top:34px; }
        .serviceDirectoryBlock h2 { margin-bottom:4px; }
        .serviceDirectoryBlock .serviceGrid { margin-top:16px; }
        .serviceTemplateModal .modalHeader { margin-bottom:20px; }
        .templateSection { margin-top:22px; padding-top:18px; border-top:1px solid #edf1f5; }
        .templateSectionHeader { margin-bottom:12px; }
        .templateSectionHeader strong { display:block; color:#334155; font-size:12px; margin-bottom:4px; }
        .templateSectionHeader span { color:#8a94a3; font-size:11px; }
        .templateChipGrid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
        .templateChip { display:flex; align-items:center; gap:6px; min-height:35px; padding:7px 9px; border:1px solid #e1e7ef; border-radius:8px; background:#fff; color:#64748b; cursor:pointer; font-size:11px; text-align:left; }
        .templateChip.selected { border-color:#bfdbfe; background:#eff6ff; color:#2563eb; }
        .templateAddRow { display:flex; gap:8px; margin-top:10px; }
        .templateAddRow input { flex:1; min-width:0; }
        .stageList { display:flex; flex-wrap:wrap; gap:7px; }
        .stageRow { display:flex; align-items:center; gap:7px; padding:7px 9px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; color:#475569; font-size:11px; }
        .stageNumber { display:inline-flex; align-items:center; justify-content:center; width:19px; height:19px; border-radius:50%; background:#e2e8f0; color:#475569; font-size:9px; font-weight:800; }
        .stageRemove { display:flex; align-items:center; justify-content:center; border:0; background:transparent; color:#94a3b8; cursor:pointer; padding:1px; }
        .stageRemove:hover { color:#dc2626; }
        .modalActions { display:flex; justify-content:flex-end; gap:9px; margin-top:24px; padding-top:17px; border-top:1px solid #edf1f5; }
        @media (max-width:900px) { .managedServiceGrid { grid-template-columns:repeat(2,minmax(0,1fr)); } .templateChipGrid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:640px) { .serviceManagementHeader { align-items:flex-start; flex-direction:column; padding:17px; } .managedServiceGrid { grid-template-columns:1fr; } .templateChipGrid { grid-template-columns:1fr; } .templateAddRow { align-items:stretch; } .modalActions { flex-direction:column-reverse; } }

        /* STEP 15 — reports responsive helpers */
        @media (max-width: 900px) { .reportsStatGrid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; } .reportsTwoCol { grid-template-columns:1fr !important; } }
        @media (max-width: 640px) { .reportsStatGrid { grid-template-columns:1fr !important; } }

        /* STEP 14 — reminders & follow-ups */
        .followUpHeaderRow { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-bottom:12px; }
        .followUpHeaderRow > span { color:#7b8794; font-size:11px; }
        .followUpList, .followUpPageList { display:flex; flex-direction:column; gap:9px; }
        .followUpItem { display:flex; align-items:center; gap:10px; padding:11px 12px; border:1px solid #e5eaf0; border-radius:10px; background:#fff; }
        .followUpItem.completed { opacity:.62; background:#f8fafc; }
        .followUpItem.completed strong { text-decoration:line-through; }
        .followUpCheck, .followUpDelete { border:0; background:transparent; padding:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#f59e0b; }
        .followUpItem.completed .followUpCheck { color:#10b981; }
        .followUpDelete { color:#94a3b8; }
        .followUpDelete:hover { color:#dc2626; }
        .followUpMain { min-width:0; flex:1; display:flex; flex-direction:column; gap:3px; }
        .followUpMain strong { color:#172033; font-size:12px; }
        .followUpMain span, .followUpMain small { color:#7b8794; font-size:11px; }
        .followUpMain small { margin-top:2px; }
        .followUpEmpty { padding:16px; border:1px dashed #d8e0e9; border-radius:10px; color:#94a3b8; font-size:11px; text-align:center; background:#fbfcfe; }
        .followUpsPage { max-width:1100px; }
        .followUpStats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:24px 0 28px; }
        .followUpStats > div { padding:17px 18px; border:1px solid #e5eaf0; border-radius:12px; background:#fff; box-shadow:0 4px 14px rgba(15,23,42,.035); display:flex; flex-direction:column; gap:5px; }
        .followUpStats span { color:#7b8794; font-size:11px; }
        .followUpStats strong { color:#172033; font-size:23px; }
        .followUpGroup { margin-bottom:28px; }
        .followUpGroup .sectionTitle { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .followUpGroup .sectionTitle h2 { margin:4px 0 0; font-size:18px; color:#172033; }
        .followUpCount { min-width:27px; height:27px; padding:0 8px; display:flex; align-items:center; justify-content:center; border-radius:999px; background:#eef2f7; color:#475569; font-size:11px; font-weight:800; }
        .followUpPageItem { display:flex; align-items:center; gap:13px; padding:15px 16px; border:1px solid #e5eaf0; border-radius:12px; background:#fff; }
        .followUpCustomer { flex:1; min-width:0; border:0; background:transparent; padding:0; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:4px; }
        .followUpCustomer strong { color:#172033; font-size:13px; }
        .followUpCustomer span { color:#7b8794; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .followUpDate { min-width:105px; text-align:right; display:flex; flex-direction:column; gap:3px; }
        .followUpDate strong { color:#334155; font-size:11px; }
        .followUpDate span { color:#94a3b8; font-size:10px; }
        @media (max-width:700px) { .followUpStats { grid-template-columns:repeat(2,minmax(0,1fr)); } .followUpHeaderRow { align-items:flex-start; flex-direction:column; } }
        @media (max-width:480px) { .followUpPageItem { align-items:flex-start; } .followUpDate { min-width:75px; } }
\n        /* STEP 16 — AI CUSTOMER COPILOT */
        .aiProfileAction { color:#7c3aed !important; border-color:#ddd6fe !important; background:#faf5ff !important; }
        .aiProfileAction:hover { border-color:#c4b5fd !important; background:#f5f3ff !important; }
        .aiModalOverlay { position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,.38); display:flex; align-items:center; justify-content:center; padding:24px; pointer-events:none; }
        .aiSummaryModal { pointer-events:auto; width:min(760px,100%); max-height:min(760px,90vh); overflow:hidden; background:#fff; border:1px solid #e5e7eb; border-radius:18px; box-shadow:0 28px 80px rgba(15,23,42,.25); display:flex; flex-direction:column; }
        .aiSummaryHeader { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; padding:20px 22px; border-bottom:1px solid #e8edf3; }
        .aiSummaryTitle { display:flex; align-items:center; gap:13px; min-width:0; }
        .aiSummaryTitle > div:last-child { min-width:0; }
        .aiSummaryTitle h2 { margin:4px 0 2px; color:#172033; font-size:20px; }
        .aiSummaryTitle p { margin:0; color:#7b8794; font-size:11px; }
        .aiSummaryIcon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:#f3e8ff; color:#7c3aed; flex:none; }
        .aiSummaryBody { padding:22px; overflow:auto; min-height:290px; }
        .aiEmptyState, .aiLoadingState { min-height:250px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:7px; color:#94a3b8; }
        .aiEmptyState > svg, .aiLoadingState > svg { color:#8b5cf6; }
        .aiEmptyState h3, .aiLoadingState h3 { margin:4px 0 0; color:#334155; font-size:15px; }
        .aiEmptyState p, .aiLoadingState p { max-width:470px; margin:0; color:#94a3b8; font-size:11px; line-height:1.6; }
        .aiSpinner { width:28px; height:28px; border:3px solid #ede9fe; border-top-color:#8b5cf6; border-radius:50%; animation:aiSpin .8s linear infinite; }
        @keyframes aiSpin { to { transform:rotate(360deg); } }
        .aiResult { display:flex; flex-direction:column; gap:10px; }
        .aiResultCard { border:1px solid #e7eaf0; border-radius:12px; background:#fff; overflow:hidden; }
        .aiResultCardHeader { display:flex; align-items:center; gap:9px; padding:12px 14px; border-bottom:1px solid #eef1f5; background:#fbfcfe; }
        .aiResultCardHeader .aiSectionIcon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#f3e8ff; color:#7c3aed; flex:none; }
        .aiResultCardHeader strong { color:#273449; font-size:12px; }
        .aiResultCardBody { padding:13px 14px; color:#475569; font-size:12px; line-height:1.6; }
        .aiResultCardBody p { margin:0 0 8px; }
        .aiResultCardBody p:last-child { margin-bottom:0; }
        .aiBulletList { display:flex; flex-direction:column; gap:8px; margin:0; padding:0; list-style:none; }
        .aiBulletItem { display:flex; align-items:flex-start; gap:8px; }
        .aiBulletDot { width:5px; height:5px; margin-top:7px; border-radius:50%; background:#8b5cf6; flex:none; }
        .aiPaymentGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
        .aiPaymentMetric { padding:10px; border-radius:9px; background:#f8fafc; border:1px solid #eef1f5; display:flex; flex-direction:column; gap:3px; }
        .aiPaymentMetric span { color:#94a3b8; font-size:9px; }
        .aiPaymentMetric strong { color:#1e293b; font-size:15px; }
        .aiNextAction { padding:11px 12px; border-radius:9px; background:#f5f3ff; border:1px solid #ddd6fe; color:#5b21b6; font-weight:600; }
        .aiCustomerMessage { position:relative; padding:12px 13px; border-radius:10px; background:#f8fafc; border:1px solid #e5e7eb; color:#334155; line-height:1.65; }
        .aiCopyMessage { margin-top:9px; }
        .theme-dark .aiResultCard { background:#172033; border-color:#334155; }
        .theme-dark .aiResultCardHeader { background:#111827; border-color:#334155; }
        .theme-dark .aiResultCardHeader strong, .theme-dark .aiPaymentMetric strong { color:#f1f5f9; }
        .theme-dark .aiResultCardBody { color:#cbd5e1; }
        .theme-dark .aiPaymentMetric { background:#111827; border-color:#334155; }
        .theme-dark .aiNextAction { background:#2b2140; border-color:#6d4ca8; color:#ddd6fe; }
        .theme-dark .aiCustomerMessage { background:#111827; border-color:#334155; color:#e2e8f0; }
        @media (max-width:640px) { .aiPaymentGrid { grid-template-columns:1fr; } }
        .aiErrorState { display:flex; align-items:flex-start; gap:11px; padding:15px; border:1px solid #fecaca; border-radius:12px; background:#fff7f7; color:#b91c1c; }
        .aiErrorState strong { display:block; font-size:12px; margin-bottom:3px; }
        .aiErrorState p { margin:0; color:#991b1b; font-size:11px; line-height:1.5; }
        .aiSummaryFooter { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:15px 22px; border-top:1px solid #e8edf3; background:#fbfcfe; }
        .aiSummaryFooter span { color:#94a3b8; font-size:10px; line-height:1.4; }
        .aiSummaryFooter .primaryButton { white-space:nowrap; }
        .aiSetupState { min-height:360px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:9px; padding:28px; }
        .aiSetupState > svg { color:#8b5cf6; }
        .aiSetupState h3 { margin:4px 0 0; color:#334155; font-size:16px; }
        .aiSetupState p { max-width:430px; margin:0 0 9px; color:#94a3b8; font-size:11px; line-height:1.6; }
        .aiSettingsCard .settingsActions { align-items:center; }
        .aiKeyField { display:flex; flex-direction:column; gap:7px; margin-bottom:12px; color:#334155; font-size:11px; font-weight:700; }
        .aiKeyField input { width:100%; box-sizing:border-box; }
        .aiSettingsNote { display:flex; align-items:flex-start; gap:9px; padding:11px 12px; border:1px solid #fde68a; border-radius:10px; background:#fffbeb; color:#92400e; font-size:10px; line-height:1.55; margin-bottom:14px; }
        .aiSettingsNote svg { flex:none; margin-top:1px; }
        .theme-emerald .aiProfileAction { color:#047857 !important; border-color:#a7f3d0 !important; background:#ecfdf5 !important; }
        .theme-dark .aiSummaryModal { background:#111827; border-color:#334155; }
        .theme-dark .aiSummaryHeader, .theme-dark .aiSummaryFooter { border-color:#334155; background:#172033; }
        .theme-dark .aiSummaryTitle h2, .theme-dark .aiEmptyState h3, .theme-dark .aiLoadingState h3, .theme-dark .aiSetupState h3 { color:#f1f5f9; }
        .theme-dark .aiSummaryBody { background:#111827; }
        .theme-dark .aiResult { background:#172033; border-color:#334155; color:#cbd5e1; }
        .theme-dark .aiResult .aiHeadingLine { color:#c4b5fd; }
        .theme-dark .aiSetupState, .theme-dark .aiEmptyState, .theme-dark .aiLoadingState { color:#94a3b8; }
        .theme-dark .aiSettingsNote { background:#2b2516; border-color:#7c5f18; color:#fcd34d; }
        @media (max-width:640px) { .aiModalOverlay { padding:10px; } .aiSummaryModal { max-height:94vh; border-radius:14px; } .aiSummaryHeader, .aiSummaryFooter { padding:15px; } .aiSummaryBody { padding:15px; } .aiSummaryFooter { align-items:stretch; flex-direction:column; } .aiSummaryFooter .primaryButton { width:100%; } }




        /* HELP & SUPPORT */
        .helpSupportPage { max-width:1100px; }
        .helpSupportGrid { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr); gap:16px; align-items:start; }
        .helpFaqCard, .helpChatCard { padding:0; overflow:hidden; }
        .helpCardHeader { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:17px 18px; border-bottom:1px solid #e8edf3; background:#fbfcfe; }
        .helpCardHeader h2 { margin:4px 0 0; color:#172033; font-size:17px; }
        .helpHeaderIcon, .helpChatIcon { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:#eff6ff; color:#2563eb; }
        .helpChatIcon { background:#ecfeff; color:#0891b2; }
        .helpFaqList { padding:8px 14px 14px; }
        .helpFaqItem { border-bottom:1px solid #eef1f5; }
        .helpFaqItem:last-child { border-bottom:0; }
        .helpFaqItem > button { width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 4px; border:0; background:transparent; color:#334155; cursor:pointer; text-align:left; font:inherit; font-size:11px; font-weight:700; }
        .helpFaqItem > button svg { flex:none; color:#94a3b8; transition:.18s ease; }
        .helpFaqItem.open > button { color:#1d4ed8; }
        .helpFaqItem.open > button svg { transform:rotate(90deg); color:#2563eb; }
        .helpFaqAnswer { padding:0 30px 14px 4px; color:#64748b; font-size:10px; line-height:1.65; }
        .helpChatMessages { height:300px; overflow:auto; padding:14px; display:flex; flex-direction:column; gap:10px; background:#f8fafc; }
        .helpChatMessage { max-width:88%; padding:9px 11px; border-radius:11px; font-size:10px; line-height:1.55; }
        .helpChatMessage.bot { align-self:flex-start; background:#fff; border:1px solid #e2e8f0; color:#475569; }
        .helpChatMessage.user { align-self:flex-end; background:#eff6ff; border:1px solid #dbeafe; color:#1e40af; }
        .helpChatMessage span { display:block; margin-bottom:3px; font-size:8px; font-weight:800; letter-spacing:1px; opacity:.7; }
        .helpChatMessage p { margin:0; }
        .helpQuickQuestions { display:flex; flex-wrap:wrap; gap:6px; padding:11px 13px 0; }
        .helpQuickQuestions button { border:1px solid #dbeafe; background:#fff; color:#2563eb; border-radius:999px; padding:6px 9px; cursor:pointer; font:inherit; font-size:9px; }
        .helpQuickQuestions button:hover { background:#eff6ff; }
        .helpChatForm { display:flex; gap:7px; padding:12px 13px 7px; }
        .helpChatForm input { flex:1; min-width:0; box-sizing:border-box; padding:10px 11px; border:1px solid #dfe5ec; border-radius:10px; outline:none; background:#fff; color:#334155; font:inherit; font-size:10px; }
        .helpChatForm input:focus { border-color:#93c5fd; box-shadow:0 0 0 3px rgba(59,130,246,.08); }
        .helpChatForm button { width:38px; min-width:38px; border:1px solid #2563eb; border-radius:10px; background:#2563eb; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .helpChatNote { margin:0; padding:0 13px 13px; color:#94a3b8; font-size:8px; line-height:1.5; }
        .theme-dark .helpCardHeader { background:#111827; border-color:#334155; }
        .theme-dark .helpCardHeader h2 { color:#f1f5f9; }
        .theme-dark .helpHeaderIcon { background:#172554; color:#93c5fd; }
        .theme-dark .helpChatIcon { background:#083344; color:#67e8f9; }
        .theme-dark .helpFaqItem { border-color:#334155; }
        .theme-dark .helpFaqItem > button { color:#cbd5e1; }
        .theme-dark .helpFaqItem.open > button { color:#93c5fd; }
        .theme-dark .helpFaqAnswer { color:#94a3b8; }
        .theme-dark .helpChatMessages { background:#111827; }
        .theme-dark .helpChatMessage.bot { background:#172033; border-color:#334155; color:#cbd5e1; }
        .theme-dark .helpChatMessage.user { background:#172554; border-color:#1e3a8a; color:#bfdbfe; }
        .theme-dark .helpQuickQuestions button { background:#172033; border-color:#334155; color:#93c5fd; }
        .theme-dark .helpChatForm input { background:#172033 !important; border-color:#334155 !important; }
        @media (max-width:820px) { .helpSupportGrid { grid-template-columns:1fr; } }
        @media (max-width:520px) { .helpChatMessages { height:260px; } .helpCardHeader { padding:14px; } .helpFaqList { padding:6px 11px 11px; } }

        /* STEP 19C — ROLE BASED ACCESS */
        .roleBadge { display:inline-flex; align-items:center; gap:5px; margin-top:2px; padding:3px 6px; border-radius:999px; background:#eff6ff; color:#2563eb !important; border:1px solid #dbeafe; width:max-content; text-transform:uppercase; }
        .theme-dark .roleBadge { background:#172554; color:#93c5fd !important; border-color:#1e3a8a; }
        .roleNotice { display:flex; align-items:center; gap:9px; margin-bottom:16px; padding:11px 13px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; color:#64748b; font-size:10px; }
        .roleNotice strong { color:#334155; }
        .theme-dark .roleNotice { background:#111827; border-color:#334155; color:#94a3b8; }
        .theme-dark .roleNotice strong { color:#e2e8f0; }

        /* STEP 17A — AUTHENTICATION */
        .authShell { min-height:100vh; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; padding:28px; background:#0b1220; color:#e2e8f0; box-sizing:border-box; }
        .authBackgroundGlow { position:absolute; width:430px; height:430px; border-radius:50%; filter:blur(80px); opacity:.22; pointer-events:none; }
        .authGlowOne { background:#2563eb; top:-180px; left:-130px; }
        .authGlowTwo { background:#06b6d4; right:-170px; bottom:-190px; }
        .authCard { position:relative; z-index:1; width:min(450px,100%); box-sizing:border-box; padding:32px; border:1px solid #26354b; border-radius:20px; background:rgba(17,24,39,.94); box-shadow:0 28px 80px rgba(0,0,0,.34); backdrop-filter:blur(12px); }
        .authBrand { display:flex; align-items:center; gap:11px; margin-bottom:31px; }
        .authBrandIcon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:#2563eb; color:#fff; box-shadow:0 8px 24px rgba(37,99,235,.28); }
        .authBrandName { color:#f8fafc; font-size:16px; font-weight:800; letter-spacing:-.3px; }
        .authBrandSub { color:#60a5fa; font-size:9px; font-weight:800; letter-spacing:3px; margin-top:1px; }
        .authIntro span { color:#60a5fa; font-size:9px; font-weight:800; letter-spacing:1.7px; }
        .authIntro h1 { margin:7px 0 6px; color:#f8fafc; font-size:27px; line-height:1.15; letter-spacing:-.6px; }
        .authIntro p { margin:0 0 25px; color:#94a3b8; font-size:11px; line-height:1.6; }
        .authForm { display:flex; flex-direction:column; gap:15px; }
        .authForm label { display:flex; flex-direction:column; gap:7px; }
        .authForm label span { color:#cbd5e1; font-size:10px; font-weight:700; }
        .authForm input { width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid #334155; border-radius:10px; outline:none; background:#0f172a; color:#f8fafc; font:inherit; font-size:11px; }
        .authForm input::placeholder { color:#64748b; }
        .authForm input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.13); }
        .authSubmit { width:100%; border:1px solid #2563eb; border-radius:10px; padding:11px 14px; background:#2563eb; color:#fff; cursor:pointer; font:inherit; font-size:11px; font-weight:800; margin-top:2px; transition:.18s ease; }
        .authSubmit:hover:not(:disabled) { background:#1d4ed8; transform:translateY(-1px); }
        .authSubmit:disabled { opacity:.65; cursor:wait; }
        .authAlert { display:flex; align-items:flex-start; gap:8px; padding:10px 11px; border-radius:10px; font-size:10px; line-height:1.5; }
        .authAlert svg { flex:none; margin-top:1px; }
        .authAlertError { border:1px solid #7f1d1d; background:#2a1518; color:#fca5a5; }
        .authAlertSuccess { border:1px solid #14532d; background:#10251a; color:#86efac; }
        .authSwitch { display:flex; align-items:center; justify-content:center; gap:5px; margin-top:19px; color:#64748b; font-size:10px; }
        .authSwitch button { border:0; padding:0; background:transparent; color:#60a5fa; cursor:pointer; font:inherit; font-weight:700; }
        .authSecurityNote { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:22px; padding-top:16px; border-top:1px solid #253044; color:#64748b; font-size:9px; }
        .authSecurityNote svg { color:#34d399; }
        .authLoadingScreen { min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; background:#0b1220; color:#94a3b8; font-size:11px; }
        .authLoadingIcon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:#2563eb; color:#fff; }
        .sidebarBottom { display:flex; flex-direction:column; }
        .sidebarBottom .workspaceCard { margin-top:auto; }
        .accountMenuWrap { position:relative; z-index:120; }
        .avatarButton { border:0; cursor:pointer; transition:.18s ease; }
        .avatarButton:hover, .avatarButton.open { transform:translateY(-1px); box-shadow:0 0 0 3px rgba(37,99,235,.12); }
        .accountMenuBackdrop { position:fixed; inset:0; z-index:-1; border:0; background:transparent; cursor:default; }
        .accountDropdown { position:absolute; top:calc(100% + 10px); right:0; width:280px; padding:9px; border:1px solid #dfe6ee; border-radius:14px; background:#fff; box-shadow:0 18px 45px rgba(15,23,42,.16); z-index:121; }
        .accountDropdownHeader { display:flex; align-items:center; gap:10px; padding:9px; }
        .accountDropdownAvatar { width:38px; height:38px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex:none; background:#eff6ff; color:#2563eb; font-size:14px; font-weight:850; }
        .accountDropdownIdentity { min-width:0; flex:1; display:flex; flex-direction:column; gap:3px; }
        .accountDropdownIdentity strong { color:#172033; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .accountDropdownIdentity span { color:#94a3b8; font-size:9px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .accountDropdownIdentity em { display:inline-flex; align-items:center; gap:4px; width:max-content; color:#2563eb; font-size:8px; font-style:normal; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
        .accountDropdownDivider { height:1px; margin:4px 4px 7px; background:#edf1f5; }
        .accountDropdownItem { width:100%; display:flex; align-items:center; gap:10px; padding:10px 10px; border:0; border-radius:9px; background:transparent; color:#475569; cursor:pointer; font:inherit; font-size:10px; font-weight:700; text-align:left; }
        .accountDropdownItem span { flex:1; }
        .accountDropdownItem > svg:first-child { color:#64748b; flex:none; }
        .accountDropdownItem > svg:last-child { color:#cbd5e1; flex:none; }
        .accountDropdownItem:hover, .accountDropdownItem.active { background:#f5f8fc; color:#2563eb; }
        .accountDropdownItem:hover > svg:first-child, .accountDropdownItem.active > svg:first-child { color:#2563eb; }
        .accountDropdownItem.danger { color:#b91c1c; margin-top:2px; }
        .accountDropdownItem.danger > svg:first-child { color:#b91c1c; }
        .accountDropdownItem.danger:hover { background:#fff1f2; color:#b91c1c; }
        .theme-dark .accountDropdown { background:#172033; border-color:#334155; box-shadow:0 18px 45px rgba(0,0,0,.35); }
        .theme-dark .accountDropdownIdentity strong { color:#f1f5f9; }
        .theme-dark .accountDropdownIdentity span { color:#94a3b8; }
        .theme-dark .accountDropdownDivider { background:#2b3950; }
        .theme-dark .accountDropdownItem { color:#cbd5e1; }
        .theme-dark .accountDropdownItem:hover, .theme-dark .accountDropdownItem.active { background:#1e293b; color:#60a5fa; }
        .theme-dark .accountDropdownItem.danger:hover { background:#2a1518; }
        @media (max-width:640px) { .accountDropdown { position:fixed; top:64px; right:12px; width:min(280px,calc(100vw - 24px)); } }
        .accountCard { display:flex; align-items:center; gap:8px; margin:10px 10px 9px; padding:9px; border:1px solid #26354b; border-radius:10px; background:#111827; }
        .accountAvatar { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; background:#1e3a8a; color:#bfdbfe; font-size:11px; font-weight:800; flex:none; }
        .accountInfo { min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }
        .accountInfo strong { color:#e2e8f0; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .accountInfo span { color:#64748b; font-size:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .accountSignOut { width:28px; height:28px; display:flex; align-items:center; justify-content:center; flex:none; border:1px solid #334155; border-radius:8px; background:transparent; color:#94a3b8; cursor:pointer; }
        .accountSignOut:hover { color:#fca5a5; border-color:#7f1d1d; background:#2a1518; }
        .theme-light .authShell { background:#f1f5f9; color:#172033; }
        .theme-light .authCard { background:#fff; border-color:#e2e8f0; box-shadow:0 28px 70px rgba(15,23,42,.12); }
        @media (max-width:520px) { .authShell { padding:14px; } .authCard { padding:24px 20px; border-radius:16px; } .authIntro h1 { font-size:24px; } }
        /* FINAL WORKSPACE POLISH — search, quick links, settings and themes */\n        .globalSearchWrap { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(620px,52vw); z-index:50; }\n        .globalSearchWrap .searchBox { position:relative; left:auto; top:auto; transform:none; width:100%; }\n        .searchClear { margin-left:auto; border:0; background:transparent; color:#94a3b8; cursor:pointer; display:flex; align-items:center; padding:3px; }\n        .searchClear:hover { color:#475569; }\n        .globalSearchPanel { position:absolute; top:calc(100% + 9px); left:0; right:0; background:#fff; border:1px solid #e2e8f0; border-radius:13px; box-shadow:0 16px 40px rgba(15,23,42,.13); padding:7px; overflow:hidden; }\n        .globalSearchResult { width:100%; display:flex; align-items:center; gap:11px; padding:10px 11px; border:0; border-radius:9px; background:transparent; color:#64748b; cursor:pointer; text-align:left; text-decoration:none; }\n        .globalSearchResult:hover { background:#f6f8fb; color:#2563eb; }\n        .globalSearchResult > svg:first-child { flex:none; }\n        .globalSearchResult > div { min-width:0; flex:1; display:flex; flex-direction:column; gap:2px; }\n        .globalSearchResult strong { color:#172033; font-size:12px; }\n        .globalSearchResult span { color:#94a3b8; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n        .globalSearchEmpty { display:flex; align-items:center; gap:9px; padding:15px 12px; color:#94a3b8; font-size:11px; }\n        .dashboardQuickLinks { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }\n        .dashboardQuickLink { display:flex; align-items:center; gap:10px; min-width:0; padding:12px; border:1px solid #e5eaf0; border-radius:11px; background:#fff; color:#64748b; text-decoration:none; transition:.18s ease; }\n        .dashboardQuickLink:hover { transform:translateY(-1px); border-color:#cbd5e1; box-shadow:0 5px 15px rgba(15,23,42,.05); }\n        .dashboardQuickLinkIcon { width:30px; height:30px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:#eff6ff; color:#2563eb; flex:none; }\n        .dashboardQuickLink > div:nth-child(2) { min-width:0; flex:1; display:flex; flex-direction:column; gap:3px; }\n        .dashboardQuickLink strong { color:#172033; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n        .dashboardQuickLink span { color:#94a3b8; font-size:9px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n        .dashboardQuickLinksEmpty { display:flex; align-items:center; gap:12px; padding:18px; border:1px dashed #d8e0e9; border-radius:11px; color:#94a3b8; background:#fbfcfe; }\n        .dashboardQuickLinksEmpty span { flex:1; font-size:11px; }\n        .officialQuickLinks { margin-top:28px; }\n        .officialQuickGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }\n        .officialQuickItem { display:flex; align-items:center; gap:10px; padding:11px 12px; border:1px solid #e5eaf0; border-radius:10px; background:#fff; }\n        .officialQuickItem > div:nth-child(2) { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }\n        .officialQuickItem strong { color:#172033; font-size:11px; }\n        .officialQuickItem span { color:#94a3b8; font-size:9px; }\n        .officialQuickItem .small { min-height:29px; padding:5px 9px; font-size:10px; }\n        .officialQuickItem .small:disabled { cursor:default; opacity:.6; }\n        .billingPanel { overflow:hidden; }
        .billingHeader { margin-bottom:18px; }
        .billingHeaderIcon { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:#eff6ff; color:#2563eb; border:1px solid #dbeafe; flex:0 0 auto; }
        .billingPlanHero { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:20px; border:1px solid #dbeafe; border-radius:16px; background:linear-gradient(135deg,#f8fbff,#ffffff); }
        .billingPlanMain { display:flex; align-items:center; gap:14px; min-width:0; }
        .billingPlanIcon { width:46px; height:46px; border-radius:13px; display:flex; align-items:center; justify-content:center; background:#2563eb; color:#fff; box-shadow:0 7px 18px rgba(37,99,235,.18); flex:0 0 auto; }
        .billingPlanTitleRow { display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-top:5px; }
        .billingPlanTitleRow h3 { margin:0; color:#172033; font-size:22px; letter-spacing:-.3px; }
        .billingPlanMain p { margin:5px 0 0; color:#64748b; font-size:11px; line-height:1.5; }
        .billingStatus { display:inline-flex; align-items:center; padding:4px 8px; border-radius:999px; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.45px; border:1px solid; }
        .billingStatus.trial { color:#92400e; background:#fffbeb; border-color:#fde68a; }
        .billingStatus.active { color:#166534; background:#f0fdf4; border-color:#bbf7d0; }
        .billingStatus.danger { color:#b91c1c; background:#fff1f2; border-color:#fecaca; }
        .billingStatus.neutral { color:#475569; background:#f8fafc; border-color:#e2e8f0; }
        .billingPlanExpiry { min-width:125px; padding-left:18px; border-left:1px solid #e2e8f0; text-align:right; }
        .billingPlanExpiry span { display:block; color:#94a3b8; font-size:8px; font-weight:800; letter-spacing:.7px; }
        .billingPlanExpiry strong { display:block; margin-top:5px; color:#334155; font-size:13px; }
        .billingSectionTitle { display:flex; align-items:flex-end; justify-content:space-between; gap:10px; margin:24px 0 11px; }
        .billingSectionTitle h3 { margin:4px 0 0; color:#172033; font-size:15px; }
        .billingSectionTitle > span { color:#94a3b8; font-size:9px; font-weight:600; }
        .billingUsageGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }
        .billingUsageCard { padding:15px; border:1px solid #e5eaf0; border-radius:13px; background:#fff; }
        .billingUsageTop { display:flex; align-items:center; gap:10px; }
        .billingUsageIcon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; color:#2563eb; background:#eff6ff; border:1px solid #dbeafe; flex:0 0 auto; }
        .billingUsageTop > div:nth-child(2) { min-width:0; flex:1; }
        .billingUsageTop strong { display:block; color:#334155; font-size:11px; }
        .billingUsageTop span { display:block; margin-top:3px; color:#94a3b8; font-size:9px; }
        .billingUsagePercent { font-size:10px; font-weight:800; }
        .billingUsagePercent.normal { color:#2563eb; }
        .billingUsagePercent.warning { color:#b45309; }
        .billingUsagePercent.danger { color:#dc2626; }
        .billingProgressTrack { height:7px; margin-top:13px; overflow:hidden; border-radius:999px; background:#eef2f7; }
        .billingProgressFill { height:100%; min-width:0; border-radius:999px; transition:width .25s ease; }
        .billingProgressFill.normal { background:#2563eb; }
        .billingProgressFill.warning { background:#f59e0b; }
        .billingProgressFill.danger { background:#ef4444; }
        .billingUsageBottom { display:flex; justify-content:space-between; gap:10px; margin-top:7px; color:#94a3b8; font-size:8px; }
        .billingUsageBottom span:first-child { font-weight:700; }
        .billingComingSoonCard { display:flex; align-items:center; gap:12px; margin-top:18px; padding:14px 15px; border:1px solid #e2e8f0; border-radius:13px; background:#f8fafc; }
        .billingUpgradeIcon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#2563eb; background:#eff6ff; border:1px solid #dbeafe; flex:0 0 auto; }
        .billingUpgradeCopy { flex:1; min-width:0; }
        .billingUpgradeCopy strong { display:block; color:#334155; font-size:11px; }
        .billingUpgradeCopy span { display:block; margin-top:3px; color:#7b8794; font-size:9px; line-height:1.5; }
        .billingComingSoonBadge { flex:0 0 auto; padding:6px 8px; border-radius:999px; background:#eef2ff; border:1px solid #e0e7ff; color:#4f46e5; font-size:8px; font-weight:900; letter-spacing:.06em; white-space:nowrap; }
        .billingLoadingGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }
        .billingSkeleton { height:92px; border:1px solid #e5eaf0; border-radius:13px; background:#f8fafc; padding:15px; }
        .billingSkeleton span,.billingSkeleton strong,.billingSkeleton small { display:block; border-radius:6px; background:#e8edf3; }
        .billingSkeleton span { width:38%; height:10px; }
        .billingSkeleton strong { width:65%; height:13px; margin-top:13px; }
        .billingSkeleton small { width:48%; height:8px; margin-top:9px; }
        .billingErrorBox { display:flex; gap:11px; align-items:flex-start; padding:15px; border:1px solid #fecaca; border-radius:13px; background:#fff7f7; color:#b91c1c; }
        .billingErrorBox > div:first-child { padding-top:1px; }
        .billingErrorBox strong { display:block; font-size:11px; }
        .billingErrorBox span { display:block; margin-top:4px; color:#7f1d1d; font-size:9px; line-height:1.5; }
        @media (max-width:820px) { .billingPlanHero { align-items:flex-start; flex-direction:column; } .billingPlanExpiry { width:100%; padding:11px 0 0; border-left:0; border-top:1px solid #e2e8f0; text-align:left; } }
        @media (max-width:620px) { .billingUsageGrid,.billingLoadingGrid { grid-template-columns:1fr; } .billingComingSoonCard { align-items:flex-start; flex-wrap:wrap; } .billingComingSoonBadge { margin-left:48px; } }
        .settingsTabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin:18px 0 16px; align-items:stretch; }
        .settingsTab { min-width:0; min-height:68px; display:flex; align-items:center; justify-content:flex-start; gap:10px; padding:12px 13px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; color:#64748b; cursor:pointer; text-align:left; transition:.18s ease; box-sizing:border-box; }
        .settingsTab:hover { border-color:#cbd5e1; background:#f8fafc; }
        .settingsTab > svg { flex:none; color:#64748b; }
        .settingsTab > span { min-width:0; display:flex; flex-direction:column; gap:3px; }
        .settingsTab strong { color:#334155; font-size:11px; font-weight:800; }
        .settingsTab small { color:#94a3b8; font-size:9px; }
        .settingsTab.active { border-color:#bfdbfe; background:#eff6ff; box-shadow:0 4px 12px rgba(37,99,235,.06); }
        .settingsTab.active > svg { color:#2563eb; }
        .settingsTab.active strong { color:#1d4ed8; }
        .settingsTabPanel { margin-top:0; min-height:230px; }
        .themeToggle { display:flex; align-items:center; gap:7px; border:1px solid #e2e8f0; background:#fff; border-radius:999px; padding:4px 6px 4px 7px; cursor:pointer; box-shadow:0 2px 8px rgba(15,23,42,.04); transition:.18s ease; }
        .themeToggle:hover { border-color:#bfdbfe; box-shadow:0 4px 12px rgba(37,99,235,.08); }
        .themeToggleIcon { display:flex; align-items:center; justify-content:center; width:20px; height:20px; color:#f59e0b; }
        .themeToggle.dark .themeToggleIcon { color:#475569; }
        .themeToggleTrack { position:relative; width:34px; height:19px; border-radius:999px; background:#dbeafe; padding:2px; display:flex; align-items:center; transition:.18s ease; }
        .themeToggle.dark .themeToggleTrack { background:#334155; }
        .themeToggleThumb { display:block; width:15px; height:15px; border-radius:50%; background:#fff; box-shadow:0 1px 4px rgba(15,23,42,.2); transform:translateX(0); transition:.18s ease; }
        .themeToggle.dark .themeToggleThumb { transform:translateX(15px); }
        @media (max-width:620px) { .themeToggle { padding:4px 5px; } .themeToggleIcon { width:18px; } }
        .settingsPage { max-width:1100px; }\n        .settingsOptionCard { margin-top:22px; padding:22px; border:1px solid #e5eaf0; border-radius:14px; background:#fff; box-shadow:0 4px 14px rgba(15,23,42,.035); }\n        .settingsOptionHeader { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:17px; }\n        .settingsOptionHeader h2 { margin:5px 0 4px; color:#172033; font-size:18px; }\n        .settingsOptionHeader p { margin:0; color:#7b8794; font-size:11px; line-height:1.55; }\n        .themeOptions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }\n        .themeOption { display:flex; align-items:center; gap:11px; padding:13px 14px; border:1px solid #e2e8f0; border-radius:11px; background:#fff; color:#64748b; cursor:pointer; text-align:left; }\n        .themeOption > div { flex:1; display:flex; flex-direction:column; gap:3px; }\n        .themeOption strong { color:#334155; font-size:12px; }\n        .themeOption span { color:#94a3b8; font-size:10px; }\n        .themeOption.active { border-color:#bfdbfe; background:#eff6ff; color:#2563eb; }\n        .themeOption.active strong { color:#1d4ed8; }\n        .themePreview { width:84px; height:54px; padding:7px; border-radius:9px; display:flex; gap:5px; border:1px solid #e2e8f0; }\n        .themePreview.light { background:#f8fafc; }\n        .themePreview.dark { background:#172033; border-color:#334155; } .themePreview.emerald { background:#ecfdf5; border-color:#a7f3d0; } .themePreview.emerald span { background:#a7f3d0; }\n        .themePreview span { flex:1; border-radius:4px; background:#dbeafe; }\n        .themePreview span:first-child { flex:0 0 24%; }\n        .themePreview.dark span { background:#334155; }\n        .settingsDataActions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }\n        .settingsDataButton { justify-content:flex-start; text-align:left; min-height:58px; }\n        .settingsDataButton div { display:flex; flex-direction:column; gap:3px; }\n        .settingsDataButton strong { font-size:11px; color:inherit; }\n        .settingsDataButton span { font-size:9px; color:#94a3b8; font-weight:500; }\n        @media (max-width:980px) { .settingsTabs { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:680px) { .settingsTabs { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:520px) { .settingsTabs { grid-template-columns:1fr; } .settingsTab { min-height:58px; padding:12px; } }
        .theme-emerald { color:#24332c; }
        .theme-emerald .mainArea, .theme-emerald .content { background:#f4faf7; }
        .theme-emerald .topbar { background:#ffffff; border-color:#d8ebe1; }
        .theme-emerald .searchBox { border-color:#cfe4d8; }
        .theme-emerald .searchBox:focus-within { border-color:#10b981; box-shadow:0 0 0 3px rgba(16,185,129,.12); }
        .theme-emerald .globalSearchPanel, .theme-emerald .dashboardCard, .theme-emerald .opsCard, .theme-emerald .statsCard, .theme-emerald .serviceCard, .theme-emerald .managedServiceCard, .theme-emerald .calculatorCard, .theme-emerald .quickLinkForm, .theme-emerald .savedLinks, .theme-emerald .settingsPanel, .theme-emerald .settingsOptionCard, .theme-emerald .dashboardQuickLink, .theme-emerald .officialQuickItem, .theme-emerald .followUpPageItem, .theme-emerald .followUpStats > div, .theme-emerald .modalCard { border-color:#d8ebe1; }
        .theme-emerald .pageHeading h1, .theme-emerald .sectionHeading h2, .theme-emerald .dashboardCard h3, .theme-emerald .opsCard strong, .theme-emerald .managedServiceTitle h3, .theme-emerald .settingsOptionHeader h2, .theme-emerald .settingsIntro h3, .theme-emerald .calculatorHeader h3, .theme-emerald .savedLink strong, .theme-emerald .officialQuickItem strong, .theme-emerald .globalSearchResult strong, .theme-emerald .followUpCustomer strong, .theme-emerald .followUpMain strong { color:#17382b; }
        .theme-emerald .themeOption.active { border-color:#6ee7b7; background:#ecfdf5; color:#059669; }
        .theme-emerald .themeOption.active strong { color:#047857; }
        .theme-emerald .primary, .theme-emerald button.primary { background:#059669; border-color:#059669; }
        .theme-emerald .primary:hover, .theme-emerald button.primary:hover { background:#047857; border-color:#047857; }
        .theme-emerald .servicePrice, .theme-emerald .dashboardQuickLink:hover, .theme-emerald .globalSearchResult:hover { color:#059669; }
        .theme-emerald .globalSearchResult:hover { background:#f0fdf4; }
        .theme-emerald .filterActiveBadge, .theme-emerald .tableDocumentProgress.complete { color:#047857; }
        .theme-emerald .statusDot { box-shadow:0 0 0 4px rgba(16,185,129,.12); }
        .theme-emerald .dashboardQuickLink > div:first-child, .theme-emerald .officialQuickItem > div:first-child { background:#ecfdf5; color:#059669; }
        .theme-emerald input:focus, .theme-emerald select:focus, .theme-emerald textarea:focus { border-color:#34d399 !important; box-shadow:0 0 0 3px rgba(16,185,129,.10); }
        .theme-dark { color:#e2e8f0; }\n        .theme-dark .mainArea, .theme-dark .content { background:#0f172a; }\n        .theme-dark .topbar { background:#111827; border-color:#253044; }\n        .theme-dark .searchBox { background:#182234; border-color:#334155; color:#94a3b8; }\n        .theme-dark .searchBox input { color:#e2e8f0; }\n        .theme-dark .globalSearchPanel, .theme-dark .dashboardCard, .theme-dark .opsCard, .theme-dark .statsCard, .theme-dark .serviceCard, .theme-dark .managedServiceCard, .theme-dark .calculatorCard, .theme-dark .quickLinkForm, .theme-dark .savedLinks, .theme-dark .settingsPanel, .theme-dark .settingsOptionCard, .theme-dark .dashboardQuickLink, .theme-dark .officialQuickItem, .theme-dark .followUpPageItem, .theme-dark .followUpStats > div, .theme-dark .modalCard { background:#172033; border-color:#2b3950; box-shadow:none; }\n        .theme-dark .pageHeading h1, .theme-dark .sectionHeading h2, .theme-dark .dashboardCard h3, .theme-dark .opsCard strong, .theme-dark .managedServiceTitle h3, .theme-dark .settingsOptionHeader h2, .theme-dark .settingsIntro h3, .theme-dark .calculatorHeader h3, .theme-dark .savedLink strong, .theme-dark .officialQuickItem strong, .theme-dark .globalSearchResult strong, .theme-dark .followUpCustomer strong, .theme-dark .followUpMain strong, .theme-dark .followUpStats strong { color:#f1f5f9; }\n        .theme-dark .pageHeading p, .theme-dark .sectionHeading p, .theme-dark .dashboardCardHeader, .theme-dark .opsCard span, .theme-dark .opsCard small, .theme-dark .settingsOptionHeader p, .theme-dark .settingsIntro p, .theme-dark .settingsHint, .theme-dark .savedLink span, .theme-dark .officialQuickItem span, .theme-dark .globalSearchResult span, .theme-dark .followUpCustomer span, .theme-dark .followUpDate span, .theme-dark .followUpStats span { color:#94a3b8; }\n        .theme-dark input, .theme-dark select, .theme-dark textarea { background:#111827 !important; border-color:#334155 !important; color:#e2e8f0 !important; }\n        .theme-dark .themeOption { background:#111827; border-color:#334155; }\n        .theme-dark .themeOption.active { background:#172b4d; border-color:#2563eb; }\n        .theme-dark .dashboardQuickLinksEmpty, .theme-dark .followUpEmpty, .theme-dark .emptyState { background:#111827; border-color:#334155; color:#94a3b8; }\n        .theme-dark .dashboardQuickLink strong { color:#f1f5f9; }\n        .theme-dark .globalSearchResult:hover { background:#1e293b; }\n        .theme-dark .secondaryButton { background:#172033; border-color:#334155; color:#cbd5e1; }\n        .theme-dark .secondaryButton:hover { background:#1e293b; }
        .theme-dark .serviceManagementHeader { background:#172033; border-color:#2b3950; box-shadow:none; }\n        .theme-dark .serviceManagementHeader h2, .theme-dark .serviceDirectoryBlock h2 { color:#f1f5f9; }\n        .theme-dark .managedServiceMeta span { background:#1e293b; color:#94a3b8; }\n        .theme-dark .templateChip, .theme-dark .stageRow { background:#111827; border-color:#334155; color:#cbd5e1; }\n        .theme-dark .documentChecklistItem { background:#172033; border-color:#334155; }\n        .theme-dark .documentChecklistItem strong { color:#f1f5f9; }\n        .theme-dark .documentChecklistItem.missing { background:#2b2516; }\n        .theme-dark .documentChecklistItem.received { background:#13271d; }\n        .theme-dark .tableDocumentProgress small { color:#64748b; }\n        .theme-dark .paymentActivityItem, .theme-dark .attentionItem { background:#172033; border-color:#334155; }\n        .theme-dark .paymentActivityItem strong, .theme-dark .attentionItem strong { color:#f1f5f9; }\n        @media (max-width:900px) { .globalSearchWrap { width:min(560px,58vw); } .dashboardQuickLinks, .officialQuickGrid, .settingsDataActions { grid-template-columns:repeat(2,minmax(0,1fr)); } }\n        @media (max-width:640px) { .globalSearchWrap { position:relative; left:auto; top:auto; transform:none; width:auto; flex:1; order:2; } .topbar { gap:9px; } .topbarRight { order:3; } .dashboardQuickLinks, .officialQuickGrid, .themeOptions, .settingsDataActions { grid-template-columns:1fr; } .settingsOptionCard { padding:17px; } .settingsOptionHeader { flex-direction:column; } }\n        /* MOBILE UX PASS — touch targets, overflow safety and compact workspace layout */
        @media (max-width:640px) {
          html, body, #root { max-width:100%; overflow-x:hidden; }
          .mainArea { min-width:0; width:100%; }
          .content { min-width:0; width:100%; box-sizing:border-box; padding-left:12px !important; padding-right:12px !important; }
          .topbar { min-width:0; padding-left:10px !important; padding-right:10px !important; }
          .mobileMenuButton { flex:0 0 auto; }
          .mobileMenuButton .iconButton { width:40px; height:40px; min-width:40px; display:flex; align-items:center; justify-content:center; }
          .globalSearchWrap { min-width:0; }
          .searchBox { min-width:0; width:100% !important; box-sizing:border-box; }
          .searchBox input { min-width:0; font-size:12px !important; }
          .topbarRight { flex:0 0 auto; min-width:0; gap:6px !important; }
          .systemStatus { display:none !important; }
          .themeToggle { flex:0 0 auto; }
          .accountMenuWrap { flex:0 0 auto; }
          .avatarButton { width:38px !important; height:38px !important; min-width:38px !important; }
          .pageHeading { min-width:0; }
          .pageHeading h1 { font-size:22px !important; line-height:1.2; }
          .pageHeading p { max-width:100%; line-height:1.5; }
          .sectionHeading { min-width:0; }
          .dashboardCard, .opsCard, .statsCard, .serviceCard, .managedServiceCard, .calculatorCard, .settingsPanel, .modalCard { max-width:100%; box-sizing:border-box; }
          button, select, input, textarea { touch-action:manipulation; }
          button { min-height:40px; }
          .iconButton { min-height:40px; }
          .modalOverlay { padding:10px !important; box-sizing:border-box; }
          .modalCard { width:100% !important; max-height:92vh; overflow:auto; }
          .accountDropdown { max-height:calc(100vh - 82px); overflow:auto; }
        }
        @media (max-width:420px) {
          .content { padding-left:10px !important; padding-right:10px !important; }
          .topbar { gap:6px !important; }
          .mobileMenuButton .iconButton { width:38px; height:38px; min-width:38px; }
          .avatarButton { width:36px !important; height:36px !important; min-width:36px !important; }
          .themeToggleTrack { width:30px; }
          .themeToggleThumb { width:13px; height:13px; }
          .themeToggle.dark .themeToggleThumb { transform:translateX(13px); }
          .globalSearchWrap { min-width:0; }
          .searchBox input { font-size:11px !important; }
        }
      `}</style>
      <div className={`appShell ${theme === "dark" ? "theme-dark" : theme === "emerald" ? "theme-emerald" : "theme-light"}`}>
      <Sidebar
        page={page}
        setPage={(value) => {
          setPage(value);
          setMobile(false);
        }}
        mobile={mobile}
        setMobile={setMobile}
        onSettings={() => {
          setPage("Settings");
          setMobile(false);
        }}
        user={user}
        onSignOut={onSignOut}
        workspace={workspace}
        userProfile={userProfile}
        workspaceRole={workspaceRole}
        canManageWorkspace={isOwnerOrAdmin}
        isStaff={isStaff}
        isCustomer={isCustomer}
      />

      <div className="mainArea">
        <header className="topbar">
          <div className="mobileMenuButton">
            <button
              className="iconButton"
              onClick={() =>
                setMobile(true)
              }
            >
              <Menu size={21} />
            </button>
          </div>

          <div className="globalSearchWrap">
            <div className="searchBox">
              <Search size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }}
                placeholder="Search customers, services, references..."
                aria-label="Search workspace"
              />
              {query && (
                <button className="searchClear" onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
            {query.trim() && (
              <GlobalSearchResults
                results={globalSearchResults}
                setPage={(value) => { setPage(value); setQuery(""); }}
                setSelectedCustomer={(value) => { setSelectedCustomer(value); setQuery(""); }}
              />
            )}
          </div>

          <div className="topbarRight">
            <div className="systemStatus">
              <span className="statusDot"></span>
              ONLINE
            </div>

            <button
              type="button"
              className={`themeToggle ${theme === "dark" ? "dark" : "light"}`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <span className="themeToggleIcon">{theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}</span>
              <span className="themeToggleTrack"><span className="themeToggleThumb" /></span>
            </button>

            <div className="accountMenuWrap">
              <button
                type="button"
                className={`avatar avatarButton ${accountMenuOpen ? "open" : ""}`}
                onClick={() => setAccountMenuOpen((value) => !value)}
                aria-label="Open account menu"
                aria-expanded={accountMenuOpen}
              >
                {(user.email || "U").charAt(0).toUpperCase()}
              </button>

              {accountMenuOpen && (
                <>
                  <button
                    type="button"
                    className="accountMenuBackdrop"
                    aria-label="Close account menu"
                    onClick={() => setAccountMenuOpen(false)}
                  />
                  <div className="accountDropdown">
                    <div className="accountDropdownHeader">
                      <div className="accountDropdownAvatar">{(user.email || "U").charAt(0).toUpperCase()}</div>
                      <div className="accountDropdownIdentity">
                        <strong>{user.user_metadata?.business_name || workspace?.name || "My Workspace"}</strong>
                        <span>{user.email || "Signed in"}</span>
                        <em><ShieldCheck size={10} /> {workspaceRole || userProfile?.role || "owner"} account</em>
                      </div>
                    </div>

                    <div className="accountDropdownDivider" />

                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        className={`accountDropdownItem ${page === "Settings" ? "active" : ""}`}
                        onClick={() => { setPage("Settings"); setAccountMenuOpen(false); }}
                      >
                        <Settings size={16} />
                        <span>Settings</span>
                        <ChevronRight size={14} />
                      </button>
                    )}

                    <button
                      type="button"
                      className="accountDropdownItem danger"
                      onClick={() => { setAccountMenuOpen(false); onSignOut(); }}
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          {!isCustomer && role === "staff" && (
            <div className="roleNotice">
              <ShieldCheck size={15} />
              <span><strong>Staff access:</strong> customer operations are enabled; workspace administration and destructive actions are restricted.</span>
            </div>
          )}

          {isCustomer && (
            <CustomerPortal
              user={user}
              workspace={workspace}
              onSignOut={onSignOut}
            />
          )}

          {!isCustomer && page === "Dashboard" && (
            <Dashboard
              tasks={tasks}
              setPage={setPage}
              setSelectedCustomer={
                setSelectedCustomer
              }
              businessProfile={businessProfile}
              links={links}
            />
          )}

          {!isCustomer && page === "Print Jobs" && isOwnerOrAdmin && (
            <PrintJobsPage workspace={workspace} />
          )}

          {!isCustomer && page === "Earnings" && isOwnerOrAdmin && (
            <PrintEarningsPage workspace={workspace} />
          )}

          {!isCustomer && page === "Café QR" && isOwnerOrAdmin && (
            <CafeQRPage
              workspace={workspace}
              businessProfile={businessProfile}
            />
          )}

          {!isCustomer && page === "Services" && (
            <Services
              customServices={serviceTemplates}
              onSaveService={saveServiceTemplate}
              onDeleteService={isOwnerOrAdmin ? deleteServiceTemplate : undefined}
              canManageServices={isOwnerOrAdmin}
            />
          )}

          {!isCustomer && page === "Customer Work" && (
            <Work
              tasks={filteredTasks}
              allTasks={tasks}
              setModal={setModal}
              setSelectedCustomer={
                setSelectedCustomer
              }
              deleteTask={isOwnerOrAdmin ? deleteTask : undefined}
              updateTask={updateTask}
              businessProfile={businessProfile}
              canManageRecords={!isCustomer}
            />
          )}

          {!isCustomer && page === "Calculators" && (
            <Calculators />
          )}

          {!isCustomer && page === "My Quick Links" && (
            <QuickLinks
              links={links}
              addLink={addLink}
              onDeleteLink={isOwnerOrAdmin ? deleteLink : undefined}
              onAddLink={() => setModal("link")}
            />
          )}

          {!isCustomer && page === "Help & Support" && (
            <HelpSupportPage />
          )}

          {!isCustomer && page === "Follow-ups" && (
            <FollowUps
              tasks={tasks}
              setSelectedCustomer={setSelectedCustomer}
              onUpdate={updateTask}
              onAddReminder={setReminderCustomer}
            />
          )}

          {!isCustomer && page === "Reports" && (
            <Reports
              tasks={tasks}
              businessProfile={businessProfile}
            />
          )}

          {!isCustomer && page === "Team" && isOwnerOrAdmin && (
            <TeamPage
              members={teamMembers}
              loading={teamLoading}
              currentUserId={user.id}
              onAddMember={addTeamMember}
              onChangeRole={changeTeamMemberRole}
              onRemoveMember={removeTeamMember}
            />
          )}

          {!isCustomer && page === "Settings" && isOwnerOrAdmin && (
            <SettingsPage
              profile={businessProfile}
              workspace={workspace}
              onSave={saveBusinessProfile}
              onSavePrintPricing={savePrintPricing}
              theme={theme}
              onThemeChange={setTheme}
              onExportBackup={exportBackup}
              onImportBackup={importBackup}
              onResetWorkspace={resetWorkspace}
              subscription={subscription}
              workspaceUsage={workspaceUsage}
              billingLoading={billingLoading}
              billingError={billingError}
              planLimits={planLimits}
              canManageWorkspace={isOwnerOrAdmin}
              subscriptionLifecycle={subscriptionLifecycle}
            />
          )}
        </main>
      </div>

      {modal === "task" && !isCustomer && (
        <CustomerFormModal
          title="Add Customer Work"
          onClose={() => setModal(null)}
          onSubmit={addTask}
        />
      )}

      {modal === "link" && !isCustomer && (
        <QuickLinkModal
          onClose={() => setModal(null)}
          onSubmit={addLink}
        />
      )}

      {selectedCustomer && (
        <CustomerDetails
          customer={selectedCustomer}
          onClose={() =>
            setSelectedCustomer(null)
          }
          onUpdate={updateTask}
          onEdit={!isCustomer ? () => {
            setEditingCustomer(
              selectedCustomer
            );
            setSelectedCustomer(null);
          } : undefined}
          onAddPayment={!isCustomer ? () =>
            setPaymentCustomer(
              selectedCustomer
            ) : undefined}
          onDeletePayment={isOwnerOrAdmin ? deletePayment : undefined}
          businessProfile={businessProfile}
          onAddReminder={!isCustomer ? () => setReminderCustomer(selectedCustomer) : undefined}
          onAiSummary={!isCustomer ? () => setAiCustomer(selectedCustomer) : undefined}
          onCustomerAccess={!isCustomer && isOwnerOrAdmin ? () => setCustomerAccessCustomer(selectedCustomer) : undefined}
        />
      )}

      {aiCustomer && !isCustomer && (
        <AiCustomerSummaryModal
          customer={aiCustomer}
          apiKeyConfigured={true}
          onClose={() => setAiCustomer(null)}
          onGenerate={generateAiCustomerSummary}
          onOpenSettings={() => {
            setAiCustomer(null);
            setPage("Settings");
          }}
        />
      )}

      {customerAccessCustomer && isOwnerOrAdmin && (
        <CustomerAccessModal
          customer={customerAccessCustomer}
          workspace={workspace}
          onClose={() => setCustomerAccessCustomer(null)}
          onLinked={(result) => {
            setCustomerAccessCustomer(null);
            alert(`Customer account linked successfully${result?.email ? ` to ${result.email}` : ""}.`);
          }}
        />
      )}

      {editingCustomer && (
        <CustomerFormModal
          title="Edit Customer"
          customer={editingCustomer}
          onClose={() =>
            setEditingCustomer(null)
          }
          onSubmit={(data) => {
            updateTask(
              editingCustomer.id,
              data
            );

            setEditingCustomer(null);
          }}
        />
      )}

      {reminderCustomer && (
        <ReminderModal
          customer={reminderCustomer}
          onClose={() => setReminderCustomer(null)}
          onSubmit={(reminder) => {
            const newReminder = {
              id: Date.now(),
              ...reminder,
              completed: false,
              created: new Date().toISOString().slice(0, 10)
            };
            updateTask(reminderCustomer.id, {
              followUps: [
                ...(Array.isArray(reminderCustomer.followUps) ? reminderCustomer.followUps : []),
                newReminder
              ]
            });
            setReminderCustomer(null);
          }}
        />
      )}

      {paymentCustomer && (
        <PaymentModal
          customer={paymentCustomer}
          onClose={() =>
            setPaymentCustomer(null)
          }
          onSubmit={(payment) =>
            addPayment(
              paymentCustomer.id,
              payment
            )
          }
        />
      )}
      </div>
    </>
  );
}

function GlobalSearchResults({ results, setPage, setSelectedCustomer }) {
  if (!results.length) return <div className="globalSearchPanel"><div className="globalSearchEmpty"><SearchX size={18} /><span>No matching customers, services or pages.</span></div></div>;
  return (
    <div className="globalSearchPanel">
      {results.map((result) => {
        const icon = result.type === "customer" ? <Users size={16} /> : result.type === "service" ? <FileText size={16} /> : result.type === "link" ? <Bookmark size={16} /> : <LayoutDashboard size={16} />;
        if (result.type === "link") return <a key={`${result.type}-${result.id}`} href={getSafeExternalUrl(result.link.url)} target="_blank" rel="noopener noreferrer" className="globalSearchResult">{icon}<div><strong>{result.title}</strong><span>{result.subtitle}</span></div><ExternalLink size={14} /></a>;
        return <button key={`${result.type}-${result.id}`} className="globalSearchResult" onClick={() => result.type === "customer" ? setSelectedCustomer(result.task) : setPage(result.page)}>{icon}<div><strong>{result.title}</strong><span>{result.subtitle}</span></div><ChevronRight size={14} /></button>;
      })}
    </div>
  );
}

function Sidebar({
  page,
  setPage,
  mobile,
  setMobile,
  onSettings,
  user,
  onSignOut,
  workspace,
  userProfile,
  workspaceRole,
  canManageWorkspace,
  isStaff,
  isCustomer
}) {
  const items = [
    {
      name: "Dashboard",
      icon: (
        <LayoutDashboard size={18} />
      )
    },
    ...(canManageWorkspace ? [{
      name: "Print Jobs",
      icon: <PrinterIcon size={18} />
    }] : []),
    ...(canManageWorkspace ? [{
      name: "Earnings",
      icon: <Banknote size={18} />
    }] : []),
    ...(canManageWorkspace ? [{
      name: "Café QR",
      icon: <QrCode size={18} />
    }] : []),
    {
      name: "Services",
      icon: <Link2 size={18} />
    },
    {
      name: "Customer Work",
      icon: <Users size={18} />
    },
    {
      name: "Follow-ups",
      icon: <CalendarDays size={18} />
    },
    {
      name: "Reports",
      icon: <BarChart3 size={18} />
    },
    ...(canManageWorkspace ? [{
      name: "Team",
      icon: <UserRound size={18} />
    }] : []),
    {
      name: "Calculators",
      icon: (
        <Calculator size={18} />
      )
    },
    {
      name: "My Quick Links",
      icon: (
        <Bookmark size={18} />
      )
    },
    {
      name: "Help & Support",
      icon: <MessageCircle size={18} />
    }
  ];

  return (
    <>
      {mobile && (
        <div
          className="sidebarOverlay"
          onClick={() =>
            setMobile(false)
          }
        />
      )}

      <style>{`
        .sidebar { overflow:hidden !important; }
        .sidebar .nav { flex:1 1 auto; min-height:0; overflow-y:auto; overflow-x:hidden; scrollbar-width:thin; }
        .sidebar .nav::-webkit-scrollbar { width:5px; }
        .sidebar .nav::-webkit-scrollbar-thumb { background:rgba(148,163,184,.45); border-radius:999px; }
        .sidebar .nav::-webkit-scrollbar-track { background:transparent; }
        .sidebarBottom { flex:0 0 auto; }
      `}</style>

      <aside
        className={`sidebar ${
          mobile
            ? "sidebarOpen"
            : ""
        }`}
      >
        <div className="brand">
          <div className="brandIcon">
            <Monitor size={23} />
          </div>

          <div>
            <div className="brandName">
              CyberCafe
            </div>

            <div className="brandSub">
              HELPER
            </div>
          </div>

          <button
            className="mobileClose"
            onClick={() =>
              setMobile(false)
            }
          >
            <X size={19} />
          </button>
        </div>

        <div className="onlineBadge">
          <span className="statusDot"></span>
          SYSTEM ONLINE
        </div>

        <div className="navSectionTitle">
          WORKSPACE
        </div>

        <nav className="nav">
          {items.filter((item) => !isCustomer).map((item) => (
            <button
              key={item.name}
              className={`navItem ${
                page === item.name
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setPage(item.name)
              }
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarBottom">
          <div className="workspaceCard">
            <div className="workspaceIcon">
              <Zap size={16} />
            </div>

            <div>
              <strong>
                {workspace?.name || user?.user_metadata?.business_name || "My Workspace"}
              </strong>
              <span>
                WORKSPACE ACTIVE
              </span>
            </div>
          </div>

          <div className="freeMvp">
            <ShieldCheck size={15} />
            FREE MVP
          </div>
        </div>
      </aside>
    </>
  );
}


function TeamPage({ members, loading, currentUserId, onAddMember, onChangeRole, onRemoveMember }) {
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    const ok = await onAddMember(email, role);
    setSaving(false);
    if (ok) {
      setEmail("");
      setRole("staff");
      setShowAdd(false);
    }
  };

  return (
    <div className="teamPage">
      <style>{`
        .teamPage { max-width:1100px; }
        .teamHeader { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:20px; }
        .teamHeader h1 { margin:5px 0 5px; font-size:22px; color:#172033; }
        .teamHeader p { margin:0; color:#7b8794; font-size:11px; line-height:1.55; }
        .teamHeaderActions { display:flex; gap:9px; }
        .teamCard { background:#fff; border:1px solid #e5eaf0; border-radius:14px; box-shadow:0 4px 14px rgba(15,23,42,.035); overflow:hidden; }
        .teamTable { width:100%; border-collapse:collapse; }
        .teamTable th { padding:12px 15px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.08em; color:#94a3b8; background:#f8fafc; border-bottom:1px solid #edf1f5; }
        .teamTable td { padding:13px 15px; border-bottom:1px solid #f0f2f5; font-size:11px; color:#475569; vertical-align:middle; }
        .teamTable tr:last-child td { border-bottom:0; }
        .teamMember { display:flex; align-items:center; gap:10px; }
        .teamAvatar { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:#eff6ff; color:#2563eb; font-weight:850; font-size:12px; }
        .teamMember strong { display:block; color:#1e293b; font-size:11px; }
        .teamMember span { display:block; color:#94a3b8; font-size:9px; margin-top:2px; }
        .teamRoleSelect { min-width:110px; padding:7px 9px; border:1px solid #dfe6ee; border-radius:8px; background:#fff; font-size:10px; color:#475569; }
        .teamRoleBadge { display:inline-flex; align-items:center; padding:5px 8px; border-radius:999px; background:#f1f5f9; color:#475569; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
        .teamRoleBadge.owner, .teamRoleBadge.admin { background:#eff6ff; color:#1d4ed8; }
        .teamRoleBadge.staff { background:#f0fdf4; color:#15803d; }
        .teamActions { display:flex; justify-content:flex-end; gap:7px; }
        .teamEmpty { padding:42px 20px; text-align:center; color:#94a3b8; font-size:11px; }
        .teamAddPanel { margin-bottom:16px; padding:16px; border:1px solid #dbeafe; border-radius:12px; background:#f8fbff; }
        .teamAddPanel form { display:grid; grid-template-columns:1fr 150px auto; gap:9px; align-items:end; }
        .teamField { display:flex; flex-direction:column; gap:6px; }
        .teamField label { font-size:9px; color:#64748b; font-weight:750; }
        .teamField input, .teamField select { width:100%; box-sizing:border-box; padding:10px 11px; border:1px solid #dfe6ee; border-radius:9px; background:#fff; font:inherit; font-size:11px; color:#334155; }
        .teamHint { margin:10px 0 0; color:#94a3b8; font-size:9px; line-height:1.5; }
        .teamCurrent { color:#94a3b8; font-size:9px; }
        @media (max-width:760px) { .teamHeader { flex-direction:column; } .teamAddPanel form { grid-template-columns:1fr; } .teamTable { min-width:650px; } .teamCard { overflow-x:auto; } }
      `}</style>

      <div className="teamHeader">
        <div>
          <div className="pageEyebrow">WORKSPACE TEAM</div>
          <h1>Team & Staff</h1>
          <p>Manage people who can work inside this CyberCafe Helper workspace.</p>
        </div>
        <div className="teamHeaderActions">
          <button className="primaryButton" onClick={() => setShowAdd((value) => !value)}>
            <Plus size={15} /> {showAdd ? "Close" : "Add Member"}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="teamAddPanel">
          <form onSubmit={submit}>
            <div className="teamField">
              <label>Existing CyberCafe Helper account email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="staff@example.com" required />
            </div>
            <div className="teamField">
              <label>Workspace role</label>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button className="primaryButton" type="submit" disabled={saving}>{saving ? "Adding…" : "Add to Workspace"}</button>
          </form>
          <p className="teamHint">The person must already have a CyberCafe Helper account. Email invitations will be connected through the secure backend later.</p>
        </div>
      )}

      <div className="teamCard">
        {loading ? (
          <div className="teamEmpty">Loading team members…</div>
        ) : !members.length ? (
          <div className="teamEmpty">No team members found.</div>
        ) : (
          <table className="teamTable">
            <thead><tr><th>Member</th><th>Role</th><th>Joined</th><th>Access</th><th></th></tr></thead>
            <tbody>
              {members.map((member) => {
                const isCurrent = member.user_id === currentUserId;
                const initials = (member.full_name || member.email || "U").charAt(0).toUpperCase();
                return (
                  <tr key={member.id}>
                    <td><div className="teamMember"><div className="teamAvatar">{initials}</div><div><strong>{member.full_name || "Unnamed member"}</strong><span>{member.email || "No email"}{isCurrent ? " • You" : ""}</span></div></div></td>
                    <td>
                      {isCurrent ? <span className={`teamRoleBadge ${member.role}`}>{member.role}</span> : (
                        <select className="teamRoleSelect" value={member.role} onChange={(event) => onChangeRole(member, event.target.value)}>
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                          <option value="customer">Customer</option>
                        </select>
                      )}
                    </td>
                    <td>{member.created_at ? new Date(member.created_at).toLocaleDateString("en-IN") : "—"}</td>
                    <td><span className="teamRoleBadge">{member.role === "owner" ? "Full access" : member.role === "admin" ? "Management" : member.role === "staff" ? "Operations" : "Customer"}</span></td>
                    <td><div className="teamActions">{!isCurrent && member.role !== "owner" && <button className="secondaryButton" onClick={() => onRemoveMember(member)}><Trash2 size={13} /> Remove</button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Reports({ tasks, businessProfile }) {
  const [range, setRange] = useState("30");
  const [service, setService] = useState("All");

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const rangeStart = new Date(today);
  if (range !== "all") rangeStart.setDate(rangeStart.getDate() - Number(range) + 1);
  const rangeStartKey = range === "all" ? "0000-00-00" : rangeStart.toISOString().slice(0, 10);

  const servicesList = Array.from(new Set(tasks.map((task) => task.service).filter(Boolean))).sort();
  const scopedTasks = tasks.filter((task) =>
    (service === "All" || task.service === service) &&
    (range === "all" || String(task.created || "") >= rangeStartKey)
  );

  const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
  const totalWork = scopedTasks.length;
  const completed = scopedTasks.filter((task) => task.status === "Completed").length;
  const active = totalWork - completed;
  const revenue = scopedTasks.reduce((sum, task) => sum + Number(task.paid || 0), 0);
  const billed = scopedTasks.reduce((sum, task) => sum + Number(task.amount || 0), 0);
  const outstanding = scopedTasks.reduce((sum, task) => sum + Math.max(Number(task.amount || 0) - Number(task.paid || 0), 0), 0);
  const collectionRate = billed > 0 ? Math.round((revenue / billed) * 100) : 0;
  const avgTicket = totalWork > 0 ? revenue / totalWork : 0;

  const serviceMap = scopedTasks.reduce((map, task) => {
    const key = task.service || "Other";
    if (!map[key]) map[key] = { jobs: 0, revenue: 0, due: 0 };
    map[key].jobs += 1;
    map[key].revenue += Number(task.paid || 0);
    map[key].due += Math.max(Number(task.amount || 0) - Number(task.paid || 0), 0);
    return map;
  }, {});
  const serviceRows = Object.entries(serviceMap).sort((a, b) => b[1].revenue - a[1].revenue);
  const maxRevenue = Math.max(...serviceRows.map(([, item]) => item.revenue), 1);

  const methodMap = scopedTasks.flatMap((task) => Array.isArray(task.payments) ? task.payments : []).reduce((map, payment) => {
    const key = payment.method || "Other";
    map[key] = (map[key] || 0) + Number(payment.amount || 0);
    return map;
  }, {});
  const paymentMethods = Object.entries(methodMap).sort((a, b) => b[1] - a[1]);

  const overdue = scopedTasks.filter((task) => task.dueDate && task.dueDate < todayKey && task.status !== "Completed");
  const dueToday = scopedTasks.filter((task) => task.dueDate === todayKey && task.status !== "Completed");

  const exportCSV = () => {
    const rows = [
      ["Customer", "Phone", "Service", "Amount", "Paid", "Due", "Status", "Created", "Due Date", "Reference"],
      ...scopedTasks.map((task) => [
        task.name || "", task.phone || "", task.service || "", Number(task.amount || 0), Number(task.paid || 0),
        Math.max(Number(task.amount || 0) - Number(task.paid || 0), 0), task.status || "", task.created || "", task.dueDate || "", task.applicationNumber || task.reference || ""
      ])
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cybercafe-report-${todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cardStyle = { background: "#fff", border: "1px solid #e5eaf0", borderRadius: 14, padding: 20, boxShadow: "0 4px 14px rgba(15,23,42,.035)" };
  const statGrid = { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, margin: "24px 0 28px" };
  const statBox = { ...cardStyle, padding: "17px 18px" };

  return (
    <div style={{ maxWidth: 1180 }}>
      <div className="pageHeading">
        <div>
          <div className="eyebrow">// BUSINESS INTELLIGENCE</div>
          <h1>Reports & Analytics</h1>
          <p>Understand your work volume, collections, outstanding payments and service performance.</p>
        </div>
        <button className="primaryButton" onClick={exportCSV}><Download size={16} /> Export CSV</button>
      </div>

      <div style={{ ...cardStyle, display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: "#334155", fontSize: 12 }}>REPORT FILTERS</strong>
          <select value={range} onChange={(e) => setRange(e.target.value)} style={{ minWidth: 150 }}>
            <option value="7">Last 7 Days</option><option value="30">Last 30 Days</option><option value="90">Last 90 Days</option><option value="all">All Time</option>
          </select>
          <select value={service} onChange={(e) => setService(e.target.value)} style={{ minWidth: 190 }}>
            <option value="All">All Services</option>
            {servicesList.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <span style={{ color: "#7b8794", fontSize: 11 }}>{totalWork} customer records in this report</span>
      </div>

      <div className="reportsStatGrid" style={statGrid}>
        <div style={statBox}><span style={{ color: "#7b8794", fontSize: 11 }}>Collected</span><strong style={{ display: "block", marginTop: 7, fontSize: 22, color: "#059669" }}>{money(revenue)}</strong><small style={{ color: "#94a3b8" }}>{collectionRate}% collection rate</small></div>
        <div style={statBox}><span style={{ color: "#7b8794", fontSize: 11 }}>Outstanding</span><strong style={{ display: "block", marginTop: 7, fontSize: 22, color: "#d97706" }}>{money(outstanding)}</strong><small style={{ color: "#94a3b8" }}>Pending from customers</small></div>
        <div style={statBox}><span style={{ color: "#7b8794", fontSize: 11 }}>Total Work</span><strong style={{ display: "block", marginTop: 7, fontSize: 22, color: "#2563eb" }}>{totalWork}</strong><small style={{ color: "#94a3b8" }}>{active} active · {completed} completed</small></div>
        <div style={statBox}><span style={{ color: "#7b8794", fontSize: 11 }}>Average Collection</span><strong style={{ display: "block", marginTop: 7, fontSize: 22, color: "#0891b2" }}>{money(avgTicket)}</strong><small style={{ color: "#94a3b8" }}>Per customer record</small></div>
      </div>

      <div className="reportsTwoCol" style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", gap: 20, marginBottom: 20 }}>
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><div><span className="sectionEyebrow">SERVICE PERFORMANCE</span><h2 style={{ margin: "5px 0 0", fontSize: 18 }}>Revenue by Service</h2></div><TrendingUp size={19} /></div>
          {serviceRows.length ? serviceRows.map(([name, item]) => (
            <div key={name} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 7, fontSize: 12 }}><span style={{ color: "#475569", fontWeight: 600 }}>{name}</span><strong>{money(item.revenue)}</strong></div>
              <div style={{ height: 7, background: "#edf1f5", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max((item.revenue / maxRevenue) * 100, 3)}%`, background: "#2563eb", borderRadius: 99 }} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, color: "#94a3b8", fontSize: 10 }}><span>{item.jobs} job{item.jobs !== 1 ? "s" : ""}</span><span>{money(item.due)} due</span></div>
            </div>
          )) : <div className="dashboardEmpty"><PieChart size={22} /> No service data for this period.</div>}
        </section>

        <section style={cardStyle}>
          <div style={{ marginBottom: 18 }}><span className="sectionEyebrow">PAYMENT MIX</span><h2 style={{ margin: "5px 0 0", fontSize: 18 }}>Collection Methods</h2></div>
          {paymentMethods.length ? paymentMethods.map(([method, amount]) => (
            <div key={method} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid #edf1f5", fontSize: 12 }}><span style={{ color: "#64748b" }}>{method}</span><strong>{money(amount)}</strong></div>
          )) : <div className="dashboardEmpty"><CreditCard size={22} /> No payments recorded.</div>}
        </section>
      </div>

      <div className="reportsTwoCol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div><span className="sectionEyebrow">DEADLINE HEALTH</span><h2 style={{ margin: "5px 0 0", fontSize: 18 }}>Attention Required</h2></div><CircleAlert size={19} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ padding: 14, borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa" }}><span style={{ color: "#9a3412", fontSize: 11 }}>Overdue Work</span><strong style={{ display: "block", marginTop: 5, fontSize: 22, color: "#c2410c" }}>{overdue.length}</strong></div>
            <div style={{ padding: 14, borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}><span style={{ color: "#92400e", fontSize: 11 }}>Due Today</span><strong style={{ display: "block", marginTop: 5, fontSize: 22, color: "#b45309" }}>{dueToday.length}</strong></div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ marginBottom: 16 }}><span className="sectionEyebrow">WORK COMPLETION</span><h2 style={{ margin: "5px 0 0", fontSize: 18 }}>Completion Rate</h2></div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", border: "8px solid #e8edf3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><strong style={{ fontSize: 17 }}>{totalWork ? Math.round((completed / totalWork) * 100) : 0}%</strong></div>
            <div><strong style={{ display: "block", fontSize: 14 }}>{completed} completed</strong><span style={{ display: "block", marginTop: 5, color: "#7b8794", fontSize: 11 }}>{active} records still active</span></div>
          </div>
        </section>
      </div>

      <div style={{ marginTop: 20, padding: "12px 14px", color: "#94a3b8", fontSize: 10, textAlign: "right" }}>{businessProfile.businessName || "CyberCafe Helper"} · Report generated {todayKey}</div>
    </div>
  );
}

function Dashboard({ tasks, setPage, setSelectedCustomer, businessProfile, links = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
  const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

  const active = tasks.filter((task) => task.status !== "Completed").length;
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const collected = tasks.reduce((sum, task) => sum + Number(task.paid || 0), 0);
  const due = tasks.reduce((sum, task) => sum + Math.max(Number(task.amount || 0) - Number(task.paid || 0), 0), 0);
  const newToday = tasks.filter((task) => task.created === today).length;
  const dueToday = tasks.filter((task) => task.dueDate === today && task.status !== "Completed").length;
  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < today && task.status !== "Completed");

  const serviceRevenueMap = tasks.reduce((map, task) => {
    const service = task.service || "Other";
    map[service] = (map[service] || 0) + Number(task.paid || 0);
    return map;
  }, {});
  const serviceRevenue = Object.entries(serviceRevenueMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxServiceRevenue = Math.max(...serviceRevenue.map(([, value]) => value), 1);

  const recentPayments = tasks.flatMap((task) =>
    (Array.isArray(task.payments) ? task.payments : []).map((payment) => ({ ...payment, customer: task }))
  ).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || Number(b.id || 0) - Number(a.id || 0)).slice(0, 5);

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const dailyRevenue = lastSevenDays.map((date) => ({
    date,
    amount: tasks.reduce((sum, task) => sum + (Array.isArray(task.payments) ? task.payments.filter((p) => p.date === date).reduce((x, p) => x + Number(p.amount || 0), 0) : 0), 0)
  }));
  const maxDailyRevenue = Math.max(...dailyRevenue.map((item) => item.amount), 1);

  return (
    <div>
      <PageHeading eyebrow="DIGITAL SEVA WORKSPACE" title="Good afternoon 👋" subtitle="Manage customer work, government services and daily cyber café operations." />

      <div className="terminalStrip">
        <div><span className="terminalPrompt">&gt;</span> CYBERCAFE_HELPER <span className="terminalMuted">// WORKSPACE ONLINE</span></div>
        <div className="terminalPulse"><span></span> READY</div>
      </div>

      <div className="statsGrid">
        <Stat label="Active Work" value={active} icon={<ClipboardList size={20} />} className="blue" />
        <Stat label="Collected" value={money(collected)} icon={<IndianRupee size={20} />} className="green" />
        <Stat label="Amount Due" value={money(due)} icon={<CircleAlert size={20} />} className="amber" />
        <Stat label="Completed" value={completed} icon={<CheckCircle2 size={20} />} className="cyan" />
      </div>

      <section className="section">
        <div className="sectionHeading">
          <div><span className="sectionEyebrow">TODAY'S OPERATIONS</span><h2>Daily Control Center</h2></div>
          <button className="textButton" onClick={() => setPage("Customer Work")}>Open work queue <ChevronRight size={16} /></button>
        </div>
        <div className="opsGrid">
          <div className="opsCard blue"><div className="opsIcon"><CalendarDays size={19} /></div><div><span>New Today</span><strong>{newToday}</strong><small>Customer records created today</small></div></div>
          <div className="opsCard amber"><div className="opsIcon"><Clock3 size={19} /></div><div><span>Due Today</span><strong>{dueToday}</strong><small>Active work reaching deadline</small></div></div>
          <div className="opsCard red"><div className="opsIcon"><CircleAlert size={19} /></div><div><span>Overdue</span><strong>{overdueTasks.length}</strong><small>Work that needs attention</small></div></div>
          <div className="opsCard green"><div className="opsIcon"><Wallet size={19} /></div><div><span>Outstanding</span><strong>{money(due)}</strong><small>Total customer balance due</small></div></div>
        </div>
      </section>

      <section className="dashboardColumns">
        <div className="dashboardCard">
          <div className="dashboardCardHeader"><div><span className="sectionEyebrow">REVENUE</span><h3>Last 7 Days</h3></div><strong>{money(dailyRevenue.reduce((s, x) => s + x.amount, 0))}</strong></div>
          <div className="revenueChart">
            {dailyRevenue.map((item) => <div className="revenueBarGroup" key={item.date} title={`${formatDate(item.date)}: ${money(item.amount)}`}><div className="revenueBarTrack"><div className="revenueBar" style={{ height: `${item.amount ? Math.max((item.amount / maxDailyRevenue) * 100, 8) : 4}%` }} /></div><span>{formatDate(item.date)}</span></div>)}
          </div>
        </div>

        <div className="dashboardCard">
          <div className="dashboardCardHeader"><div><span className="sectionEyebrow">SERVICE PERFORMANCE</span><h3>Revenue by Service</h3></div><Banknote size={19} /></div>
          {serviceRevenue.length ? <div className="serviceRevenueList">{serviceRevenue.map(([service, amount]) => <div className="serviceRevenueRow" key={service}><div className="serviceRevenueTop"><span>{service}</span><strong>{money(amount)}</strong></div><div className="serviceRevenueTrack"><div className="serviceRevenueBar" style={{ width: `${Math.max((amount / maxServiceRevenue) * 100, 4)}%` }} /></div></div>)}</div> : <div className="dashboardEmpty"><Banknote size={22} /> No payment data yet.</div>}
        </div>
      </section>

      <section className="dashboardColumns">
        <div className="dashboardCard">
          <div className="dashboardCardHeader"><div><span className="sectionEyebrow">ACTION REQUIRED</span><h3>Overdue Work</h3></div><span className="attentionCount">{overdueTasks.length}</span></div>
          {overdueTasks.length ? <div className="attentionList">{overdueTasks.slice(0, 5).map((task) => <button className="attentionItem" key={task.id} onClick={() => setSelectedCustomer(task)}><div className="attentionAvatar">{(task.name || "C").charAt(0).toUpperCase()}</div><div className="attentionInfo"><strong>{task.name}</strong><span>{task.service}</span></div><div className="attentionMeta"><span>Due {formatDate(task.dueDate)}</span><strong>{money(Math.max(Number(task.amount || 0) - Number(task.paid || 0), 0))}</strong></div><ChevronRight size={16} /></button>)}</div> : <div className="dashboardEmpty"><CheckCircle2 size={22} /> No overdue work. Great!</div>}
        </div>

        <div className="dashboardCard">
          <div className="dashboardCardHeader"><div><span className="sectionEyebrow">PAYMENTS</span><h3>Recent Payments</h3></div><History size={19} /></div>
          {recentPayments.length ? <div className="paymentActivityList">{recentPayments.map((payment) => <button className="paymentActivityItem" key={`${payment.customerId}-${payment.id}`} onClick={() => setSelectedCustomer(payment.customer)}><div className="paymentIcon"><IndianRupee size={16} /></div><div className="paymentInfo"><strong>{payment.customer.name}</strong><span>{payment.method || "Other"} · {formatDate(payment.date)}</span></div><strong className="paymentAmount">+{money(payment.amount)}</strong></button>)}</div> : <div className="dashboardEmpty"><History size={22} /> No payments recorded yet.</div>}
        </div>
      </section>

      <section className="section">
        <div className="sectionHeading"><div><span className="sectionEyebrow">GOVERNMENT SERVICES</span><h2>Quick Services</h2></div><button className="textButton" onClick={() => setPage("Services")}>View all <ChevronRight size={16} /></button></div>
        <div className="serviceGrid">{services.map((service) => <ServiceCard key={service.title} service={service} />)}</div>
      </section>

      <section className="section">
        <div className="sectionHeading"><div><span className="sectionEyebrow">YOUR SHORTCUTS</span><h2>Quick Links</h2></div><button className="textButton" onClick={() => setPage("My Quick Links")}>Manage links <ChevronRight size={16} /></button></div>
        {links.length ? (
          <div className="dashboardQuickLinks">
            {links.slice(0, 6).map((link) => (
              <a key={link.id} href={getSafeExternalUrl(link.url)} target="_blank" rel="noopener noreferrer" className="dashboardQuickLink">
                <div className="dashboardQuickLinkIcon"><Globe2 size={16} /></div>
                <div><strong>{link.name}</strong><span>{link.url}</span></div>
                <ExternalLink size={14} />
              </a>
            ))}
          </div>
        ) : (
          <div className="dashboardQuickLinksEmpty">
            <Bookmark size={20} />
            <span>No quick links saved yet.</span>
            <button className="secondaryButton" onClick={() => setPage("My Quick Links")}>Set up Quick Links</button>
          </div>
        )}
      </section>

      <section className="section">
        <div className="sectionHeading"><div><span className="sectionEyebrow">CUSTOMER CRM</span><h2>Recent Customer Work</h2></div><button className="primaryButton small" onClick={() => setPage("Customer Work")}>View all work</button></div>
        <WorkTable tasks={tasks.slice(0, 5)} setSelectedCustomer={setSelectedCustomer} updateTask={null} deleteTask={null} businessProfile={businessProfile} />
      </section>
    </div>
  );
}

function HelpSupportPage() {
  const faqs = [
    {
      q: "How does the café QR work?",
      a: "Open Café QR from the sidebar and show the QR code to customers. They scan it to open your café's customer portal and submit print requests."
    },
    {
      q: "How do I process a print request?",
      a: "Open Print Jobs, review the customer's files and print settings, then move the job through Accepted, Printing and Completed."
    },
    {
      q: "Why is the customer's estimated price different from the final amount?",
      a: "The estimate is based on the uploaded file count and your configured pricing. You can enter the actual final amount when completing the job."
    },
    {
      q: "How do I change print prices?",
      a: "Go to Settings → Print Pricing, update the rates, and click Save Print Pricing. A confirmation appears when the changes are saved."
    },
    {
      q: "How does Earnings work?",
      a: "Earnings uses completed print jobs and recorded payments. Paid jobs contribute to collected revenue, while unpaid completed jobs remain outstanding."
    },
    {
      q: "A customer says their job is stuck. What should I do?",
      a: "Open Print Jobs, find the job using the customer name or Job ID, and check its current status. Update the workflow to the correct stage."
    }
  ];

  const [openFaq, setOpenFaq] = useState(0);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I’m the CyberCafe Helper assistant. Ask me about QR printing, print jobs, pricing, payments or earnings." }
  ]);
  const [input, setInput] = useState("");

  const answerQuestion = (question) => {
    const text = question.toLowerCase();
    if (/self[- ]?harm|suicid|kill myself|hurt myself|end my life/.test(text)) {
      return "I’m sorry you’re dealing with this. I can’t provide help with self-harm. If you may hurt yourself or someone else, please contact local emergency services or a trusted person who can stay with you. In India, you can also call Tele-MANAS at 14416 for mental-health support.";
    }
    if (/qr|scan|customer portal/.test(text)) return faqs[0].a;
    if (/print job|request|process|printing|accepted|completed/.test(text)) return faqs[1].a;
    if (/price|pricing|estimate|amount|rate/.test(text)) return faqs[2].a;
    if (/change.*price|settings|save.*pricing/.test(text)) return faqs[3].a;
    if (/earning|revenue|payment|paid|unpaid|cash|upi|card/.test(text)) return faqs[4].a;
    if (/stuck|problem|issue|not working|customer.*waiting/.test(text)) return faqs[5].a;
    return "I can help with QR printing, print jobs, pricing, payments and earnings. Try asking: ‘How does the QR work?’ or ‘How do I process a print request?’";
  };

  const sendMessage = (event) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question) return;
    const answer = answerQuestion(question);
    setMessages((current) => [
      ...current,
      { role: "user", text: question },
      { role: "bot", text: answer }
    ]);
    setInput("");
  };

  const quickAsk = (question) => {
    setInput(question);
    window.setTimeout(() => {
      const answer = answerQuestion(question);
      setMessages((current) => [
        ...current,
        { role: "user", text: question },
        { role: "bot", text: answer }
      ]);
      setInput("");
    }, 0);
  };

  return (
    <div className="helpSupportPage">
      <PageHeading
        eyebrow="HELP & SUPPORT"
        title="How can we help?"
        subtitle="Quick answers for running your cyber café with CyberCafe Helper."
      />

      <div className="helpSupportGrid">
        <section className="dashboardCard helpFaqCard">
          <div className="helpCardHeader">
            <div>
              <span className="sectionEyebrow">FREQUENTLY ASKED</span>
              <h2>FAQs</h2>
            </div>
            <div className="helpHeaderIcon"><CircleAlert size={17} /></div>
          </div>

          <div className="helpFaqList">
            {faqs.map((faq, index) => (
              <div className={`helpFaqItem ${openFaq === index ? "open" : ""}`} key={faq.q}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                  <span>{faq.q}</span>
                  <ChevronRight size={15} />
                </button>
                {openFaq === index && <div className="helpFaqAnswer">{faq.a}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="dashboardCard helpChatCard">
          <div className="helpCardHeader">
            <div>
              <span className="sectionEyebrow">QUICK HELP</span>
              <h2>Support Assistant</h2>
            </div>
            <div className="helpChatIcon"><MessageCircle size={17} /></div>
          </div>

          <div className="helpChatMessages">
            {messages.map((message, index) => (
              <div className={`helpChatMessage ${message.role}`} key={`${message.role}-${index}`}>
                <span>{message.role === "bot" ? "HELP" : "YOU"}</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <div className="helpQuickQuestions">
            {[
              "How does the QR work?",
              "How do I process a print request?",
              "How does Earnings work?"
            ].map((question) => (
              <button type="button" key={question} onClick={() => quickAsk(question)}>{question}</button>
            ))}
          </div>

          <form className="helpChatForm" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for help..."
              aria-label="Ask for help"
              maxLength={500}
            />
            <button type="submit" aria-label="Send help question" title="Send">
              <ChevronRight size={17} />
            </button>
          </form>
          <p className="helpChatNote">This assistant provides quick guidance from the app's built-in help topics.</p>
        </section>
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle
}) {
  return (
    <div className="pageHeading">
      <div>
        <div className="pageEyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>

        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  className
}) {
  return (
    <div
      className={`statCard ${className}`}
    >
      <div className="statTop">
        <div className="statIcon">
          {icon}
        </div>

        <span className="statSignal">
          LIVE
        </span>
      </div>

      <div className="statValue">
        {value}
      </div>

      <div className="statLabel">
        {label}
      </div>
    </div>
  );
}


function PrintEarningsPage({ workspace }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("30");

  const loadEarnings = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError("");
    try {
      const { data: jobRows, error: jobsError } = await supabase
        .from("print_jobs")
        .select("id, customer_name, status, color_mode, copies, paper_size, duplex, created_at, completed_at, final_amount, payment_method, payment_status, paid_at, payment_note")
        .eq("workspace_id", workspace.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });

      if (jobsError) throw jobsError;

      const rows = jobRows || [];
      if (!rows.length) {
        setJobs([]);
        return;
      }

      const jobIds = rows.map((job) => job.id);
      const { data: fileRows, error: filesError } = await supabase
        .from("print_job_files")
        .select("id, print_job_id")
        .in("print_job_id", jobIds);

      if (filesError) throw filesError;

      const fileCounts = (fileRows || []).reduce((acc, file) => {
        acc[file.print_job_id] = (acc[file.print_job_id] || 0) + 1;
        return acc;
      }, {});

      setJobs(rows.map((job) => ({
        ...job,
        fileCount: fileCounts[job.id] || 0,
        estimatedAmount: calculatePrintEstimate({
          workspace,
          colorMode: job.color_mode,
          paperSize: job.paper_size,
          copies: job.copies,
          duplex: job.duplex,
          fileCount: fileCounts[job.id] || 0
        }),
        amount: job.final_amount != null ? Number(job.final_amount) : 0,
        isPaid: job.payment_status === "paid"
      })));
    } catch (err) {
      console.error("Print earnings load failed:", err);
      setError(getSafeUiError(err, "Could not load print earnings."));
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
  }, [workspace?.id, workspace?.print_bw_price, workspace?.print_color_price, workspace?.print_a3_bw_price, workspace?.print_a3_color_price, workspace?.print_duplex_discount]);

  const periodDays = period === "7" ? 7 : period === "30" ? 30 : null;
  const cutoff = useMemo(() => {
    if (!periodDays) return null;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (periodDays - 1));
    return date;
  }, [periodDays]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!cutoff) return true;
      const completedAt = new Date(job.completed_at || job.created_at);
      return completedAt.getTime() >= cutoff.getTime();
    });
  }, [jobs, cutoff]);

  const totalEarnings = filteredJobs.filter((job) => job.isPaid).filter((job) => job.isPaid)
        .reduce((sum, job) => sum + Number(job.amount || 0), 0);
  const outstandingAmount = filteredJobs.filter((job) => !job.isPaid).reduce((sum, job) => sum + Number(job.amount || 0), 0);
  const completedCount = filteredJobs.length;
  const paidCount = filteredJobs.filter((job) => job.isPaid).length;
  const averageOrder = paidCount ? totalEarnings / paidCount : 0;
  const totalUnits = filteredJobs.reduce(
    (sum, job) => sum + (Math.max(0, Number(job.fileCount) || 0) * Math.max(1, Number(job.copies) || 1)),
    0
  );

  const dailyData = useMemo(() => {
    const days = period === "7" ? 7 : 7;
    const result = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      const amount = filteredJobs
        .filter((job) => new Date(job.completed_at || job.created_at).toISOString().slice(0, 10) === key)
        .reduce((sum, job) => sum + Number(job.amount || 0), 0);

      result.push({
        key,
        label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        amount
      });
    }
    return result;
  }, [filteredJobs, period]);

  const maxDaily = Math.max(...dailyData.map((item) => item.amount), 1);

  const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;

  const formatJobDate = (value) => value
    ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      })
    : "—";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", paddingBottom: 24 }}>
      <PageHeading
        eyebrow="PRINT EARNINGS"
        title="Earnings"
        subtitle="Track actual payments received from completed QR print jobs."
      />

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 18
      }}>
        <div style={{
          padding: "10px 13px",
          borderRadius: 12,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          fontSize: 11,
          lineHeight: 1.5
        }}>
          <strong>Actual revenue:</strong> earnings include only completed jobs marked as paid. Unpaid completed jobs remain outstanding.
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {[
            ["7", "Last 7 days"],
            ["30", "Last 30 days"],
            ["all", "All time"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={period === value ? "primaryButton" : "secondaryButton"}
              style={{ padding: "9px 12px", fontSize: 10 }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: 16,
          padding: 13,
          borderRadius: 12,
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          fontSize: 12
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 18
      }}>
        {[
          ["Collected revenue", formatMoney(totalEarnings), "Paid completed jobs"],
          ["Outstanding", formatMoney(outstandingAmount), "Completed but unpaid"],
          ["Paid jobs", paidCount.toLocaleString("en-IN"), `of ${completedCount.toLocaleString("en-IN")} completed`],
          ["Average paid order", formatMoney(averageOrder), "Per paid job"]
        ].map(([label, value, note]) => (
          <div key={label} className="dashboardCard" style={{ padding: 18 }}>
            <div style={{ color: "#64748b", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em" }}>
              {label}
            </div>
            <div style={{ marginTop: 8, fontSize: 25, fontWeight: 900, color: "#0f172a" }}>
              {loading ? "…" : value}
            </div>
            <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 10 }}>
              {note}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 18,
        alignItems: "start"
      }}>
        <section className="dashboardCard" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div>
              <div className="sectionEyebrow">RECENT TREND</div>
              <h3 style={{ margin: "5px 0 0", fontSize: 17 }}>Daily print earnings</h3>
            </div>
            <TrendingUp size={18} style={{ color: "#2563eb" }} />
          </div>

          {loading ? (
            <div style={{ padding: "42px 10px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Loading earnings…</div>
          ) : (
            <div style={{
              height: 220,
              display: "flex",
              alignItems: "flex-end",
              gap: 9,
              padding: "10px 2px 0"
            }}>
              {dailyData.map((item) => (
                <div key={item.key} style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 6
                }}>
                  <span style={{
                    fontSize: 9,
                    color: item.amount ? "#334155" : "#cbd5e1",
                    fontWeight: 800,
                    whiteSpace: "nowrap"
                  }}>
                    {item.amount ? formatMoney(item.amount) : "₹0"}
                  </span>
                  <div
                    title={`${item.label}: ${formatMoney(item.amount)}`}
                    style={{
                      width: "100%",
                      maxWidth: 52,
                      height: `${Math.max(6, (item.amount / maxDaily) * 145)}px`,
                      borderRadius: "8px 8px 4px 4px",
                      background: item.amount ? "#2563eb" : "#e2e8f0"
                    }}
                  />
                  <span style={{ fontSize: 9, color: "#64748b", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboardCard" style={{ padding: 22 }}>
          <div className="sectionEyebrow">BREAKDOWN</div>
          <h3 style={{ margin: "5px 0 16px", fontSize: 17 }}>What customers printed</h3>

          {filteredJobs.length === 0 ? (
            <div style={{
              padding: "34px 10px",
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 12
            }}>
              No completed print jobs in this period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["B&W", filteredJobs.filter((job) => job.color_mode === "bw").length],
                ["Color", filteredJobs.filter((job) => job.color_mode === "color").length],
                ["A4", filteredJobs.filter((job) => job.paper_size === "A4").length],
                ["A3", filteredJobs.filter((job) => job.paper_size === "A3").length],
                ["Duplex", filteredJobs.filter((job) => job.duplex).length]
              ].map(([label, count]) => (
                <div key={label} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 11px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #eef2f7"
                }}>
                  <span style={{ color: "#475569", fontSize: 11 }}>{label}</span>
                  <strong style={{ fontSize: 12 }}>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="dashboardCard" style={{ marginTop: 18, overflow: "hidden" }}>
        <div style={{ padding: "20px 22px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div className="sectionEyebrow">COMPLETED JOBS</div>
            <h3 style={{ margin: "5px 0 0", fontSize: 17 }}>Earnings history</h3>
          </div>
          <span style={{ color: "#64748b", fontSize: 10 }}>
            {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>Loading history…</div>
        ) : filteredJobs.length === 0 ? (
          <div style={{ padding: 38, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
            <Banknote size={25} style={{ marginBottom: 8, opacity: .55 }} />
            <div>No completed print jobs yet.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Job", "Customer", "Print", "Units", "Completed", "Amount"].map((heading) => (
                    <th key={heading} style={{ textAlign: "left", padding: "11px 16px", fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 10, fontWeight: 800 }}>
                      #{job.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700 }}>
                      {job.customer_name || "Customer"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 10, color: "#64748b" }}>
                      {(job.color_mode === "color" ? "Color" : "B&W")} · {job.paper_size || "A4"} · {job.duplex ? "Duplex" : "Single"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 10, color: "#475569" }}>
                      {(Math.max(0, Number(job.fileCount) || 0) * Math.max(1, Number(job.copies) || 1)).toLocaleString("en-IN")}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>
                      {formatJobDate(job.completed_at)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap" }}>
                      {formatMoney(job.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsPage({ profile, workspace, onSave, onSavePrintPricing, theme, onThemeChange, onExportBackup, onImportBackup, onResetWorkspace, subscription, workspaceUsage, billingLoading, billingError, planLimits }) {
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [pricingForm, setPricingForm] = useState(() => getPrintPricing(workspace));
  const [pricingSaved, setPricingSaved] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSaveConfirmation, setPricingSaveConfirmation] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => setForm(profile), [profile]);
  useEffect(() => setPricingForm(getPrintPricing(workspace)), [workspace]);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanedProfile = {
      businessName: form.businessName?.trim() || "CyberCafe Helper",
      ownerName: form.ownerName?.trim() || "",
      phone: form.phone?.trim() || "",
      address: form.address?.trim() || "",
      gstin: form.gstin?.trim().toUpperCase() || "",
      receiptFooter: form.receiptFooter?.trim() || "Thank you for using our services."
    };
    try {
      await onSave(cleanedProfile);
    } catch (error) {
      alert(`Could not save business profile.\n\n${getSafeUiError(error, "Something went wrong. Please try again.")}`);
      return;
    }
    setForm(cleanedProfile);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const handlePricingSubmit = async (event) => {
    event.preventDefault();
    setPricingSaving(true);
    try {
      const cleaned = {
        bwPrice: Math.max(0, Number(pricingForm.bwPrice) || 0),
        colorPrice: Math.max(0, Number(pricingForm.colorPrice) || 0),
        a3BwPrice: Math.max(0, Number(pricingForm.a3BwPrice) || 0),
        a3ColorPrice: Math.max(0, Number(pricingForm.a3ColorPrice) || 0),
        duplexDiscount: Math.min(100, Math.max(0, Number(pricingForm.duplexDiscount) || 0))
      };
      await onSavePrintPricing?.(cleaned);
      setPricingForm(cleaned);
      setPricingSaved(true);
      setPricingSaveConfirmation(true);
      window.setTimeout(() => setPricingSaved(false), 1800);
      window.setTimeout(() => setPricingSaveConfirmation(false), 2200);
    } catch (error) {
      window.alert(error?.message || "Could not save print pricing.");
    } finally {
      setPricingSaving(false);
    }
  };

  return (
    <div className="settingsPage">
      <PageHeading eyebrow="WORKSPACE SETTINGS" title="Settings" subtitle="Manage your business identity, workspace data and subscription." />

      <div className="settingsTabs" role="tablist" aria-label="Settings sections">
        <button type="button" className={`settingsTab ${activeTab === "profile" ? "active" : ""}`} onClick={() => setActiveTab("profile")} role="tab" aria-selected={activeTab === "profile"}>
          <Settings size={16} />
          <span><strong>Business Profile</strong><small>Identity & receipts</small></span>
        </button>
        <button type="button" className={`settingsTab ${activeTab === "pricing" ? "active" : ""}`} onClick={() => setActiveTab("pricing")} role="tab" aria-selected={activeTab === "pricing"}>
          <IndianRupee size={16} />
          <span><strong>Print Pricing</strong><small>Customer estimates</small></span>
        </button>
        <button type="button" className={`settingsTab ${activeTab === "data" ? "active" : ""}`} onClick={() => setActiveTab("data")} role="tab" aria-selected={activeTab === "data"}>
          <Database size={16} />
          <span><strong>Data & Backup</strong><small>Import & export</small></span>
        </button>
        <button type="button" className={`settingsTab ${activeTab === "billing" ? "active" : ""}`} onClick={() => setActiveTab("billing")} role="tab" aria-selected={activeTab === "billing"}>
          <Wallet size={16} />
          <span><strong>Plan & Billing</strong><small>Subscription & usage</small></span>
        </button>
      </div>

      {activeTab === "profile" && (
        <form className="settingsPanel" onSubmit={handleSubmit}>
          <div className="settingsIntro"><div className="settingsIntroIcon"><Settings size={20} /></div><div><h3>Business Profile</h3><p>These details appear on printed customer receipts.</p></div></div>
          <div className="settingsGrid">
            <label>Business / Cyber Café Name<input value={form.businessName} onChange={(e) => updateField("businessName", e.target.value)} placeholder="e.g. Sharma Cyber Cafe" /></label>
            <label>Owner / Operator Name<input value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} placeholder="Optional" /></label>
            <label>Business Phone<input value={form.phone} onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength="10" placeholder="10 digit mobile number" /></label>
            <label>GSTIN<input value={form.gstin} onChange={(e) => updateField("gstin", e.target.value.toUpperCase())} placeholder="Optional" /></label>
            <label className="settingsFull">Business Address<textarea value={form.address} onChange={(e) => updateField("address", e.target.value)} rows="3" placeholder="Shop / office address" /></label>
            <label className="settingsFull">Receipt Footer<textarea value={form.receiptFooter} onChange={(e) => updateField("receiptFooter", e.target.value)} rows="2" placeholder="Thank you for using our services." /></label>
          </div>
          <div className="settingsActions"><span className={saved ? "settingsSaved" : "settingsHint"}>{saved ? "✓ Settings saved" : "Used for printed receipts"}</span><button className="primaryButton" type="submit"><CheckCircle2 size={16} /> Save Settings</button></div>
        </form>
      )}


      {activeTab === "pricing" && (
        <form className="settingsPanel settingsTabPanel" onSubmit={handlePricingSubmit}>
          <div className="settingsIntro"><div className="settingsIntroIcon"><IndianRupee size={20} /></div><div><h3>Print Pricing</h3><p>Set the café's default print rates used to show customers an estimated price before they submit.</p></div></div>
          <div style={{ padding: "11px 13px", marginBottom: 16, borderRadius: 10, background: "#eff6ff", border: "1px solid #dbeafe", color: "#1e40af", fontSize: 10, lineHeight: 1.55 }}>
            <strong>MVP pricing model:</strong> the estimate is based on uploaded files × copies. The current upload system does not inspect page counts inside PDFs or Word documents, so this is an estimate rather than a final invoice.
          </div>
          <div className="settingsGrid">
            <label>B&W · A4 / standard (₹ per file)<input type="number" min="0" step="0.5" value={pricingForm.bwPrice} onChange={(e) => setPricingForm((prev) => ({ ...prev, bwPrice: e.target.value }))} /></label>
            <label>Color · A4 / standard (₹ per file)<input type="number" min="0" step="0.5" value={pricingForm.colorPrice} onChange={(e) => setPricingForm((prev) => ({ ...prev, colorPrice: e.target.value }))} /></label>
            <label>B&W · A3 (₹ per file)<input type="number" min="0" step="0.5" value={pricingForm.a3BwPrice} onChange={(e) => setPricingForm((prev) => ({ ...prev, a3BwPrice: e.target.value }))} /></label>
            <label>Color · A3 (₹ per file)<input type="number" min="0" step="0.5" value={pricingForm.a3ColorPrice} onChange={(e) => setPricingForm((prev) => ({ ...prev, a3ColorPrice: e.target.value }))} /></label>
            <label>Duplex discount (%)<input type="number" min="0" max="100" step="1" value={pricingForm.duplexDiscount} onChange={(e) => setPricingForm((prev) => ({ ...prev, duplexDiscount: e.target.value }))} /></label>
          </div>
          <div className="settingsActions"><span className={pricingSaved ? "settingsSaved" : "settingsHint"}>{pricingSaved ? "✓ Print pricing saved" : "Used by the QR customer portal"}</span><button className="primaryButton" type="submit" disabled={pricingSaving}><CheckCircle2 size={16} /> {pricingSaving ? "Saving…" : "Save Print Pricing"}</button></div>
        </form>
      )}

      {activeTab === "data" && (
        <section className="settingsOptionCard settingsTabPanel">
          <div className="settingsOptionHeader"><div><span className="sectionEyebrow">DATA & BACKUP</span><h2>Workspace Data</h2><p>Workspace data is stored securely in Supabase. Export a backup when you need an offline copy or before major changes.</p></div><Database size={21} /></div>
          <div className="settingsDataActions">
            <button type="button" className="secondaryButton settingsDataButton" onClick={onExportBackup}><Download size={16} /><div><strong>Export Backup</strong><span>Download all workspace data as JSON</span></div></button>
            <button type="button" className="secondaryButton settingsDataButton" onClick={() => fileInputRef.current?.click()}><Upload size={16} /><div><strong>Import Backup</strong><span>Restore a previous JSON backup</span></div></button>
            <button type="button" className="dangerButton settingsDataButton" onClick={onResetWorkspace}><RotateCcw size={16} /><div><strong>Reset Workspace</strong><span>Restore demo data and remove custom data</span></div></button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" hidden onChange={(e) => { onImportBackup(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </section>
      )}

      {activeTab === "billing" && (
        <section className="settingsOptionCard settingsTabPanel billingPanel">
          <div className="settingsOptionHeader billingHeader">
            <div>
              <span className="sectionEyebrow">WORKSPACE PLAN</span>
              <h2>Plan & Billing</h2>
              <p>See your current plan, workspace limits, and how much of your allowance you are using.</p>
            </div>
            <div className="billingHeaderIcon"><Wallet size={20} /></div>
          </div>

          {billingLoading ? (
            <div className="billingLoadingGrid">
              {[1,2,3,4].map((item) => <div className="billingSkeleton" key={item}><span></span><strong></strong><small></small></div>)}
            </div>
          ) : billingError ? (
            <div className="billingErrorBox">
              <div><CircleAlert size={18} /></div>
              <div><strong>Couldn't load billing information</strong><span>{billingError}</span></div>
            </div>
          ) : (
            <>
              {(() => {
                const planName = subscription?.plan === "pro" ? "Pro" : "Free Trial";
                const status = subscription?.status || "trial";
                const trialDays = daysUntil(subscription?.trial_ends_at);
                const expiryDate = subscription?.trial_ends_at || subscription?.current_period_end;
                const statusLabel = status === "trial" ? "Trial active" : status === "active" ? "Active" : status === "expired" ? "Expired" : status === "cancelled" ? "Cancelled" : "Unknown";
                const statusClass = status === "expired" ? "danger" : status === "cancelled" ? "neutral" : status === "trial" ? "trial" : "active";
                const usageItems = [
                  { label:"Customers", value:Number(workspaceUsage?.customers || 0), limit:planLimits?.customerLimit ?? 50, icon:<Users size={17} /> },
                  { label:"Staff", value:Number(workspaceUsage?.staff || 0), limit:planLimits?.staffLimit ?? 1, icon:<UserRound size={17} /> },
                  { label:"Custom Services", value:Number(workspaceUsage?.serviceTemplates || 0), limit:planLimits?.serviceTemplateLimit ?? 10, icon:<FileText size={17} /> },
                  { label:"Quick Links", value:Number(workspaceUsage?.quickLinks || 0), limit:planLimits?.quickLinkLimit ?? 25, icon:<Link2 size={17} /> }
                ];

                return (
                  <>
                    <div className="billingPlanHero">
                      <div className="billingPlanMain">
                        <div className="billingPlanIcon"><Wallet size={22} /></div>
                        <div>
                          <span className="sectionEyebrow">CURRENT PLAN</span>
                          <div className="billingPlanTitleRow">
                            <h3>{planName}</h3>
                            <span className={`billingStatus ${statusClass}`}>{statusLabel}</span>
                          </div>
                          <p>{status === "trial" ? `${trialDays} ${trialDays === 1 ? "day" : "days"} remaining in your free trial` : status === "active" ? "Your workspace is on an active subscription." : status === "expired" ? "Your trial has ended. Paid plans are coming soon. New workspace resources may be paused after the trial ends." : "Subscription status: " + status}</p>
                        </div>
                      </div>
                      <div className="billingPlanExpiry">
                        <span>{status === "trial" ? "TRIAL ENDS" : "PERIOD ENDS"}</span>
                        <strong>{formatSubscriptionDate(expiryDate)}</strong>
                      </div>
                    </div>

                    <div className="billingSectionTitle">
                      <div><span className="sectionEyebrow">USAGE</span><h3>Workspace limits</h3></div>
                      <span>Updates automatically</span>
                    </div>

                    <div className="billingUsageGrid">
                      {usageItems.map((item) => {
                        const unlimited = !Number.isFinite(item.limit);
                        const percent = unlimited ? 0 : Math.min(100, Math.round((item.value / Math.max(1, item.limit)) * 100));
                        const nearLimit = !unlimited && percent >= 80;
                        const atLimit = !unlimited && item.value >= item.limit;
                        const usageClass = atLimit ? "danger" : nearLimit ? "warning" : "normal";
                        return (
                          <div className="billingUsageCard" key={item.label}>
                            <div className="billingUsageTop">
                              <div className="billingUsageIcon">{item.icon}</div>
                              <div><strong>{item.label}</strong><span>{unlimited ? "No plan limit" : `${item.value.toLocaleString("en-IN")} of ${formatLimit(item.limit)}`}</span></div>
                              <b className={`billingUsagePercent ${usageClass}`}>{unlimited ? "∞" : `${percent}%`}</b>
                            </div>
                            <div className="billingProgressTrack"><div className={`billingProgressFill ${usageClass}`} style={{width:`${unlimited ? 8 : Math.max(item.value > 0 ? 3 : 0, percent)}%`}}></div></div>
                            <div className="billingUsageBottom">
                              <span>{atLimit ? "Limit reached" : nearLimit ? "Approaching limit" : unlimited ? "Unlimited" : `${Math.max(0, item.limit - item.value).toLocaleString("en-IN")} remaining`}</span>
                              {!unlimited && <span>Limit {formatLimit(item.limit)}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="billingComingSoonCard">
                      <div className="billingUpgradeIcon"><Sparkles size={19} /></div>
                      <div className="billingUpgradeCopy">
                        <strong>Pro plan coming soon</strong>
                        <span>We’re preparing paid plans and billing. Your current workspace and free-trial access are available without payment.</span>
                      </div>
                      <span className="billingComingSoonBadge">COMING SOON</span>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </section>
      )}

      {pricingSaveConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Changes saved"
          onClick={() => setPricingSaveConfirmation(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(15, 23, 42, 0.42)",
            backdropFilter: "blur(3px)"
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(380px, 100%)",
              padding: "24px 22px",
              borderRadius: 18,
              background: "#ffffff",
              boxShadow: "0 20px 60px rgba(15, 23, 42, 0.24)",
              textAlign: "center",
              border: "1px solid #e2e8f0"
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                margin: "0 auto 12px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#dcfce7",
                color: "#15803d"
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#0f172a" }}>Changes saved</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "#64748b" }}>Your print pricing has been updated successfully.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AiSummaryResult({ summary, customer }) {
  let parsed = null;
  try {
    const candidate = String(summary || "").trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    const value = JSON.parse(candidate);
    if (value && typeof value === "object") parsed = value;
  } catch {
    parsed = null;
  }

  const totalAmount = Number(customer?.amount || 0);
  const paidAmount = Number(customer?.paid || 0);
  const dueAmount = Math.max(totalAmount - paidAmount, 0);

  const sections = parsed
    ? [
        { title: "Customer Summary", value: parsed.summary, icon: <Sparkles size={14} /> },
        { title: "What Is Pending", value: parsed.pending, icon: <ClipboardList size={14} /> },
        { title: "Payment Status", value: "", icon: <Wallet size={14} />, payment: true },
        { title: "Recommended Next Action", value: parsed.nextAction, icon: <Zap size={14} /> },
        { title: "Customer Message", value: parsed.customerMessage, icon: <MessageCircle size={14} /> }
      ]
    : [{ title: "AI Summary", value: String(summary || ""), icon: <Sparkles size={14} /> }];

  return (
    <div className="aiResult">
      {sections.map((section, index) => (
        <div className="aiResultCard" key={`${section.title}-${index}`}>
          <div className="aiResultCardHeader">
            <div className="aiSectionIcon">{section.icon}</div>
            <strong>{section.title}</strong>
          </div>
          <div className="aiResultCardBody">
            {section.payment ? (
              <div className="aiPaymentGrid">
                <div className="aiPaymentMetric"><span>Total</span><strong>₹{totalAmount.toLocaleString("en-IN")}</strong></div>
                <div className="aiPaymentMetric"><span>Paid</span><strong>₹{paidAmount.toLocaleString("en-IN")}</strong></div>
                <div className="aiPaymentMetric"><span>Due</span><strong>₹{dueAmount.toLocaleString("en-IN")}</strong></div>
              </div>
            ) : section.title === "Customer Message" ? (
              <div className="aiCustomerMessage"><p>{String(section.value || "").replace(/^"|"$/g, "")}</p></div>
            ) : (
              <div className={section.title === "Recommended Next Action" ? "aiNextAction" : "aiBulletList"}>
                <div className={section.title === "Recommended Next Action" ? "" : "aiBulletItem"}>
                  {section.title !== "Recommended Next Action" && <span className="aiBulletDot" />}
                  <span>{section.value}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AiCustomerSummaryModal({ customer, apiKeyConfigured, onClose, onGenerate, onOpenSettings }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [progress, setProgress] = useState("Connecting to Gemini…");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setProgress("Connecting to Gemini…");
    try {
      const result = await onGenerate(customer, setProgress);
      setSummary(result);
    } catch (err) {
      setError(getSafeUiError(err, "Unable to generate the AI summary."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="aiModalOverlay" onClick={onClose}>
        <div className="aiSummaryModal" onClick={(e) => e.stopPropagation()}>
          <div className="aiSummaryHeader">
            <div className="aiSummaryTitle">
              <div className="aiSummaryIcon"><Sparkles size={20} /></div>
              <div><span className="drawerEyebrow">AI CUSTOMER COPILOT</span><h2>{customer.name || "Customer"}</h2><p>{customer.service || "Customer work"}</p></div>
            </div>
            <button className="iconButton" onClick={onClose}><X size={20} /></button>
          </div>

          {!apiKeyConfigured ? (
            <div className="aiSetupState">
              <Sparkles size={30} />
              <h3>Connect Gemini to use AI summaries</h3>
              <p>Add your Gemini API key in Settings. The summary will use this customer's existing CRM data only.</p>
              <button className="primaryButton" onClick={onOpenSettings}><Settings size={16} /> Open AI Settings</button>
            </div>
          ) : (
            <>
              <div className="aiSummaryBody">
                {!summary && !loading && !error && (
                  <div className="aiEmptyState">
                    <Sparkles size={28} />
                    <h3>Ready to analyze {customer.name || "this customer"}</h3>
                    <p>Gemini will review the work stage, documents, payments, due date, follow-ups and notes, then suggest the next action.</p>
                  </div>
                )}
                {loading && (
                  <div className="aiLoadingState"><div className="aiSpinner"></div><h3>{progress}</h3><p>Preparing a concise operator summary.</p></div>
                )}
                {error && (
                  <div className="aiErrorState"><CircleAlert size={20} /><div><strong>AI request failed</strong><p>{error}</p></div></div>
                )}
                {summary && !loading && (
                  <AiSummaryResult summary={summary} customer={customer} />
                )}
              </div>
              <div className="aiSummaryFooter">
                <span>AI uses only the CRM data shown in this customer record. AI-generated suggestions may be inaccurate; verify important details before acting.</span>
                <button className="primaryButton" onClick={handleGenerate} disabled={loading}>{loading ? "Generating…" : summary ? "Regenerate Summary" : "Generate AI Summary"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Services({ customServices = [], onSaveService, onDeleteService, canManageServices = true }) {
  const [editingService, setEditingService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);

  return (
    <div>
      <PageHeading
        eyebrow="SERVICE DIRECTORY"
        title="Government Services"
        subtitle="Keep official portals and your service templates organized in one place."
      />

      <div className="serviceManagementHeader">
        <div>
          <div className="sectionEyebrow">SERVICE MANAGEMENT</div>
          <h2>Your Service Templates</h2>
          <p>Define pricing, documents, workflow stages and expected completion time for your services.</p>
        </div>
        {canManageServices && (
          <button className="primaryButton" onClick={() => { setEditingService(null); setShowServiceModal(true); }}>
            <Plus size={17} /> Add Service
          </button>
        )}
      </div>

      <div className="managedServiceGrid">
        {customServices.length ? customServices.map((service) => (
          <div className="managedServiceCard" key={service.id}>
            <div className="managedServiceTop">
              <div className="serviceIcon"><FileText size={21} /></div>
              <div className="managedServiceTitle">
                <h3>{service.name}</h3>
                <span>{service.completionDays || 0} day{Number(service.completionDays) === 1 ? "" : "s"} expected</span>
              </div>
              <div className="servicePrice">₹{Number(service.price || 0).toLocaleString("en-IN")}</div>
            </div>
            <div className="managedServiceMeta">
              <span>{service.requiredDocuments?.length || 0} documents</span>
              <span>{service.workflowStages?.length || 0} stages</span>
            </div>
            {canManageServices && (
              <div className="managedServiceActions">
                <button className="secondaryButton" onClick={() => { setEditingService(service); setShowServiceModal(true); }}><Pencil size={14} /> Edit</button>
                <button className="dangerButton" onClick={() => onDeleteService?.(service.id)}><Trash2 size={14} /> Delete</button>
              </div>
            )}
          </div>
        )) : (
          <div className="serviceManagementEmpty">
            <ClipboardList size={28} />
            <strong>No custom services yet</strong>
            <span>Create your first service template to make customer entry faster.</span>
          </div>
        )}
      </div>

      <div className="serviceDirectoryBlock">
        <div className="sectionEyebrow">OFFICIAL PORTALS</div>
        <h2>Government Services</h2>
        <p className="serviceDirectorySubtitle">Frequently used official websites for Digital Seva work.</p>
        <div className="serviceGrid large">
          {services.map((service) => <ServiceCard key={service.title} service={service} />)}
        </div>
      </div>

      {showServiceModal && (
        <ServiceTemplateModal
          service={editingService}
          onClose={() => setShowServiceModal(false)}
          onSave={(data) => { onSaveService(data); setShowServiceModal(false); }}
        />
      )}
    </div>
  );
}

function ServiceCard({ service }) {
  return (
    <div className="serviceCard">
      <div className="serviceIcon">{service.icon}</div>
      <div className="serviceContent">
        <h3>{service.title}</h3>
        <div className="serviceLinks">
          {service.links.map((link) => (
            <a key={link.name} href={getSafeExternalUrl(link.url)} target="_blank" rel="noopener noreferrer" className="portalLink">
              <span>{link.name}</span><ExternalLink size={14} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function ServiceTemplateModal({ service, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: service?.id || `service-${Date.now()}`,
    name: service?.name || "",
    price: service?.price ?? "",
    completionDays: service?.completionDays ?? 3,
    requiredDocuments: service?.requiredDocuments || ["Aadhaar", "Photo", "Signature"],
    workflowStages: service?.workflowStages || ["New", "Documents", "Processing", "Ready", "Completed"],
    trackingLabel: service?.trackingLabel || "Application / Reference No."
  }));
  const [newStage, setNewStage] = useState("");
  const [newDocument, setNewDocument] = useState("");

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const toggleDocument = (doc) => update("requiredDocuments", form.requiredDocuments.includes(doc) ? form.requiredDocuments.filter((item) => item !== doc) : [...form.requiredDocuments, doc]);

  const addStage = () => {
    const value = newStage.trim();
    if (!value || form.workflowStages.includes(value)) return;
    update("workflowStages", [...form.workflowStages, value]);
    setNewStage("");
  };

  const addDocument = () => {
    const value = newDocument.trim();
    if (!value || form.requiredDocuments.includes(value)) return;
    update("requiredDocuments", [...form.requiredDocuments, value]);
    setNewDocument("");
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { alert("Service name is required."); return; }
    const stages = form.workflowStages.length ? form.workflowStages : ["New", "Processing", "Ready", "Completed"];
    onSave({ ...form, name: form.name.trim(), price: Number(form.price || 0), completionDays: Math.max(Number(form.completionDays || 0), 0), workflowStages: stages, requiredDocuments: form.requiredDocuments.filter(Boolean) });
  };

  return (
    <div className="modalOverlay">
      <div className="modalCard largeModal serviceTemplateModal">
        <div className="modalHeader">
          <div><div className="modalEyebrow">// SERVICE TEMPLATE</div><h2>{service ? "Edit Service" : "Add Service"}</h2><p>Configure how this service should behave throughout the CRM.</p></div>
          <button className="iconButton" onClick={onClose}><X size={19} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="formGrid">
            <label>Service Name *<input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Birth Certificate" /></label>
            <label>Service Price (₹)<input type="number" min="0" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="150" /></label>
            <label>Expected Completion (days)<input type="number" min="0" value={form.completionDays} onChange={(e) => update("completionDays", e.target.value)} /></label>
            <label>Tracking / Reference Label<input value={form.trackingLabel} onChange={(e) => update("trackingLabel", e.target.value)} placeholder="Application / Reference No." /></label>
          </div>

          <div className="templateSection">
            <div className="templateSectionHeader"><div><strong>Required Documents</strong><span>Select the documents normally needed for this service.</span></div></div>
            <div className="templateChipGrid">
              {docOptions.map((doc) => <button type="button" key={doc} className={`templateChip ${form.requiredDocuments.includes(doc) ? "selected" : ""}`} onClick={() => toggleDocument(doc)}>{form.requiredDocuments.includes(doc) ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}{doc}</button>)}
            </div>
            <div className="templateAddRow"><input value={newDocument} onChange={(e) => setNewDocument(e.target.value)} placeholder="Add custom document" /><button type="button" className="secondaryButton" onClick={addDocument}><Plus size={14} /> Add</button></div>
          </div>

          <div className="templateSection">
            <div className="templateSectionHeader"><div><strong>Workflow Stages</strong><span>These stages appear in Customer Work for this service.</span></div></div>
            <div className="stageList">
              {form.workflowStages.map((stage, index) => <div className="stageRow" key={`${stage}-${index}`}><span className="stageNumber">{index + 1}</span><span>{stage}</span>{index > 0 && index < form.workflowStages.length - 1 && <button type="button" className="stageRemove" onClick={() => update("workflowStages", form.workflowStages.filter((_, i) => i !== index))}><X size={13} /></button>}</div>)}
            </div>
            <div className="templateAddRow"><input value={newStage} onChange={(e) => setNewStage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(); } }} placeholder="Add workflow stage" /><button type="button" className="secondaryButton" onClick={addStage}><Plus size={14} /> Add Stage</button></div>
          </div>

          <div className="modalActions"><button type="button" className="secondaryButton" onClick={onClose}>Cancel</button><button type="submit" className="primaryButton"><CheckCircle2 size={16} /> Save Service</button></div>
        </form>
      </div>
    </div>
  );
}

function Work({
  tasks,
  allTasks,
  setModal,
  setSelectedCustomer,
  deleteTask,
  updateTask,
  businessProfile,
  canManageRecords = true
}) {
  const [filter, setFilter] =
    useState("All");

  const [paymentFilter, setPaymentFilter] =
    useState("All");

  const [serviceFilter, setServiceFilter] =
    useState("All");

  const [workflowFilter, setWorkflowFilter] =
    useState("All");

  const [dueDateFilter, setDueDateFilter] =
    useState("All");

  const serviceOptions = useMemo(() => {
    return Array.from(
      new Set(
        allTasks
          .map((task) => String(task.service || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [allTasks]);

  const workflowOptions = useMemo(() => {
    const stages = allTasks.flatMap((task) =>
      getWorkflowStages(task.service)
    );

    return Array.from(new Set(stages));
  }, [allTasks]);

  const visibleTasks = tasks.filter((task) => {
    const statusMatches =
      filter === "All" ||
      task.status === filter;

    const dueAmount = Math.max(
      Number(task.amount || 0) -
        Number(task.paid || 0),
      0
    );

    const paymentMatches =
      paymentFilter === "All" ||
      (paymentFilter === "Due" && dueAmount > 0) ||
      (paymentFilter === "Paid" && dueAmount === 0);

    const serviceMatches =
      serviceFilter === "All" ||
      task.service === serviceFilter;

    const workflowMatches =
      workflowFilter === "All" ||
      (task.workflowStage || getWorkflowStages(task.service)[0]) === workflowFilter;

    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const dueDate = String(task.dueDate || "");

    const dueDateMatches =
      dueDateFilter === "All" ||
      (dueDateFilter === "Today" && dueDate === todayKey) ||
      (dueDateFilter === "Overdue" && dueDate && dueDate < todayKey) ||
      (dueDateFilter === "Upcoming" && dueDate && dueDate > todayKey);

    return (
      statusMatches &&
      paymentMatches &&
      serviceMatches &&
      workflowMatches &&
      dueDateMatches
    );
  });

  const hasAdvancedFilters =
    serviceFilter !== "All" ||
    workflowFilter !== "All" ||
    dueDateFilter !== "All" ||
    paymentFilter !== "All" ||
    filter !== "All";

  const clearFilters = () => {
    setFilter("All");
    setPaymentFilter("All");
    setServiceFilter("All");
    setWorkflowFilter("All");
    setDueDateFilter("All");
  };

  return (
    <>
      <style>{`
        /* STEP 12 — polished smart-filter spacing */
        .step12WorkPage { width: 100%; }
        .step12WorkPage .workToolbar { margin-top: 22px; margin-bottom: 18px; gap: 14px; align-items: center; }
        .step12WorkPage .filterGroup { gap: 6px; }
        .step12WorkPage .advancedFilters { margin-top: 18px; margin-bottom: 24px; padding: 20px 22px 17px; border: 1px solid #e6ebf2; border-radius: 14px; background: #fff; box-shadow: 0 5px 18px rgba(15,23,42,.045); }
        .step12WorkPage .advancedFiltersHeader { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:17px; }
        .step12WorkPage .advancedFiltersHeader > div { display:flex; flex-direction:column; gap:5px; min-width:0; }
        .step12WorkPage .advancedFiltersHeader strong { color:#172033; font-size:14px; line-height:1.35; }
        .step12WorkPage .clearFiltersButton { flex:0 0 auto; padding:8px 12px; border:1px solid #dce3ec; border-radius:8px; background:#f8fafc; color:#475569; font-size:11px; font-weight:700; cursor:pointer; }
        .step12WorkPage .clearFiltersButton:hover { background:#f1f5f9; border-color:#cbd5e1; }
        .step12WorkPage .advancedFilterGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
        .step12WorkPage .advancedFilterField { display:flex; flex-direction:column; gap:7px; min-width:0; }
        .step12WorkPage .advancedFilterField > span { color:#64748b; font-size:11px; font-weight:700; line-height:1.2; }
        .step12WorkPage .advancedFilterField select { width:100%; min-height:39px; box-sizing:border-box; padding:8px 11px; border:1px solid #dfe5ee; border-radius:9px; background:#fff; color:#172033; font-size:12px; outline:none; }
        .step12WorkPage .advancedFilterField select:focus { border-color:#93c5fd; box-shadow:0 0 0 3px #eff6ff; }
        .step12WorkPage .filterResultSummary { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:16px; padding-top:13px; border-top:1px solid #edf1f6; color:#7b8494; font-size:11px; line-height:1.4; }
        .step12WorkPage .filterResultSummary strong { color:#334155; font-weight:800; }
        .step12WorkPage .filterActiveBadge { flex:0 0 auto; padding:5px 9px; border:1px solid #bfdbfe; border-radius:999px; background:#eff6ff; color:#2563eb; font-size:10px; font-weight:700; }
        .step12WorkPage .tableCard { margin-top:0; }
        @media (max-width:900px) { .step12WorkPage .advancedFilterGrid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:640px) {
          .step12WorkPage .workToolbar { margin-top:18px; margin-bottom:14px; }
          .step12WorkPage .advancedFilters { padding:16px; margin-top:14px; margin-bottom:18px; }
          .step12WorkPage .advancedFiltersHeader { align-items:flex-start; margin-bottom:14px; }
          .step12WorkPage .advancedFilterGrid { grid-template-columns:1fr; gap:11px; }
          .step12WorkPage .filterResultSummary { align-items:flex-start; flex-direction:column; }
        }
      `}</style>
      <div className="step12WorkPage">
        <PageHeading
          eyebrow="CUSTOMER CRM"
        title="Customer Work"
        subtitle="Track applications, documents, payments and customer follow-ups."
      />

      <div className="workToolbar">
        <div className="filterGroup">
          {[
            "All",
            "Pending",
            "Processing",
            "Completed"
          ].map((item) => (
            <button
              key={item}
              className={`filterButton ${
                filter === item
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setFilter(item)
              }
            >
              {item}

              <span>
                {item === "All"
                  ? allTasks.length
                  : allTasks.filter(
                      (task) =>
                        task.status ===
                        item
                    ).length}
              </span>
            </button>
          ))}
        </div>

        <div className="paymentFilter">
          <Wallet size={15} />
          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value)
            }
            aria-label="Filter by payment status"
          >
            <option value="All">All Payments</option>
            <option value="Due">Payment Due</option>
            <option value="Paid">Fully Paid</option>
          </select>
        </div>

        {canManageRecords && (
          <button
            className="primaryButton"
            onClick={() =>
              setModal("task")
            }
          >
            <Plus size={17} />
            Add Customer
          </button>
        )}
      </div>

      <div className="advancedFilters">
        <div className="advancedFiltersHeader">
          <div>
            <span className="sectionEyebrow">SMART FILTERS</span>
            <strong>Find customer work faster</strong>
          </div>

          {hasAdvancedFilters && (
            <button
              type="button"
              className="clearFiltersButton"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
        </div>

        <div className="advancedFilterGrid">
          <label className="advancedFilterField">
            <span>Service</span>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option value="All">All Services</option>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>

          <label className="advancedFilterField">
            <span>Work Stage</span>
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value)}
            >
              <option value="All">All Stages</option>
              {workflowOptions.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          <label className="advancedFilterField">
            <span>Completion Date</span>
            <select
              value={dueDateFilter}
              onChange={(e) => setDueDateFilter(e.target.value)}
            >
              <option value="All">All Dates</option>
              <option value="Today">Due Today</option>
              <option value="Overdue">Overdue</option>
              <option value="Upcoming">Upcoming</option>
            </select>
          </label>
        </div>

        <div className="filterResultSummary">
          <span>Showing <strong>{visibleTasks.length}</strong> of <strong>{tasks.length}</strong> matching records</span>
          {(serviceFilter !== "All" || workflowFilter !== "All" || dueDateFilter !== "All") && (
            <span className="filterActiveBadge">Advanced filters active</span>
          )}
        </div>
      </div>

      <WorkTable
        tasks={visibleTasks}
        setSelectedCustomer={
          setSelectedCustomer
        }
        updateTask={updateTask}
        deleteTask={deleteTask}
        businessProfile={businessProfile}
      />
      </div>
    </>
  );
}

function WorkTable({
  tasks,
  setSelectedCustomer,
  updateTask,
  deleteTask,
  businessProfile
}) {
  if (!tasks.length) {
    return (
      <div className="emptyState">
        <Users size={28} />

        <h3>
          No customer records
          found
        </h3>

        <p>
          Add a customer or
          change your
          search/filter.
        </p>
      </div>
    );
  }

  return (
    <div className="tableCard">
      <div className="tableHeader">
        <div>
          <span className="sectionEyebrow">
            WORK QUEUE
          </span>

          <strong>
            {tasks.length} RECORDS
          </strong>
        </div>

        <div className="tableLive">
          <span className="statusDot"></span>
          LIVE
        </div>
      </div>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>
                Customer
              </th>
              <th>
                Service
              </th>
              <th>
                Contact
              </th>
              <th>
                Amount
              </th>
              <th>
                Documents
              </th>
              <th>
                Status
              </th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {tasks.map(
              (task) => {
                const due =
                  Math.max(
                    Number(
                      task.amount ||
                        0
                    ) -
                      Number(
                        task.paid ||
                          0
                      ),
                    0
                  );

                return (
                  <tr
                    key={
                      task.id
                    }
                  >
                    <td>
                      <button
                        className="customerLink"
                        onClick={() =>
                          setSelectedCustomer(
                            task
                          )
                        }
                      >
                        <span className="customerAvatar">
                          {(
                            task.name ||
                            "C"
                          )
                            .charAt(
                              0
                            )
                            .toUpperCase()}
                        </span>

                        <span>
                          <strong>
                            {
                              task.name
                            }
                          </strong>

                          <small>
                            #
                            {task.reference ||
                              task.id}
                          </small>
                        </span>
                      </button>
                    </td>

                    <td>
                      <span className="serviceName">
                        {
                          task.service
                        }
                      </span>
                    </td>

                    <td>
                      <a
                        className="phoneLink"
                        href={getSafePhoneUrl(task.phone)}
                      >
                        <Phone
                          size={14}
                        />
                        {task.phone ||
                          "Not provided"}
                      </a>
                    </td>

                    <td>
                      <div className="amountCell">
                        <strong>
                          ₹
                          {task.amount ||
                            0}
                        </strong>

                        <span>
                          Paid ₹
                          {task.paid ||
                            0}

                          {due >
                            0 &&
                            ` · Due ₹${due}`}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="docPills">
                        {task
                          .documents
                          ?.length
                          ? task.documents
                              .slice(
                                0,
                                3
                              )
                              .map(
                                (
                                  doc
                                ) => (
                                  <span
                                    className="docPill"
                                    key={
                                      doc
                                    }
                                  >
                                    {
                                      doc
                                    }
                                  </span>
                                )
                              )
                          : "—"}
                      </div>

                       {(() => {
                         const progress = getDocumentProgress(task);
                         return (
                           <div className={`tableDocumentProgress ${progress.percent === 100 ? "complete" : ""}`}>
                             <span>{progress.percent}% documents</span>
                             {progress.missing.length > 0 && <small>{progress.missing.length} pending</small>}
                           </div>
                         );
                       })()}
                    </td>

                    <td>
                      {updateTask ? (
                        <select
                          className={`statusSelect workflowSelect ${String(
                            task.status
                          ).toLowerCase()}`}
                          value={
                            task.workflowStage || getWorkflowStages(task.service)[0]
                          }
                          onChange={(e) => {
                            const stages = getWorkflowStages(task.service);
                            const stage = e.target.value;
                            updateTask(task.id, {
                              workflowStage: stage,
                              status: statusForWorkflowStage(stage, stages)
                            });
                          }}
                        >
                          {getWorkflowStages(task.service).map((stage) => (
                            <option key={stage} value={stage}>{stage}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`statusChip ${String(
                            task.status
                          ).toLowerCase()}`}
                        >
                          {
                            task.status
                          }
                        </span>
                      )}
                    </td>

                    <td>
                      {deleteTask && (
                        <div className="rowActions">
                          <a
                            className="rowAction whatsapp"
                            href={getSafeWhatsAppUrl("91" + String(task.phone || ""))}
                            target="_blank"
                            rel="noreferrer"
                            title="WhatsApp"
                          >
                            <MessageCircle
                              size={
                                15
                              }
                            />
                          </a>

                          <button
                            className="rowAction"
                            onClick={() =>
                              printReceipt(
                                task,
                                businessProfile
                              )
                            }
                            title="Print receipt"
                          >
                            <Receipt
                              size={
                                15
                              }
                            />
                          </button>

                          <button
                            className="rowAction danger"
                            onClick={() =>
                              deleteTask(
                                task.id
                              )
                            }
                            title="Delete"
                          >
                            <Trash2
                              size={
                                15
                              }
                            />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerDetails({
  customer,
  onClose,
  onUpdate,
  onEdit,
  onAddPayment,
  onDeletePayment,
  businessProfile,
  onAddReminder,
  onAiSummary,
  onCustomerAccess
}) {
  const due =
    Math.max(
      Number(customer.amount || 0) -
        Number(customer.paid || 0),
      0
    );

  const paymentPercent =
    Number(customer.amount || 0) >
    0
      ? Math.min(
          (Number(
            customer.paid || 0
          ) /
            Number(
              customer.amount || 0
            )) *
            100,
          100
        )
      : 0;

  const payments =
    Array.isArray(
      customer.payments
    )
      ? [...customer.payments].reverse()
      : [];

  return (
    <>
      <div
        className="detailsOverlay"
        onClick={onClose}
      />

      <aside className="customerDrawer">
        <div className="drawerHeader">
          <div>
            <div className="drawerEyebrow">
              CUSTOMER PROFILE
            </div>

            <h2>
              Customer Details
            </h2>
          </div>

          <button
            className="iconButton"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="drawerBody">
          <div className="profileHero">
            <div className="profileAvatar">
              {(
                customer.name ||
                "C"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="profileIdentity">
              <h3>
                {customer.name}
              </h3>

              <span>
                <Hash size={13} />
                {customer.reference ||
                  "NO-REFERENCE"}
              </span>
            </div>

            <button
              className="profileEditButton"
              onClick={onEdit}
              title="Edit customer"
            >
              <Pencil size={15} />
              Edit
            </button>
          </div>

          <div className="profileActions">
            <a
              href={getSafePhoneUrl(customer.phone)}
              className="profileAction"
            >
              <Phone size={17} />
              Call
            </a>

            <a
              href={getSafeWhatsAppUrl("91" + String(customer.phone || ""))}
              target="_blank"
              rel="noreferrer"
              className="profileAction whatsappAction"
            >
              <MessageCircle
                size={17}
              />
              WhatsApp
            </a>

            <button
              className="profileAction"
              onClick={() =>
                printReceipt(
                  customer,
                  businessProfile
                )
              }
            >
              <Receipt size={17} />
              Receipt
            </button>

            <button
              className="profileAction aiProfileAction"
              onClick={onAiSummary}
            >
              <Sparkles size={17} />
              AI Summary
            </button>

            {onCustomerAccess && (
              <button
                className="profileAction"
                onClick={onCustomerAccess}
              >
                <Link2 size={17} />
                Portal Access
              </button>
            )}
          </div>

          <div className="detailSection">
            <div className="detailSectionTitle">
              <UserRound size={16} />
              CUSTOMER INFORMATION
            </div>

            <div className="detailGrid">
              <DetailItem
                icon={
                  <Phone size={15} />
                }
                label="Phone"
                value={
                  customer.phone ||
                  "Not provided"
                }
              />

              <DetailItem
                icon={
                  <ClipboardList
                    size={15}
                  />
                }
                label="Service"
                value={
                  customer.service ||
                  "Not provided"
                }
              />

              <DetailItem
                icon={
                  <MapPin size={15} />
                }
                label="Address"
                value={
                  customer.address ||
                  "Not provided"
                }
              />

              <DetailItem
                icon={
                  <CalendarDays
                    size={15}
                  />
                }
                label="Created"
                value={
                  customer.created ||
                  "—"
                }
              />

              <DetailItem
                icon={
                  <Clock3 size={15} />
                }
                label="Expected Completion"
                value={
                  customer.dueDate ||
                  "Not set"
                }
              />

              <DetailItem
                icon={
                  <Hash size={15} />
                }
                label="Reference"
                value={
                  customer.reference ||
                  "Not set"
                }
              />
            </div>
          </div>

          <div className="detailSection workflowSection">
            <div className="detailSectionTitle">
              <ClipboardList size={16} />
              WORKFLOW PROGRESS
            </div>

            {(() => {
              const workflow = getWorkflowProgress(customer);
              const trackingLabel = getTrackingLabel(customer.service);
              return (
                <>
                  <div className="workflowTopRow">
                    <div>
                      <strong>{workflow.current}</strong>
                      <span>{workflow.percent}% complete</span>
                    </div>
                    <span className="workflowStageCount">{workflow.index + 1}/{workflow.stages.length}</span>
                  </div>

                  <div className="workflowProgressTrack">
                    <div className="workflowProgressFill" style={{ width: `${workflow.percent}%` }} />
                  </div>

                  <div className="workflowSteps">
                    {workflow.stages.map((stage, index) => (
                      <button
                        type="button"
                        key={stage}
                        className={`workflowStep ${index < workflow.index ? "done" : ""} ${index === workflow.index ? "current" : ""}`}
                        onClick={() => onUpdate(customer.id, {
                          workflowStage: stage,
                          status: statusForWorkflowStage(stage, workflow.stages)
                        })}
                      >
                        <span className="workflowStepDot">{index < workflow.index ? "✓" : index + 1}</span>
                        <span>{stage}</span>
                      </button>
                    ))}
                  </div>

                  <div className="workflowTrackingField">
                    <span>{trackingLabel}</span>
                    <input
                      value={customer.applicationNumber || ""}
                      onChange={(e) => onUpdate(customer.id, { applicationNumber: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </>
              );
            })()}
          </div>

          <div className="detailSection">
            <div className="detailSectionTitle">
              <CircleAlert size={16} />
              WORK STATUS
            </div>

            <select
              className={`drawerStatusSelect ${String(
                customer.status
              ).toLowerCase()}`}
              value={
                customer.status
              }
              onChange={(e) =>
                onUpdate(
                  customer.id,
                  {
                    status:
                      e.target.value
                  }
                )
              }
            >
              <option>
                Pending
              </option>

              <option>
                Processing
              </option>

              <option>
                Completed
              </option>
            </select>
          </div>

          <div className="detailSection">
            <div className="detailSectionTitle paymentTitle">
              <IndianRupee
                size={16}
              />
              PAYMENT SUMMARY

              <button
                className="addPaymentButton"
                onClick={
                  onAddPayment
                }
              >
                <Plus size={14} />
                Add Payment
              </button>
            </div>

            <div className="paymentCards">
              <div>
                <span>Total</span>

                <strong>
                  ₹
                  {customer.amount ||
                    0}
                </strong>
              </div>

              <div>
                <span>Paid</span>

                <strong>
                  ₹
                  {customer.paid ||
                    0}
                </strong>
              </div>

              <div
                className={
                  due > 0
                    ? "dueCard"
                    : "paidCard"
                }
              >
                <span>Due</span>

                <strong>
                  ₹{due}
                </strong>
              </div>
            </div>

            <div className="paymentProgress">
              <div className="progressTop">
                <span>
                  Payment received
                </span>

                <strong>
                  {Math.round(
                    paymentPercent
                  )}
                  %
                </strong>
              </div>

              <div className="progressTrack">
                <div
                  className="progressFill"
                  style={{
                    width: `${paymentPercent}%`
                  }}
                />
              </div>
            </div>
          </div>

          <div className="detailSection">
            <div className="detailSectionTitle">
              <History size={16} />
              PAYMENT HISTORY
            </div>

            {payments.length ? (
              <div className="paymentHistory">
                {payments.map(
                  (payment) => (
                    <div
                      className="paymentHistoryItem"
                      key={
                        payment.id
                      }
                    >
                      <div className="paymentHistoryIcon">
                        <Wallet
                          size={
                            16
                          }
                        />
                      </div>

                      <div className="paymentHistoryInfo">
                        <div>
                          <strong>
                            ₹
                            {payment.amount}
                          </strong>

                          <span className="paymentMethod">
                            {
                              payment.method
                            }
                          </span>
                        </div>

                        <span className="paymentDate">
                          {payment.date}
                        </span>

                        {payment.note && (
                          <span className="paymentNote">
                            {
                              payment.note
                            }
                          </span>
                        )}
                      </div>

                      <button
                        className="paymentDelete"
                        onClick={() =>
                          onDeletePayment(
                            customer.id,
                            payment.id
                          )
                        }
                        title="Delete payment"
                      >
                        <Trash2
                          size={
                            14
                          }
                        />
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="noPayments">
                <Banknote
                  size={22}
                />

                <span>
                  No payment history yet.
                </span>
              </div>
            )}
          </div>

          {(() => {
            const documentProgress = getDocumentProgress(customer);
            const received = Array.isArray(customer.documents) ? customer.documents : [];
            const toggle = (doc) => {
              onUpdate(customer.id, {
                documents: received.includes(doc)
                  ? received.filter((item) => item !== doc)
                  : [...received, doc]
              });
            };

            return (
              <div className="detailSection documentsChecklistSection">
                <div className="detailSectionTitle">
                  <FileText size={16} />
                  DOCUMENT CHECKLIST
                </div>

                <div className="documentProgressHeader">
                  <div>
                    <strong>{documentProgress.receivedRequired.length} / {documentProgress.required.length} required documents</strong>
                    <span>
                      {documentProgress.missing.length
                        ? `${documentProgress.missing.length} document${documentProgress.missing.length > 1 ? "s" : ""} pending`
                        : "All required documents received"}
                    </span>
                  </div>
                  <strong className="documentProgressPercent">{documentProgress.percent}%</strong>
                </div>

                <div className="documentProgressTrack">
                  <div
                    className={`documentProgressFill ${documentProgress.percent === 100 ? "complete" : ""}`}
                    style={{ width: `${documentProgress.percent}%` }}
                  />
                </div>

                <div className="documentChecklist">
                  {documentProgress.required.map((doc) => {
                    const receivedDoc = received.includes(doc);
                    return (
                      <button
                        type="button"
                        className={`documentChecklistItem ${receivedDoc ? "received" : "missing"}`}
                        key={doc}
                        onClick={() => toggle(doc)}
                      >
                        {receivedDoc ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
                        <span>
                          <strong>{doc}</strong>
                          <small>{receivedDoc ? "Received" : "Pending"}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="customDocumentArea">
                  <div className="customDocumentHeading">
                    <span>Additional documents</span>
                    <small>Optional / custom</small>
                  </div>

                  {received.filter((doc) => !documentProgress.required.includes(doc)).map((doc) => (
                    <button type="button" className="customDocumentPill" key={doc} onClick={() => toggle(doc)} title="Click to remove">
                      <CheckCircle2 size={14} />
                      {doc}
                      <X size={13} />
                    </button>
                  ))}

                  <div className="customDocumentInputRow">
                    <input className="customDocumentInput" placeholder="e.g. Birth Certificate" id={`custom-doc-${customer.id}`} />
                    <button
                      type="button"
                      className="secondaryButton smallButton"
                      onClick={() => {
                        const input = document.getElementById(`custom-doc-${customer.id}`);
                        const value = input?.value.trim();
                        if (!value) return;
                        if (!received.includes(value)) onUpdate(customer.id, { documents: [...received, value] });
                        if (input) input.value = "";
                      }}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="detailSection followUpSection">
            <div className="detailSectionTitle">
              <CalendarDays size={16} />
              FOLLOW-UPS & REMINDERS
            </div>

            <div className="followUpHeaderRow">
              <span>Keep track of the next customer action.</span>
              <button type="button" className="secondaryButton smallButton" onClick={onAddReminder}>
                <Plus size={14} /> Add Reminder
              </button>
            </div>

            {(() => {
              const reminders = Array.isArray(customer.followUps) ? [...customer.followUps].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))) : [];
              if (!reminders.length) {
                return <div className="followUpEmpty">No reminders added yet.</div>;
              }
              return (
                <div className="followUpList">
                  {reminders.map((reminder) => (
                    <div className={`followUpItem ${reminder.completed ? "completed" : ""}`} key={reminder.id}>
                      <button type="button" className="followUpCheck" onClick={() => onUpdate(customer.id, { followUps: reminders.map((item) => item.id === reminder.id ? { ...item, completed: !item.completed } : item) })}>
                        {reminder.completed ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
                      </button>
                      <div className="followUpMain">
                        <strong>{reminder.title}</strong>
                        <span>{reminder.type} · {reminder.date}{reminder.time ? ` · ${reminder.time}` : ""}</span>
                        {reminder.note ? <small>{reminder.note}</small> : null}
                      </div>
                      <button type="button" className="followUpDelete" onClick={() => { if (window.confirm("Delete this reminder?")) onUpdate(customer.id, { followUps: reminders.filter((item) => item.id !== reminder.id) }); }} title="Delete reminder">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="detailSection">
            <div className="detailSectionTitle">
              <FileText size={16} />
              NOTES
            </div>

            <div className="notesBox">
              {customer.notes ||
                "No notes added."}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function DetailItem({
  icon,
  label,
  value
}) {
  return (
    <div className="detailItem">
      <div className="detailItemIcon">
        {icon}
      </div>

      <div>
        <span>{label}</span>

        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
}

function ReminderModal({ customer, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Follow-up");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");

  const submit = (event) => {
    event.preventDefault();
    if (!title.trim()) { alert("Please enter a reminder title."); return; }
    if (!date) { alert("Please select a reminder date."); return; }
    onSubmit({ title: title.trim(), type, date, time, note: note.trim() });
  };

  return (
    <div className="modalOverlay">
      <div className="modalCard reminderModal">
        <div className="modalHeader">
          <div>
            <div className="modalEyebrow">// FOLLOW-UP REMINDER</div>
            <h2>Add Reminder</h2>
            <p>Create a follow-up for {customer.name}.</p>
          </div>
          <button className="iconButton" onClick={onClose}><X size={19} /></button>
        </div>
        <form onSubmit={submit}>
          <label>Reminder Title *<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call customer about document" /></label>
          <div className="formGrid">
            <label>Reminder Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option>Follow-up</option><option>Payment Due</option><option>Documents</option><option>Work Update</option><option>Ready for Pickup</option><option>Other</option>
              </select>
            </label>
            <label>Reminder Date *<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>Time (optional)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          </div>
          <label>Note<textarea value={note} onChange={(e) => setNote(e.target.value)} rows="3" placeholder="What should you remember?" /></label>
          <div className="modalFooter">
            <button type="button" className="secondaryButton" onClick={onClose}>Cancel</button>
            <button type="submit" className="primaryButton"><CalendarDays size={16} /> Save Reminder</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FollowUps({ tasks, setSelectedCustomer, onUpdate, onAddReminder }) {
  const today = new Date().toISOString().slice(0, 10);
  const reminders = tasks.flatMap((task) => (Array.isArray(task.followUps) ? task.followUps : []).map((reminder) => ({ ...reminder, customer: task })))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || Number(a.id || 0) - Number(b.id || 0));
  const pending = reminders.filter((r) => !r.completed);
  const overdue = pending.filter((r) => r.date < today);
  const todayItems = pending.filter((r) => r.date === today);
  const upcoming = pending.filter((r) => r.date > today);

  const toggle = (item) => {
    const existing = Array.isArray(item.customer.followUps) ? item.customer.followUps : [];
    onUpdate(item.customer.id, { followUps: existing.map((r) => r.id === item.id ? { ...r, completed: !r.completed } : r) });
  };

  const renderGroup = (title, list, empty) => (
    <section className="followUpGroup">
      <div className="sectionTitle"><div><span className="eyebrow">// {title.toUpperCase()}</span><h2>{title}</h2></div><span className="followUpCount">{list.length}</span></div>
      {list.length ? <div className="followUpPageList">{list.map((item) => (
        <div className="followUpPageItem" key={`${item.customer.id}-${item.id}`}>
          <button type="button" className="followUpCheck" onClick={() => toggle(item)}><CircleAlert size={18} /></button>
          <button type="button" className="followUpCustomer" onClick={() => setSelectedCustomer(item.customer)}><strong>{item.title}</strong><span>{item.customer.name} · {item.customer.service}</span></button>
          <div className="followUpDate"><strong>{item.date}</strong><span>{item.time || item.type}</span></div>
        </div>
      ))}</div> : <div className="followUpEmpty pageEmpty">{empty}</div>}
    </section>
  );

  return (
    <div className="followUpsPage">
      <div className="pageHeading"><div><div className="eyebrow">// CUSTOMER RETENTION</div><h1>Follow-ups</h1><p>Never miss the next action for a customer.</p></div><button className="primaryButton" onClick={() => pending[0] ? onAddReminder(pending[0].customer) : alert("Open a customer record to add a reminder.")}><Plus size={16} /> Add Reminder</button></div>
      <div className="followUpStats"><div><span>Pending</span><strong>{pending.length}</strong></div><div><span>Overdue</span><strong>{overdue.length}</strong></div><div><span>Today</span><strong>{todayItems.length}</strong></div><div><span>Upcoming</span><strong>{upcoming.length}</strong></div></div>
      {renderGroup("Overdue", overdue, "No overdue reminders. Great!")}
      {renderGroup("Today", todayItems, "Nothing scheduled for today.")}
      {renderGroup("Upcoming", upcoming, "No upcoming reminders.")}
    </div>
  );
}

function PaymentModal({
  customer,
  onClose,
  onSubmit
}) {
  const currentDue =
    Math.max(
      Number(customer.amount || 0) -
        Number(customer.paid || 0),
      0
    );

  const [amount, setAmount] =
    useState("");

  const [method, setMethod] =
    useState("Cash");

  const [note, setNote] =
    useState("");

  const submit = (e) => {
    e.preventDefault();

    const paymentAmount =
      Number(amount || 0);

    if (
      !paymentAmount ||
      paymentAmount <= 0
    ) {
      alert(
        "Please enter a valid payment amount."
      );
      return;
    }

    if (
      paymentAmount >
      currentDue
    ) {
      alert(
        `Payment cannot be greater than the current due amount of ₹${currentDue}.`
      );
      return;
    }

    onSubmit({
      amount:
        paymentAmount,
      method,
      note: note.trim()
    });
  };

  return (
    <div className="modalOverlay">
      <div className="modalCard paymentModal">
        <div className="modalHeader">
          <div>
            <div className="modalEyebrow">
              // PAYMENT ENTRY
            </div>

            <h2>
              Add Payment
            </h2>

            <p>
              Record a payment received
              from {customer.name}.
            </p>
          </div>

          <button
            className="iconButton"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <div className="paymentModalCustomer">
          <div className="paymentCustomerAvatar">
            {(
              customer.name ||
              "C"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <strong>
              {customer.name}
            </strong>

            <span>
              Current due: ₹
              {currentDue}
            </span>
          </div>
        </div>

        <form onSubmit={submit}>
          <label>
            Payment Amount *

            <div className="moneyInput">
              <span>₹</span>

              <input
                type="number"
                min="1"
                max={currentDue}
                value={amount}
                onChange={(e) =>
                  setAmount(
                    e.target.value
                  )
                }
                placeholder={
                  currentDue > 0
                    ? String(
                        currentDue
                      )
                    : "0"
                }
              />
            </div>
          </label>

          <label>
            Payment Method

            <select
              value={method}
              onChange={(e) =>
                setMethod(
                  e.target.value
                )
              }
            >
              <option>
                Cash
              </option>

              <option>
                UPI
              </option>

              <option>
                Card
              </option>

              <option>
                Other
              </option>
            </select>
          </label>

          <label>
            Note

            <textarea
              value={note}
              onChange={(e) =>
                setNote(
                  e.target.value
                )
              }
              placeholder="e.g. Advance payment"
              rows="3"
            />
          </label>

          <div className="modalFooter">
            <button
              type="button"
              className="secondaryButton"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primaryButton"
              disabled={
                currentDue <= 0
              }
            >
              <Wallet size={16} />
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerFormModal({
  title,
  customer,
  onClose,
  onSubmit
}) {
  const [customDocument, setCustomDocument] = useState("");

  const [form, setForm] =
    useState({
      name:
        customer?.name || "",
      phone:
        customer?.phone || "",
      reference:
        customer?.reference || "",
      address:
        customer?.address || "",
      service:
        customer?.service || "",
      workflowStage:
        customer?.workflowStage || getWorkflowStages(customer?.service)[0],
      applicationNumber:
        customer?.applicationNumber || "",
      amount:
        customer?.amount ?? "",
      paid:
        customer?.paid ?? "",
      documents:
        customer?.documents || [],
      notes:
        customer?.notes || "",
      dueDate:
        customer?.dueDate || ""
    });

  const update = (
    field,
    value
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleDocument = (
    document
  ) => {
    setForm((prev) => ({
      ...prev,
      documents:
        prev.documents.includes(
          document
        )
          ? prev.documents.filter(
              (item) =>
                item !==
                document
            )
          : [
              ...prev.documents,
              document
            ]
    }));
  };

  const submit = (e) => {
    e.preventDefault();

    if (
      !form.name.trim() ||
      !form.service.trim()
    ) {
      alert(
        "Customer name and service are required."
      );
      return;
    }

    if (
      Number(form.paid || 0) >
      Number(form.amount || 0)
    ) {
      alert(
        "Paid amount cannot be greater than total amount."
      );
      return;
    }

    onSubmit({
      ...form,
      name:
        form.name.trim(),
      phone:
        form.phone.trim(),
      reference:
        form.reference.trim(),
      address:
        form.address.trim(),
      service:
        form.service.trim(),
      amount:
        Number(form.amount || 0),
      paid:
        Number(form.paid || 0)
    });
  };

  return (
    <div className="modalOverlay">
      <div className="modalCard largeModal">
        <div className="modalHeader">
          <div>
            <div className="modalEyebrow">
              {customer
                ? "// EDIT RECORD"
                : "// NEW RECORD"}
            </div>

            <h2>
              {title}
            </h2>

            <p>
              {customer
                ? "Update this customer's information."
                : "Create a new customer record for your work queue."}
            </p>
          </div>

          <button
            className="iconButton"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="formGrid">
            <label>
              Customer Name *

              <input
                value={form.name}
                onChange={(e) =>
                  update(
                    "name",
                    e.target.value
                  )
                }
                placeholder="Rahul Kumar"
              />
            </label>

            <label>
              Phone

              <input
                value={form.phone}
                onChange={(e) =>
                  update(
                    "phone",
                    e.target.value
                  )
                }
                placeholder="9876543210"
              />
            </label>

            <label>
              Reference Number

              <input
                value={
                  form.reference
                }
                onChange={(e) =>
                  update(
                    "reference",
                    e.target.value
                  )
                }
                placeholder="PAN123456"
              />
            </label>

            <label>
              Service *

              <input
                list="serviceTemplateOptions"
                value={form.service}
                onChange={(e) => {
                  const service = e.target.value;
                  const stages = getWorkflowStages(service);
                  update("service", service);
                  if (!stages.includes(form.workflowStage)) {
                    update("workflowStage", stages[0]);
                  }
                }}
                placeholder="PAN Correction"
              />
              <datalist id="serviceTemplateOptions">
                {Object.keys(workflowStagesByService).map((service) => (
                  <option key={service} value={service} />
                ))}
              </datalist>
            </label>

            <label>
              Current Work Stage

              <select
                value={form.workflowStage}
                onChange={(e) => update("workflowStage", e.target.value)}
              >
                {getWorkflowStages(form.service).map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </label>

            <label>
              {getTrackingLabel(form.service)}

              <input
                value={form.applicationNumber}
                onChange={(e) => update("applicationNumber", e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label>
              Total Amount

              <input
                type="number"
                min="0"
                value={
                  form.amount
                }
                onChange={(e) =>
                  update(
                    "amount",
                    e.target.value
                  )
                }
                placeholder="150"
              />
            </label>

            <label>
              Paid Amount

              <input
                type="number"
                min="0"
                value={form.paid}
                onChange={(e) =>
                  update(
                    "paid",
                    e.target.value
                  )
                }
                placeholder="100"
              />
            </label>

            <label>
              Expected Completion

              <input
                type="date"
                value={
                  form.dueDate
                }
                onChange={(e) =>
                  update(
                    "dueDate",
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Address

              <input
                value={
                  form.address
                }
                onChange={(e) =>
                  update(
                    "address",
                    e.target.value
                  )
                }
                placeholder="Delhi"
              />
            </label>
          </div>

          <label className="fullLabel">
            Documents Received
          </label>

          <div className="checkboxGrid">
            {docOptions.map(
              (doc) => (
                <label
                  className="checkboxItem"
                  key={doc}
                >
                  <input
                    type="checkbox"
                    checked={form.documents.includes(
                      doc
                    )}
                    onChange={() =>
                      toggleDocument(
                        doc
                      )
                    }
                  />

                  <span>
                    {doc}
                  </span>
                </label>
              )
            )}
          </div>

          <div className="formRequiredDocuments">
            <div className="formDocHeading">
              <span>Required for {form.service || "this service"}</span>
              <small>
                {getDocumentProgress({ service: form.service, documents: form.documents }).receivedRequired.length}/{getRequiredDocuments(form.service).length} received
              </small>
            </div>
            <div className="formRequiredDocList">
              {getRequiredDocuments(form.service).map((doc) => (
                <span className={`formRequiredDoc ${form.documents.includes(doc) ? "received" : "missing"}`} key={doc}>
                  {form.documents.includes(doc) ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
                  {doc}
                </span>
              ))}
            </div>
          </div>

          <div className="customDocumentFormRow">
            <input
              value={customDocument}
              onChange={(e) => setCustomDocument(e.target.value)}
              placeholder="Add a custom document"
            />
            <button
              type="button"
              className="secondaryButton smallButton"
              onClick={() => {
                const value = customDocument.trim();
                if (!value || form.documents.includes(value)) return;
                setForm((prev) => ({ ...prev, documents: [...prev.documents, value] }));
                setCustomDocument("");
              }}
            >
              <Plus size={14} />
              Add Document
            </button>
          </div>

          <label className="fullLabel">
            Notes

            <textarea
              value={form.notes}
              onChange={(e) =>
                update(
                  "notes",
                  e.target.value
                )
              }
              placeholder="Add any important customer or application notes..."
              rows="4"
            />
          </label>

          <div className="modalFooter">
            <button
              type="button"
              className="secondaryButton"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primaryButton"
            >
              {customer ? (
                <>
                  <CheckCircle2
                    size={17}
                  />
                  Save Changes
                </>
              ) : (
                <>
                  <Plus size={17} />
                  Create Customer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickLinkModal({
  onClose,
  onSubmit
}) {
  const [name, setName] =
    useState("");

  const [url, setUrl] =
    useState("");

  const submit = (e) => {
    e.preventDefault();

    if (
      !name.trim() ||
      !url.trim()
    ) {
      return;
    }

    onSubmit({
      name: name.trim(),
      url: url.trim()
    });
  };

  return (
    <div className="modalOverlay">
      <div className="modalCard">
        <div className="modalHeader">
          <div>
            <div className="modalEyebrow">
              // QUICK LINK
            </div>

            <h2>
              Add Quick Link
            </h2>

            <p>
              Save a frequently used portal.
            </p>
          </div>

          <button
            className="iconButton"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={submit}>
          <label>
            Name

            <input
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              placeholder="Income Tax Portal"
            />
          </label>

          <label className="fullLabel">
            URL

            <input
              value={url}
              onChange={(e) =>
                setUrl(
                  e.target.value
                )
              }
              placeholder="https://example.com"
            />
          </label>

          <div className="modalFooter">
            <button
              type="button"
              className="secondaryButton"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              className="primaryButton"
              type="submit"
            >
              <Bookmark size={16} />
              Save Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickLinks({
  links,
  addLink,
  onDeleteLink,
  onAddLink
}) {
  return (
    <div>
      <PageHeading
        eyebrow="PERSONAL SHORTCUTS"
        title="My Quick Links"
        subtitle="Save portals and websites you use frequently."
      />

      <div className="quickLinkLayout">
        <div className="quickLinkForm">
          <div className="calculatorHeader">
            <div className="calculatorIcon">
              <Bookmark size={20} />
            </div>

            <div>
              <h3>
                Add Quick Link
              </h3>

              <p>
                Keep daily portals one click away.
              </p>
            </div>
          </div>

          <div className="emptyQuickAction">
            <p>
              Save your own frequently
              used websites.
            </p>

            <button className="primaryButton" onClick={onAddLink}>
              <Plus size={17} />
              Add Link
            </button>
          </div>
        </div>

        <div className="savedLinks">
          <div className="sectionHeading compact">
            <div>
              <span className="sectionEyebrow">
                SAVED PORTALS
              </span>

              <h2>
                {links.length} Links
              </h2>
            </div>
          </div>

          {!links.length ? (
            <div className="emptyState small">
              <Bookmark
                size={25}
              />

              <h3>
                No saved links yet
              </h3>

              <p>
                Add your first quick link.
              </p>
            </div>
          ) : (
            <div className="linksList">
              {links.map(
                (link) => (
                  <div
                    className="savedLink"
                    key={
                      link.id
                    }
                  >
                    <div className="savedLinkIcon">
                      <Link2
                        size={
                          17
                        }
                      />
                    </div>

                    <div>
                      <strong>
                        {
                          link.name
                        }
                      </strong>

                      <span>
                        {
                          link.url
                        }
                      </span>
                    </div>

                    <a
                      href={
                        getSafeExternalUrl(link.url)
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="rowAction"
                    >
                      <ExternalLink
                        size={
                          15
                        }
                      />
                    </a>

                    <button
                      className="rowAction danger"
                      onClick={() => onDeleteLink(link.id)}
                    >
                      <Trash2
                        size={
                          15
                        }
                      />
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="officialQuickLinks">
        <div className="sectionHeading compact">
          <div>
            <span className="sectionEyebrow">OFFICIAL PORTALS</span>
            <h2>Useful Government Shortcuts</h2>
          </div>
        </div>
        <div className="officialQuickGrid">
          {services
            .flatMap((service) =>
              service.links.map((link) => ({ ...link, category: service.title }))
            )
            .map((link) => {
              const saved = links.some(
                (item) =>
                  String(item.url || "").toLowerCase() ===
                  String(link.url || "").toLowerCase()
              );

              return (
                <div className="officialQuickItem" key={link.url}>
                  <div className="savedLinkIcon"><Globe2 size={16} /></div>
                  <div>
                    <strong>{link.name}</strong>
                    <span>{link.category}</span>
                  </div>
                  <a href={getSafeExternalUrl(link.url)} target="_blank" rel="noopener noreferrer" className="rowAction">
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    className="secondaryButton small"
                    disabled={saved}
                    onClick={() => addLink({ name: link.name, url: link.url })}
                  >
                    {saved ? "Saved" : "Save"}
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}


function Calculators() {
  const [gstAmount, setGstAmount] =
    useState("");

  const [gstRate, setGstRate] =
    useState("18");

  const [principal, setPrincipal] =
    useState("");

  const [rate, setRate] =
    useState("");

  const [months, setMonths] =
    useState("");

  const gst = gstAmount
    ? Number(gstAmount) *
      (Number(gstRate) / 100)
    : 0;

  const gstTotal =
    Number(gstAmount || 0) +
    gst;

  const monthlyRate =
    Number(rate || 0) /
    12 /
    100;

  const emi =
    principal &&
    rate &&
    months
      ? (Number(principal) *
          monthlyRate *
          Math.pow(
            1 + monthlyRate,
            Number(months)
          )) /
        (Math.pow(
          1 + monthlyRate,
          Number(months)
        ) - 1)
      : 0;

  return (
    <div>
      <PageHeading
        eyebrow="UTILITY DESK"
        title="Calculators"
        subtitle="Quick calculations for everyday cyber café work."
      />

      <div className="calculatorGrid">
        <div className="calculatorCard">
          <div className="calculatorHeader">
            <div className="calculatorIcon">
              <IndianRupee
                size={20}
              />
            </div>

            <div>
              <h3>
                GST Calculator
              </h3>

              <p>
                Calculate GST amount and final price.
              </p>
            </div>
          </div>

          <label>
            Amount

            <input
              type="number"
              value={
                gstAmount
              }
              onChange={(e) =>
                setGstAmount(
                  e.target.value
                )
              }
              placeholder="10000"
            />
          </label>

          <label>
            GST Rate

            <select
              value={gstRate}
              onChange={(e) =>
                setGstRate(
                  e.target.value
                )
              }
            >
              <option value="5">
                5%
              </option>

              <option value="12">
                12%
              </option>

              <option value="18">
                18%
              </option>

              <option value="28">
                28%
              </option>
            </select>
          </label>

          <div className="calculatorResult">
            <div>
              <span>
                GST Amount
              </span>

              <strong>
                ₹
                {gst.toFixed(
                  2
                )}
              </strong>
            </div>

            <div>
              <span>
                Total
              </span>

              <strong>
                ₹
                {gstTotal.toFixed(
                  2
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="calculatorCard">
          <div className="calculatorHeader">
            <div className="calculatorIcon">
              <CreditCard
                size={20}
              />
            </div>

            <div>
              <h3>
                EMI Calculator
              </h3>

              <p>
                Estimate monthly loan payments.
              </p>
            </div>
          </div>

          <label>
            Loan Amount

            <input
              type="number"
              value={
                principal
              }
              onChange={(e) =>
                setPrincipal(
                  e.target.value
                )
              }
              placeholder="500000"
            />
          </label>

          <label>
            Annual Interest Rate %

            <input
              type="number"
              value={rate}
              onChange={(e) =>
                setRate(
                  e.target.value
                )
              }
              placeholder="10"
            />
          </label>

          <label>
            Tenure (Months)

            <input
              type="number"
              value={months}
              onChange={(e) =>
                setMonths(
                  e.target.value
                )
              }
              placeholder="60"
            />
          </label>

          <div className="calculatorResult single">
            <div>
              <span>
                Estimated Monthly EMI
              </span>

              <strong>
                ₹
                {emi
                  ? emi.toFixed(
                      2
                    )
                  : "0.00"}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function printReceipt(task, businessProfile = {}) {
  const due =
    Math.max(
      Number(task.amount || 0) -
        Number(task.paid || 0),
      0
    );

  const receiptWindow =
    window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=800,height=900"
    );

  if (!receiptWindow) {
    alert(
      "Please allow popups to print the receipt."
    );
    return;
  }

  receiptWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${escapeHtml(task.reference || task.name)}</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            background: #fff;
            color: #111827;
            padding: 40px;
            line-height: 1.5;
          }

          .receipt {
            max-width: 650px;
            margin: auto;
            border: 1px solid #ddd;
            padding: 32px;
            border-radius: 6px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            gap: 32px;
            border-bottom: 2px solid #111827;
            padding-bottom: 22px;
            margin-bottom: 24px;
          }

          h1 {
            margin: 0 0 7px;
            font-size: 25px;
            line-height: 1.2;
            letter-spacing: -0.2px;
          }

          .muted {
            color: #6b7280;
            font-size: 13px;
            line-height: 1.55;
          }

          .header .muted {
            margin-top: 2px;
          }

          .header > div:last-child {
            text-align: right;
            white-space: nowrap;
          }

          .header > div:last-child strong {
            display: block;
            margin-bottom: 5px;
            font-size: 14px;
            letter-spacing: 0.6px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 28px;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
            line-height: 1.45;
          }

          .row span {
            color: #6b7280;
            font-size: 13px;
          }

          .row strong {
            font-size: 14px;
            text-align: right;
            line-height: 1.45;
          }

          .total {
            margin-top: 4px;
            padding: 15px 0;
            font-size: 18px;
            font-weight: bold;
          }

          .total span {
            color: #111827;
            font-size: 15px;
          }

          .total strong {
            font-size: 18px;
          }

          .footer {
            margin-top: 30px;
            padding-top: 18px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
            line-height: 1.7;
          }

          .footer div {
            margin: 2px 0;
          }

          .footer div:last-child {
            margin-top: 9px;
            font-weight: 500;
          }

          @media print {
            body {
              padding: 0;
            }

            .receipt {
              border: none;
              padding: 24px;
            }
          }
        </style>
      </head>

      <body>
        <div class="receipt">
          <div class="header">
            <div>
              <h1>
                ${escapeHtml(businessProfile.businessName || "CyberCafe Helper")}
              </h1>

              <div class="muted">
                ${escapeHtml(businessProfile.ownerName ? `Owner: ${businessProfile.ownerName}` : "Digital Seva / Customer Receipt")}
              </div>
            </div>

            <div>
              <strong>
                RECEIPT
              </strong>

              <div class="muted">
                #${escapeHtml(task.reference || task.id)}
              </div>
            </div>
          </div>

          <div class="row">
            <span>Customer</span>
            <strong>
              ${escapeHtml(task.name)}
            </strong>
          </div>

          <div class="row">
            <span>Phone</span>
            <strong>
              ${escapeHtml(task.phone || "—")}
            </strong>
          </div>

          <div class="row">
            <span>Service</span>
            <strong>
              ${escapeHtml(task.service)}
            </strong>
          </div>

          <div class="row">
            <span>Total Amount</span>
            <strong>
              ₹${escapeHtml(task.amount || 0)}
            </strong>
          </div>

          <div class="row">
            <span>Paid</span>
            <strong>
              ₹${escapeHtml(task.paid || 0)}
            </strong>
          </div>

          <div class="row total">
            <span>Amount Due</span>
            <strong>
              ₹${escapeHtml(due)}
            </strong>
          </div>

          <div class="row">
            <span>Status</span>
            <strong>
              ${escapeHtml(task.status)}
            </strong>
          </div>

          <div class="footer">
            ${businessProfile.address ? `<div>${escapeHtml(businessProfile.address)}</div>` : ""}
            ${businessProfile.phone ? `<div>Phone: ${escapeHtml(businessProfile.phone)}</div>` : ""}
            ${businessProfile.gstin ? `<div>GSTIN: ${escapeHtml(businessProfile.gstin)}</div>` : ""}
            <div>${escapeHtml(businessProfile.receiptFooter || "Thank you for using our services.")}</div>
          </div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  receiptWindow.document.close();
}

function AppRoot() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceRole, setWorkspaceRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [publicMode, setPublicMode] = useState(() => {
    if (typeof window === "undefined") return "landing";
    const params = new URLSearchParams(window.location.search);
    const workspaceId = params.get("workspace") || "";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId);
    return params.get("mode") === "customer" && isUuid ? "qr" : "landing";
  });
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [legalPage, setLegalPage] = useState(() => {
    if (typeof window === "undefined") return null;
    const legal = new URLSearchParams(window.location.search).get("legal");
    return legal === "privacy" || legal === "terms" ? legal : null;
  });
  const [qrWorkspaceId] = useState(() => {
    if (typeof window === "undefined") return "";
    const workspaceId = new URLSearchParams(window.location.search).get("workspace") || "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId) ? workspaceId : "";
  });

  useEffect(() => {
  let title = "CyberCafe Helper";

  if (legalPage === "privacy") {
    title = "Privacy Policy · CyberCafe Helper";
  } else if (legalPage === "terms") {
    title = "Terms & Conditions · CyberCafe Helper";
  } else if (recoveryMode) {
    title = "Reset Password · CyberCafe Helper";
  } else if (publicMode === "qr") {
    title = "Print Request · CyberCafe Helper";
  } else if (publicMode === "login") {
    title = "Sign In · CyberCafe Helper";
  } else if (publicMode === "signup") {
    title = "Create Workspace · CyberCafe Helper";
  } else if (publicMode === "forgot") {
    title = "Forgot Password · CyberCafe Helper";
  } else if (user) {
    title = "Dashboard · CyberCafe Helper";
  }

  document.title = title;
}, [legalPage, recoveryMode, publicMode, user]);

  // Emergency startup fallback: the UI must never remain on the loading screen.
  useEffect(() => {
    const emergencyTimer = setTimeout(() => {
      console.warn("CyberCafe Helper startup fallback: forcing loading screen off.");
      setLoading(false);
    }, 3000);
    return () => clearTimeout(emergencyTimer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Supabase session error:", error);
          if (mounted) setUser(null);
          return;
        }

        let session = data?.session || null;

        if (!session?.access_token) {
          const refreshResult = await supabase.auth.refreshSession();

          if (!refreshResult.error) {
            session = refreshResult.data?.session || null;
          } else {
            const message = String(
              refreshResult.error?.message || refreshResult.error || ""
            ).toLowerCase();

            const invalidRefreshToken =
              message.includes("invalid refresh token") ||
              message.includes("refresh token not found") ||
              message.includes("refresh token is not found");

            if (invalidRefreshToken) {
              try {
                await supabase.auth.signOut({ scope: "local" });
              } catch (signOutError) {
                console.warn(
                  "Could not clear the broken local auth session during startup:",
                  signOutError
                );
              }
              session = null;
            } else {
              console.warn(
                "Supabase session refresh during startup failed:",
                refreshResult.error
              );
            }
          }
        }

        if (mounted) {
          setUser(session?.user || null);
        }
      } catch (error) {
        console.error("Supabase session load failed:", error);

        // Do not aggressively sign the user out because a transient
        // browser/network problem prevented the initial session read.
        // Supabase Auth remains the source of truth through its listener.
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setUser(session?.user || null);
        return;
      }
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadUserProfile = async () => {
      if (!user) {
        setUserProfile(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, full_name, email, role, terms_accepted_at, terms_version, privacy_policy_version, created_at, updated_at")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("User profile lookup failed:", error);
          if (mounted) setUserProfile(null);
          return;
        }

        if (data) {
          if (mounted) setUserProfile(data);
          return;
        }

        const { data: createdProfile, error: createError } = await supabase
          .from("user_profiles")
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || "",
            email: user.email || "",
            role: "owner",
            terms_accepted_at: user.user_metadata?.terms_accepted_at || null,
            terms_version: user.user_metadata?.terms_version || null,
            privacy_policy_version: user.user_metadata?.privacy_policy_version || null
          })
          .select("id, full_name, email, role, terms_accepted_at, terms_version, privacy_policy_version, created_at, updated_at")
          .single();

        if (createError) {
          console.error("User profile creation failed:", createError);
          if (mounted) setUserProfile(null);
          return;
        }

        if (mounted) setUserProfile(createdProfile);
      } catch (error) {
        console.error("User profile load failed:", error);
        if (mounted) setUserProfile(null);
      }
    };

    loadUserProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const loadWorkspace = async () => {
      if (!user) {
        setWorkspace(null);
        setWorkspaceRole(null);
        return;
      }

      try {
        // IMPORTANT: customer accounts can also have an automatically-created
        // owner workspace. Resolve customer portal access FIRST so the linked
        // cyber-café workspace wins over that personal owner workspace.
        const { data: customerAccess, error: customerAccessError } = await supabase
          .from("customer_workspace_access")
          .select("workspace_id, customer_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (customerAccessError) {
          console.error("Customer workspace access lookup failed:", customerAccessError);
        }

        if (customerAccess?.workspace_id) {
          const { data: customerWorkspace, error: customerWorkspaceError } = await supabase
            .from("workspaces")
            .select("id, name, owner_id, phone, address, gstin, print_bw_price, print_color_price, print_a3_bw_price, print_a3_color_price, print_duplex_discount, created_at, updated_at")
            .eq("id", customerAccess.workspace_id)
            .maybeSingle();

          if (!mounted) return;

          if (customerWorkspaceError) {
            console.error("Customer workspace lookup failed:", customerWorkspaceError);
            setWorkspace(null);
            setWorkspaceRole(null);
            return;
          }

          setWorkspace(customerWorkspace || null);
          setWorkspaceRole("customer");
          return;
        }

        // No customer portal mapping: resolve normal workspace membership.
        const { data: membership, error: membershipError } = await supabase
          .from("workspace_members")
          .select("workspace_id, role")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          console.error("Workspace membership lookup failed:", membershipError);
        }

        if (membership?.workspace_id) {
          const { data: memberWorkspace, error: memberWorkspaceError } = await supabase
            .from("workspaces")
            .select("id, name, owner_id, phone, address, gstin, print_bw_price, print_color_price, print_a3_bw_price, print_a3_color_price, print_duplex_discount, created_at, updated_at")
            .eq("id", membership.workspace_id)
            .maybeSingle();

          if (!mounted) return;

          if (memberWorkspaceError) {
            console.error("Member workspace lookup failed:", memberWorkspaceError);
            setWorkspace(null);
            setWorkspaceRole(null);
            return;
          }

          setWorkspace(memberWorkspace || null);
          setWorkspaceRole(membership.role || null);
          return;
        }

        // No membership exists: this is a new standalone account, so create
        // its owner workspace using the existing safe RPC.
        const { data: ensuredWorkspace, error: ensureError } = await supabase
          .rpc("ensure_workspace_for_current_user");

        if (ensureError) {
          console.error("Workspace initialization failed:", ensureError);
          if (mounted) {
            setWorkspace(null);
            setWorkspaceRole(null);
          }
          return;
        }

        if (!mounted) return;

        const workspaceRow = Array.isArray(ensuredWorkspace)
          ? ensuredWorkspace[0]
          : ensuredWorkspace;

        if (workspaceRow?.id) {
          setWorkspace(workspaceRow);

          try {
            const roleFromMembership = await getCurrentWorkspaceRole(workspaceRow.id);
            if (mounted) setWorkspaceRole(roleFromMembership || "owner");
          } catch (roleError) {
            console.error("Workspace role lookup failed:", roleError);
            if (mounted) setWorkspaceRole("owner");
          }
          return;
        }

        const { data, error } = await supabase
          .from("workspaces")
          .select("id, name, owner_id, phone, address, gstin, print_bw_price, print_color_price, print_a3_bw_price, print_a3_color_price, print_duplex_discount, created_at, updated_at")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!mounted) return;
        if (error) {
          console.error("Workspace lookup failed:", error);
          setWorkspace(null);
          setWorkspaceRole(null);
          return;
        }

        setWorkspace(data || null);
        if (data?.id) {
          try {
            const roleFromMembership = await getCurrentWorkspaceRole(data.id);
            if (mounted) setWorkspaceRole(roleFromMembership || "owner");
          } catch (roleError) {
            console.error("Workspace role lookup failed:", roleError);
            if (mounted) setWorkspaceRole("owner");
          }
        } else {
          setWorkspaceRole(null);
        }
      } catch (error) {
        console.error("Workspace initialization failed:", error);
        if (mounted) {
          setWorkspace(null);
          setWorkspaceRole(null);
        }
      }
    };

    loadWorkspace();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    const handler = (event) => {
      const value = event.detail;
      if (value === "privacy" || value === "terms") setLegalPage(value);
    };
    window.addEventListener("cc-open-legal", handler);
    return () => window.removeEventListener("cc-open-legal", handler);
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRecoveryMode(false);
    setWorkspace(null);
    setWorkspaceRole(null);
    setUserProfile(null);
    setPublicMode("landing");
  };

  if (loading) {
    return (
      <div className="authLoadingScreen">
        <div className="authLoadingIcon"><Monitor size={22} /></div>
        <strong>Loading CyberCafe Helper…</strong>
      </div>
    );
  }

  if (recoveryMode) {
    return <ResetPasswordScreen onComplete={() => { setRecoveryMode(false); setUser(null); setPublicMode("login"); supabase.auth.signOut(); }} />;
  }

  if (legalPage) {
    return (
      <LegalPage
        type={legalPage}
        onBack={() => { setLegalPage(null); setPublicMode("landing"); }}
        onSignUp={() => { setLegalPage(null); setPublicMode("signup"); }}
      />
    );
  }

  if (publicMode === "qr" && qrWorkspaceId) {
    return (
      <QRCustomerLanding
        workspaceId={qrWorkspaceId}
        onSignIn={() => setPublicMode("login")}
        onSignUp={() => setPublicMode("signup")}
      />
    );
  }

  if (user) {
    return (
      <App
        user={user}
        onSignOut={signOut}
        workspace={workspace}
        userProfile={userProfile}
        workspaceRole={workspaceRole}
      />
    );
  }

  if (publicMode === "login") {
    return <AuthScreen initialMode="login" onBackToLanding={() => setPublicMode("landing")} onForgotPassword={() => setPublicMode("forgot")} />;
  }

  if (publicMode === "signup") {
    return <AuthScreen initialMode="signup" onBackToLanding={() => setPublicMode("landing")} onForgotPassword={() => setPublicMode("forgot")} />;
  }

  if (publicMode === "forgot") {
    return <ForgotPasswordScreen onBackToLogin={() => setPublicMode("login")} onBackToLanding={() => setPublicMode("landing")} />;
  }

  return (
    <LandingPage
      onSignIn={() => setPublicMode("login")}
      onSignUp={() => setPublicMode("signup")}
    />
  );
}

createRoot(document.getElementById("root")).render(<AppRoot />);


// ============================================================
// STEP 19E STATUS
// Workspace membership is now the source of truth for workspace permissions.
// Staff/admin/customer accounts resolve their existing workspace before any
// owner-workspace initialization can occur.
//
// STEP 18B-1 STATUS
// Supabase customer repository is ready.
// Customer data is stored in Supabase; localStorage is limited to non-sensitive preferences and print tracking.
// The next step will wire the Customer CRM UI to these functions.
// ============================================================
