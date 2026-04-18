"use client";

interface UsageBarProps {
  totalTokens: number;
  requests: number;
}

const FREE_TIER_TOKENS = 500_000;

export default function UsageBar({ totalTokens, requests }: UsageBarProps) {
  const pct = Math.min((totalTokens / FREE_TIER_TOKENS) * 100, 100);
  const color =
    pct < 60 ? "bg-emerald-500" : pct < 85 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="bg-white rounded-xl p-3 shadow-sm border border-[#bdcabb]/30">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-['Work_Sans']">
            Uso de API
          </span>
          <span className="text-[10px] text-slate-400 font-['Work_Sans']">
            {requests} req hoy
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-slate-400 font-['Inter']">
            {totalTokens.toLocaleString()} tokens
          </span>
          <span className="text-[10px] text-slate-400 font-['Inter']">
            {FREE_TIER_TOKENS.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
