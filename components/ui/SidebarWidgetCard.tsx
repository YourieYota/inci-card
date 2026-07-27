import React from 'react';
import Link from 'next/link';

export interface WidgetLinkItem {
  label: string;
  href: string;
  badgeCount?: number;
}

interface SidebarWidgetCardProps {
  title: string;
  items: WidgetLinkItem[];
  className?: string;
}

export default function SidebarWidgetCard({ title, items, className = '' }: SidebarWidgetCardProps) {
  return (
    <div className={`bg-white rounded-2xl border-2 border-emerald-600 shadow-sm p-5 max-w-sm ${className}`}>
      {/* Title with Green Accent Underline */}
      <div className="mb-4 pb-2 border-b border-gray-200 relative">
        <h3 className="text-2xl font-bold text-amber-600 tracking-tight">
          {title}
        </h3>
        {/* Accent green underline */}
        <div className="absolute -bottom-[2px] left-0 w-16 h-1 bg-emerald-600 rounded-full" />
      </div>

      {/* Links List */}
      <ul className="divide-y divide-gray-100">
        {items.map((item, idx) => (
          <li key={idx} className="py-2.5 first:pt-1 last:pb-1">
            <Link
              href={item.href}
              className="flex items-center text-gray-700 hover:text-emerald-700 font-medium transition-colors group"
            >
              {/* Green Diamond Bullet */}
              <span className="text-emerald-600 mr-3 text-xs transform group-hover:scale-125 transition-transform">
                ◆
              </span>
              <span className="flex-1 capitalize">{item.label}</span>
              {item.badgeCount !== undefined && (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                  {item.badgeCount}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
