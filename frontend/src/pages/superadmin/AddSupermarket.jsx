import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Store,
  Building2,
  User,
  Users,
  Mail,
  Phone,
  MapPin,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Crown,
  Sliders,
  CheckCircle2,
  Check,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Copy,
  Download,
  ExternalLink,
  Sparkles,
  PlusCircle,
  CreditCard,
  CheckCheck,
  Image as ImageIcon,
  CheckSquare,
  Upload,
  X,
  Globe,
  Truck,
} from "lucide-react";
import API from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./AddSupermarket.css";
import "./SuperAdmin.css";

// 4 Standard Multi-Tenant SaaS Subscription Plans
const SAAS_PLANS = [
  {
    id: "Basic",
    name: "Basic Plan",
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    badge: null,
    features: [
      "Up to 1,000 Products",
      "1 Branch Location",
      "Up to 3 Staff Accounts",
      "Standard Barcode Generation",
      "Daily Sales & Inventory Summary",
      "Standard Email Support",
    ],
  },
  {
    id: "Standard",
    name: "Standard Plan",
    monthlyPrice: 9999,
    yearlyPrice: 99990,
    badge: null,
    features: [
      "Up to 5,000 Products",
      "Up to 2 Branch Locations",
      "Up to 10 Staff Accounts",
      "Auto Barcode Printing & Labels",
      "Low Stock Notifications & Reorder",
      "Consolidated Daily Reports",
      "Business Hours Support",
    ],
  },
  {
    id: "Premium",
    name: "Premium Plan",
    monthlyPrice: 19999,
    yearlyPrice: 199990,
    badge: "Most Popular",
    features: [
      "Unlimited Products Inventory",
      "Up to 5 Branches Network",
      "Up to 25 Staff Accounts & Roles",
      "Instant Customer Self-Checkout",
      "Exit QR & Turnstile Gate Control",
      "Product-Wise Profit & Loss Reports",
      "GST Filing CSV/Excel Exports",
      "24/7 Priority Support",
    ],
  },
  {
    id: "Enterprise",
    name: "Enterprise Plan",
    monthlyPrice: 29999,
    yearlyPrice: 299990,
    badge: "Unlimited",
    features: [
      "Unlimited Products & Warehouses",
      "Unlimited Branches Multi-City",
      "Unlimited Staff & Cashier Roles",
      "Dedicated Database Isolation",
      "Custom ERP & POS Hardware APIs",
      "Audit Logs & Security Monitoring",
      "Dedicated SaaS Account Manager",
      "99.99% Guaranteed Cloud SLA",
    ],
  },
];

// Helper: Generate collision-free unique Supermarket ID (e.g. SM-8492)
function generateStoreCode(name = "") {
  let prefix = "SM";
  if (name.trim()) {
    const letters = name.trim().replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
    if (letters.length >= 2) prefix = letters;
  }
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomDigits}`;
}

// Helper: Generate a strong, readable temporary password
function generateStrongPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghjkmnpqrstuvwxyz";
  const nums = "23456789";
  const specials = "!@#$%&*";

  let pwd = "";
  pwd += chars[Math.floor(Math.random() * chars.length)];
  pwd += lowers[Math.floor(Math.random() * lowers.length)];
  pwd += nums[Math.floor(Math.random() * nums.length)];
  pwd += specials[Math.floor(Math.random() * specials.length)];

  const all = chars + lowers + nums + specials;
  for (let i = 0; i < 6; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd;
}

// Helper: Format date to YYYY-MM-DD
function formatDate(dateObj) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AddSupermarket() {
  const navigate = useNavigate();
  const { switchSupermarket, loadSupermarkets } = useAuth();

  // Multi-Step Stepper State (Steps 1 through 5, and Step 6 for Success)
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  // ================= Step 1: Supermarket Information =================
  const [supermarketName, setSupermarketName] = useState("");
  const [supermarketId, setSupermarketId] = useState(() => generateStoreCode());
  const [ownerName, setOwnerName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoLoadError, setLogoLoadError] = useState(false);
  const logoFileInputRef = useRef(null);

  // ================= Purchase Mode Availability (Super Admin Fixed Policy) =================
  const [onlineDeliveryAvailable, setOnlineDeliveryAvailable] = useState(false);
  const [selfPickupAvailable, setSelfPickupAvailable] = useState(true);

  // Dedicated Delivery Dashboard & Credentials (Online Delivery Only)
  const [deliveryUsername, setDeliveryUsername] = useState("");
  const [deliveryPassword, setDeliveryPassword] = useState("Delivery@123");
  const [deliveryStaffName, setDeliveryStaffName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [showDeliveryPassword, setShowDeliveryPassword] = useState(false);

  // Synchronize delivery credentials defaults with supermarket name
  useEffect(() => {
    if (supermarketName && !deliveryUsername) {
      const clean = supermarketName.toLowerCase().replace(/[^a-z0-9]/g, "");
      setDeliveryUsername(`${clean}_delivery`);
    }
    if (supermarketName && !deliveryStaffName) {
      setDeliveryStaffName(`${supermarketName} Delivery Fleet`);
    }
    if (mobileNumber && !deliveryPhone) {
      setDeliveryPhone(mobileNumber);
    }
  }, [supermarketName, mobileNumber]);

  // ================= Step 2: Admin Credentials =================
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showReviewPassword, setShowReviewPassword] = useState(false);
  const [sendCredentialsEmail, setSendCredentialsEmail] = useState(true);
  const [forcePasswordChange, setForcePasswordChange] = useState(true);

  // Calculate password strength
  const getPasswordStrength = (pwd) => {
    if (!pwd || pwd.length < 6) return { score: 1, label: "Weak", color: "#ef4444" };
    let score = 1;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score: 1, label: "Weak", color: "#ef4444" };
    if (score <= 4) return { score: 2, label: "Good", color: "#f59e0b" };
    return { score: 3, label: "Strong", color: "#16a34a" };
  };

  // ================= Step 3: Subscription Plan =================
  const [selectedPlanId, setSelectedPlanId] = useState("Premium");
  const [billingCycle, setBillingCycle] = useState("Monthly"); // Monthly or Yearly
  const [customAmount, setCustomAmount] = useState(19999);
  const [startDate, setStartDate] = useState(() => formatDate(new Date()));
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return formatDate(d);
  });
  const [trialPeriodDays, setTrialPeriodDays] = useState(0); // 0, 14, 30
  const [autoRenewal, setAutoRenewal] = useState(true);

  // Re-calculate price and expiry when plan, cycle, or trial changes
  useEffect(() => {
    const plan = SAAS_PLANS.find((p) => p.id === selectedPlanId) || SAAS_PLANS[2];
    const amount = billingCycle === "Yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    setCustomAmount(amount);

    const s = new Date(startDate || Date.now());
    const exp = new Date(s);
    if (billingCycle === "Yearly") {
      exp.setFullYear(exp.getFullYear() + 1);
    } else {
      exp.setMonth(exp.getMonth() + 1);
    }
    if (Number(trialPeriodDays) > 0) {
      exp.setDate(exp.getDate() + Number(trialPeriodDays));
    }
    setExpiryDate(formatDate(exp));
  }, [selectedPlanId, billingCycle, startDate, trialPeriodDays]);

  // ================= Step 4: Store Configuration =================
  const [storeType, setStoreType] = useState("Grocery & Supermarket");
  const [currency, setCurrency] = useState("INR");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(5);
  const [branchesCount, setBranchesCount] = useState(1);
  const [maxStaffUsers, setMaxStaffUsers] = useState(25);
  const [timeZone, setTimeZone] = useState("Asia/Kolkata");
  const [accountStatus, setAccountStatus] = useState("Active");

  // Keep staff users synchronized with plan limits
  useEffect(() => {
    if (selectedPlanId === "Basic") setMaxStaffUsers(3);
    else if (selectedPlanId === "Standard") setMaxStaffUsers(10);
    else if (selectedPlanId === "Premium") setMaxStaffUsers(25);
    else if (selectedPlanId === "Enterprise") setMaxStaffUsers(100);
  }, [selectedPlanId]);

  // ================= Step 6: Registration Success Data =================
  const [createdData, setCreatedData] = useState(null);

  const handleStoreNameChange = (val) => {
    setSupermarketName(val);
    setErrors((prev) => ({ ...prev, name: "" }));
  };

  const handleRegenerateStoreId = () => {
    const newId = generateStoreCode(supermarketName);
    setSupermarketId(newId);
    setErrors((prev) => ({ ...prev, code: "" }));
  };

  const handleRegeneratePassword = () => {
    const pwd = generateStrongPassword();
    setAdminPassword(pwd);
    setConfirmPassword(pwd);
    setErrors((prev) => ({ ...prev, adminPassword: "", confirmPassword: "" }));
  };

  // Helper: Extract actual image source if wrapped in Google Images search URLs
  const cleanAndExtractImageUrl = (raw) => {
    if (!raw) return "";
    let val = raw.trim();

    // Check for Google Images url containing imgurl=...
    if (val.includes("imgurl=")) {
      try {
        const match = val.match(/[?&]imgurl=([^&]+)/i);
        if (match && match[1]) {
          val = decodeURIComponent(match[1]);
        }
      } catch (_) {}
    } else if (val.includes("google.") && val.includes("url=")) {
      try {
        const match = val.match(/[?&]url=([^&]+)/i);
        if (match && match[1] && (match[1].startsWith("http%3A") || match[1].startsWith("https%3A") || match[1].startsWith("http"))) {
          val = decodeURIComponent(match[1]);
        }
      } catch (_) {}
    }

    return val;
  };

  const handleLogoUrlChange = (val) => {
    setLogoLoadError(false);
    setErrors((p) => ({ ...p, logo: "" }));
    if (!val) {
      setLogoUrl("");
    setLogoLoadError(false);
      return;
    }
    const resolved = cleanAndExtractImageUrl(val);
    setLogoUrl(resolved);
  };

  const handleLogoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors((p) => ({ ...p, logo: "Logo image must be smaller than 5MB." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        setLogoUrl(dataUrl);
        setLogoLoadError(false);
        setErrors((p) => ({ ...p, logo: "" }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClearLogo = () => {
    setLogoUrl("");
    setLogoLoadError(false);
    setLogoLoadError(false);
    setErrors((p) => ({ ...p, logo: "" }));
  };

  // Indian mobile phone number handling: strictly starting with 6, 7, 8, or 9
  const handleMobileChange = (e) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");

    if (!digits) {
      setMobileNumber("");
      setErrors((p) => ({ ...p, mobileNumber: "" }));
      return;
    }

    const firstDigit = digits[0];
    if (!["6", "7", "8", "9"].includes(firstDigit)) {
      setErrors((p) => ({
        ...p,
        mobileNumber: "Mobile number must start with 6, 7, 8, or 9 (TRAI standard). Digits starting with 0-5 are not valid mobile numbers.",
      }));
      if (digits.length === 1) {
        setMobileNumber("");
        return;
      }
      setMobileNumber(digits.slice(0, 10));
      return;
    }

    const clean10 = digits.slice(0, 10);
    setMobileNumber(clean10);

    if (clean10.length === 10) {
      setErrors((p) => ({ ...p, mobileNumber: "" }));
    } else {
      setErrors((p) => ({
        ...p,
        mobileNumber: `Must be exactly 10 digits (${clean10.length}/10 entered).`,
      }));
    }
  };

  // Quick Demo / Sample Data Filler (Super Admin convenience)
  const handleFillDemoStore = () => {
    const storeNames = [
      "GreenLeaf Organic Supermarket",
      "Apex Mega Mart",
      "FreshChoice Supermarket",
      "Royal Spices & Groceries",
      "DailyNeeds Hypermarket",
    ];
    const pickedName = storeNames[Math.floor(Math.random() * storeNames.length)];
    const code = generateStoreCode(pickedName);
    const slug = pickedName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);

    setSupermarketName(pickedName);
    setSupermarketId(code);
    setOwnerName("Vikram Malhotra");
    setContactPerson("Rajesh Sharma (General Manager)");
    setEmail(`support@${slug}.in`);
    setMobileNumber("9876543210");
    setAddress("Plot 42, 100ft Ring Road, Indiranagar");
    setCity("Bangalore");
    setState("Karnataka");
    setPincode("560038");
    setGstNumber("29AAAAA1234A1Z5");
    setLogoUrl("https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80");

    setAdminUsername(`${slug}_admin`);
    setAdminEmail(`admin@${slug}.in`);
    const pwd = generateStrongPassword();
    setAdminPassword(pwd);
    setConfirmPassword(pwd);
    setSelectedPlanId("Premium");
    setBillingCycle("Monthly");
    setOnlineAvailable(false);
    setOfflineAvailable(false);
    setStoreType("Grocery & Supermarket");
    setOnlineAvailable(true);
    setOfflineAvailable(true);
    setErrors({});
    setGeneralError("");
  };

  // ================= Validation Per Step =================
  const validateStep1 = () => {
    const newErr = {};
    if (!supermarketName.trim()) {
      newErr.name = "Supermarket name is required.";
    }
    if (!supermarketId.trim()) {
      newErr.code = "Unique Supermarket ID is required.";
    }
    if (!ownerName.trim()) {
      newErr.ownerName = "Owner / Legal Entity name is required.";
    }
    if (!contactPerson.trim()) {
      newErr.contactPerson = "Contact person name is required.";
    }

    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    if (!email.trim()) {
      newErr.email = "Email address is required.";
    } else if (/[A-Z]/.test(email)) {
      newErr.email = "Uppercase letters are not allowed in email addresses. Use lowercase characters only.";
    } else if (!emailRegex.test(email.trim().toLowerCase())) {
      newErr.email = "Please enter a valid lowercase email address (e.g. store@example.com).";
    }

    const cleanMobile = mobileNumber.replace(/\D/g, "");
    if (!cleanMobile) {
      newErr.mobileNumber = "Mobile phone number is required.";
    } else if (!["6", "7", "8", "9"].includes(cleanMobile[0])) {
      newErr.mobileNumber = "Mobile number must start with 6, 7, 8, or 9.";
    } else if (cleanMobile.length !== 10) {
      newErr.mobileNumber = `Mobile number must be exactly 10 digits (${cleanMobile.length}/10 entered).`;
    }

    if (!address.trim()) {
      newErr.address = "Street address is required.";
    }
    if (!city.trim()) {
      newErr.city = "City is required.";
    }
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      newErr.pincode = "Enter a valid 6-digit postal pincode.";
    }
    if (gstNumber.trim() && !/^[0-9A-Z]{15}$/i.test(gstNumber.trim())) {
      newErr.gstNumber = "GST Number must be 15 alphanumeric characters.";
    }

    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const validateStep2 = () => {
    const newErr = {};
    if (!adminUsername.trim() || adminUsername.trim().length < 3) {
      newErr.adminUsername = "Admin username must be at least 3 characters.";
    }

    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    const targetEmail = (adminEmail.trim() || email.trim()).toLowerCase();
    if (!targetEmail) {
      newErr.adminEmail = "Admin email address is required.";
    } else if (/[A-Z]/.test(adminEmail)) {
      newErr.adminEmail = "Uppercase letters are not allowed in email addresses. Use lowercase only.";
    } else if (!emailRegex.test(targetEmail)) {
      newErr.adminEmail = "Please enter a valid lowercase admin email address.";
    }

    if (!adminPassword || adminPassword.length < 6) {
      newErr.adminPassword = "Temporary password must be at least 6 characters long.";
    }
    if (adminPassword !== confirmPassword) {
      newErr.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const validateStep3 = () => {
    const newErr = {};
    if (!selectedPlanId) {
      newErr.plan = "Please select a subscription plan.";
    }
    if (!startDate) {
      newErr.startDate = "Start date is required.";
    }
    if (!expiryDate) {
      newErr.expiryDate = "Expiry date is required.";
    }
    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const validateStep4 = () => {
    const newErr = {};
    if (!storeType) {
      newErr.storeType = "Please select a store type.";
    }
    if (Number(branchesCount) < 1) {
      newErr.branchesCount = "Branches must be at least 1.";
    }
    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const handleNextStep = () => {
    setGeneralError("");
    let isValid = false;
    if (currentStep === 1) {
      isValid = validateStep1();
      if (isValid && !adminEmail && email.trim()) {
        setAdminEmail(email.trim());
      }
    }
    else if (currentStep === 2) isValid = validateStep2();
    else if (currentStep === 3) isValid = validateStep3();
    else if (currentStep === 4) isValid = validateStep4();

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
      window.scrollTo({ top: 80, behavior: "smooth" });
    }
  };

  const handlePrevStep = () => {
    setGeneralError("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 80, behavior: "smooth" });
  };

  // Jump to specific step from Review Screen or Stepper (with validation protection)
  const handleJumpToStep = (stepNumber) => {
    if (stepNumber === currentStep) return;
    if (stepNumber < currentStep) {
      setCurrentStep(stepNumber);
      window.scrollTo({ top: 80, behavior: "smooth" });
      return;
    }
    // Forward jump validation
    if (stepNumber >= 2 && !validateStep1()) return;
    if (stepNumber >= 2 && !adminEmail && email.trim()) {
      setAdminEmail(email.trim());
    }
    if (stepNumber >= 3 && !validateStep2()) return;
    if (stepNumber >= 4 && !validateStep3()) return;
    if (stepNumber >= 5 && !validateStep4()) return;

    setCurrentStep(stepNumber);
    window.scrollTo({ top: 80, behavior: "smooth" });
  };

  // ================= Final Submission (Create Supermarket) =================
  const handleFinalCreateSupermarket = async () => {
    setGeneralError("");
    setSubmitting(true);

    try {
      const selectedPlanObj = SAAS_PLANS.find((p) => p.id === selectedPlanId) || SAAS_PLANS[2];
      const cleanPhone10 = mobileNumber.replace(/\D/g, "").slice(-10);

      const payload = {
        name: supermarketName.trim(),
        code: supermarketId.trim().toUpperCase(),
        ownerName: ownerName.trim(),
        contactPerson: contactPerson.trim(),
        email: email.trim().toLowerCase(),
        phone: cleanPhone10,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        logoUrl: logoUrl.trim(),

        // Admin Credentials
        adminUsername: adminUsername.trim().toLowerCase(),
        adminPassword: adminPassword,
        adminEmail: (adminEmail || email).trim().toLowerCase(),
        adminName: `${supermarketName.trim()} Admin`,
        sendCredentialsEmail: Boolean(sendCredentialsEmail),
        forcePasswordChange: Boolean(forcePasswordChange),

        // Subscription Plan
        plan: selectedPlanId,
        billingCycle: billingCycle,
        subscriptionAmount: Number(customAmount),
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        trialPeriodDays: Number(trialPeriodDays) || 0,
        autoRenewal: Boolean(autoRenewal),
        planFeatures: selectedPlanObj.features,

        // Configuration
        storeType: storeType,
        currency: currency,
        taxSettings: {
          enabled: Boolean(taxEnabled),
          rate: Number(taxRate),
          gstNumber: gstNumber.trim().toUpperCase(),
        },
        branchesCount: Number(branchesCount) || 1,
        maxStaffUsers: Number(maxStaffUsers) || 15,
        timeZone: timeZone,
        status: accountStatus,
        themeColor: "#16a34a",
        onlineDeliveryAvailable: Boolean(onlineDeliveryAvailable),
        selfPickupAvailable: Boolean(selfPickupAvailable),
        onlineAvailable: Boolean(onlineDeliveryAvailable || selfPickupAvailable),
        offlineAvailable: Boolean(selfPickupAvailable),
        deliveryCredentials: onlineDeliveryAvailable ? {
          username: (deliveryUsername || `${supermarketName.toLowerCase().replace(/[^a-z0-9]/g, "")}_delivery`).trim().toLowerCase(),
          password: deliveryPassword || "Delivery@123",
          staffName: (deliveryStaffName || `${supermarketName} Delivery Fleet`).trim(),
          phone: deliveryPhone || mobileNumber,
          active: true,
        } : null,
        deliveryUsername: onlineDeliveryAvailable ? (deliveryUsername || `${supermarketName.toLowerCase().replace(/[^a-z0-9]/g, "")}_delivery`).trim().toLowerCase() : "",
        deliveryPassword: onlineDeliveryAvailable ? (deliveryPassword || "Delivery@123") : "",
        deliveryStaffName: onlineDeliveryAvailable ? (deliveryStaffName || `${supermarketName} Delivery Fleet`).trim() : "",
        deliveryPhone: onlineDeliveryAvailable ? (deliveryPhone || mobileNumber) : "",
      };

      const res = await API.post("/super-admin/supermarkets", payload);

      if (res.data?.success) {
        const created = res.data.supermarket || payload;
        const creds = res.data.credentials || {
          supermarketId: created.code,
          supermarketName: created.name,
          adminUsername: payload.adminUsername,
          adminPassword: payload.adminPassword,
          adminEmail: payload.adminEmail,
          loginUrl: "/login",
        };

        setCreatedData({
          ...created,
          credentials: creds,
        });

        // Trigger global supermarkets reload in background so Manage & Registered tabs update immediately
        if (loadSupermarkets) await loadSupermarkets();

        // Advance to Success screen (Step 6)
        setCurrentStep(6);
        window.scrollTo({ top: 60, behavior: "smooth" });
      } else {
        setGeneralError(res.data?.message || "Failed to register supermarket.");
      }
    } catch (err) {
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (typeof err.response?.data === "string" ? err.response.data : "") ||
        err.message ||
        "Server error while registering supermarket. Please check connection.";
      setGeneralError(serverMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: Copy text to clipboard
  const handleCopyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2000);
    } catch (_) {
      // Fallback
    }
  };

  // Helper: Download printable / colorful credentials pass (HTML with rich colors & print-to-PDF support)
  const handleDownloadCredentialsSlip = () => {
    if (!createdData) return;
    const creds = createdData.credentials || {};

    const rawPhone = String(createdData.phone || mobileNumber || "").trim();
    const phoneDigits10 = rawPhone.replace(/\D/g, "").slice(-10);
    const cleanMobileNumber = phoneDigits10 ? `+91 ${phoneDigits10}` : "+91 N/A";

    const storeName = createdData.name || supermarketName;
    const tenantId = creds.supermarketId || createdData.code || supermarketId;
    const owner = createdData.ownerName || ownerName || "N/A";
    const storeEmail = createdData.email || email || "N/A";
    const username = creds.adminUsername || adminUsername;
    const password = creds.adminPassword || adminPassword;
    const planName = createdData.plan || selectedPlanId;
    const feeFormatted = Number(customAmount).toLocaleString("en-IN");
    const loginLink = `${window.location.origin}/login`;
    const generatedTime = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    const storeLocation =
      [createdData.address || address, createdData.city || city, createdData.state || state, createdData.pincode || pincode]
        .filter(Boolean)
        .join(", ") || "Bangalore, Karnataka";

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GrocerEase Onboarding Pass - ${tenantId}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      padding: 32px 16px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .print-bar {
      max-width: 760px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
    }
    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #16a34a;
      color: #ffffff;
      border: none;
      padding: 9px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13.5px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
      transition: all 0.2s;
    }
    .print-btn:hover { background: #15803d; transform: translateY(-1px); }
    .pass-container {
      max-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      border: 1.5px solid #cbd5e1;
      box-shadow: 0 20px 40px -15px rgba(6, 61, 46, 0.18);
    }
    .pass-header {
      background: linear-gradient(135deg, #063d2e 0%, #0d523e 50%, #16a34a 100%);
      color: #ffffff;
      padding: 28px 32px;
      position: relative;
    }
    .pass-header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-title span.eco { color: #4ade80; }
    .badge-pill {
      background: rgba(255, 255, 255, 0.16);
      border: 1px solid rgba(255, 255, 255, 0.35);
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #dcfce7;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pass-title {
      font-size: 13px;
      font-weight: 700;
      color: #a7f3d0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 4px;
    }
    .pass-body {
      padding: 28px 32px;
    }
    .section-card {
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 18px;
      position: relative;
    }
    .section-card.identity {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
    }
    .section-card.credentials {
      background: #f5f3ff;
      border: 1.5px solid #c4b5fd;
    }
    .section-card.subscription {
      background: #fffbeb;
      border: 1.5px solid #fde68a;
    }
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px dashed rgba(0,0,0,0.1);
    }
    .section-title {
      font-size: 12.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .identity .section-title { color: #166534; }
    .credentials .section-title { color: #5b21b6; }
    .subscription .section-title { color: #92400e; }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
    }
    .grid-full { grid-column: span 2; }
    .field-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .field-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .field-value {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .field-value.highlight-green {
      color: #15803d;
      font-size: 16px;
      font-weight: 800;
    }
    .mono-pill {
      font-family: 'JetBrains Mono', monospace;
      background: #ffffff;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      display: inline-block;
      width: fit-content;
      color: #1e1b4b;
      letter-spacing: 0.02em;
    }
    .mono-pill.pwd {
      background: #fdf2f8;
      border-color: #f472b6;
      color: #9d174d;
    }
    .security-notice {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px 20px;
      font-size: 12.5px;
      color: #1e40af;
      line-height: 1.55;
      margin-top: 22px;
    }
    .security-notice strong { color: #1e3a8a; }
    .pass-footer {
      border-top: 1px solid #e2e8f0;
      padding: 18px 32px;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748b;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .print-bar { display: none !important; }
      .pass-container {
        border: 1px solid #cbd5e1;
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div style="font-size: 13px; font-weight: 600; color: #475569;">
      GrocerEase Supermarket Security Credentials Pass
    </div>
    <button type="button" class="print-btn" onclick="window.print()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      <span>Print / Save as PDF</span>
    </button>
  </div>

  <div class="pass-container">
    <div class="pass-header">
      <div class="pass-header-top">
        <div class="brand-title">
          <span>Grocer<span class="eco">Ease</span></span>
        </div>
        <div class="badge-pill">
          <span>Verified Multi-Tenant Pass</span>
        </div>
      </div>
      <div class="pass-title">Supermarket Onboarding & Tenant Credentials Pass</div>
    </div>

    <div class="pass-body">
      <!-- 1. Supermarket Identity -->
      <div class="section-card identity">
        <div class="section-header">
          <div class="section-title">1. Supermarket Identity & Contact</div>
          <span style="font-size: 11px; font-weight: 800; color: #166534; background: #dcfce7; padding: 3px 10px; border-radius: 9999px;">Active Store</span>
        </div>
        <div class="grid-2">
          <div class="field-item">
            <span class="field-label">Supermarket Name</span>
            <span class="field-value highlight-green">${storeName}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Unique Tenant ID</span>
            <div class="mono-pill" style="color: #065f46; border-color: #86efac; background: #ecfdf5;">${tenantId}</div>
          </div>
          <div class="field-item">
            <span class="field-label">Owner / Legal Entity</span>
            <span class="field-value">${owner}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Contact Mobile</span>
            <span class="field-value" style="color: #0f172a; font-family: 'JetBrains Mono', monospace;">${cleanMobileNumber}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Official Email</span>
            <span class="field-value">${storeEmail}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Store Location</span>
            <span class="field-value">${storeLocation}</span>
          </div>
        </div>
      </div>

      <!-- 2. Administrator Credentials -->
      <div class="section-card credentials">
        <div class="section-header">
          <div class="section-title">2. Administrator Login Credentials</div>
          <span style="font-size: 11px; font-weight: 800; color: #5b21b6; background: #ede9fe; padding: 3px 10px; border-radius: 9999px;">Confidential</span>
        </div>
        <div class="grid-2">
          <div class="field-item">
            <span class="field-label">Admin Username</span>
            <div class="mono-pill">${username}</div>
          </div>
          <div class="field-item">
            <span class="field-label">Temporary Password</span>
            <div class="mono-pill pwd">${password}</div>
          </div>
          <div class="field-item grid-full">
            <span class="field-label">Portal Login URL</span>
            <a href="${loginLink}" target="_blank" style="font-size: 13.5px; font-weight: 700; color: #4338ca; text-decoration: underline;">${loginLink}</a>
          </div>
          <div class="field-item">
            <span class="field-label">Force Password Reset</span>
            <span class="field-value" style="color: #7c2d12;">${forcePasswordChange ? "Yes (Required on first login)" : "No"}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Role & Privileges</span>
            <span class="field-value">Store Admin (Full POS, Turnstile & Inventory Access)</span>
          </div>
        </div>
      </div>

      <!-- 3. Tenant Subscription -->
      <div class="section-card subscription">
        <div class="section-header">
          <div class="section-title">3. Tenant Subscription & Entitlements</div>
          <span style="font-size: 11px; font-weight: 800; color: #92400e; background: #fef3c7; padding: 3px 10px; border-radius: 9999px;">${planName} Plan</span>
        </div>
        <div class="grid-2">
          <div class="field-item">
            <span class="field-label">Subscription Tier</span>
            <span class="field-value">${planName} (${billingCycle})</span>
          </div>
          <div class="field-item">
            <span class="field-label">Billing Amount</span>
            <span class="field-value" style="color: #15803d; font-size: 15px;">₹${feeFormatted}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Subscription Start</span>
            <span class="field-value">${startDate}</span>
          </div>
          <div class="field-item">
            <span class="field-label">Subscription Expiry</span>
            <span class="field-value">${expiryDate}</span>
          </div>
          <div class="field-item grid-full">
            <span class="field-label">Multi-Tenant Data Isolation</span>
            <span class="field-value" style="color: #0369a1;">Strictly Isolated Multi-Tenant Container (Dedicated Tenant ID & POS Room)</span>
          </div>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="security-notice">
        <strong>IMPORTANT SECURITY NOTICE:</strong> Please deliver these credentials securely to the supermarket store manager. For security compliance, the administrator will be prompted to change their temporary password upon their first login.
      </div>
    </div>

    <div class="pass-footer">
      <span>Generated on ${generatedTime}</span>
      <span>GrocerEase SaaS Platform &bull; All Rights Reserved</span>
    </div>
  </div>
</body>
</html>`;

    // 1. Download as colored HTML document
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `GrocerEase-Onboarding-Pass-${tenantId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2. Also open in new browser tab so user can immediately view/print in color
    try {
      window.open(url, "_blank");
    } catch (_) {}

    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Helper: Switch context and launch newly created store admin portal
  const handleLaunchStoreAdmin = () => {
    if (createdData && switchSupermarket) {
      switchSupermarket(createdData);
      navigate("/admin");
    } else {
      navigate("/login");
    }
  };

  // Helper: Reset form to register another supermarket
  const handleRegisterAnother = () => {
    setSupermarketName("");
    setSupermarketId(generateStoreCode());
    setOwnerName("");
    setContactPerson("");
    setEmail("");
    setMobileNumber("");
    setAddress("");
    setCity("Bangalore");
    setState("Karnataka");
    setPincode("560001");
    setGstNumber("");
    setLogoUrl("");
    setLogoLoadError(false);
    setAdminUsername("");
    setAdminEmail("");
    const newPwd = generateStrongPassword();
    setAdminPassword(newPwd);
    setConfirmPassword(newPwd);
    setSelectedPlanId("Premium");
    setBillingCycle("Monthly");
    setOnlineAvailable(false);
    setOfflineAvailable(false);
    setCreatedData(null);
    setErrors({});
    setGeneralError("");
    setCurrentStep(1);
    window.scrollTo({ top: 60, behavior: "smooth" });
  };

  const pwdStrength = getPasswordStrength(adminPassword);

  const stepTitles = [
    "Supermarket Details",
    "Admin Credentials",
    "Subscription Plan",
    "Store Configuration",
    "Review & Create",
  ];

  return (
    <div className="asm-page-container">
      {/* 1. Page Header Bar */}
      <header className="asm-page-header">
        <div className="asm-header-left">
          <Link to="/super-admin/supermarkets" className="asm-back-btn" title="Back to Supermarkets">
            <ArrowLeft size={18} />
          </Link>
          <div className="asm-header-titles">
            <div className="asm-title-row">
              <h1>Add New Supermarket</h1>
              <span className="asm-live-pill">
                <span className="asm-pulse-dot" />
                Live Setup
              </span>
            </div>
            <p>Onboard and configure a new supermarket store with isolated tenant scoping in 5 easy steps</p>
          </div>
        </div>

        <div className="asm-header-actions">
          <div className="asm-header-badges">
            <span className="asm-badge-tenant" title="Full data isolation guaranteed">
              <ShieldCheck size={14} />
              <span>Isolated Data Scoping</span>
            </span>
          </div>
        </div>
      </header>

      {/* General Error Banner */}
      {generalError && (
        <div className="asm-form-alert error">
          <AlertCircle size={18} />
          <span>{generalError}</span>
        </div>
      )}

      {/* 2. Interactive Progress Stepper (Visible for Steps 1 through 5) */}
      {currentStep <= 5 && (
        <div className="asm-stepper-card">
          <div className="asm-stepper-meta">
            <span className="asm-step-current-tag">
              Step {currentStep} of 5: <strong>{stepTitles[currentStep - 1]}</strong>
            </span>
            <span className="asm-step-pct">
              {Math.round((currentStep / 5) * 100)}% Completed
            </span>
          </div>

          <div className="asm-progress-track">
            <div
              className="asm-progress-fill"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>

          <div className="asm-stepper-track">
            {/* Step 1 */}
            <button
              type="button"
              className={`asm-step-item ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}
              onClick={() => handleJumpToStep(1)}
            >
              <div className="asm-step-circle">
                {currentStep > 1 ? <Check size={17} strokeWidth={3} /> : <Store size={18} />}
              </div>
              <span className="asm-step-label">1. Store Info</span>
            </button>

            <div className={`asm-step-connector ${currentStep > 1 ? "filled" : ""}`} />

            {/* Step 2 */}
            <button
              type="button"
              className={`asm-step-item ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}
              onClick={() => handleJumpToStep(2)}
            >
              <div className="asm-step-circle">
                {currentStep > 2 ? <Check size={17} strokeWidth={3} /> : <KeyRound size={18} />}
              </div>
              <span className="asm-step-label">2. Admin Login</span>
            </button>

            <div className={`asm-step-connector ${currentStep > 2 ? "filled" : ""}`} />

            {/* Step 3 */}
            <button
              type="button"
              className={`asm-step-item ${currentStep === 3 ? "active" : currentStep > 3 ? "completed" : ""}`}
              onClick={() => handleJumpToStep(3)}
            >
              <div className="asm-step-circle">
                {currentStep > 3 ? <Check size={17} strokeWidth={3} /> : <Crown size={18} />}
              </div>
              <span className="asm-step-label">3. Subscription</span>
            </button>

            <div className={`asm-step-connector ${currentStep > 3 ? "filled" : ""}`} />

            {/* Step 4 */}
            <button
              type="button"
              className={`asm-step-item ${currentStep === 4 ? "active" : currentStep > 4 ? "completed" : ""}`}
              onClick={() => handleJumpToStep(4)}
            >
              <div className="asm-step-circle">
                {currentStep > 4 ? <Check size={17} strokeWidth={3} /> : <Sliders size={18} />}
              </div>
              <span className="asm-step-label">4. Configuration</span>
            </button>

            <div className={`asm-step-connector ${currentStep > 4 ? "filled" : ""}`} />

            {/* Step 5 */}
            <button
              type="button"
              className={`asm-step-item ${currentStep === 5 ? "active" : ""}`}
              onClick={() => handleJumpToStep(5)}
            >
              <div className="asm-step-circle">
                <CheckCircle2 size={18} />
              </div>
              <span className="asm-step-label">5. Review &amp; Create</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 1: Supermarket Information ================= */}
      {currentStep === 1 && (
        <div className="asm-form-main-card">
          <div className="asm-step-header">
            <div className="asm-step-header-left">
              <h2>
                <Store size={22} className="asm-header-icon" />
                <span>Supermarket Information</span>
              </h2>
              <p>Enter the store's primary details, identification code, and physical location coordinates</p>
            </div>
            <span className="asm-step-counter-tag">Step 1 of 5</span>
          </div>

          {/* Section A: Basic Store Identity */}
          <div className="asm-form-section">
            <div className="asm-section-title">
              <Building2 size={16} />
              <span>Basic Store Identity</span>
            </div>

            <div className="asm-grid-2">
              {/* Field: Supermarket Name */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Supermarket Name <span className="asm-req">*</span></span>
                  <span className="asm-hint">Public store name</span>
                </label>
                <div className={`asm-input-box ${errors.name ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <Store size={18} />
                  </div>
                  <input
                    type="text"
                    className="asm-input"
                    placeholder=""
                    value={supermarketName}
                    onChange={(e) => handleStoreNameChange(e.target.value)}
                    autoFocus
                  />
                </div>
                {errors.name && <span className="asm-error-text">{errors.name}</span>}
              </div>

              {/* Field: Automatically Generated Unique Supermarket ID */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Unique Supermarket ID <span className="asm-req">*</span></span>
                  <span className="asm-hint">Tenant Identifier</span>
                </label>
                <div className={`asm-input-box ${errors.code ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <Building2 size={18} />
                  </div>
                  <input
                    type="text"
                    className="asm-input"
                    placeholder=""
                    value={supermarketId}
                    onChange={(e) => {
                      setSupermarketId(e.target.value.toUpperCase());
                      setErrors((p) => ({ ...p, code: "" }));
                    }}
                  />
                  <button
                    type="button"
                    className="asm-btn-inline"
                    onClick={handleRegenerateStoreId}
                    title="Generate a new random Supermarket ID"
                  >
                    <RefreshCw size={13} />
                    <span>Regenerate</span>
                  </button>
                </div>
                {errors.code && <span className="asm-error-text">{errors.code}</span>}
              </div>

              {/* Field: Store Logo with Live Preview Thumbnail & File Upload */}
              <div className="asm-form-group asm-grid-full">
                <label className="asm-label">
                  <span>Store Logo <span className="asm-hint-inline">(Optional)</span></span>
                  <span className="asm-hint">Shown on POS billing receipts &amp; store portal</span>
                </label>

                {/* Hidden File Picker Input */}
                <input
                  type="file"
                  ref={logoFileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: "none" }}
                  onChange={handleLogoFileUpload}
                />

                <div className="asm-logo-input-row">
                  {/* Live Preview Box */}
                  <div
                    className={`asm-logo-preview ${logoUrl && !logoLoadError ? "has-img" : ""} ${logoLoadError ? "has-error" : ""}`}
                    title={logoUrl ? (logoLoadError ? "Failed to load image from URL" : "Store Logo Preview") : "No logo uploaded"}
                  >
                    {logoUrl && !logoLoadError ? (
                      <img
                        src={logoUrl}
                        alt="Store Logo Preview"
                        onLoad={() => setLogoLoadError(false)}
                        onError={() => setLogoLoadError(true)}
                      />
                    ) : logoLoadError ? (
                      <AlertCircle size={20} className="asm-logo-error-icon" title="Could not load image" />
                    ) : (
                      <Store size={22} className="asm-logo-placeholder-icon" />
                    )}
                  </div>

                  {/* URL / Paste Input Box with integrated Upload and Clear buttons */}
                  <div className="asm-input-box asm-logo-input-box" style={{ flex: 1 }}>
                    <div className="asm-badge-icon">
                      <ImageIcon size={18} />
                    </div>
                    <input
                      type="text"
                      className="asm-input"
                      placeholder="Paste image URL (Google Images or direct link) or upload file"
                      value={logoUrl.startsWith("data:") ? "[Local file uploaded successfully]" : logoUrl}
                      onChange={(e) => {
                        if (!logoUrl.startsWith("data:")) {
                          handleLogoUrlChange(e.target.value);
                        }
                      }}
                    />

                    {logoUrl && (
                      <button
                        type="button"
                        className="asm-btn-inline clear"
                        onClick={handleClearLogo}
                        title="Remove current logo"
                      >
                        <X size={13} />
                        <span>Clear</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="asm-btn-inline upload"
                      onClick={() => logoFileInputRef.current?.click()}
                      title="Upload image file from computer (PNG, JPG, SVG, WebP)"
                    >
                      <Upload size={13} />
                      <span>Browse File</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Status Microcopy */}
                {logoLoadError && (
                  <div className="asm-logo-feedback error">
                    <AlertCircle size={13} />
                    <span>
                      Could not load image directly from this URL (the domain may restrict hotlinking). Please click <strong>Browse File</strong> to upload the logo image directly.
                    </span>
                  </div>
                )}
                {logoUrl && !logoLoadError && (
                  <div className="asm-logo-feedback success">
                    <Check size={13} />
                    <span>
                      Logo loaded successfully! Will appear on customer POS billing receipts, exit passes, and store portal.
                    </span>
                  </div>
                )}
                {!logoUrl && (
                  <span className="asm-field-help">
                    Paste any direct image link, Google Images search result URL, or click "Browse File" to upload from your PC.
                  </span>
                )}
                {/* Quick Preset Logos */}
                <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>Or quick preset:</span>
                  {[
                    { label: "Fresh Market", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80" },
                    { label: "Organic Mart", url: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80" },
                    { label: "Smart Retail", url: "https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=200&auto=format&fit=crop&q=80" },
                    { label: "Daily Needs", url: "https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=200&auto=format&fit=crop&q=80" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleLogoUrlChange(preset.url)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: logoUrl === preset.url ? "1.5px solid #16a34a" : "1px solid #cbd5e1",
                        background: logoUrl === preset.url ? "#f0fdf4" : "#ffffff",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <img src={preset.url} alt={preset.label} style={{ width: "16px", height: "16px", borderRadius: "3px", objectFit: "cover" }} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
                {errors.logo && <span className="asm-error-text">{errors.logo}</span>}
              </div>
            </div>
          </div>

          {/* Section B: Owner & Manager Contact */}
          <div className="asm-form-section">
            <div className="asm-section-title">
              <Users size={16} />
              <span>Owner &amp; Manager Contact</span>
            </div>

            <div className="asm-grid-2">
              {/* Field: Owner Name */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Owner / Legal Entity Name <span className="asm-req">*</span></span>
                </label>
                <div className={`asm-input-box ${errors.ownerName ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    className="asm-input"
                    placeholder=""
                    value={ownerName}
                    onChange={(e) => {
                      setOwnerName(e.target.value);
                      setErrors((p) => ({ ...p, ownerName: "" }));
                    }}
                  />
                </div>
                {errors.ownerName && <span className="asm-error-text">{errors.ownerName}</span>}
              </div>

              {/* Field: Contact Person */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Contact Person / Store Manager <span className="asm-req">*</span></span>
                </label>
                <div className={`asm-input-box ${errors.contactPerson ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <Users size={18} />
                  </div>
                  <input
                    type="text"
                    className="asm-input"
                    placeholder=""
                    value={contactPerson}
                    onChange={(e) => {
                      setContactPerson(e.target.value);
                      setErrors((p) => ({ ...p, contactPerson: "" }));
                    }}
                  />
                </div>
                {errors.contactPerson && <span className="asm-error-text">{errors.contactPerson}</span>}
              </div>

              {/* Field: Email Address */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Official Email Address <span className="asm-req">*</span></span>
                  <span className="asm-hint">Billing &amp; updates</span>
                </label>
                <div className={`asm-input-box ${errors.email ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    className="asm-input"
                    placeholder="e.g. store@grocerease.store (lowercase only)"
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
                      setEmail(val);
                      setErrors((p) => ({ ...p, email: "" }));
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = (e.clipboardData || window.clipboardData).getData("text") || "";
                      const val = pasted.toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
                      setEmail(val);
                      setErrors((p) => ({ ...p, email: "" }));
                    }}
                  />
                </div>
                {errors.email && <span className="asm-error-text">{errors.email}</span>}
              </div>

              {/* Field: Mobile Number with +91 Country Badge */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Mobile Phone Number <span className="asm-req">*</span></span>
                  <span
                    className={`asm-hint ${
                      mobileNumber.length === 10 && /^[6-9]/.test(mobileNumber)
                        ? "success"
                        : errors.mobileNumber
                        ? "error"
                        : ""
                    }`}
                  >
                    {mobileNumber.length === 10 && /^[6-9]/.test(mobileNumber)
                      ? "✓ Valid 10 Digits"
                      : mobileNumber.length > 0
                      ? `${mobileNumber.length}/10 Digits`
                      : "Starts with 6, 7, 8, or 9"}
                  </span>
                </label>
                <div
                  className={`asm-input-box ${
                    errors.mobileNumber
                      ? "error"
                      : mobileNumber.length === 10 && /^[6-9]/.test(mobileNumber)
                      ? "valid"
                      : ""
                  }`}
                >
                  <div className="asm-phone-prefix">
                    <span>🇮🇳 +91</span>
                  </div>
                  <input
                    type="tel"
                    className="asm-input"
                    placeholder=""
                    maxLength={10}
                    value={mobileNumber}
                    onChange={handleMobileChange}
                  />
                  {mobileNumber.length === 10 && /^[6-9]/.test(mobileNumber) && (
                    <span className="asm-input-valid-icon" title="Valid 10-digit Indian mobile number">
                      <Check size={16} />
                    </span>
                  )}
                </div>
                {errors.mobileNumber ? (
                  <span className="asm-error-text">{errors.mobileNumber}</span>
                ) : (
                  <span className="asm-field-help">Prefix must start with 6, 7, 8, or 9</span>
                )}
              </div>
            </div>
          </div>

          {/* Section C: Store Location & Tax Details */}
          <div className="asm-form-section">
            <div className="asm-section-title">
              <MapPin size={16} />
              <span>Physical Store Location &amp; Tax</span>
            </div>

            <div className="asm-grid-2">
              {/* Field: Street Address (Full Width) */}
              <div className="asm-form-group asm-grid-full">
                <label className="asm-label">
                  <span>Street Address <span className="asm-req">*</span></span>
                </label>
                <div className={`asm-input-box ${errors.address ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <MapPin size={18} />
                  </div>
                  <input
                    type="text"
                    className="asm-input"
                    placeholder=""
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setErrors((p) => ({ ...p, address: "" }));
                    }}
                  />
                </div>
                {errors.address && <span className="asm-error-text">{errors.address}</span>}
              </div>

              {/* City, State, Pincode Triplet */}
              <div className="asm-grid-full asm-grid-3">
                {/* City */}
                <div className="asm-form-group">
                  <label className="asm-label">
                    <span>City <span className="asm-req">*</span></span>
                  </label>
                  <div className={`asm-input-box ${errors.city ? "error" : ""}`}>
                    <input
                      type="text"
                      className="asm-input"
                      placeholder=""
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setErrors((p) => ({ ...p, city: "" }));
                      }}
                    />
                  </div>
                  {errors.city && <span className="asm-error-text">{errors.city}</span>}
                </div>

                {/* State */}
                <div className="asm-form-group">
                  <label className="asm-label">
                    <span>State <span className="asm-req">*</span></span>
                  </label>
                  <div className="asm-input-box">
                    <select
                      className="asm-select"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    >
                      <option value="">Select State</option>
                      <option value="Karnataka">Karnataka</option>
                      <option value="Tamil Nadu">Tamil Nadu</option>
                      <option value="Maharashtra">Maharashtra</option>
                      <option value="Delhi">Delhi NCR</option>
                      <option value="Telangana">Telangana</option>
                      <option value="Kerala">Kerala</option>
                      <option value="Gujarat">Gujarat</option>
                      <option value="Andhra Pradesh">Andhra Pradesh</option>
                      <option value="Rajasthan">Rajasthan</option>
                      <option value="West Bengal">West Bengal</option>
                    </select>
                    <Sliders size={14} className="asm-select-arrow" />
                  </div>
                </div>

                {/* Pincode */}
                <div className="asm-form-group">
                  <label className="asm-label">
                    <span>Pincode <span className="asm-req">*</span></span>
                    <span className="asm-hint">6 digits</span>
                  </label>
                  <div className={`asm-input-box ${errors.pincode ? "error" : ""}`}>
                    <input
                      type="text"
                      className="asm-input"
                      placeholder=""
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => {
                        setPincode(e.target.value.replace(/\D/g, ""));
                        setErrors((p) => ({ ...p, pincode: "" }));
                      }}
                    />
                  </div>
                  {errors.pincode && <span className="asm-error-text">{errors.pincode}</span>}
                </div>
              </div>

              {/* GST Number (Optional) */}
              <div className="asm-form-group asm-grid-full">
                <label className="asm-label">
                  <span>GST Number (Optional)</span>
                  <span className="asm-hint">15 alphanumeric characters (Optional for unregistered stores)</span>
                </label>
                <div className={`asm-input-box ${errors.gstNumber ? "error" : ""}`}>
                  <input
                    type="text"
                    className="asm-input"
                    placeholder=""
                    maxLength={15}
                    value={gstNumber}
                    onChange={(e) => {
                      setGstNumber(e.target.value.toUpperCase());
                      setErrors((p) => ({ ...p, gstNumber: "" }));
                    }}
                  />
                </div>
                {errors.gstNumber && <span className="asm-error-text">{errors.gstNumber}</span>}
              </div>
            </div>
          </div>

          {/* Section D: Store Availability & Purchase Mode Configuration (Online Delivery & Self Pickup) */}
          <div className="asm-form-section asm-availability-section">
            <div className="asm-section-title">
              <Sliders size={16} />
              <span>Purchase Availability Configuration (Super Admin Policy)</span>
            </div>
            <p className="asm-section-desc" style={{ fontSize: "13px", color: "#64748b", margin: "-6px 0 16px 0" }}>
              Configure purchase availability options for this supermarket. You can independently enable or disable <strong>Online Delivery</strong> and <strong>Self Pickup</strong>. Only options enabled here will be available to customers.
            </p>

            <div className="asm-availability-button-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* Option 1: Online Delivery */}
              <button
                type="button"
                className={`asm-avail-toggle-btn ${onlineDeliveryAvailable ? "active-enabled" : "inactive-disabled"}`}
                onClick={() => setOnlineDeliveryAvailable((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 18px",
                  borderRadius: "14px",
                  border: onlineDeliveryAvailable ? "2px solid #16a34a" : "2px solid #cbd5e1",
                  background: onlineDeliveryAvailable ? "#f0fdf4" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                  boxShadow: onlineDeliveryAvailable ? "0 4px 12px rgba(22, 163, 74, 0.12)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: onlineDeliveryAvailable ? "#16a34a" : "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: onlineDeliveryAvailable ? "#ffffff" : "#64748b",
                    }}
                  >
                    <Truck size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: onlineDeliveryAvailable ? "#166534" : "#1e293b" }}>
                      Online Delivery
                    </div>
                    <div style={{ fontSize: "12px", color: onlineDeliveryAvailable ? "#15803d" : "#64748b", marginTop: "2px" }}>
                      Doorstep delivery • Dedicated Delivery Dashboard
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: "9999px",
                    fontSize: "12px",
                    fontWeight: 700,
                    background: onlineDeliveryAvailable ? "#dcfce7" : "#f1f5f9",
                    color: onlineDeliveryAvailable ? "#166534" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    border: onlineDeliveryAvailable ? "1px solid #86efac" : "1px solid #e2e8f0",
                  }}
                >
                  {onlineDeliveryAvailable ? (
                    <>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <span>Available</span>
                    </>
                  ) : (
                    <span>Disabled</span>
                  )}
                </div>
              </button>

              {/* Option 2: Self Pickup */}
              <button
                type="button"
                className={`asm-avail-toggle-btn ${selfPickupAvailable ? "active-enabled" : "inactive-disabled"}`}
                onClick={() => setSelfPickupAvailable((prev) => !prev)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 18px",
                  borderRadius: "14px",
                  border: selfPickupAvailable ? "2px solid #16a34a" : "2px solid #cbd5e1",
                  background: selfPickupAvailable ? "#f0fdf4" : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  textAlign: "left",
                  boxShadow: selfPickupAvailable ? "0 4px 12px rgba(22, 163, 74, 0.12)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "10px",
                      background: selfPickupAvailable ? "#16a34a" : "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: selfPickupAvailable ? "#ffffff" : "#64748b",
                    }}
                  >
                    <Store size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: selfPickupAvailable ? "#166534" : "#1e293b" }}>
                      Self Pickup
                    </div>
                    <div style={{ fontSize: "12px", color: selfPickupAvailable ? "#15803d" : "#64748b", marginTop: "2px" }}>
                      Online Shopping (app) &amp; Offline Shopping (scan &amp; go)
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: "9999px",
                    fontSize: "12px",
                    fontWeight: 700,
                    background: selfPickupAvailable ? "#dcfce7" : "#f1f5f9",
                    color: selfPickupAvailable ? "#166534" : "#64748b",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    border: selfPickupAvailable ? "1px solid #86efac" : "1px solid #e2e8f0",
                  }}
                >
                  {selfPickupAvailable ? (
                    <>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <span>Available</span>
                    </>
                  ) : (
                    <span>Disabled</span>
                  )}
                </div>
              </button>
            </div>

            {/* Case 1 & Case 3: Dedicated Delivery Dashboard Setup (Appears ONLY when Online Delivery is Enabled) */}
            {onlineDeliveryAvailable ? (
              <div
                style={{
                  marginTop: "18px",
                  padding: "18px 20px",
                  background: "#f0fdf4",
                  borderRadius: "12px",
                  border: "1.5px solid #86efac",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Truck size={18} color="#166534" />
                  <span style={{ fontSize: "14.5px", fontWeight: 800, color: "#166534" }}>
                    Dedicated Mobile Delivery Dashboard Setup ({supermarketName || "Store"} Only)
                  </span>
                  <span style={{ fontSize: "11px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "9999px", fontWeight: 700 }}>
                    Mobile App Only
                  </span>
                </div>
                <p style={{ fontSize: "12.5px", color: "#15803d", margin: "0 0 14px 0", lineHeight: 1.5 }}>
                  When Online Delivery is enabled, assign dedicated login credentials for this supermarket's Delivery Dashboard in the mobile app. Store Admin credentials cannot access this dashboard, and this dashboard will strictly show only {supermarketName || "this store"}'s delivery orders.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>
                      Delivery Account Username <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 12px" }}>
                      <KeyRound size={15} color="#64748b" style={{ marginRight: "8px" }} />
                      <input
                        type="text"
                        style={{ border: "none", outline: "none", width: "100%", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}
                        placeholder="e.g. pooja_delivery"
                        value={deliveryUsername}
                        onChange={(e) => setDeliveryUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>
                      Delivery Password <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <div style={{ display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 12px" }}>
                      <Lock size={15} color="#64748b" style={{ marginRight: "8px" }} />
                      <input
                        type={showDeliveryPassword ? "text" : "password"}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}
                        placeholder="Password"
                        value={deliveryPassword}
                        onChange={(e) => setDeliveryPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeliveryPassword((prev) => !prev)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#64748b" }}
                      >
                        {showDeliveryPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>
                      Delivery Fleet / Staff Name
                    </label>
                    <div style={{ display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 12px" }}>
                      <User size={15} color="#64748b" style={{ marginRight: "8px" }} />
                      <input
                        type="text"
                        style={{ border: "none", outline: "none", width: "100%", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}
                        placeholder="e.g. Pooja Fleet Lead"
                        value={deliveryStaffName}
                        onChange={(e) => setDeliveryStaffName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: "4px" }}>
                      Delivery Contact Phone
                    </label>
                    <div style={{ display: "flex", alignItems: "center", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 12px" }}>
                      <Phone size={15} color="#64748b" style={{ marginRight: "8px" }} />
                      <input
                        type="tel"
                        style={{ border: "none", outline: "none", width: "100%", fontSize: "13px", fontWeight: 600, color: "#0f172a" }}
                        placeholder="10-digit number"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Current Selection Scenario Summary Indicator */}
            <div
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "12.5px",
                color: "#334155",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Sparkles size={14} color="#059669" />
              <span>
                <strong>Configured Status: </strong>
                {onlineDeliveryAvailable && selfPickupAvailable && "Online Delivery – Available | Self Pickup – Available (Case 3: Both Options Enabled - Delivery Dashboard Created)"}
                {onlineDeliveryAvailable && !selfPickupAvailable && "Online Delivery – Available | Self Pickup – Disabled (Case 1: Online Delivery Only - Delivery Dashboard Created)"}
                {!onlineDeliveryAvailable && selfPickupAvailable && "Online Delivery – Disabled | Self Pickup – Available (Case 2: Self Pickup Only - Delivery Dashboard Not Created)"}
                {!onlineDeliveryAvailable && !selfPickupAvailable && "Online Delivery – Disabled | Self Pickup – Disabled (Case 4: Customer purchase options blocked)"}
              </span>
            </div>
          </div>

          <div className="asm-form-footer">
            <Link to="/super-admin/supermarkets" className="asm-btn-prev">
              <span>Cancel</span>
            </Link>
            <button type="button" className="asm-btn-next" onClick={handleNextStep}>
              <span>Continue to Admin Credentials</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: Admin Credentials ================= */}
      {currentStep === 2 && (
        <div className="asm-form-main-card">
          <div className="asm-step-header">
            <div className="asm-step-header-left">
              <h2>
                <KeyRound size={22} className="asm-header-icon" />
                <span>Supermarket Admin Credentials</span>
              </h2>
              <p>Set up dedicated store manager login details and initial security preferences</p>
            </div>
            <span className="asm-step-counter-tag">Step 2 of 5</span>
          </div>

          {/* Section: Store Administrator Login */}
          <div className="asm-form-section">
            <div className="asm-section-title">
              <User size={16} />
              <span>Store Administrator Login</span>
            </div>

            <div className="asm-grid-2">
              {/* Field: Admin Username */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Admin Username <span className="asm-req">*</span></span>
                  <span className="asm-hint">Used to login to Store Admin portal</span>
                </label>
                <div className={`asm-input-box ${errors.adminUsername ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <User size={18} />
                  </div>
                  <input
                    type="text"
                    className="asm-input"
                    placeholder=""
                    value={adminUsername}
                    onChange={(e) => {
                      setAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                      setErrors((p) => ({ ...p, adminUsername: "" }));
                    }}
                  />
                </div>
                {errors.adminUsername && <span className="asm-error-text">{errors.adminUsername}</span>}
              </div>

              {/* Field: Admin Email */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Admin Email <span className="asm-req">*</span></span>
                  <span className="asm-hint">Password recovery &amp; notifications</span>
                </label>
                <div className={`asm-input-box ${errors.adminEmail ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    className="asm-input"
                    placeholder="e.g. admin@grocerease.store (lowercase only)"
                    value={adminEmail || email}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
                      setAdminEmail(val);
                      setErrors((p) => ({ ...p, adminEmail: "" }));
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = (e.clipboardData || window.clipboardData).getData("text") || "";
                      const val = pasted.toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
                      setAdminEmail(val);
                      setErrors((p) => ({ ...p, adminEmail: "" }));
                    }}
                  />
                </div>
                {errors.adminEmail && <span className="asm-error-text">{errors.adminEmail}</span>}
              </div>
            </div>
          </div>

          {/* Section: Temporary Password & Security */}
          <div className="asm-form-section">
            <div className="asm-section-title">
              <Lock size={16} />
              <span>Temporary Admin Password</span>
            </div>

            <div className="asm-grid-2">
              {/* Field: Temporary Password */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Temporary Password <span className="asm-req">*</span></span>
                  <button
                    type="button"
                    className="asm-btn-inline"
                    onClick={handleRegeneratePassword}
                    title="Auto-generate a secure random temporary password"
                  >
                    <RefreshCw size={12} />
                    <span>Generate Password</span>
                  </button>
                </label>
                <div className={`asm-input-box ${errors.adminPassword ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="asm-input"
                    placeholder=""
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      setErrors((p) => ({ ...p, adminPassword: "" }));
                    }}
                  />
                  <button
                    type="button"
                    className="asm-toggle-eye"
                    onClick={() => setShowPassword((p) => !p)}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.adminPassword && <span className="asm-error-text">{errors.adminPassword}</span>}
              </div>

              {/* Field: Confirm Password */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Confirm Password <span className="asm-req">*</span></span>
                  {confirmPassword && confirmPassword === adminPassword && (
                    <span className="asm-hint" style={{ color: "#16a34a", fontWeight: 700 }}>
                      ✓ Passwords match
                    </span>
                  )}
                </label>
                <div className={`asm-input-box ${errors.confirmPassword ? "error" : ""}`}>
                  <div className="asm-badge-icon">
                    <ShieldCheck size={18} />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="asm-input"
                    placeholder=""
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((p) => ({ ...p, confirmPassword: "" }));
                    }}
                  />
                  <button
                    type="button"
                    className="asm-toggle-eye"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && <span className="asm-error-text">{errors.confirmPassword}</span>}
              </div>
            </div>

            {/* Security Checkbox Toggles */}
            <div className="asm-toggle-grid" style={{ marginTop: "1rem" }}>
              {/* Checkbox: Send Login Credentials */}
              <div
                className={`asm-toggle-box ${sendCredentialsEmail ? "checked" : ""}`}
                onClick={() => setSendCredentialsEmail((p) => !p)}
              >
                <div className={`asm-switch ${sendCredentialsEmail ? "on" : ""}`}>
                  <div className="asm-switch-knob" />
                </div>
                <div className="asm-toggle-info">
                  <span className="asm-toggle-title">Send Login Credentials via Email</span>
                  <span className="asm-toggle-desc">
                    Send temporary login link, store ID and security instructions to admin email
                  </span>
                </div>
              </div>

              {/* Checkbox: Force Password Change on First Login */}
              <div
                className={`asm-toggle-box ${forcePasswordChange ? "checked" : ""}`}
                onClick={() => setForcePasswordChange((p) => !p)}
              >
                <div className={`asm-switch ${forcePasswordChange ? "on" : ""}`}>
                  <div className="asm-switch-knob" />
                </div>
                <div className="asm-toggle-info">
                  <span className="asm-toggle-title">Force Password Change on First Login</span>
                  <span className="asm-toggle-desc">
                    Require the store manager to set their personal secure password immediately upon first sign in
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="asm-form-footer">
            <button type="button" className="asm-btn-prev" onClick={handlePrevStep}>
              <ArrowLeft size={16} />
              <span>Back to Store Info</span>
            </button>
            <button type="button" className="asm-btn-next" onClick={handleNextStep}>
              <span>Continue to Subscription Plan</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: Subscription Plan ================= */}
      {currentStep === 3 && (
        <div className="asm-form-main-card">
          <div className="asm-step-header">
            <div className="asm-step-header-left">
              <h2>
                <Crown size={22} className="asm-header-icon" />
                <span>Select SaaS Subscription Plan</span>
              </h2>
              <p>Choose the tier and billing frequency for this supermarket. You can change plans anytime.</p>
            </div>
            <span className="asm-step-counter-tag">Step 3 of 5</span>
          </div>

          {/* Billing Frequency Switcher */}
          <div className="asm-cycle-bar">
            <button
              type="button"
              className={`asm-cycle-btn ${billingCycle === "Monthly" ? "active" : ""}`}
              onClick={() => setBillingCycle("Monthly")}
            >
              <span>Monthly Billing</span>
            </button>
            <button
              type="button"
              className={`asm-cycle-btn ${billingCycle === "Yearly" ? "active" : ""}`}
              onClick={() => setBillingCycle("Yearly")}
            >
              <span>Yearly Billing</span>
              <span className="asm-discount-tag">Save 17%</span>
            </button>
          </div>

          {/* 4 Plan Cards */}
          <div className="asm-plans-grid">
            {SAAS_PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const displayPrice =
                billingCycle === "Yearly"
                  ? `₹${Number(plan.yearlyPrice).toLocaleString("en-IN")}`
                  : `₹${Number(plan.monthlyPrice).toLocaleString("en-IN")}`;

              return (
                <div
                  key={plan.id}
                  className={`asm-plan-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  {plan.badge && <span className="asm-plan-popular-pill">{plan.badge}</span>}
                  <div>
                    <h3 className="asm-plan-name">{plan.name}</h3>
                    <div className="asm-plan-price">
                      <span className="amount">{displayPrice}</span>
                      <span className="period">/{billingCycle === "Yearly" ? "year" : "month"}</span>
                    </div>

                    <div className="asm-plan-features">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="asm-plan-feature-item">
                          <Check size={14} className="asm-feature-check" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="asm-plan-select-indicator">
                    {isSelected ? (
                      <>
                        <Check size={14} strokeWidth={3} />
                        <span>Plan Selected</span>
                      </>
                    ) : (
                      <span>Select Plan</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subscription Dates & Adjustments Grid */}
          <div className="asm-form-section">
            <div className="asm-section-title">
              <CreditCard size={16} />
              <span>Billing Details &amp; Period</span>
            </div>

            <div className="asm-grid-3">
              {/* Custom Subscription Amount */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Subscription Amount (₹)</span>
                  <span className="asm-hint">Editable for discounts</span>
                </label>
                <div className="asm-input-box">
                  <div className="asm-badge-icon">
                    <CreditCard size={18} />
                  </div>
                  <input
                    type="number"
                    className="asm-input"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Start Date */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Start Date <span className="asm-req">*</span></span>
                </label>
                <div className="asm-input-box">
                  <input
                    type="date"
                    className="asm-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Expiry Date <span className="asm-req">*</span></span>
                </label>
                <div className="asm-input-box">
                  <input
                    type="date"
                    className="asm-input"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Free Trial Period */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Free Trial Period</span>
                </label>
                <div className="asm-input-box">
                  <select
                    className="asm-select"
                    value={trialPeriodDays}
                    onChange={(e) => setTrialPeriodDays(Number(e.target.value))}
                  >
                    <option value={0}>No Trial (Immediate Paid Activation)</option>
                    <option value={14}>14 Days Free Trial</option>
                    <option value={30}>30 Days Free Trial</option>
                  </select>
                  <Sliders size={14} className="asm-select-arrow" />
                </div>
              </div>

              {/* Auto Renewal Toggle */}
              <div
                className={`asm-toggle-box ${autoRenewal ? "checked" : ""}`}
                style={{ gridColumn: "span 2" }}
                onClick={() => setAutoRenewal((p) => !p)}
              >
                <div className={`asm-switch ${autoRenewal ? "on" : ""}`}>
                  <div className="asm-switch-knob" />
                </div>
                <div className="asm-toggle-info">
                  <span className="asm-toggle-title">Auto Renewal Option</span>
                  <span className="asm-toggle-desc">
                    Automatically renew tenant subscription at end of period and issue invoice
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="asm-form-footer">
            <button type="button" className="asm-btn-prev" onClick={handlePrevStep}>
              <ArrowLeft size={16} />
              <span>Back to Admin Credentials</span>
            </button>
            <button type="button" className="asm-btn-next" onClick={handleNextStep}>
              <span>Continue to Store Configuration</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: Store Configuration ================= */}
      {currentStep === 4 && (
        <div className="asm-form-main-card">
          <div className="asm-step-header">
            <div className="asm-step-header-left">
              <h2>
                <Sliders size={22} className="asm-header-icon" />
                <span>Store Configuration &amp; Tenant Limits</span>
              </h2>
              <p>Configure regional currency, GST settings, branch quota, and account activation status</p>
            </div>
            <span className="asm-step-counter-tag">Step 4 of 5</span>
          </div>

          <div className="asm-form-section">
            <div className="asm-section-title">
              <Sliders size={16} />
              <span>Store Setup &amp; Regional Options</span>
            </div>

            <div className="asm-grid-2">
              {/* Store Type */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Store Type <span className="asm-req">*</span></span>
                </label>
                <div className="asm-input-box">
                  <select
                    className="asm-select"
                    value={storeType}
                    onChange={(e) => setStoreType(e.target.value)}
                  >
                    <option value="Grocery & Supermarket">Grocery &amp; Supermarket</option>
                    <option value="Hypermarket & Departmental">Hypermarket &amp; Departmental</option>
                    <option value="Organic Foods & Fresh Produce">Organic Foods &amp; Fresh Produce</option>
                    <option value="Convenience & Express Store">Convenience &amp; Express Store</option>
                    <option value="Wholesale Cash & Carry">Wholesale Cash &amp; Carry</option>
                  </select>
                  <Sliders size={14} className="asm-select-arrow" />
                </div>
              </div>

              {/* Currency */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Currency <span className="asm-req">*</span></span>
                </label>
                <div className="asm-input-box">
                  <select
                    className="asm-select"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                    <option value="AED">AED (د.إ - UAE Dirham)</option>
                  </select>
                  <Sliders size={14} className="asm-select-arrow" />
                </div>
              </div>

              {/* Tax Rate */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Default GST / Tax Rate (%)</span>
                </label>
                <div className="asm-input-box">
                  <select
                    className="asm-select"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                  >
                    <option value={0}>0% (Tax Exempt)</option>
                    <option value={5}>5% Standard Grocery GST</option>
                    <option value={12}>12% Packaged Foods GST</option>
                    <option value={18}>18% General Retail GST</option>
                    <option value={28}>28% Luxury / Tier 1 GST</option>
                  </select>
                  <Sliders size={14} className="asm-select-arrow" />
                </div>
              </div>

              {/* Default Time Zone */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Default Time Zone</span>
                </label>
                <div className="asm-input-box">
                  <select
                    className="asm-select"
                    value={timeZone}
                    onChange={(e) => setTimeZone(e.target.value)}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                    <option value="UTC">UTC (+00:00)</option>
                    <option value="America/New_York">America/New_York (EST -05:00)</option>
                  </select>
                  <Sliders size={14} className="asm-select-arrow" />
                </div>
              </div>

              {/* Number of Branches */}
              <div className="asm-form-group">
                <label className="asm-label">
                  <span>Number of Allowed Branches</span>
                </label>
                <div className="asm-input-box">
                  <input
                    type="number"
                    className="asm-input"
                    min={1}
                    max={50}
                    value={branchesCount}
                    onChange={(e) => setBranchesCount(Math.max(1, Number(e.target.value)))}
                  />
                </div>
              </div>

              {/* Account Status */}
              <div className="asm-form-group asm-grid-full">
                <label className="asm-label">
                  <span>Initial Store Status</span>
                </label>
                <div className="asm-input-box">
                  <select
                    className="asm-select"
                    value={accountStatus}
                    onChange={(e) => setAccountStatus(e.target.value)}
                  >
                    <option value="Active">Active (Instant access to Store Admin portal)</option>
                    <option value="Trial">Trial Mode (Evaluation period)</option>
                    <option value="Inactive">Inactive / Suspended</option>
                  </select>
                  <Sliders size={14} className="asm-select-arrow" />
                </div>
              </div>
            </div>
          </div>

          <div className="asm-form-footer">
            <button type="button" className="asm-btn-prev" onClick={handlePrevStep}>
              <ArrowLeft size={16} />
              <span>Back to Subscription</span>
            </button>
            <button type="button" className="asm-btn-next" onClick={handleNextStep}>
              <span>Continue to Review &amp; Create</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 5: Review and Create ================= */}
      {currentStep === 5 && (
        <div className="asm-form-main-card">
          {/* Header with Step indicator and Top Quick Action Button */}
          <div className="asm-step-header" style={{ alignItems: "center" }}>
            <div className="asm-step-header-left">
              <h2>
                <CheckCircle2 size={24} className="asm-header-icon" color="#16a34a" />
                <span>Review &amp; Create Supermarket</span>
              </h2>
              <p>Verify all entered store details, admin credentials, plan terms, and availability channels before launching</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span className="asm-step-counter-tag">Step 5 of 5</span>
              <button
                type="button"
                className="asm-btn-create"
                style={{ padding: "0.55rem 1.25rem", fontSize: "0.85rem", height: "auto" }}
                onClick={handleFinalCreateSupermarket}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="spin-icon" />
                    <span>Provisioning...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle size={16} />
                    <span>Create Supermarket</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Executive Summary & Launch Preview Strip */}
          <div className="asm-review-hero-strip">
            <div className="asm-review-hero-left">
              <div className="asm-review-hero-avatar">
                {logoUrl && !logoLoadError ? (
                  <img src={logoUrl} alt={supermarketName} />
                ) : (
                  <Store size={28} color="#16a34a" />
                )}
              </div>
              <div className="asm-review-hero-title">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h3>{supermarketName || "New Supermarket"}</h3>
                  <span className="asm-val-tag" style={{ fontFamily: "monospace", fontSize: "0.8rem", letterSpacing: "0.5px" }}>
                    {supermarketId}
                  </span>
                </div>
                <div className="asm-review-hero-meta">
                  <span style={{ fontSize: "0.82rem", color: "#475569", fontWeight: 600 }}>
                    {city}, {state} ({pincode || "560001"})
                  </span>
                  <span style={{ color: "#94a3b8" }}>&bull;</span>
                  <span style={{ fontSize: "0.82rem", color: "#166534", fontWeight: 700, background: "#dcfce7", padding: "1px 8px", borderRadius: "4px" }}>
                    ★ {selectedPlanId} Plan ({billingCycle})
                  </span>
                  <span style={{ color: "#94a3b8" }}>&bull;</span>
                  <span style={{ fontSize: "0.82rem", color: "#1e40af", fontWeight: 700, background: "#dbeafe", padding: "1px 8px", borderRadius: "4px" }}>
                    Admin: {adminUsername}
                  </span>
                </div>
              </div>
            </div>

            {/* Channels & Policy Status */}
            <div className="asm-review-hero-right">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.5px" }}>
                  Store Availability Channels
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      backgroundColor: onlineDeliveryAvailable ? "#dcfce7" : "#fee2e2",
                      color: onlineDeliveryAvailable ? "#15803d" : "#991b1b",
                      border: onlineDeliveryAvailable ? "1.5px solid #86efac" : "1.5px solid #fca5a5",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Truck size={13} /> Online Delivery: {onlineDeliveryAvailable ? "Available" : "Disabled"}
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      backgroundColor: selfPickupAvailable ? "#dcfce7" : "#fee2e2",
                      color: selfPickupAvailable ? "#15803d" : "#991b1b",
                      border: selfPickupAvailable ? "1.5px solid #86efac" : "1.5px solid #fca5a5",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Store size={13} /> Self Pickup: {selfPickupAvailable ? "Available" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Tenant Cryptographic Isolation Assurance Card */}
          <div className="asm-isolation-notice" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", border: "1.5px solid #86efac", marginBottom: "1.5rem" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ShieldCheck size={22} strokeWidth={2.4} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ color: "#166534", fontSize: "0.92rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Strict Multi-Tenant Database Isolation Guaranteed</span>
                <span style={{ fontSize: "0.72rem", padding: "1px 6px", background: "#bbf7d0", color: "#14532d", borderRadius: "4px" }}>Verified</span>
              </h4>
              <p style={{ color: "#15803d", fontSize: "0.82rem", lineHeight: 1.5, marginTop: "4px" }}>
                This supermarket will be provisioned under unique tenant ID <strong>{supermarketId}</strong>. All catalog products, inventory stock, order transactions, customer profiles, and analytics will start with fresh, verified zero-state statistics strictly separated from every other supermarket.
              </p>
            </div>
          </div>

          {/* 4 Summary Cards (2x2 Grid) */}
          <div className="asm-review-grid">
            {/* Card 1: Supermarket Information */}
            <div className="asm-review-card theme-emerald">
              <div className="asm-review-card-header">
                <div className="asm-review-card-title">
                  <div className="asm-card-icon-pill emerald">
                    <Store size={17} />
                  </div>
                  <span>1. Supermarket Information</span>
                </div>
                <button type="button" className="asm-edit-btn" onClick={() => handleJumpToStep(1)}>
                  <span>Edit</span>
                </button>
              </div>

              <div className="asm-review-rows">
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Store size={14} /> Store Name:
                  </span>
                  <span className="asm-review-val">{supermarketName}</span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Building2 size={14} /> Tenant ID:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="asm-val-tag" style={{ fontFamily: "monospace" }}>{supermarketId}</span>
                    <button
                      type="button"
                      className="asm-copy-pill-btn"
                      onClick={() => handleCopyText(supermarketId, "tenant_id")}
                      title="Copy Tenant ID"
                    >
                      {copiedKey === "tenant_id" ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <User size={14} /> Owner / Contact:
                  </span>
                  <span className="asm-review-val">
                    {ownerName || "N/A"} {contactPerson ? `(${contactPerson})` : ""}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Mail size={14} /> Store Email:
                  </span>
                  <span className="asm-review-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {email}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Phone size={14} /> Mobile Number:
                  </span>
                  <span className="asm-review-val">
                    {mobileNumber ? `+91 ${mobileNumber.replace(/\D/g, "").slice(-10)}` : "N/A"}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <MapPin size={14} /> Location:
                  </span>
                  <span className="asm-review-val">
                    {city}, {state} ({pincode})
                  </span>
                </div>
                {gstNumber && (
                  <div className="asm-review-row">
                    <span className="asm-review-key">
                      <CreditCard size={14} /> GST Number:
                    </span>
                    <span className="asm-review-val" style={{ fontFamily: "monospace" }}>
                      {gstNumber}
                    </span>
                  </div>
                )}
                {logoUrl && (
                  <div className="asm-review-row" style={{ alignItems: "center" }}>
                    <span className="asm-review-key">
                      <ImageIcon size={14} /> Store Logo:
                    </span>
                    <span className="asm-review-val" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img
                        src={logoUrl}
                        alt="Store Logo"
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "6px",
                          objectFit: "cover",
                          border: "1px solid #cbd5e1",
                        }}
                      />
                      <span style={{ fontSize: "0.76rem", color: "#64748b" }}>Configured for receipts &amp; store portal</span>
                    </span>
                  </div>
                )}
                <div className="asm-review-row" style={{ alignItems: "center" }}>
                  <span className="asm-review-key">
                    <Truck size={14} /> Channels:
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: onlineDeliveryAvailable ? "#dcfce7" : "#fee2e2",
                        color: onlineDeliveryAvailable ? "#166534" : "#991b1b",
                        border: onlineDeliveryAvailable ? "1px solid #86efac" : "1px solid #fca5a5",
                      }}
                    >
                      Online Delivery: {onlineDeliveryAvailable ? "Available" : "Disabled"}
                    </span>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: selfPickupAvailable ? "#dcfce7" : "#fee2e2",
                        color: selfPickupAvailable ? "#166534" : "#991b1b",
                        border: selfPickupAvailable ? "1px solid #86efac" : "1px solid #fca5a5",
                      }}
                    >
                      Self Pickup: {selfPickupAvailable ? "Available" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Admin Credentials */}
            <div className="asm-review-card theme-violet">
              <div className="asm-review-card-header">
                <div className="asm-review-card-title">
                  <div className="asm-card-icon-pill violet">
                    <KeyRound size={17} />
                  </div>
                  <span>2. Admin Credentials</span>
                </div>
                <button type="button" className="asm-edit-btn" onClick={() => handleJumpToStep(2)}>
                  <span>Edit</span>
                </button>
              </div>

              <div className="asm-review-rows">
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <User size={14} /> Username:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="asm-review-val" style={{ fontFamily: "monospace", color: "#6d28d9" }}>
                      {adminUsername}
                    </span>
                    <button
                      type="button"
                      className="asm-copy-pill-btn"
                      onClick={() => handleCopyText(adminUsername, "admin_user")}
                      title="Copy Username"
                    >
                      {copiedKey === "admin_user" ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Mail size={14} /> Admin Email:
                  </span>
                  <span className="asm-review-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {adminEmail || email}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Lock size={14} /> Temp Password:
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="asm-review-val" style={{ fontFamily: "monospace", letterSpacing: showReviewPassword ? "0" : "2px" }}>
                      {showReviewPassword ? adminPassword : "••••••••••••"}
                    </span>
                    <button
                      type="button"
                      className="asm-copy-pill-btn"
                      onClick={() => setShowReviewPassword((p) => !p)}
                      title={showReviewPassword ? "Hide Password" : "Show Password"}
                    >
                      {showReviewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button
                      type="button"
                      className="asm-copy-pill-btn"
                      onClick={() => handleCopyText(adminPassword, "admin_pwd")}
                      title="Copy Password"
                    >
                      {copiedKey === "admin_pwd" ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Sparkles size={14} /> Strength:
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.74rem",
                      fontWeight: 800,
                      backgroundColor: getPasswordStrength(adminPassword).score >= 3 ? "#dcfce7" : "#fef3c7",
                      color: getPasswordStrength(adminPassword).score >= 3 ? "#15803d" : "#b45309",
                    }}
                  >
                    {getPasswordStrength(adminPassword).label}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Mail size={14} /> Dispatch Email:
                  </span>
                  <span className="asm-review-val" style={{ color: sendCredentialsEmail ? "#16a34a" : "#64748b" }}>
                    {sendCredentialsEmail ? "Yes (Brevo SMTP Enabled)" : "No"}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <ShieldCheck size={14} /> First Login:
                  </span>
                  <span className="asm-review-val" style={{ color: forcePasswordChange ? "#16a34a" : "#64748b" }}>
                    {forcePasswordChange ? "Mandatory Password Change" : "Optional"}
                  </span>
                </div>

                {onlineDeliveryAvailable && (
                  <>
                    <div style={{ margin: "10px 0 6px 0", borderTop: "1px dashed #c4b5fd", paddingTop: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        🚚 Mobile Delivery Dashboard Credentials
                      </span>
                    </div>
                    <div className="asm-review-row">
                      <span className="asm-review-key">
                        <KeyRound size={14} /> Delivery User:
                      </span>
                      <span className="asm-review-val" style={{ fontFamily: "monospace", color: "#166534", fontWeight: 700 }}>
                        {deliveryUsername || `${supermarketName.toLowerCase().replace(/[^a-z0-9]/g, "")}_delivery`}
                      </span>
                    </div>
                    <div className="asm-review-row">
                      <span className="asm-review-key">
                        <Lock size={14} /> Delivery Password:
                      </span>
                      <span className="asm-review-val" style={{ fontFamily: "monospace", color: "#166534", fontWeight: 700 }}>
                        {deliveryPassword || "Delivery@123"}
                      </span>
                    </div>
                    <div className="asm-review-row">
                      <span className="asm-review-key">
                        <User size={14} /> Fleet Lead:
                      </span>
                      <span className="asm-review-val">
                        {deliveryStaffName || `${supermarketName} Delivery Fleet`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Card 3: Subscription Plan */}
            <div className="asm-review-card theme-amber">
              <div className="asm-review-card-header">
                <div className="asm-review-card-title">
                  <div className="asm-card-icon-pill amber">
                    <Crown size={17} />
                  </div>
                  <span>3. Subscription Plan</span>
                </div>
                <button type="button" className="asm-edit-btn" onClick={() => handleJumpToStep(3)}>
                  <span>Edit</span>
                </button>
              </div>

              <div className="asm-review-rows">
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Crown size={14} /> Plan Tier:
                  </span>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      background: "#fef3c7",
                      color: "#b45309",
                      border: "1px solid #fde68a",
                    }}
                  >
                    ★ {selectedPlanId} Plan
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <RefreshCw size={14} /> Billing Cycle:
                  </span>
                  <span className="asm-review-val">{billingCycle}</span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <CreditCard size={14} /> Subscription Fee:
                  </span>
                  <span className="asm-review-val" style={{ fontSize: "1.05rem", color: "#16a34a", fontWeight: 850 }}>
                    ₹{Number(customAmount).toLocaleString("en-IN")}
                    <small style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}> / {billingCycle}</small>
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <CheckCircle2 size={14} /> Start Date:
                  </span>
                  <span className="asm-review-val">{startDate}</span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <CheckCircle2 size={14} /> Expiry Date:
                  </span>
                  <span className="asm-review-val" style={{ color: "#d97706" }}>{expiryDate}</span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Sparkles size={14} /> Free Trial:
                  </span>
                  <span className="asm-review-val">
                    {trialPeriodDays ? `${trialPeriodDays} Days Free Trial` : "None (Direct Activation)"}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <RefreshCw size={14} /> Auto Renewal:
                  </span>
                  <span className="asm-review-val" style={{ color: autoRenewal ? "#16a34a" : "#64748b" }}>
                    {autoRenewal ? "Yes (Automatic Renewal)" : "No (Manual Renewal)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Store Operations & System Settings */}
            <div className="asm-review-card theme-sky">
              <div className="asm-review-card-header">
                <div className="asm-review-card-title">
                  <div className="asm-card-icon-pill sky">
                    <Sliders size={17} />
                  </div>
                  <span>4. Store Operations &amp; Settings</span>
                </div>
                <button type="button" className="asm-edit-btn" onClick={() => handleJumpToStep(4)}>
                  <span>Edit</span>
                </button>
              </div>

              <div className="asm-review-rows">
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Store size={14} /> Store Type:
                  </span>
                  <span className="asm-review-val">{storeType}</span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <CreditCard size={14} /> Currency:
                  </span>
                  <span className="asm-review-val">{currency} (₹ - Indian Rupee)</span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Sliders size={14} /> Default GST:
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      backgroundColor: taxEnabled ? "#dbeafe" : "#f1f5f9",
                      color: taxEnabled ? "#1e40af" : "#64748b",
                      border: `1px solid ${taxEnabled ? "#bfdbfe" : "#cbd5e1"}`,
                    }}
                  >
                    {taxEnabled ? `${taxRate}% Standard GST Enabled` : "Tax Exempt (0%)"}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Building2 size={14} /> Allowed Branches:
                  </span>
                  <span className="asm-review-val">{branchesCount} Branch(es) Quota</span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <Globe size={14} /> Time Zone:
                  </span>
                  <span className="asm-review-val" style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {timeZone}
                  </span>
                </div>
                <div className="asm-review-row">
                  <span className="asm-review-key">
                    <ShieldCheck size={14} /> Initial Status:
                  </span>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      backgroundColor: accountStatus === "Active" ? "#dcfce7" : "#fee2e2",
                      color: accountStatus === "Active" ? "#15803d" : "#b91c1c",
                      border: `1px solid ${accountStatus === "Active" ? "#86efac" : "#fca5a5"}`,
                    }}
                  >
                    {accountStatus} (Instant Activation)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Footer with Clean Two-Button Layout and Help Text */}
          <div className="asm-form-footer" style={{ marginTop: "1rem" }}>
            <button type="button" className="asm-btn-prev" onClick={handlePrevStep} disabled={submitting}>
              <ArrowLeft size={16} />
              <span>Back to Store Configuration</span>
            </button>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
              <button
                type="button"
                className="asm-btn-create"
                onClick={handleFinalCreateSupermarket}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={18} className="spin-icon" />
                    <span>Provisioning Supermarket...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle size={18} />
                    <span>Create Supermarket &amp; Credentials</span>
                  </>
                )}
              </button>
              <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                Creates dedicated tenant database isolation &amp; dispatches admin credentials
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 6: Registration Success Screen ================= */}
      {currentStep === 6 && createdData && (
        <div className="asm-success-card">
          <div className="asm-success-badge-wrap">
            <CheckCheck size={40} strokeWidth={2.8} />
          </div>

          <h2 className="asm-success-title">Supermarket Successfully Registered!</h2>
          <p className="asm-success-subtitle">
            <strong>{createdData.name}</strong> has been onboarded to your multi-tenant network.
            A dedicated tenant container has been initialized with clean zero-state statistics.
          </p>

          {/* Automatic Registration Welcome Email Delivery Status Banner */}
          <div
            style={{
              background: "#ecfdf5",
              border: "1.5px solid #86efac",
              borderRadius: "12px",
              padding: "16px 20px",
              margin: "18px 0 24px 0",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#dcfce7",
                color: "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Mail size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "14.5px", color: "#166534" }}>
                Automatic Welcome Email Dispatched via Brevo SMTP!
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#15803d", lineHeight: 1.5 }}>
                An official onboarding email has been sent to{" "}
                <strong>{createdData.email || email}</strong> with secure login instructions, assigned{" "}
                <strong>{createdData.plan || selectedPlanId}</strong> subscription dates, and store access links.
              </p>
            </div>
          </div>

          {/* Credentials Delivery & Display Box */}
          <div className="asm-credentials-box">
            <div className="asm-cred-header">
              <strong>
                <KeyRound size={16} color="#16a34a" />
                <span>Store Administrator Onboarding Credentials</span>
              </strong>
              <span className="asm-val-tag">Active Tenant</span>
            </div>

            <div className="asm-cred-grid">
              {/* Tenant ID */}
              <div className="asm-cred-item">
                <span className="asm-cred-label">Supermarket ID (Tenant Code)</span>
                <div className="asm-cred-value-wrap">
                  <span className="asm-cred-value">{createdData.code || supermarketId}</span>
                  <button
                    type="button"
                    className="asm-copy-icon-btn"
                    onClick={() => handleCopyText(createdData.code || supermarketId, "code")}
                    title="Copy Supermarket ID"
                  >
                    {copiedKey === "code" ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Admin Username */}
              <div className="asm-cred-item">
                <span className="asm-cred-label">Admin Username</span>
                <div className="asm-cred-value-wrap">
                  <span className="asm-cred-value">
                    {createdData.credentials?.adminUsername || adminUsername}
                  </span>
                  <button
                    type="button"
                    className="asm-copy-icon-btn"
                    onClick={() =>
                      handleCopyText(createdData.credentials?.adminUsername || adminUsername, "user")
                    }
                    title="Copy Admin Username"
                  >
                    {copiedKey === "user" ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Temporary Password */}
              <div className="asm-cred-item">
                <span className="asm-cred-label">Temporary Password</span>
                <div className="asm-cred-value-wrap">
                  <span className="asm-cred-value">
                    {createdData.credentials?.adminPassword || adminPassword}
                  </span>
                  <button
                    type="button"
                    className="asm-copy-icon-btn"
                    onClick={() =>
                      handleCopyText(createdData.credentials?.adminPassword || adminPassword, "pwd")
                    }
                    title="Copy Password"
                  >
                    {copiedKey === "pwd" ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Assigned Plan */}
              <div className="asm-cred-item">
                <span className="asm-cred-label">Assigned Plan</span>
                <div className="asm-cred-value-wrap">
                  <span className="asm-cred-value">{createdData.plan || selectedPlanId} ({billingCycle})</span>
                  <span className="asm-val-tag">Paid</span>
                </div>
              </div>

              {/* Purchase Channels Availability */}
              <div className="asm-cred-item" style={{ gridColumn: "1 / -1" }}>
                <span className="asm-cred-label">Store Availability Modes (Configured)</span>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      backgroundColor: onlineAvailable ? "#dcfce7" : "#fee2e2",
                      color: onlineAvailable ? "#166534" : "#991b1b",
                      border: onlineAvailable ? "1px solid #86efac" : "1px solid #fca5a5",
                    }}
                  >
                    Online: {onlineAvailable ? "Available" : "Not Available"}
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      backgroundColor: offlineAvailable ? "#dcfce7" : "#fee2e2",
                      color: offlineAvailable ? "#166534" : "#991b1b",
                      border: offlineAvailable ? "1px solid #86efac" : "1px solid #fca5a5",
                    }}
                  >
                    Offline: {offlineAvailable ? "Available" : "Not Available"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Success Actions */}
          <div className="asm-success-actions">
            {/* Copy Full Credentials */}
            <button
              type="button"
              className="asm-btn-download"
              onClick={() => {
                const text = `GrocerEase Supermarket Credentials\nSupermarket: ${createdData.name}\nTenant ID: ${createdData.code || supermarketId}\nAdmin Username: ${adminUsername}\nPassword: ${adminPassword}\nLogin: ${window.location.origin}/login`;
                handleCopyText(text, "all");
              }}
            >
              {copiedKey === "all" ? <Check size={16} /> : <Copy size={16} />}
              <span>{copiedKey === "all" ? "Credentials Copied!" : "Copy All Credentials"}</span>
            </button>

            {/* Download Credentials Slip */}
            <button
              type="button"
              className="asm-btn-download"
              onClick={handleDownloadCredentialsSlip}
            >
              <Download size={16} />
              <span>Download Onboarding Pass</span>
            </button>

            {/* Launch Store Admin Portal */}
            <button
              type="button"
              className="asm-btn-launch"
              onClick={handleLaunchStoreAdmin}
            >
              <ExternalLink size={16} />
              <span>Launch Store Admin</span>
            </button>

            {/* Manage Supermarkets */}
            <button
              type="button"
              className="asm-btn-manage"
              onClick={() => navigate("/super-admin/supermarkets")}
            >
              <Building2 size={16} />
              <span>Manage Supermarkets</span>
            </button>

            {/* Register Another Supermarket */}
            <button
              type="button"
              className="asm-btn-another"
              onClick={handleRegisterAnother}
            >
              <PlusCircle size={16} />
              <span>Register Another</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
