"use client";

import React from "react";
import RPNInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  helperText?: string;
  id?: string;
  defaultCountry?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  label,
  value,
  onChange,
  required,
  error,
  helperText,
  id,
  defaultCountry = "LK",
  disabled,
  placeholder,
  className = "",
}: PhoneInputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <RPNInput
        id={inputId}
        international
        defaultCountry={defaultCountry as any}
        value={value || undefined}
        onChange={(v) => onChange((v as string) || "")}
        disabled={disabled}
        placeholder={placeholder}
        className={[
          "phone-input-wrapper rounded-xl border bg-white px-3 py-2",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500",
          error ? "border-red-400 focus-within:ring-red-400 focus-within:border-red-400" : "border-neutral-300",
          disabled ? "opacity-50 cursor-not-allowed bg-neutral-50" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && <p className="text-xs text-neutral-500">{helperText}</p>}
    </div>
  );
}

export function isValidE164Phone(value: string | undefined | null): boolean {
  if (!value) return false;
  return isValidPhoneNumber(value);
}

export default PhoneInput;
