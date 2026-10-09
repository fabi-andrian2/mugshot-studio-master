const VARIANTS = {
  ghost: 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300',
  active: 'bg-emerald-900/40 border-emerald-700 text-emerald-300',
  primary: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white font-semibold',
};

const BASE = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition disabled:opacity-30 disabled:cursor-not-allowed';

export const ToolbarGroup = ({ children }) => <div className="flex items-center gap-1.5">{children}</div>;

export const Divider = () => <div className="w-px h-6 bg-gray-800 mx-1.5" />;

export const ToolButton = ({
  icon: Icon,
  label,
  title,
  onClick,
  disabled,
  variant = 'ghost',
  alwaysLabel = false,
  pressed,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title ?? label}
    aria-pressed={pressed}
    className={`${BASE} ${VARIANTS[variant]}`}
  >
    {Icon && <Icon size={13} />}
    {label && <span className={alwaysLabel ? '' : 'hidden 2xl:inline'}>{label}</span>}
    {children}
  </button>
);

export const FileButton = ({ icon: Icon, label, title, onFiles }) => (
  <label
    title={title ?? label}
    className={`${BASE} ${VARIANTS.ghost} cursor-pointer`}
  >
    {Icon && <Icon size={13} />}
    <span className="hidden 2xl:inline">{label}</span>
    <input
      type="file"
      multiple
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const files = Array.from(e.target.files);
        e.target.value = '';
        onFiles(files);
      }}
    />
  </label>
);

export const Segmented = ({ options, value, onChange, title }) => (
  <div title={title} className="flex items-center bg-gray-800/60 border border-gray-700 rounded-md overflow-hidden text-[11px]">
    {options.map((option, index) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={`px-2.5 py-2 transition ${index > 0 ? 'border-l border-gray-700' : ''} ${
          value === option.value ? 'bg-emerald-900/50 text-emerald-300' : 'hover:bg-gray-700 text-gray-300'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);