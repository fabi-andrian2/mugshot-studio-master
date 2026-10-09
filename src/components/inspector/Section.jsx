import { ChevronDown, ChevronRight } from 'lucide-react';

const Section = ({ title, open, onToggle, summary, children }) => (
  <section className="border-b border-gray-800">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#161616] transition"
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </span>
      {!open && summary && <span className="text-[11px] font-mono text-gray-500 truncate ml-2">{summary}</span>}
    </button>
    {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
  </section>
);

export default Section;