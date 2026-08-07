import React from "react";
import { AlertCircle } from "lucide-react";

export function ConfigError() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md bg-white border-2 border-amber-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="text-amber-600" size={24} />
          <h2 className="font-serif text-2xl text-stone-900">Setup needed</h2>
        </div>
        <p className="text-stone-700 text-sm">
          Paste your Supabase URL and anon key into the top of the file.
        </p>
      </div>
    </div>
  );
}
