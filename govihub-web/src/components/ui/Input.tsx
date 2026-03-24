"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-neutral-700"
        >
          {label}
          {props.required && (
            <span className="text-red-500 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          {...props}
          id={inputId}
          className={[
            "w-full rounded-xl border bg-white text-neutral-900 placeholder-neutral-400",
            "px-4 py-2.5 text-sm",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-50",
            error
              ? "border-red-400 focus:ring-red-400 focus:border-red-400"
              : "border-neutral-300",
            leftIcon ? "pl-10" : "",
            rightIcon ? "pr-10" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        />
        {rightIcon && (
          <span className="absolute inset-y-0 right-3 flex items-center text-neutral-400">
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="text-xs text-neutral-500">{helperText}</p>
      )}
    </div>
  );
}

export default Input;
