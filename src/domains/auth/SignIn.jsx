import React, { useState, useEffect } from "react";
import { Delete } from "lucide-react";
import { secureEmployeeSignIn } from "../../lib/supabase.js";

export function SignIn({ onSignIn }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const press = (n) => {
    setError("");
    if (pin.length < 4) setPin(pin + n);
  };
  const back = () => {
    setError("");
    setPin(pin.slice(0, -1));
  };
  useEffect(() => {
    if (pin.length === 4) tryLogin();
    // eslint-disable-next-line
  }, [pin]);
  const tryLogin = async () => {
    setBusy(true);
    const data = await secureEmployeeSignIn(pin);
    setBusy(false);
    if (!data) {
      setError("Invalid PIN");
      setTimeout(() => {
        setPin("");
        setError("");
      }, 1200);
      return;
    }
    onSignIn(data);
  };

  // Summit Clean palette — applied inline here for the sample.
  // Gold: #C99B5C  ·  Black: #0A0A0A  ·  Cream: #FAF8F4  ·  Warm grey: #6B6258  ·  Border: #E8E3DA
  const GOLD = "#C99B5C";
  const BLACK = "#0A0A0A";
  const CREAM = "#FAF8F4";
  const BORDER = "#E8E3DA";
  const MUTED = "#6B6258";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: CREAM }}
    >
      {/* Dark brand header band — tightened so the keypad fits on small phones */}
      <div
        className="flex flex-col items-center py-5 sm:py-8"
        style={{ backgroundColor: BLACK }}
      >
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="w-28 sm:w-40 h-auto mx-auto"
        />
      </div>

      {/* PIN entry section */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full py-4 sm:py-8">
        <div className="text-center mb-4 sm:mb-6">
          <p
            className="text-xs uppercase tracking-[0.25em] font-mono"
            style={{ color: MUTED, letterSpacing: "0.25em" }}
          >
            Welcome back
          </p>
          <h2
            className="font-serif text-xl sm:text-2xl mt-2"
            style={{ color: BLACK }}
          >
            Enter your 4-digit PIN
          </h2>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3 mb-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border-2 transition-all"
              style={{
                backgroundColor:
                  pin.length > i ? (error ? "#B23A3A" : GOLD) : "transparent",
                borderColor:
                  pin.length > i ? (error ? "#B23A3A" : GOLD) : BORDER,
              }}
            />
          ))}
        </div>
        <div
          className="h-5 mb-3 sm:mb-5 text-xs font-mono"
          style={{ color: "#B23A3A" }}
        >
          {error}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-xs">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => press(n)}
              disabled={busy}
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: BORDER,
                color: BLACK,
                touchAction: "manipulation",
              }}
              className="aspect-square rounded-2xl border text-2xl font-light active:scale-95 transition-all"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => press(0)}
            disabled={busy}
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: BORDER,
              color: BLACK,
              touchAction: "manipulation",
            }}
            className="aspect-square rounded-2xl border text-2xl font-light active:scale-95 transition-all"
          >
            0
          </button>
          <button
            onClick={back}
            disabled={busy}
            style={{ color: MUTED, touchAction: "manipulation" }}
            className="aspect-square rounded-2xl flex items-center justify-center active:scale-95 transition-all"
          >
            <Delete size={20} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-3 sm:pb-6 space-y-1 sm:space-y-2">
        <button
          onClick={() => {
            try {
              localStorage.removeItem("tt_role_choice");
            } catch {}
            window.location.hash = "";
            window.location.reload();
          }}
          className="text-xs font-mono hover:underline"
          style={{ color: MUTED }}
        >
          Not staff? Sign in as a property manager →
        </button>
        <div className="text-xs font-mono" style={{ color: MUTED }}>
          Summit Clean · Cleaning operations
        </div>
      </div>
    </div>
  );
}
