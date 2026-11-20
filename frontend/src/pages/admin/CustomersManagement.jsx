import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  Search,
  Filter,
  ShoppingBag,
  IndianRupee,
  Star,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  X,
  CreditCard,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Download,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Eye,
  Check,
  Tag,
  ArrowRight,
  UserPlus,
  Building2,
  Trash2,
} from "lucide-react";
import API from "../../services/api";
import ErpPageBanner from "../../components/ErpPageBanner";
import "./ProductManagement.css";

const STATUS_FILTERS = ["All Statuses", "Active", "Suspended"];

const DATE_FILTERS = [
  { value: "all", label: "All Registration Dates" },
  { value: "today", label: "Registered Today" },
  { value: "week", label: "Registered This Week (7 Days)" },
  { value: "month", label: "Registered This Month (30 Days)" },
];

const TIER_FILTERS = [
  "All Membership Tiers",
  "VIP Platinum",
  "Gold Shoppers",
  "Regular Members",
];

// Universal phone formatter: guarantees standard '+91 XXXXXXXXXX' without duplicated '+91 +91'
const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = String(phone).trim();
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `+91 ${digits.slice(-10)}`;
  }
  return digits ? `+91 ${digits}` : cleaned;
};

export default function CustomersManagement() {
  const [searchParams] = useSearchParams();
  const [rawCustomers, setRawCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");

  useEffect(() => {
    const q = searchParams.get("search");
    if (q !== null) {
      setSearch(q);
    }
  }, [searchParams]);

  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [selectedDateFilter, setSelectedDateFilter] = useState("all");
  const [selectedTier, setSelectedTier] = useState("All Membership Tiers");

  // Profile modal & pagination
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [viewAll, setViewAll] = useState(false);
  const [actionToast, setActionToast] = useState("");

  // Add Walk-in Offline Customer Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [creatingCust, setCreatingCust] = useState(false);

  // Customer account status override map
  const [statusOverrides, setStatusOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem("grocerease_customer_statuses");
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });

  /**
   * Fetch Customers from dedicated Backend Customer API:
   * STRICT: API returns ONLY customers registered through the OFFLINE shopping flow.
   * Multi-tenant isolated to authenticated Store Admin's supermarket.
   */
  const fetchData = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const res = await API.get("/customers");

      if (res.data?.success && Array.isArray(res.data.customers)) {
        // Enforce registrationType: "OFFLINE"
        const offlineOnly = res.data.customers.filter(
          (c) => c.registrationType === "OFFLINE" || !c.registrationType
        );
        setRawCustomers(offlineOnly);
      }
    } catch (err) {
      console.warn("Customers data sync:", err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);

    // Auto-poll every 4s to ensure real-time offline registrations update
    const timer = setInterval(() => {
      fetchData(false);
    }, 4000);

    const handleStorageUpdate = () => {
      fetchData(false);
    };
    window.addEventListener("grocerease_storage_updated", handleStorageUpdate);

    return () => {
      clearInterval(timer);
      window.removeEventListener("grocerease_storage_updated", handleStorageUpdate);
    };
  }, []);

  // Format and process offline customer records
  const customers = useMemo(() => {
    return rawCustomers.map((c) => {
      const regDate = new Date(c.registrationDate || c.createdAt || Date.now());
      const latestDate = new Date(c.latestOrderDate || c.createdAt || Date.now());
      const totalSpent = Number(c.totalSpent || 0);

      // Derive Membership Tier based on actual completed spend
      let tier = "Regular Members";
      if (totalSpent >= 10000) {
        tier = "VIP Platinum";
      } else if (totalSpent >= 3000) {
        tier = "Gold Shoppers";
      }

      // Preferred payment
      let topMethod = "Cash / UPI";
      let topCount = 0;
      if (c.paymentMethodsUsed && typeof c.paymentMethodsUsed === "object") {
        Object.entries(c.paymentMethodsUsed).forEach(([method, count]) => {
          if (count > topCount) {
            topMethod = method;
            topCount = count;
          }
        });
      }

      const key = String(c._id || c.phone || c.id);
      const status = statusOverrides[key] || c.status || "Active";

      return {
        ...c,
        key,
        registrationDate: regDate,
        latestOrderDate: latestDate,
        totalOrders: Number(c.totalOrders || (c.orders ? c.orders.length : 0)),
        totalSpent,
        tier,
        status,
        preferredPayment: topMethod,
        orders: Array.isArray(c.orders)
          ? c.orders.map((o) => ({
              ...o,
              date: new Date(o.date || Date.now()),
            }))
          : [],
      };
    });
  }, [rawCustomers, statusOverrides]);

  // Executive KPI Metrics (Offline Directory)
  const totalRegisteredCount = customers.length;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const activeCustomersCount = useMemo(() => {
    return customers.filter(
      (c) => c.status === "Active" && c.latestOrderDate >= thirtyDaysAgo
    ).length;
  }, [customers, thirtyDaysAgo]);

  const newCustomersCount = useMemo(() => {
    return customers.filter((c) => c.registrationDate >= thirtyDaysAgo).length;
  }, [customers, thirtyDaysAgo]);

  const customersWithOrdersCount = useMemo(() => {
    return customers.filter((c) => c.totalOrders > 0).length;
  }, [customers]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return customers.filter((c) => {
      // 1. Status Filter
      if (selectedStatus !== "All Statuses" && c.status !== selectedStatus) {
        return false;
      }

      // 2. Membership Tier Filter
      if (selectedTier !== "All Membership Tiers" && c.tier !== selectedTier) {
        return false;
      }

      // 3. Registration Date Filter
      if (selectedDateFilter === "today" && c.registrationDate < startOfToday) {
        return false;
      }
      if (selectedDateFilter === "week" && c.registrationDate < sevenDaysAgo) {
        return false;
      }
      if (selectedDateFilter === "month" && c.registrationDate < thirtyDaysAgo) {
        return false;
      }

      // 4. Search Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchEmail = c.email?.toLowerCase().includes(q);
        const matchId = c.id?.toLowerCase().includes(q);
        const matchAddress = c.address?.toLowerCase().includes(q);

        if (!matchName && !matchPhone && !matchEmail && !matchId && !matchAddress) {
          return false;
        }
      }

      return true;
    });
  }, [customers, selectedStatus, selectedTier, selectedDateFilter, search, now, thirtyDaysAgo]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedCustomers = useMemo(() => {
    if (viewAll) return filteredCustomers;
    const start = (validCurrentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, validCurrentPage, pageSize, viewAll]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedStatus, selectedTier, selectedDateFilter, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Register New Walk-in Offline Customer
  const handleCreateOfflineCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      alert("Please enter customer name.");
      return;
    }

    const cleanP = newCustPhone.replace(/\D/g, "").slice(-10);
    if (!cleanP || cleanP.length !== 10 || !["6", "7", "8", "9"].includes(cleanP[0])) {
      alert("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
      return;
    }

    setCreatingCust(true);
    try {
      const res = await API.post("/customers", {
        name: newCustName.trim(),
        phone: cleanP,
        email: newCustEmail.trim().toLowerCase(),
        address: newCustAddress.trim(),
      });

      if (res.data?.success) {
        setActionToast(`✓ Offline customer "${newCustName.trim()}" registered successfully!`);
        setIsAddModalOpen(false);
        setNewCustName("");
        setNewCustPhone("");
        setNewCustEmail("");
        setNewCustAddress("");
        await fetchData(false);
        setTimeout(() => setActionToast(""), 4500);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to register offline customer.");
    } finally {
      setCreatingCust(false);
    }
  };

  // Toggle Customer Account Status
  const handleToggleCustomerStatus = async (customer) => {
    const newStatus = customer.status === "Active" ? "Suspended" : "Active";
    const updatedMap = {
      ...statusOverrides,
      [customer.key]: newStatus,
    };
    setStatusOverrides(updatedMap);
    try {
      localStorage.setItem("grocerease_customer_statuses", JSON.stringify(updatedMap));
    } catch (_) {}

    // Persist to backend if ID exists
    if (customer._id) {
      try {
        await API.patch(`/customers/${customer._id}/status`, { status: newStatus });
      } catch (_) {}
    }

    // Update active customer modal if open
    if (activeCustomer && activeCustomer.key === customer.key) {
      setActiveCustomer((prev) => ({ ...prev, status: newStatus }));
    }

    setActionToast(`✓ Offline Customer "${customer.name}" status updated to ${newStatus}.`);
    setTimeout(() => setActionToast(""), 4000);
    fetchData(false);
  };

  // Delete Offline Customer Record
  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Are you sure you want to remove offline customer "${customer.name}" (${customer.phone})?\n\nThis action cannot be undone.`)) {
      return;
    }
    try {
      if (customer._id) {
        await API.delete(`/customers/${customer._id}`);
      }
      setActionToast(`✓ Customer "${customer.name}" removed from offline directory.`);
      if (activeCustomer && activeCustomer.key === customer.key) {
        setActiveCustomer(null);
      }
      setTimeout(() => setActionToast(""), 4000);
      fetchData(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to delete customer.");
    }
  };

  // Export Offline Customers to CSV
  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      alert("No customer records match the current filter.");
      return;
    }

    const headers = [
      "Customer ID",
      "Customer Name",
      "Registration Source",
      "Mobile Number",
      "Email Address",
      "Address",
      "Registration Date",
      "Total Orders",
      "Total Verified Spend (INR)",
      "Membership Tier",
      "Account Status",
      "Preferred Payment",
    ];

    const rows = filteredCustomers.map((c) => [
      `"${c.id}"`,
      `"${c.name}"`,
      `"OFFLINE"`,
      `"${c.phone}"`,
      `"${c.email || "N/A"}"`,
      `"${c.address || "N/A"}"`,
      `"${c.registrationDate.toLocaleDateString("en-IN")}"`,
      c.totalOrders,
      Number(c.totalSpent).toFixed(2),
      `"${c.tier}"`,
      `"${c.status}"`,
      `"${c.preferredPayment}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `supermarket_offline_customers_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Avatar Initials Helper
  const getInitials = (name) => {
    if (!name) return "GS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="grocer-page-container">
      {/* ========================================================================= */}
      {/* 1. TOP HERO BANNER - STRICT OFFLINE CUSTOMER REGISTRATION DIRECTORY        */}
      {/* ========================================================================= */}
      <ErpPageBanner
        title="Offline Customers"
        subtitle="Directory of customers registered exclusively through the OFFLINE shopping flow • In-store walk-in shopper profiles"
        badges={["OFFLINE Customers Only", "In-Store Walk-In Shoppers", "Strictly Isolated from Online Orders"]}
        icon={<Users size={22} color="#ffffff" strokeWidth={2.4} />}
      />

      {/* Action Toast Feedback */}
      {actionToast && (
        <div
          style={{
            background: "#DCFCE7",
            border: "1px solid #86EFAC",
            color: "#166534",
            padding: "12px 18px",
            borderRadius: "14px",
            fontSize: "13.5px",
            fontWeight: "700",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(22, 101, 52, 0.08)",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FOUR HORIZONTAL OFFLINE CUSTOMER KPI CARDS                             */}
      {/* ========================================================================= */}
      <section className="pm-kpi-grid">
        {/* Card 1: Total Registered Offline Customers */}
        <div className="pm-kpi-card blue-theme">
          <div className="pm-kpi-icon-pill blue">
            <Users size={20} color="#2563EB" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{totalRegisteredCount}</h3>
            <span className="pm-kpi-label">Offline Registered Customers</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>Exclusively Offline Flow</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Offline Customers */}
        <div className="pm-kpi-card green-theme">
          <div className="pm-kpi-icon-pill green">
            <CheckCircle2 size={20} color="#059669" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{activeCustomersCount}</h3>
            <span className="pm-kpi-label">Active In-Store Shoppers</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>Visited in last 30 days</span>
            </div>
          </div>
        </div>

        {/* Card 3: New Offline Customers */}
        <div className="pm-kpi-card yellow-theme">
          <div className="pm-kpi-icon-pill yellow">
            <Sparkles size={20} color="#D97706" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{newCustomersCount}</h3>
            <span className="pm-kpi-label">New Walk-In Registrations</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">↑</span>
              <span>Joined recently</span>
            </div>
          </div>
        </div>

        {/* Card 4: Customers with Orders */}
        <div className="pm-kpi-card purple-theme">
          <div className="pm-kpi-icon-pill purple">
            <ShoppingBag size={20} color="#7C3AED" strokeWidth={2.4} />
          </div>
          <div className="pm-kpi-content">
            <h3 className="pm-kpi-number">{customersWithOrdersCount}</h3>
            <span className="pm-kpi-label">Shoppers with Purchase History</span>
            <div className="pm-kpi-trend green">
              <span className="trend-arrow">✓</span>
              <span>
                {totalRegisteredCount > 0
                  ? `${Math.round((customersWithOrdersCount / totalRegisteredCount) * 100)}% active shoppers`
                  : "0%"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SEARCH & FILTERS TOOLBAR                                               */}
      {/* ========================================================================= */}
      <section className="pm-toolbar-row">
        <div className="pm-toolbar-search">
          <Search size={18} className="pm-search-ico" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offline customers by name, mobile, email, or customer ID..."
          />
        </div>

        <div className="pm-toolbar-filters">
          {/* Status Filter */}
          <div className="pm-select-pill-wrap">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="pm-select-pill"
            >
              {STATUS_FILTERS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Registration Date Filter */}
          <div className="pm-select-pill-wrap">
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="pm-select-pill"
            >
              {DATE_FILTERS.map((df) => (
                <option key={df.value} value={df.value}>
                  {df.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tier Filter */}
          <div className="pm-select-pill-wrap">
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="pm-select-pill"
            >
              {TIER_FILTERS.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>

          {/* Add Offline Walk-in Customer Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "700",
              background: "#059669",
              color: "#FFFFFF",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.25)",
              whiteSpace: "nowrap",
            }}
          >
            <UserPlus size={16} />
            <span>+ Add Offline Customer</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. OFFLINE CUSTOMER DIRECTORY LISTING TABLE                               */}
      {/* ========================================================================= */}
      <div className="pm-catalog-card">
        <div className="pm-catalog-header">
          <div className="pm-catalog-title-group">
            <div className="pm-catalog-icon-box" style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}>
              <Users size={18} color="#FFFFFF" />
            </div>
            <div>
              <h3 className="pm-catalog-heading">
                Offline Customer Directory ({filteredCustomers.length} Shoppers Listed)
              </h3>
              <span style={{ fontSize: "11.5px", color: "#64748B", fontWeight: "600" }}>
                Strictly customers registered via OFFLINE shopping flow • Online registrations excluded
              </span>
            </div>
          </div>

          <div className="cm-header-controls" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Top Interactive Page Navigation Control */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "2px",
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: "8px",
                padding: "2px 6px",
              }}
            >
              <button
                type="button"
                className="pm-page-chevron"
                style={{ width: "24px", height: "24px", border: "none", background: "transparent", cursor: validCurrentPage <= 1 || viewAll ? "not-allowed" : "pointer" }}
                disabled={validCurrentPage <= 1 || viewAll}
                onClick={() => {
                  setViewAll(false);
                  setCurrentPage((p) => Math.max(1, p - 1));
                }}
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              <span
                style={{
                  fontSize: "12px",
                  color: "#334155",
                  fontWeight: 700,
                  padding: "0 6px",
                  whiteSpace: "nowrap",
                }}
              >
                {viewAll ? `All (${filteredCustomers.length})` : `Page ${validCurrentPage} of ${totalPages}`}
              </span>

              <button
                type="button"
                className="pm-page-chevron"
                style={{ width: "24px", height: "24px", border: "none", background: "transparent", cursor: validCurrentPage >= totalPages || viewAll ? "not-allowed" : "pointer" }}
                disabled={validCurrentPage >= totalPages || viewAll}
                onClick={() => {
                  setViewAll(false);
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                }}
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* View All / Paginate View Toggle Button */}
            <button
              type="button"
              className={`pm-view-all-btn ${viewAll ? "active" : ""}`}
              onClick={() => {
                setCurrentPage(1);
                setViewAll((prev) => !prev);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                border: "1px solid #CBD5E1",
                background: viewAll ? "#2563EB" : "#FFFFFF",
                color: viewAll ? "#FFFFFF" : "#334155",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={viewAll ? "Switch back to paginated view" : "View all customers on a single page"}
            >
              <span>{viewAll ? `Paginate (${pageSize}/p)` : "View All"}</span>
              <ArrowRight
                size={13}
                style={{
                  transform: viewAll ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>

            <button
              type="button"
              className="pm-action-btn primary"
              onClick={handleExportCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                background: "#059669",
                color: "#FFFFFF",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="pm-table-wrapper">
          {filteredCustomers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748B" }}>
              <Users size={36} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
              <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#0F172A" }}>
                No OFFLINE customer records found.
              </p>
              <span style={{ fontSize: "13px" }}>
                Customers registering through the in-store offline flow or added via the button above appear here.
              </span>
            </div>
          ) : (
            <table className="pm-products-table">
              <thead>
                <tr>
                  <th>CUSTOMER INFO</th>
                  <th>SOURCE</th>
                  <th>MOBILE & EMAIL</th>
                  <th>REGISTRATION DATE</th>
                  <th>IN-STORE ORDERS</th>
                  <th>TOTAL VERIFIED SPEND</th>
                  <th>LATEST VISIT</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "center" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((c) => {
                  const regFormatted = c.registrationDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  const latestFormatted = c.latestOrderDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={c.key}>
                      {/* Customer Info (Avatar & ID) */}
                      <td>
                        <div className="pm-cell-details">
                          <div className="cm-avatar-initials" style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}>
                            {getInitials(c.name)}
                          </div>
                          <div className="pm-details-text">
                            <span className="pm-name-main">{c.name}</span>
                            <span
                              style={{
                                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                fontSize: "11px",
                                color: "#059669",
                                fontWeight: 800,
                              }}
                            >
                              {c.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Registration Source Badge */}
                      <td>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "#ECFDF5",
                            color: "#059669",
                            border: "1px solid #A7F3D0",
                            letterSpacing: "0.4px",
                          }}
                        >
                          OFFLINE
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 700,
                              color: "#0F172A",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Phone size={12} color="#64748B" />
                            {c.phone ? formatPhone(c.phone) : "Not provided"}
                          </span>
                          {c.address ? (
                            <span style={{ fontSize: "11px", color: "#64748B" }} title={c.address}>
                              📍 {c.address}
                            </span>
                          ) : null}
                          {c.email ? (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#64748B",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <Mail size={11} /> {c.email}
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94A3B8" }}>No email provided</span>
                          )}
                        </div>
                      </td>

                      {/* Registration Date */}
                      <td>
                        <span style={{ fontSize: "12.5px", color: "#334155", fontWeight: 600 }}>
                          {regFormatted}
                        </span>
                      </td>

                      {/* Total In-Store Orders */}
                      <td>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 800,
                            background: "#F1F5F9",
                            color: "#0F172A",
                            padding: "3px 9px",
                            borderRadius: "6px",
                          }}
                        >
                          {c.totalOrders} {c.totalOrders === 1 ? "order" : "orders"}
                        </span>
                      </td>

                      {/* Total Verified Spend */}
                      <td>
                        <span className="pm-price-bold" style={{ color: "#059669" }}>
                          ₹{c.totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Latest Order Date */}
                      <td>
                        <span style={{ fontSize: "12px", color: "#475569" }}>
                          {c.totalOrders > 0 ? latestFormatted : "Walk-in Only"}
                        </span>
                      </td>

                      {/* Customer Account Status */}
                      <td>
                        <span className={`cm-status-pill ${c.status === "Active" ? "active" : "suspended"}`}>
                          {c.status === "Active" ? "✓ Active" : "✕ Suspended"}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="action-pill-btn refresh"
                            style={{ padding: "6px 12px", fontSize: "12px" }}
                            onClick={() => setActiveCustomer(c)}
                            title="View Complete Customer Profile & Offline Purchase History"
                          >
                            <Eye size={13} />
                            <span>View Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(c)}
                            style={{
                              padding: "6px 8px",
                              borderRadius: "8px",
                              border: "1px solid #FCA5A5",
                              background: "#FEF2F2",
                              color: "#DC2626",
                              cursor: "pointer",
                            }}
                            title="Delete Customer Record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 5. PAGINATION CONTROLS                                                    */}
        {/* ========================================================================= */}
        {filteredCustomers.length > 0 && (
          <div className="cm-pagination-wrap">
            <div className="cm-pagination-info">
              {viewAll
                ? `Showing all ${filteredCustomers.length} registered offline customers`
                : `Showing ${(validCurrentPage - 1) * pageSize + 1} to ${Math.min(
                    validCurrentPage * pageSize,
                    filteredCustomers.length
                  )} of ${filteredCustomers.length} registered offline customers (Page ${validCurrentPage} of ${totalPages})`}
            </div>

            <div className="cm-pagination-actions">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                  setViewAll(false);
                }}
                style={{
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#334155",
                  background: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>

              {/* Prev Button */}
              <button
                type="button"
                className="cm-page-btn"
                disabled={validCurrentPage <= 1 || viewAll}
                onClick={() => {
                  setViewAll(false);
                  setCurrentPage((p) => Math.max(1, p - 1));
                }}
                title="Previous Page"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  className={`pm-page-num ${validCurrentPage === pageNum && !viewAll ? "active" : ""}`}
                  onClick={() => {
                    setViewAll(false);
                    setCurrentPage(pageNum);
                  }}
                  title={`Go to page ${pageNum}`}
                  style={{
                    cursor: "pointer",
                    minWidth: "30px",
                    height: "30px",
                  }}
                >
                  {pageNum}
                </button>
              ))}

              {/* Next Button */}
              <button
                type="button"
                className="cm-page-btn"
                disabled={validCurrentPage >= totalPages || viewAll}
                onClick={() => {
                  setViewAll(false);
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                }}
                title="Next Page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. ADD WALK-IN OFFLINE CUSTOMER MODAL                                     */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="pm-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="pm-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px", padding: "26px" }}
          >
            <div className="pm-modal-header" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ padding: "8px", borderRadius: "10px", background: "#ECFDF5", color: "#059669" }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="pm-modal-title" style={{ margin: 0, fontSize: "17px" }}>
                    Register Offline Customer
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748B" }}>
                    Multi-tenant isolated • OFFLINE Registration Source
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="pm-modal-close"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOfflineCustomer}>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "5px" }}>
                    Customer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13.5px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "5px" }}>
                    Mobile Number (10 Digits starting with 6-9) *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="e.g. 9845012345"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13.5px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "5px" }}>
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="e.g. customer@example.com"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13.5px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "5px" }}>
                    Street Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="e.g. 12 Main St, Bangalore"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #CBD5E1",
                      fontSize: "13.5px",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "22px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="pm-btn-cancel"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCust}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "10px",
                    background: "#059669",
                    color: "#FFFFFF",
                    fontWeight: "700",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {creatingCust ? "Registering..." : "Save Offline Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. CUSTOMER PROFILE & OFFLINE ORDER HISTORY MODAL                         */}
      {/* ========================================================================= */}
      {activeCustomer && (
        <div className="pm-modal-overlay" onClick={() => setActiveCustomer(null)}>
          <div
            className="pm-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "620px", padding: "24px" }}
          >
            {/* Modal Header */}
            <div className="pm-modal-header" style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  className="cm-avatar-initials"
                  style={{ width: "48px", height: "48px", fontSize: "17px", background: "linear-gradient(135deg, #059669, #10B981)" }}
                >
                  {getInitials(activeCustomer.name)}
                </div>
                <div>
                  <h3 className="pm-modal-title" style={{ margin: 0, fontSize: "17px" }}>
                    {activeCustomer.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                    <span style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: "12px", color: "#059669", fontWeight: 800 }}>
                      {activeCustomer.id}
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>&bull;</span>
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "#ECFDF5",
                        color: "#059669",
                        border: "1px solid #A7F3D0",
                      }}
                    >
                      OFFLINE REGISTRATION
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748B" }}>&bull;</span>
                    <span className={`cm-status-pill ${activeCustomer.status === "Active" ? "active" : "suspended"}`}>
                      {activeCustomer.status === "Active" ? "✓ Active" : "✕ Suspended"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="pm-modal-close"
                onClick={() => setActiveCustomer(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Overview Card */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "18px",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px" }}>
                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                    Mobile Number
                  </span>
                  <strong style={{ color: "#0F172A" }}>
                    {activeCustomer.phone ? formatPhone(activeCustomer.phone) : "Not provided"}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                    Email Address
                  </span>
                  <strong style={{ color: "#0F172A" }}>{activeCustomer.email || "Not registered"}</strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                    Registration Date
                  </span>
                  <strong style={{ color: "#0F172A" }}>
                    {activeCustomer.registrationDate.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </div>

                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "11px", textTransform: "uppercase" }}>
                    Registration Channel
                  </span>
                  <strong style={{ color: "#059669" }}>Offline In-Store Walk-In</strong>
                </div>
              </div>

              {/* Status Toggle Action */}
              <div
                style={{
                  marginTop: "14px",
                  paddingTop: "12px",
                  borderTop: "1px dashed #CBD5E1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12px", color: "#475569" }}>
                  Account Status: <strong>{activeCustomer.status}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleCustomerStatus(activeCustomer)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1px solid",
                    background: activeCustomer.status === "Active" ? "#FEF2F2" : "#F0FDF4",
                    color: activeCustomer.status === "Active" ? "#DC2626" : "#16A34A",
                    borderColor: activeCustomer.status === "Active" ? "#FECACA" : "#BBF7D0",
                  }}
                >
                  {activeCustomer.status === "Active" ? "Suspend Account" : "Reactivate Account"}
                </button>
              </div>
            </div>

            {/* 3 Metric Stat Boxes */}
            <div className="cm-profile-stats-grid">
              <div className="cm-profile-stat-box">
                <span className="num">{activeCustomer.totalOrders}</span>
                <span className="lbl">In-Store Orders Placed</span>
              </div>

              <div className="cm-profile-stat-box">
                <span className="num" style={{ color: "#059669" }}>
                  ₹{activeCustomer.totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                <span className="lbl">Lifetime In-Store Spend</span>
              </div>

              <div className="cm-profile-stat-box">
                <span className="num" style={{ color: "#2563EB" }}>
                  ₹
                  {activeCustomer.totalOrders > 0
                    ? Math.round(activeCustomer.totalSpent / activeCustomer.totalOrders).toLocaleString("en-IN")
                    : "0"}
                </span>
                <span className="lbl">Avg Order Value</span>
              </div>
            </div>

            {/* Complete Offline Order History */}
            <h4
              style={{
                margin: "18px 0 10px",
                fontSize: "14px",
                fontWeight: 800,
                color: "#0F172A",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Offline Purchase History ({activeCustomer.orders.length} Records)</span>
              <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700 }}>
                In-Store Checkout Records
              </span>
            </h4>

            {activeCustomer.orders.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 16px",
                  background: "#F8FAFC",
                  borderRadius: "10px",
                  color: "#64748B",
                  fontSize: "13px",
                }}
              >
                No completed in-store orders recorded yet.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {activeCustomer.orders.map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 800, color: "#059669" }}>
                          #{ord.id}
                        </span>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: ord.paymentStatus === "Completed" ? "#DCFCE7" : "#FEF3C7",
                            color: ord.paymentStatus === "Completed" ? "#166534" : "#B45309",
                          }}
                        >
                          {ord.paymentStatus}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: "4px 0 2px",
                          fontSize: "11.5px",
                          color: "#475569",
                          maxWidth: "320px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {(ord.items || []).map((it) => `${it.name} (x${it.quantity})`).join(", ") || "General Grocery"}
                      </p>

                      <span style={{ fontSize: "10.5px", color: "#94A3B8" }}>
                        {ord.date.toLocaleDateString("en-IN")} &bull; {ord.paymentMethod}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A", display: "block" }}>
                        ₹{Number(ord.amount || 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: "10.5px", color: "#64748B" }}>
                        {ord.items?.length || 0} items
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button
                type="button"
                className="pm-btn-cancel"
                onClick={() => setActiveCustomer(null)}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
