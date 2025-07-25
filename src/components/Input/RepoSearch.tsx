"use client";
import React from "react";


export default function RepoSearch({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Search repositories..."
      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-black text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}
