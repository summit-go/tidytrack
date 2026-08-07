import React, { useState, useContext } from "react";
import {
  ArrowLeft,
  Home,
  MoreVertical,
  Languages,
  MessageCircle,
  Users,
  LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { APP_VERSION } from "../lib/constants.js";
import { isTextTranslateConfigured } from "../lib/translation.js";
import { useUnreadCount } from "../hooks/useUnreadCount.js";
import { useLocale } from "../contexts/LocaleContext.jsx";
import { PreviewContext } from "../contexts/PreviewContext.jsx";
import { NotificationBell } from "./NotificationBell.jsx";

export function Header({
  name,
  onSignOut,
  role,
  employee,
  onOpenMessages,
  onLogoClick,
  onBack,
  onOpenWhosHere,
  menuItems,
  onNotificationNavigate,
  cleanerView = false,
}) {
  // Messages icon in header for all signed-in roles (cleaner/manager/owner)
  const showMessagesIcon = !!(onOpenMessages && employee);
  // Cleaners get a bare header (just the logo) — their language / messages /
  // who's-here / sign-out live in the bottom "More" tab instead. Owners and
  // managers keep the ⋯ menu (it also holds their admin tools). cleanerView is
  // forced by the cleaner shell so this holds even when an owner is
  // previewing-as-cleaner or a Beta account (whose real role is owner/manager).
  const isCleaner = cleanerView || (role !== "owner" && role !== "manager");
  const unread = useUnreadCount({
    employee: showMessagesIcon ? employee : null,
  });
  const { locale, setLocale } = useLocale();
  const previewCtx = useContext(PreviewContext);
  const translateConfigured = isTextTranslateConfigured();
  // Overflow "⋯" menu — holds occasional owner tools so they don't
  // clutter the home screen. Only rendered when menuItems are provided.
  const [menuOpen, setMenuOpen] = useState(false);

  const logoBlock = (
    <div className="flex items-center gap-3">
      {/* Logo directly on the header (no chip), with a small gold HOME badge
         so it's obvious that tapping the logo takes you home. */}
      <div className="relative shrink-0">
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="h-10 w-auto object-contain"
        />
        <span
          className="absolute -bottom-1 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-stone-900 flex items-center justify-center border-2 shadow-sm"
          style={{ borderColor: "#3E5C76" }}
        >
          <Home size={11} />
        </span>
      </div>
      <div className="text-stone-50">
        <div
          className="text-xs font-mono flex items-center gap-1.5"
          style={{ color: "#FAF8F4" }}
        >
          {name}
          {role === "owner" && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-900">
              Owner
            </span>
          )}
          {role === "manager" && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-700 text-stone-50">
              Manager
            </span>
          )}
        </div>
        <div
          className="text-[10px] font-mono opacity-70"
          style={{ color: "#FAF8F4" }}
        >
          TidyTrack v{APP_VERSION}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="flex items-center justify-between px-5 py-3 border-b"
      style={{ backgroundColor: "#3E5C76", borderColor: "#2E4657" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Back button — pure history step, not "home". Shown only when
           the parent provides onBack. Keeps the logo's "go home" role
           distinct so users know exactly what each does. */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-50 active:scale-95 transition-transform flex items-center gap-1 pr-2.5"
            title="Back"
          >
            <ArrowLeft size={16} />
            <span className="text-xs font-mono">Back</span>
          </button>
        )}
        {/* Logo button — always clickable so the user has a reliable
           "go home" tap target on every screen. When the parent supplies
           onLogoClick we use that (typically navigates to the screen's
           local home, e.g. PropertyHub for cleaners). Otherwise we
           fall back to reloading the root URL, which sends them to
           sign-in / landing. A subtle title attribute confirms the
           action so users know what tapping the logo does. */}
        <button
          onClick={() => {
            if (onLogoClick) onLogoClick();
            else window.location.hash = "";
          }}
          className="active:scale-95 transition-transform flex items-center gap-1"
          title="Home"
        >
          {logoBlock}
        </button>
        {/* The owner "Preview as cleaner" button used to sit here, but it now
           lives in the bottom nav, so it's removed from the header. */}
      </div>
      {!isCleaner && (
        <div className="flex items-center gap-2" data-no-translate>
          <NotificationBell
            employee={employee}
            isOwner={role === "owner" || role === "manager"}
            onNavigate={onNotificationNavigate}
          />
          {/* Everything that used to sit as separate icons (language, messages,
           who's-here) now lives inside this one ⋯ menu, together with any
           tools the parent passes and Sign out. That keeps the header to just
           the logo (home) + this menu. The unread dot on the button still
           flags new messages without opening the menu. */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="relative p-2 rounded-full text-stone-50 active:scale-95 transition"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
              title="Menu"
            >
              <MoreVertical size={18} />
              {unread > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-stone-900 text-[10px] font-mono font-bold flex items-center justify-center border-2"
                  style={{ borderColor: "#3E5C76" }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 z-50 rounded-2xl bg-white border border-stone-200 shadow-xl overflow-hidden py-1">
                  {/* Language toggle — kept easy to reach since Spanish-first
                   cleaners rely on it. */}
                  {translateConfigured && (
                    <button
                      onClick={async () => {
                        const next = locale === "es" ? "en" : "es";
                        setLocale(next);
                        if (employee?.id) {
                          try {
                            await supabase
                              .from("employees")
                              .update({ locale: next })
                              .eq("id", employee.id);
                          } catch (e) {
                            console.warn("[locale] save failed", e);
                          }
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-100"
                    >
                      <span className="flex-shrink-0 text-stone-500">
                        <Languages size={18} />
                      </span>
                      <span className="flex-1 text-sm text-stone-800">
                        {locale === "es"
                          ? "Cambiar a English"
                          : "Switch to Español"}
                      </span>
                      <span className="text-[10px] font-mono uppercase font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                        {locale === "es" ? "ES" : "EN"}
                      </span>
                    </button>
                  )}
                  {showMessagesIcon && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenMessages();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-100"
                    >
                      <span className="flex-shrink-0 text-stone-500">
                        <MessageCircle size={18} />
                      </span>
                      <span className="flex-1 text-sm text-stone-800">
                        Messages
                      </span>
                      {unread > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </button>
                  )}
                  {onOpenWhosHere && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenWhosHere();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-100"
                    >
                      <span className="flex-shrink-0 text-stone-500">
                        <Users size={18} />
                      </span>
                      <span className="flex-1 text-sm text-stone-800">
                        Who's here right now
                      </span>
                    </button>
                  )}
                  {(menuItems || []).map((mi, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setMenuOpen(false);
                        mi.onClick?.();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors border-b border-stone-100"
                    >
                      {mi.icon && (
                        <span
                          className={`flex-shrink-0 ${mi.danger ? "text-red-600" : "text-stone-500"}`}
                        >
                          {mi.icon}
                        </span>
                      )}
                      <span
                        className={`text-sm ${mi.danger ? "text-red-600" : "text-stone-800"}`}
                      >
                        {mi.label}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 transition-colors"
                  >
                    <span className="flex-shrink-0 text-red-600">
                      <LogOut size={18} />
                    </span>
                    <div className="flex-1">
                      <div className="text-sm text-red-600 font-medium">
                        Sign out
                      </div>
                      <div className="text-[11px] text-stone-400">
                        Clocks you out and ends your session
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {isCleaner && employee && (
        <div className="flex items-center" data-no-translate>
          <NotificationBell
            employee={employee}
            isOwner={false}
            onNavigate={onNotificationNavigate}
          />
        </div>
      )}
    </div>
  );
}
