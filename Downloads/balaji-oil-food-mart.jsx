import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, User, LogOut, Package,
  Droplet, MapPin, Phone, Mail, Lock, Edit3, ArrowUpDown, CheckCircle2,
  XCircle, Loader2, Boxes, ClipboardList, ShoppingBag, AlertCircle,
  PackageX, TrendingUp, CalendarDays, ChevronLeft, Pencil,
} from "lucide-react";

/* ============================================================================
   BALAJI OIL AND FOOD MART  —  single-file React storefront
   ----------------------------------------------------------------------------
   EASY-TO-CHANGE CONSTANTS. Edit these four before going live, then redeploy.
   ============================================================================ */
const WHATSAPP_NUMBER = "91XXXXXXXXXX"; // mart's number: country code 91, no + or spaces
const ADMIN_EMAIL = "admin@balajimart.com";
const ADMIN_PASSWORD = "change-me";
const STORE_NAME = "Balaji Oil and Food Mart";

/* ---- storage keys (single JSON array per key, all shared:true) ---- */
const K_PRODUCTS = "products";
const K_USERS = "users";
const K_ORDERS = "orders";

/* ============================================================================
   STORAGE LAYER  —  artifact window.storage key-value API (NOT localStorage)
   Every call is wrapped; missing keys throw, so we treat thrown reads as null.
   ============================================================================ */
async function readArray(key) {
  try {
    if (!window.storage) return null;
    const res = await window.storage.get(key, true);
    if (!res || res.value == null) return null;
    const parsed = JSON.parse(res.value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null; // key not set yet (or read failed) — caller seeds/defaults
  }
}

async function writeArray(key, value) {
  try {
    if (!window.storage) return false;
    const res = await window.storage.set(key, JSON.stringify(value), true);
    return !!res;
  } catch (e) {
    console.error("storage.set failed:", key, e);
    return false;
  }
}

// Append by re-reading the latest array first (last-write-wins on the whole key).
async function appendItem(key, item) {
  const current = (await readArray(key)) || [];
  const next = [...current, item];
  const ok = await writeArray(key, next);
  return ok ? next : null;
}

/* ============================================================================
   HELPERS
   ============================================================================ */
// NOT production-grade security — client-side only, fine as a login gate for a small store.
function hashPassword(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36) + ":" + str.length.toString(36);
}

const formatRupees = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim());
const isValidPhone = (p) => /^\d{10}$/.test(String(p).trim());
const uid = () =>
  (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now();

const CATEGORIES = ["All", "Oils", "Groceries"];
const STATUSES = ["Placed", "Confirmed", "Ready/Out for delivery", "Completed"];
const STATUS_STYLES = {
  "Placed": "bg-amber-100 text-amber-800 border-amber-200",
  "Confirmed": "bg-sky-100 text-sky-800 border-sky-200",
  "Ready/Out for delivery": "bg-violet-100 text-violet-800 border-violet-200",
  "Completed": "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function seedProducts() {
  const img = (name, bg) => `https://placehold.co/600x600/${bg}/fde68a?text=${encodeURIComponent(name)}`;
  return [
    { id: uid(), name: "Groundnut Oil", category: "Oils", price: 185, unit: "1 L", imageUrl: img("Groundnut Oil", "065f46"), description: "Cold-pressed groundnut (peanut) oil. Rich aroma, ideal for everyday cooking and frying.", inStock: true },
    { id: uid(), name: "Sunflower Oil", category: "Oils", price: 150, unit: "1 L", imageUrl: img("Sunflower Oil", "047857"), description: "Light, refined sunflower oil. Neutral taste for daily kitchen use.", inStock: true },
    { id: uid(), name: "Gingelly (Sesame) Oil", category: "Oils", price: 320, unit: "1 L", imageUrl: img("Gingelly Oil", "065f46"), description: "Traditional wood-pressed sesame oil. Nutty flavour for South Indian cooking.", inStock: true },
    { id: uid(), name: "Coconut Oil", category: "Oils", price: 220, unit: "500 ml", imageUrl: img("Coconut Oil", "047857"), description: "Pure coconut oil for cooking, hair and skin. Sweet, mild aroma.", inStock: true },
    { id: uid(), name: "Mustard Oil", category: "Oils", price: 195, unit: "1 L", imageUrl: img("Mustard Oil", "065f46"), description: "Pungent kachi ghani mustard oil. Great for pickles and North Indian dishes.", inStock: false },
    { id: uid(), name: "Sona Masoori Rice", category: "Groceries", price: 399, unit: "5 kg", imageUrl: img("Sona Masoori Rice", "92400e"), description: "Lightweight, aromatic everyday rice. Soft texture when cooked.", inStock: true },
    { id: uid(), name: "Toor Dal", category: "Groceries", price: 145, unit: "1 kg", imageUrl: img("Toor Dal", "b45309"), description: "Premium split pigeon peas. The base for sambar and dal.", inStock: true },
    { id: uid(), name: "Sugar", category: "Groceries", price: 48, unit: "1 kg", imageUrl: img("Sugar", "92400e"), description: "Fine refined sugar for tea, coffee and sweets.", inStock: true },
  ];
}

function buildWhatsAppMessage(order) {
  const lines = [];
  lines.push(`New order #${order.orderNo} — ${STORE_NAME}`);
  lines.push("");
  order.items.forEach((it, i) =>
    lines.push(`${i + 1}. ${it.name} (${it.unit}) x${it.qty} - ₹${it.price * it.qty}`)
  );
  lines.push("");
  lines.push(`Total: ₹${order.total}`);
  lines.push("");
  lines.push(`Type: ${order.deliveryType === "delivery" ? "Delivery" : "Pickup"}`);
  if (order.deliveryType === "delivery") lines.push(`Address: ${order.address}`);
  lines.push(`Name: ${order.customerName}`);
  lines.push(`Phone: ${order.customerPhone}`);
  return lines.join("\n");
}

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch (e) { return iso; }
};

/* ============================================================================
   SMALL SHARED UI PIECES
   ============================================================================ */
function ProductImage({ src, name, className }) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [src]);
  if (error || !src) {
    return (
      <div className={`flex items-center justify-center bg-emerald-100 font-serif text-2xl font-bold text-emerald-700 ${className || ""}`}>
        {(name && name.charAt(0).toUpperCase()) || "?"}
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setError(true)} className={className} />;
}

function Stepper({ value, onDec, onInc, full }) {
  return (
    <div className={`flex items-center rounded-xl border border-emerald-200 bg-white ${full ? "w-full justify-between" : ""}`}>
      <button type="button" onClick={onDec} aria-label="Decrease quantity"
        className="rounded-l-xl px-3 py-2 text-emerald-800 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-amber-300">
        <Minus className="h-4 w-4" />
      </button>
      <span className={`text-center text-sm font-bold text-stone-800 ${full ? "flex-1" : "w-7"}`}>{value}</span>
      <button type="button" onClick={onInc} aria-label="Increase quantity"
        className="rounded-r-xl px-3 py-2 text-emerald-800 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-amber-300">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function SearchBar({ value, onChange, className }) {
  return (
    <div className={`relative ${className || ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search oils, rice, dal…"
        aria-label="Search products"
        className="w-full rounded-full border border-emerald-200 bg-white py-2 pl-9 pr-4 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300"
      />
    </div>
  );
}

function Field({ label, type = "text", value, onChange, icon: Icon, placeholder, autoComplete }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border border-emerald-200 bg-white py-2.5 ${Icon ? "pl-9" : "pl-3"} pr-3 text-sm text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300`}
        />
      </div>
    </label>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || "bg-stone-100 text-stone-700 border-stone-200"}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-stone-800">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-stone-500">{subtitle}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${t.type === "error" ? "bg-red-600 text-white" : "bg-emerald-800 text-amber-50"}`}>
          {t.type === "error" ? <XCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function ModalShell({ open, onClose, children, maxW = "max-w-md" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div onClick={onClose} className="absolute inset-0 bg-stone-900 opacity-50" />
      <div className={`relative z-10 max-h-full w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${maxW}`}>
        {children}
      </div>
    </div>
  );
}

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-amber-50">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-emerald-900">
        <Droplet className="h-8 w-8 animate-pulse" fill="currentColor" />
      </div>
      <Loader2 className="mt-4 h-6 w-6 animate-spin text-emerald-700" />
      <p className="mt-2 text-sm text-stone-500">Loading {STORE_NAME}…</p>
    </div>
  );
}

/* ============================================================================
   HEADER
   ============================================================================ */
function Header({ user, cartCount, view, setView, onCartClick, onLoginClick, onLogout, search, setSearch }) {
  return (
    <header className="sticky top-0 z-30 bg-emerald-900 text-amber-50 shadow-lg">
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("shop")} className="flex shrink-0 items-center gap-2 focus:outline-none">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-emerald-900 shadow">
              <Droplet className="h-6 w-6" fill="currentColor" />
            </span>
            <span className="text-left leading-tight">
              <span className="block font-serif text-xl font-bold tracking-tight text-amber-50">Balaji</span>
              <span className="block text-xs uppercase tracking-widest text-amber-200">Oil &amp; Food Mart</span>
            </span>
          </button>

          <SearchBar value={search} onChange={setSearch} className="ml-4 hidden flex-1 md:block" />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setView(view === "orders" ? "shop" : "orders")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition hover:bg-emerald-800 ${view === "orders" ? "bg-emerald-800" : ""}`}
              aria-label="My orders"
            >
              <Package className="h-5 w-5" />
              <span className="hidden sm:inline">My Orders</span>
            </button>

            <button onClick={onCartClick} className="relative rounded-full p-2 transition hover:bg-emerald-800" aria-label="Open cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-bold text-emerald-900">
                  {cartCount}
                </span>
              )}
            </button>

            {user ? (
              <button onClick={onLogout} className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-sm font-bold text-emerald-900 transition hover:bg-amber-300" aria-label="Log out">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            ) : (
              <button onClick={onLoginClick} className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-sm font-bold text-emerald-900 transition hover:bg-amber-300">
                <User className="h-4 w-4" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>

        <SearchBar value={search} onChange={setSearch} className="mt-3 md:hidden" />
        {user && user.role === "customer" && (
          <p className="mt-2 text-xs text-amber-200">Signed in as {user.name}</p>
        )}
      </div>
    </header>
  );
}

/* ============================================================================
   HERO + FILTER BAR (shop view)
   ============================================================================ */
function Hero() {
  return (
    <section className="bg-gradient-to-br from-emerald-900 to-emerald-800 text-amber-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Your neighbourhood mart</p>
        <h1 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">Pure oils &amp; daily essentials, to your door</h1>
        <p className="mt-2 max-w-md text-sm text-emerald-100">Place your order on WhatsApp in seconds — choose home delivery or quick pickup.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-emerald-700 px-3 py-1">Cold-pressed oils</span>
          <span className="rounded-full bg-emerald-700 px-3 py-1">Fresh stock daily</span>
          <span className="rounded-full bg-emerald-700 px-3 py-1">Pay on delivery</span>
        </div>
      </div>
    </section>
  );
}

function FilterBar({ category, setCategory, sort, setSort, count }) {
  return (
    <div className="border-b border-emerald-100 bg-amber-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${category === c ? "bg-emerald-800 text-amber-50" : "border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-stone-500 sm:inline">{count} items</span>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-emerald-700" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products"
              className="appearance-none rounded-full border border-emerald-200 bg-white py-1.5 pl-8 pr-7 text-sm text-stone-700 outline-none focus:border-amber-400">
              <option value="default">Featured</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   PRODUCT CARD + CATALOG
   ============================================================================ */
function ProductCard({ product, onAdd }) {
  const [qty, setQty] = useState(1);
  const out = !product.inStock;
  return (
    <div className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${out ? "border-stone-200" : "border-emerald-100"}`}>
      <div className="relative aspect-square w-full overflow-hidden bg-emerald-50">
        <ProductImage src={product.imageUrl} name={product.name} className={`h-full w-full object-cover ${out ? "opacity-60" : ""}`} />
        <span className="absolute left-2 top-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-amber-50">{product.category}</span>
        {out && (
          <span className="absolute right-2 top-2 rounded-full bg-stone-700 px-2 py-0.5 text-xs font-semibold text-white">Out of stock</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="font-serif text-base font-semibold leading-tight text-stone-800">{product.name}</h3>
        <p className="mt-0.5 text-xs text-stone-500">{product.unit}</p>
        <p className="mt-1 hidden text-xs leading-snug text-stone-500 sm:block">{product.description}</p>
        <div className="mt-auto pt-3">
          <span className="font-serif text-lg font-bold text-emerald-900">{formatRupees(product.price)}</span>
          {out ? (
            <button disabled className="mt-2 w-full cursor-not-allowed rounded-xl bg-stone-100 py-2 text-sm font-semibold text-stone-400">
              Unavailable
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <Stepper full value={qty} onDec={() => setQty((q) => Math.max(1, q - 1))} onInc={() => setQty((q) => q + 1)} />
              <button onClick={() => { onAdd(product, qty); setQty(1); }}
                className="flex w-full items-center justify-center gap-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300">
                <Plus className="h-4 w-4" /> Add to cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Catalog({ products, onAdd }) {
  if (products.length === 0) {
    return (
      <EmptyState icon={Search} title="No products found"
        subtitle="Try a different search term or switch the category filter to see more items." />
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {products.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
      </div>
    </div>
  );
}

/* ============================================================================
   CART DRAWER
   ============================================================================ */
function CartDrawer({ open, onClose, cart, total, onInc, onDec, onRemove, onCheckout }) {
  return (
    <>
      <div onClick={onClose}
        className={`fixed inset-0 z-40 bg-stone-900 transition-opacity duration-300 ${open ? "opacity-50" : "pointer-events-none opacity-0"}`} />
      <aside className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-amber-50 shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}>
        <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-900 px-4 py-4 text-amber-50">
          <h2 className="flex items-center gap-2 font-serif text-lg font-bold">
            <ShoppingCart className="h-5 w-5" /> Your Cart
          </h2>
          <button onClick={onClose} aria-label="Close cart" className="rounded-full p-1 hover:bg-emerald-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Your cart is empty"
              subtitle="Add some oils or groceries to get started — they'll show up here." />
          ) : (
            <div className="space-y-3">
              {cart.map((line) => (
                <div key={line.id} className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-800">{line.name}</p>
                    <p className="text-xs text-stone-500">{line.unit} · {formatRupees(line.price)}</p>
                    <div className="mt-2">
                      <Stepper value={line.qty} onDec={() => onDec(line.id)} onInc={() => onInc(line.id)} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-semibold text-emerald-900">{formatRupees(line.price * line.qty)}</span>
                    <button onClick={() => onRemove(line.id)} aria-label={`Remove ${line.name}`} className="text-stone-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-emerald-100 bg-amber-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-stone-600">Total</span>
              <span className="font-serif text-2xl font-bold text-emerald-900">{formatRupees(total)}</span>
            </div>
            <button onClick={onCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 font-bold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-amber-300">
              <ShoppingBag className="h-5 w-5" /> Checkout
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ============================================================================
   AUTH MODAL (login / register)
   ============================================================================ */
function AuthModal({ open, mode, setMode, onLogin, onRegister, onClose }) {
  const blank = { name: "", phone: "", email: "", password: "", confirm: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setForm(blank); setError(""); setBusy(false); }
  }, [open, mode]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError("");
    setBusy(true);
    const res = mode === "login"
      ? await onLogin(form.email, form.password)
      : await onRegister(form);
    setBusy(false);
    if (res && !res.ok) setError(res.error);
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-emerald-900">
              <Droplet className="h-6 w-6" fill="currentColor" />
            </span>
            <div>
              <h2 className="font-serif text-xl font-bold text-stone-800">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-xs text-stone-500">
                {mode === "login" ? "Sign in to order from Balaji Mart" : "Quick sign-up to start ordering"}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-stone-400 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {mode === "register" && (
            <>
              <Field label="Full name" value={form.name} onChange={(v) => upd("name", v)} icon={User} placeholder="e.g. Ravi Kumar" autoComplete="name" />
              <Field label="Phone (10 digits)" value={form.phone} onChange={(v) => upd("phone", v)} icon={Phone} placeholder="9876543210" autoComplete="tel" />
            </>
          )}
          <Field label="Email" type="email" value={form.email} onChange={(v) => upd("email", v)} icon={Mail} placeholder="you@example.com" autoComplete="email" />
          <Field label="Password" type="password" value={form.password} onChange={(v) => upd("password", v)} icon={Lock} placeholder="At least 6 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode === "register" && (
            <Field label="Confirm password" type="password" value={form.confirm} onChange={(v) => upd("confirm", v)} icon={Lock} placeholder="Re-enter password" autoComplete="new-password" />
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <button onClick={submit} disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="mt-4 text-center text-sm text-stone-500">
          {mode === "login" ? "New to Balaji Mart? " : "Already have an account? "}
          <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="font-semibold text-emerald-700 hover:underline">
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </ModalShell>
  );
}

/* ============================================================================
   CHECKOUT MODAL
   ============================================================================ */
function CheckoutModal({ open, onClose, user, cart, total, onPlace }) {
  const [deliveryType, setDeliveryType] = useState("delivery");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDeliveryType("delivery");
      setAddress((user && user.address) || "");
      setError("");
      setBusy(false);
    }
  }, [open, user]);

  const place = async () => {
    if (deliveryType === "delivery" && !address.trim()) {
      setError("Please enter a delivery address.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await onPlace({ deliveryType, address: address.trim() });
    setBusy(false);
    if (res && !res.ok) setError(res.error || "Could not place the order. Please try again.");
  };

  if (!user) return null;

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-stone-800">Confirm your order</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 text-stone-400 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-emerald-100 bg-white p-3 text-sm">
          {cart.map((line) => (
            <div key={line.id} className="flex justify-between">
              <span className="text-stone-700">{line.name} <span className="text-stone-400">({line.unit}) ×{line.qty}</span></span>
              <span className="font-medium text-stone-800">{formatRupees(line.price * line.qty)}</span>
            </div>
          ))}
        </div>

        <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-stone-500">Name</span><span className="font-medium text-stone-800">{user.name}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-stone-500">Phone</span><span className="font-medium text-stone-800">{user.phone}</span></div>
        </div>

        <p className="mb-2 text-sm font-medium text-stone-700">How would you like to receive it?</p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {["delivery", "pickup"].map((t) => (
            <button key={t} onClick={() => setDeliveryType(t)}
              className={`rounded-xl border py-2.5 text-sm font-semibold capitalize transition ${deliveryType === t ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"}`}>
              {t === "delivery" ? "Home delivery" : "Store pickup"}
            </button>
          ))}
        </div>

        {deliveryType === "delivery" && (
          <label className="mb-4 block">
            <span className="mb-1 flex items-center gap-1 text-sm font-medium text-stone-700">
              <MapPin className="h-4 w-4 text-emerald-600" /> Delivery address
            </span>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
              placeholder="House no, street, area, landmark, pincode"
              className="w-full rounded-xl border border-emerald-200 bg-white p-3 text-sm text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300" />
          </label>
        )}

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between border-t border-emerald-100 pt-3">
          <span className="text-stone-600">Total payable</span>
          <span className="font-serif text-2xl font-bold text-emerald-900">{formatRupees(total)}</span>
        </div>

        <button onClick={place} disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 font-bold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingBag className="h-5 w-5" />}
          Place Order on WhatsApp
        </button>
        <p className="mt-2 text-center text-xs text-stone-400">Opens WhatsApp with your order pre-filled for the mart to confirm.</p>
      </div>
    </ModalShell>
  );
}

/* ============================================================================
   SUCCESS MODAL
   ============================================================================ */
function SuccessModal({ order, onClose, onViewOrders }) {
  if (!order) return null;
  return (
    <ModalShell open={!!order} onClose={onClose}>
      <div className="p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-stone-800">Order placed!</h2>
        <p className="mt-2 text-sm text-stone-600">
          Your order <span className="font-bold text-emerald-800">{order.orderNo}</span> has been sent to {STORE_NAME} on WhatsApp.
        </p>
        <div className="mx-auto mt-4 max-w-xs rounded-xl bg-emerald-50 p-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-stone-500">Total</span><span className="font-semibold text-stone-800">{formatRupees(order.total)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-stone-500">Type</span><span className="font-semibold capitalize text-stone-800">{order.deliveryType}</span></div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onViewOrders} className="rounded-xl bg-emerald-700 py-3 font-bold text-white transition hover:bg-emerald-800">View my orders</button>
          <button onClick={onClose} className="rounded-xl border border-emerald-200 bg-white py-3 font-semibold text-emerald-800 transition hover:bg-emerald-50">Continue shopping</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ============================================================================
   MY ORDERS (customer)
   ============================================================================ */
function OrderCard({ order }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-serif text-lg font-bold text-emerald-900">{order.orderNo}</p>
          <p className="text-xs text-stone-500">{fmtDate(order.timestamp)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="my-3 space-y-1 border-y border-emerald-50 py-3 text-sm">
        {order.items.map((it, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-stone-700">{it.name} <span className="text-stone-400">({it.unit}) ×{it.qty}</span></span>
            <span className="font-medium text-stone-800">{formatRupees(it.price * it.qty)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-stone-500">
          <span className="capitalize">{order.deliveryType}</span>
          {order.deliveryType === "delivery" && order.address && (
            <span className="block max-w-xs text-xs text-stone-400">{order.address}</span>
          )}
        </div>
        <span className="font-serif text-lg font-bold text-emerald-900">{formatRupees(order.total)}</span>
      </div>
    </div>
  );
}

function MyOrders({ orders, onShop }) {
  if (orders.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title="No orders yet"
        subtitle="When you place an order it will appear here so you can track its status."
        action={<button onClick={onShop} className="rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800">Start shopping</button>} />
    );
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h2 className="font-serif text-2xl font-bold text-stone-800">My Orders</h2>
      {orders.map((o) => <OrderCard key={o.id} order={o} />)}
    </div>
  );
}

/* ============================================================================
   ADMIN — product form, manage rows, orders
   ============================================================================ */
function ProductForm({ editing, onSave, onCancel }) {
  const blank = { name: "", category: "Oils", price: "", unit: "1 L", imageUrl: "", description: "", inStock: true };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) setForm({ ...editing, price: String(editing.price) });
    else setForm(blank);
    setError("");
  }, [editing]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const name = form.name.trim();
    const priceNum = Number(form.price);
    if (!name) { setError("Product name is required."); return; }
    if (form.price === "" || isNaN(priceNum) || priceNum <= 0) { setError("Enter a valid price greater than 0."); return; }
    setError("");
    setBusy(true);
    const res = await onSave({
      name,
      category: form.category,
      price: priceNum,
      unit: form.unit.trim() || "1 unit",
      imageUrl: form.imageUrl.trim(),
      description: form.description.trim(),
      inStock: !!form.inStock,
    }, editing ? editing.id : null);
    setBusy(false);
    if (res && res.ok) setForm(blank);
    else if (res) setError(res.error || "Could not save the product.");
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-stone-800">{editing ? "Edit product" : "Add a product"}</h3>
        {editing && (
          <button onClick={onCancel} className="text-sm font-semibold text-stone-500 hover:text-stone-700">Cancel edit</button>
        )}
      </div>
      <div className="space-y-3">
        <Field label="Name" value={form.name} onChange={(v) => upd("name", v)} placeholder="e.g. Groundnut Oil" />
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Category</span>
            <select value={form.category} onChange={(e) => upd("category", e.target.value)}
              className="w-full rounded-xl border border-emerald-200 bg-white py-2.5 px-3 text-sm text-stone-800 outline-none focus:border-amber-400">
              <option>Oils</option>
              <option>Groceries</option>
            </select>
          </label>
          <Field label="Price (₹)" type="number" value={form.price} onChange={(v) => upd("price", v)} placeholder="180" />
        </div>
        <Field label="Unit" value={form.unit} onChange={(v) => upd("unit", v)} placeholder="1 L, 500 g, 1 kg, 1 pack" />
        <Field label="Image URL" value={form.imageUrl} onChange={(v) => upd("imageUrl", v)} placeholder="https://… (optional)" />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Description</span>
          <textarea value={form.description} onChange={(e) => upd("description", e.target.value)} rows={2}
            placeholder="Short description shown on the product card"
            className="w-full rounded-xl border border-emerald-200 bg-white p-3 text-sm text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300" />
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={form.inStock} onChange={(e) => upd("inStock", e.target.checked)}
            className="h-4 w-4 rounded border-emerald-300 text-emerald-700 focus:ring-amber-300" />
          <span className="text-sm font-medium text-stone-700">In stock</span>
        </label>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
          </div>
        )}

        <button onClick={save} disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "Save changes" : "Add product"}
        </button>
      </div>
    </div>
  );
}

function ProductManageRow({ p, onUpdatePrice, onToggleStock, onEdit, onDelete }) {
  const [price, setPrice] = useState(String(p.price));
  const [confirming, setConfirming] = useState(false);

  useEffect(() => setPrice(String(p.price)), [p.price]);

  const commitPrice = () => {
    const n = Number(price);
    if (!isNaN(n) && n > 0 && n !== p.price) onUpdatePrice(p.id, n);
    else setPrice(String(p.price));
  };

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${p.inStock ? "border-stone-200 bg-white" : "border-red-200 bg-red-50"}`}>
      <ProductImage src={p.imageUrl} name={p.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-stone-800">{p.name}</p>
        <p className="text-xs text-stone-500">{p.category} · {p.unit}</p>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-sm text-stone-400">₹</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          type="number"
          aria-label={`Price for ${p.name}`}
          className="w-16 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300"
        />
      </div>

      <button onClick={() => onToggleStock(p.id)}
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.inStock ? "bg-emerald-100 text-emerald-700" : "bg-stone-200 text-stone-600"}`}
        aria-label="Toggle stock">
        {p.inStock ? "In stock" : "Out"}
      </button>

      <button onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-emerald-700">
        <Pencil className="h-4 w-4" />
      </button>

      {confirming ? (
        <div className="flex items-center gap-1">
          <button onClick={() => onDelete(p.id)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white">Delete</button>
          <button onClick={() => setConfirming(false)} className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-600">No</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} aria-label={`Delete ${p.name}`} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function AdminProducts({ products, onSaveProduct, onUpdatePrice, onToggleStock, onDeleteProduct }) {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const save = async (data, id) => {
    const res = await onSaveProduct(data, id);
    if (res && res.ok) setEditing(null);
    return res;
  };

  const startEdit = (p) => {
    setEditing(p);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-4">
          <ProductForm editing={editing} onSave={save} onCancel={() => setEditing(null)} />
        </div>
      </div>
      <div className="lg:col-span-3">
        <div className="mb-3">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={Boxes} title="No products" subtitle="Add your first product using the form on the left." />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <ProductManageRow key={p.id} p={p}
                onUpdatePrice={onUpdatePrice} onToggleStock={onToggleStock}
                onEdit={startEdit} onDelete={onDeleteProduct} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminOrderCard({ o, onUpdateStatus }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-serif text-lg font-bold text-emerald-900">{o.orderNo}</p>
          <p className="text-xs text-stone-500">{fmtDate(o.timestamp)}</p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <div className="mt-2 rounded-xl bg-stone-50 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-stone-800"><User className="h-4 w-4 text-emerald-600" /> {o.customerName}</div>
        <div className="mt-0.5 flex items-center gap-2 text-stone-600"><Phone className="h-4 w-4 text-emerald-600" /> {o.customerPhone}</div>
        <div className="mt-0.5 flex items-start gap-2 text-stone-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span className="capitalize">{o.deliveryType}{o.deliveryType === "delivery" && o.address ? ` — ${o.address}` : ""}</span>
        </div>
      </div>

      <div className="my-3 space-y-1 border-y border-stone-100 py-2 text-sm">
        {o.items.map((it, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-stone-700">{it.name} <span className="text-stone-400">({it.unit}) ×{it.qty}</span></span>
            <span className="font-medium text-stone-800">{formatRupees(it.price * it.qty)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-serif text-lg font-bold text-emerald-900">{formatRupees(o.total)}</span>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-stone-500">Status</span>
          <select value={o.status} onChange={(e) => onUpdateStatus(o.id, e.target.value)}
            className="rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-sm font-medium text-stone-800 outline-none focus:border-amber-400">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function AdminOrders({ orders, onUpdateStatus }) {
  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [orders]
  );
  if (sorted.length === 0) {
    return <EmptyState icon={ClipboardList} title="No orders yet" subtitle="Customer orders will appear here as they come in." />;
  }
  return (
    <div className="space-y-3">
      {sorted.map((o) => <AdminOrderCard key={o.id} o={o} onUpdateStatus={onUpdateStatus} />)}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone] || tones.green}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-stone-800">{value}</p>
        <p className="text-xs text-stone-500">{label}</p>
      </div>
    </div>
  );
}

function Admin({ products, orders, toasts, onSaveProduct, onUpdatePrice, onToggleStock, onDeleteProduct, onUpdateStatus, onLogout }) {
  const [tab, setTab] = useState("products");

  const totalProducts = products.length;
  const outOfStock = products.filter((p) => !p.inStock).length;
  const totalOrders = orders.length;
  const today = new Date().toDateString();
  const ordersToday = orders.filter((o) => {
    try { return new Date(o.timestamp).toDateString() === today; } catch (e) { return false; }
  }).length;

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="sticky top-0 z-30 bg-emerald-900 text-amber-50 shadow-lg">
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-emerald-900">
              <Droplet className="h-6 w-6" fill="currentColor" />
            </span>
            <div className="leading-tight">
              <span className="block font-serif text-lg font-bold">Balaji Mart</span>
              <span className="block text-xs uppercase tracking-widest text-amber-200">Admin dashboard</span>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-amber-300">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Boxes} label="Total products" value={totalProducts} tone="green" />
          <StatCard icon={PackageX} label="Out of stock" value={outOfStock} tone="red" />
          <StatCard icon={ClipboardList} label="Total orders" value={totalOrders} tone="blue" />
          <StatCard icon={CalendarDays} label="Orders today" value={ordersToday} tone="amber" />
        </div>

        <div className="my-6 flex gap-2 border-b border-stone-200">
          {[
            { id: "products", label: "Products", icon: Boxes },
            { id: "orders", label: "Orders", icon: ClipboardList },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "border-emerald-700 text-emerald-800" : "border-transparent text-stone-500 hover:text-stone-700"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "products" ? (
          <AdminProducts products={products}
            onSaveProduct={onSaveProduct} onUpdatePrice={onUpdatePrice}
            onToggleStock={onToggleStock} onDeleteProduct={onDeleteProduct} />
        ) : (
          <AdminOrders orders={orders} onUpdateStatus={onUpdateStatus} />
        )}
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}

/* ============================================================================
   ROOT APP
   ============================================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [cart, setCart] = useState([]); // session-only: [{id,name,unit,price,qty}]

  const [view, setView] = useState("shop"); // 'shop' | 'orders'
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const [toasts, setToasts] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("default");

  /* ---- toast helper ---- */
  const addToast = (message, type = "success") => {
    const id = uid();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  /* ---- initial load + seed ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let p = await readArray(K_PRODUCTS);
        if (p === null || p.length === 0) { p = seedProducts(); await writeArray(K_PRODUCTS, p); }
        let u = await readArray(K_USERS);
        if (u === null) { u = []; await writeArray(K_USERS, u); }
        let o = await readArray(K_ORDERS);
        if (o === null) { o = []; await writeArray(K_ORDERS, o); }
        if (mounted) { setProducts(p); setUsers(u); setOrders(o); }
      } catch (e) {
        console.error("init failed", e);
        if (mounted) { setProducts(seedProducts()); setLoadError(true); }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* ---- derived ---- */
  const visibleProducts = useMemo(() => {
    let list = products.slice();
    if (category !== "All") list = list.filter((p) => p.category === category);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (sort === "low") list.sort((a, b) => a.price - b.price);
    else if (sort === "high") list.sort((a, b) => b.price - a.price);
    return list;
  }, [products, category, search, sort]);

  const myOrders = useMemo(
    () => orders
      .filter((o) => currentUser && o.userId === currentUser.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [orders, currentUser]
  );

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

  /* ---- auth ---- */
  const closeAuthAndReplay = () => {
    setAuthOpen(false);
    if (pendingAction) { const action = pendingAction; setPendingAction(null); setTimeout(action, 0); }
  };

  const handleLogin = async (email, password) => {
    const e = String(email).trim().toLowerCase();
    if (!e || !password) return { ok: false, error: "Enter your email and password." };
    if (e === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      setCurrentUser({ id: "admin", name: "Admin", role: "admin", email: ADMIN_EMAIL });
      setAuthOpen(false); setPendingAction(null); setCart([]);
      addToast("Signed in as admin");
      return { ok: true };
    }
    const list = (await readArray(K_USERS)) || [];
    const user = list.find((u) => u.email.toLowerCase() === e);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return { ok: false, error: "Incorrect email or password." };
    }
    setCurrentUser(user);
    closeAuthAndReplay();
    addToast(`Welcome back, ${user.name.split(" ")[0]}!`);
    return { ok: true };
  };

  const handleRegister = async (form) => {
    const name = form.name.trim();
    if (!name || !form.phone.trim() || !form.email.trim() || !form.password || !form.confirm) {
      return { ok: false, error: "Please fill in all fields." };
    }
    if (!isValidEmail(form.email)) return { ok: false, error: "Enter a valid email address." };
    if (!isValidPhone(form.phone)) return { ok: false, error: "Phone number must be exactly 10 digits." };
    if (form.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    if (form.password !== form.confirm) return { ok: false, error: "Passwords do not match." };

    const list = (await readArray(K_USERS)) || [];
    if (list.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      return { ok: false, error: "An account with this email already exists." };
    }
    const user = {
      id: uid(),
      name,
      phone: form.phone.trim(),
      email: form.email.trim(),
      passwordHash: hashPassword(form.password),
      role: "customer",
      address: "",
    };
    const next = await appendItem(K_USERS, user);
    if (!next) return { ok: false, error: "Could not create your account. Please try again." };
    setUsers(next);
    setCurrentUser(user);
    closeAuthAndReplay();
    addToast(`Welcome, ${user.name.split(" ")[0]}!`);
    return { ok: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setView("shop");
    setCart([]);
    setCartOpen(false);
    addToast("Signed out");
  };

  /* ---- gate actions behind login ---- */
  const requireAuth = (action) => {
    if (currentUser && currentUser.role === "customer") { action(); return; }
    if (currentUser && currentUser.role === "admin") { addToast("Switch to a customer account to shop", "error"); return; }
    setPendingAction(() => action);
    setAuthMode("login");
    setAuthOpen(true);
  };

  /* ---- cart ---- */
  const addToCart = (product, qty) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { id: product.id, name: product.name, unit: product.unit, price: product.price, qty }];
    });
    addToast(`Added ${product.name} to cart`);
  };

  const handleAddToCart = (product, qty) => {
    if (!product.inStock) { addToast("That item is out of stock", "error"); return; }
    requireAuth(() => addToCart(product, qty));
  };

  const incLine = (id) => setCart((p) => p.map((i) => i.id === id ? { ...i, qty: i.qty + 1 } : i));
  const decLine = (id) => setCart((p) => p.map((i) => i.id === id ? { ...i, qty: Math.max(1, i.qty - 1) } : i));
  const removeLine = (id) => setCart((p) => p.filter((i) => i.id !== id));

  const openCheckout = () => {
    if (cart.length === 0) { addToast("Your cart is empty", "error"); return; }
    requireAuth(() => { setCartOpen(false); setCheckoutOpen(true); });
  };

  /* ---- place order ---- */
  const placeOrder = async ({ deliveryType, address }) => {
    if (cart.length === 0) return { ok: false, error: "Your cart is empty." };
    if (!currentUser) return { ok: false, error: "Please sign in to place an order." };

    const currentOrders = (await readArray(K_ORDERS)) || [];
    const orderNo = `BOM-${1042 + currentOrders.length}`;
    const order = {
      id: uid(),
      orderNo,
      userId: currentUser.id,
      customerName: currentUser.name,
      customerPhone: currentUser.phone || "",
      deliveryType,
      address: deliveryType === "delivery" ? address : "",
      items: cart.map((i) => ({ name: i.name, unit: i.unit, qty: i.qty, price: i.price })),
      total: cartTotal,
      status: "Placed",
      timestamp: new Date().toISOString(),
    };

    const next = await appendItem(K_ORDERS, order);
    if (!next) return { ok: false, error: "Could not save your order. Please try again." };
    setOrders(next);

    // remember delivery address on the customer's profile for next time
    if (deliveryType === "delivery" && address && currentUser.role === "customer" && currentUser.address !== address) {
      const list = (await readArray(K_USERS)) || [];
      const updatedUsers = list.map((u) => u.id === currentUser.id ? { ...u, address } : u);
      if (await writeArray(K_USERS, updatedUsers)) {
        setUsers(updatedUsers);
        setCurrentUser((cu) => cu ? { ...cu, address } : cu);
      }
    }

    const msg = buildWhatsAppMessage(order);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");

    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setLastOrder(order);
    addToast(`Order ${orderNo} placed`);
    return { ok: true };
  };

  /* ---- admin product/order ops ---- */
  const saveProduct = async (data, editingId) => {
    const current = (await readArray(K_PRODUCTS)) || [];
    let next;
    if (editingId) next = current.map((p) => p.id === editingId ? { ...p, ...data } : p);
    else next = [...current, { id: uid(), ...data }];
    if (await writeArray(K_PRODUCTS, next)) {
      setProducts(next);
      addToast(editingId ? "Product saved" : "Product added");
      return { ok: true };
    }
    return { ok: false, error: "Could not save the product." };
  };

  const updateProductPrice = async (id, price) => {
    const current = (await readArray(K_PRODUCTS)) || [];
    const next = current.map((p) => p.id === id ? { ...p, price } : p);
    if (await writeArray(K_PRODUCTS, next)) { setProducts(next); addToast("Price updated"); }
    else addToast("Could not update price", "error");
  };

  const toggleStock = async (id) => {
    const current = (await readArray(K_PRODUCTS)) || [];
    const next = current.map((p) => p.id === id ? { ...p, inStock: !p.inStock } : p);
    if (await writeArray(K_PRODUCTS, next)) { setProducts(next); addToast("Stock updated"); }
    else addToast("Could not update stock", "error");
  };

  const deleteProduct = async (id) => {
    const current = (await readArray(K_PRODUCTS)) || [];
    const next = current.filter((p) => p.id !== id);
    if (await writeArray(K_PRODUCTS, next)) { setProducts(next); addToast("Product deleted"); }
    else addToast("Could not delete product", "error");
  };

  const updateOrderStatus = async (id, status) => {
    const current = (await readArray(K_ORDERS)) || [];
    const next = current.map((o) => o.id === id ? { ...o, status } : o);
    if (await writeArray(K_ORDERS, next)) { setOrders(next); addToast("Status updated"); }
    else addToast("Could not update status", "error");
  };

  /* ---- render ---- */
  if (loading) return <FullScreenLoader />;

  if (currentUser && currentUser.role === "admin") {
    return (
      <Admin
        products={products} orders={orders} toasts={toasts}
        onSaveProduct={saveProduct} onUpdatePrice={updateProductPrice}
        onToggleStock={toggleStock} onDeleteProduct={deleteProduct}
        onUpdateStatus={updateOrderStatus} onLogout={logout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-amber-50">
      <Header
        user={currentUser} cartCount={cartCount} view={view} setView={setView}
        onCartClick={() => setCartOpen(true)}
        onLoginClick={() => { setAuthMode("login"); setAuthOpen(true); }}
        onLogout={logout} search={search} setSearch={setSearch}
      />

      {loadError && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Saved data couldn't be loaded, so you're seeing sample products. Changes may not persist this session.
          </div>
        </div>
      )}

      <main>
        {view === "shop" ? (
          <>
            <Hero />
            <FilterBar category={category} setCategory={setCategory} sort={sort} setSort={setSort} count={visibleProducts.length} />
            <Catalog products={visibleProducts} onAdd={handleAddToCart} />
          </>
        ) : (
          <MyOrders orders={myOrders} onShop={() => setView("shop")} />
        )}
      </main>

      <footer className="mt-8 border-t border-emerald-100 bg-emerald-900 text-amber-100">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm">
          <p className="font-serif text-base font-bold text-amber-50">{STORE_NAME}</p>
          <p className="mt-1 text-amber-200">Fresh oils &amp; daily essentials · Order on WhatsApp · Delivery &amp; pickup</p>
        </div>
      </footer>

      <CartDrawer
        open={cartOpen} onClose={() => setCartOpen(false)}
        cart={cart} total={cartTotal} onInc={incLine} onDec={decLine}
        onRemove={removeLine} onCheckout={openCheckout}
      />

      <AuthModal
        open={authOpen} mode={authMode} setMode={setAuthMode}
        onLogin={handleLogin} onRegister={handleRegister}
        onClose={() => { setAuthOpen(false); setPendingAction(null); }}
      />

      <CheckoutModal
        open={checkoutOpen} onClose={() => setCheckoutOpen(false)}
        user={currentUser} cart={cart} total={cartTotal} onPlace={placeOrder}
      />

      <SuccessModal
        order={lastOrder}
        onClose={() => setLastOrder(null)}
        onViewOrders={() => { setLastOrder(null); setView("orders"); }}
      />

      <Toasts toasts={toasts} />
    </div>
  );
}
