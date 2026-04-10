"use client";

import { useState } from "react";
import { CarDetails, RegistrationResult } from "@/lib/types";
import { properties } from "@/lib/properties";
import { defaultCarDetails } from "@/lib/defaults";

export default function Home() {
  const [carDetails, setCarDetails] = useState<CarDetails>(defaultCarDetails);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);

  function updateField(field: keyof CarDetails, value: string) {
    setCarDetails((prev) => ({ ...prev, [field]: value }));
  }

  async function handleRegister(propertyId: string) {
    setLoading(propertyId);
    setResult(null);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, carDetails }),
      });

      const data: RegistrationResult = await res.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        message: "Network error. Could not reach the server.",
        property: "",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-950 px-4 py-8 font-sans sm:px-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Visitor Parking
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            One-tap visitor registration
          </p>
        </div>

        {/* Car Details Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Vehicle Info
            </h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="rounded-lg px-3 py-1 text-xs font-medium text-indigo-400 transition hover:bg-zinc-800"
            >
              {isEditing ? "Done" : "Edit"}
            </button>
          </div>

          {isEditing ? (
            <div className="mt-4 grid gap-3">
              {(
                [
                  ["make", "Make"],
                  ["model", "Model"],
                  ["year", "Year"],
                  ["licensePlate", "Plate"],
                  ["email", "Email"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="w-12 shrink-0 text-right text-xs text-zinc-500">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={carDetails[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Detail label="Plate" value={carDetails.licensePlate} />
              <Detail label="Make" value={carDetails.make} />
              <Detail label="Model" value={carDetails.model} />
              <Detail label="Year" value={carDetails.year} />
              <div className="col-span-2">
                <Detail label="Email" value={carDetails.email} />
              </div>
            </div>
          )}
        </div>

        {/* Property Buttons */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Properties
          </h2>
          <div className="grid gap-3">
            {properties.map((property) => {
              const isLoading = loading === property.id;
              const disabled = !property.urlKey || loading !== null;

              return (
                <button
                  key={property.id}
                  onClick={() => handleRegister(property.id)}
                  disabled={disabled}
                  className={`group relative flex flex-col items-start rounded-2xl border px-5 py-4 text-left transition-all ${
                    disabled && !isLoading
                      ? "cursor-not-allowed border-zinc-800 bg-zinc-900/50 opacity-50"
                      : isLoading
                        ? "border-indigo-600 bg-indigo-950/40"
                        : "border-zinc-800 bg-zinc-900 hover:border-indigo-600 hover:bg-indigo-950/20 active:scale-[0.98]"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-lg font-semibold text-white">
                      {property.name}
                    </span>
                    {isLoading ? (
                      <Spinner />
                    ) : property.urlKey ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        Ready
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-xs font-medium text-zinc-500">
                        No key
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    {property.address && (
                      <span className="text-xs text-zinc-500">
                        {property.address}
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 text-xs font-medium text-zinc-400">
                    Apt {property.aptNumber}
                  </span>
                  {isLoading && (
                    <span className="mt-2 text-xs text-indigo-300">
                      Registering vehicle...
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result Toast */}
        {result && (
          <div
            className={`rounded-2xl border p-4 ${
              result.success
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : "border-red-800 bg-red-950/40 text-red-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {result.success ? "Success" : "Failed"}
                </p>
                <p className="mt-1 text-xs opacity-80">{result.message}</p>
                {result.confirmationCode && (
                  <p className="mt-2 text-sm font-mono font-bold">
                    Code: {result.confirmationCode}
                  </p>
                )}
              </div>
              <button
                onClick={() => setResult(null)}
                className="ml-4 shrink-0 text-xs opacity-60 transition hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
            <p className="mt-2 text-xs opacity-50">
              {new Date(result.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-zinc-500">{label}</span>
      <p className="font-medium text-white">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-indigo-400"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
