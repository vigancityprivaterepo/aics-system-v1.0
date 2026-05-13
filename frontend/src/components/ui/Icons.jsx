import React from 'react'

function IconBase({ children, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

export function HomeIcon(props) { return <IconBase {...props}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" /></IconBase> }
export function ChartIcon(props) { return <IconBase {...props}><path d="M4.5 19.5h15"/><path d="M7.5 16V9.5"/><path d="M12 16V6.5"/><path d="M16.5 16v-4.5"/></IconBase> }
export function UsersIcon(props) { return <IconBase {...props}><path d="M16.5 19.5v-1.2a3.3 3.3 0 0 0-3.3-3.3h-2.4a3.3 3.3 0 0 0-3.3 3.3v1.2"/><circle cx="12" cy="9" r="3"/><path d="M18.5 8.5a2.5 2.5 0 0 1 0 5"/><path d="M5.5 13.5a2.5 2.5 0 0 1 0-5"/></IconBase> }
export function FolderIcon(props) { return <IconBase {...props}><path d="M3.5 8.5V18a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21.5 18V8.5a1.5 1.5 0 0 0-1.5-1.5H13L11 4.5H5A1.5 1.5 0 0 0 3.5 6z"/></IconBase> }
export function PillIcon(props) { return <IconBase {...props}><path d="M9.2 3.2a4.95 4.95 0 0 1 7 7L5.5 20.9a4.95 4.95 0 0 1-7-7Z"/><path d="m12 6.5 5.5 5.5"/></IconBase> }
export function CrossIcon(props) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></IconBase> }
export function DocumentIcon(props) { return <IconBase {...props}><rect x="5" y="4" width="14" height="16" rx="1.5"/><path d="M8.5 9h7"/><path d="M8.5 13h7"/><path d="M8.5 17H13"/></IconBase> }
export function FileTextIcon(props) { return <IconBase {...props}><path d="M8 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z"/><path d="M14 3.5V8h4"/><path d="M9 11h6"/><path d="M9 15h6"/></IconBase> }
export function ClipboardIcon(props) { return <IconBase {...props}><path d="M9 4.5h6"/><path d="M9.5 3h5A1.5 1.5 0 0 1 16 4.5V6H8V4.5A1.5 1.5 0 0 1 9.5 3Z"/><path d="M8 5.5H6.5A1.5 1.5 0 0 0 5 7v12a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V7a1.5 1.5 0 0 0-1.5-1.5H16"/></IconBase> }
export function CogIcon(props) { return <IconBase {...props}><path d="m12 4 1 .6 1.2-.2.8 1 .9.6-.1 1.2.6 1 .9.7-.4 1.1.4 1.1-.9.7-.6 1 .1 1.2-.9.6-.8 1-1.2-.2-1 .6-1-.6-1.2.2-.8-1-.9-.6.1-1.2-.6-1-.9-.7.4-1.1-.4-1.1.9-.7.6-1-.1-1.2.9-.6.8-1 1.2.2Z"/><circle cx="12" cy="12" r="2.7"/></IconBase> }
export function LogoutIcon(props) { return <IconBase {...props}><path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10"/><path d="M14 16.5 19 12l-5-4.5"/><path d="M19 12H9"/></IconBase> }
export function MenuIcon(props) { return <IconBase {...props}><path d="M4 7.5h16"/><path d="M4 12h16"/><path d="M4 16.5h16"/></IconBase> }
export function SearchIcon(props) { return <IconBase {...props}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></IconBase> }
export function PlusIcon(props) { return <IconBase {...props}><path d="M12 5v14"/><path d="M5 12h14"/></IconBase> }
export function CheckIcon(props) { return <IconBase {...props}><path d="m5 12 5 5 9-9"/></IconBase> }
export function CheckCircleIcon(props) { return <IconBase {...props}><circle cx="12" cy="12" r="8.5"/><path d="m8.8 12.2 2.1 2.1 4.4-4.6"/></IconBase> }
export function XIcon(props) { return <IconBase {...props}><path d="m6 6 12 12"/><path d="M18 6 6 18"/></IconBase> }
export function XCircleIcon(props) { return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/></IconBase> }
export function ChevronLeftIcon(props) { return <IconBase {...props}><path d="m14.5 6-6 6 6 6"/></IconBase> }
export function ChevronRightIcon(props) { return <IconBase {...props}><path d="m9.5 6 6 6-6 6"/></IconBase> }
export function ChevronDownIcon(props) { return <IconBase {...props}><path d="m6 9 6 6 6-6"/></IconBase> }
export function ChevronUpIcon(props) { return <IconBase {...props}><path d="m6 15 6-6 6 6"/></IconBase> }
export function AlertTriangleIcon(props) { return <IconBase {...props}><path d="M12 4.5 20 19H4l8-14.5Z"/><path d="M12 9.5v4"/><path d="M12 16h.01"/></IconBase> }
export function InfoIcon(props) { return <IconBase {...props}><circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v4"/><path d="M12 7.7h.01"/></IconBase> }
export function ClockIcon(props) { return <IconBase {...props}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/></IconBase> }
export function ArrowRightIcon(props) { return <IconBase {...props}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></IconBase> }
export function UploadIcon(props) { return <IconBase {...props}><path d="M12 15V5"/><path d="m8.5 8.5 3.5-3.5 3.5 3.5"/><path d="M5 18.5h14"/></IconBase> }
export function PrintIcon(props) { return <IconBase {...props}><path d="M6.5 6.5V3h11v3.5"/><rect x="3" y="6.5" width="18" height="11" rx="1.5"/><path d="M6.5 11.5H9"/><path d="M6.5 21H17.5v-7h-11z"/></IconBase> }
export function DownloadIcon(props) { return <IconBase {...props}><path d="M12 3v12"/><path d="m8.5 11.5 3.5 3.5 3.5-3.5"/><path d="M5 19.5h14"/></IconBase> }
export function EditIcon(props) { return <IconBase {...props}><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="m15 3 4 4L9 17H5v-4Z"/></IconBase> }
export function TrashIcon(props) { return <IconBase {...props}><path d="M4.5 7h15"/><path d="M10 10v7"/><path d="M14 10v7"/><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2"/><rect x="6" y="7" width="12" height="13" rx="1.5"/></IconBase> }
export function EyeIcon(props) { return <IconBase {...props}><path d="M2.5 12s3-7 9.5-7 9.5 7 9.5 7-3 7-9.5 7S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></IconBase> }
export function BellIcon(props) { return <IconBase {...props}><path d="M7.5 17.5h9l-1.2-1.6V11a3.3 3.3 0 0 0-2.8-3.3V6.8a.5.5 0 0 0-1 0v.9A3.3 3.3 0 0 0 8.7 11v4.9Z"/><path d="M10.5 19a1.7 1.7 0 0 0 3 0"/></IconBase> }
export function RefreshIcon(props) { return <IconBase {...props}><path d="M4 12a8 8 0 0 1 14.9-3.7"/><path d="M20 12a8 8 0 0 1-14.9 3.7"/><path d="M4 8V3h5"/><path d="M20 16v5h-5"/></IconBase> }
export function ShieldCheckIcon(props) { return <IconBase {...props}><path d="M12 3.5c2 1.6 4.4 2.3 6.5 2.6v5.4c0 4.3-2.6 7.5-6.5 9-3.9-1.5-6.5-4.7-6.5-9V6.1c2.1-.3 4.5-1 6.5-2.6Z"/><path d="m9.5 12.5 1.8 1.8 3.7-3.8"/></IconBase> }
export function QrCodeIcon(props) { return <IconBase {...props}><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M15 14h1.5v1.5H18V14h2v3.5h-2V19H20v1h-3.5v-2H15v2h-1v-6Z"/><path d="M6.5 6.5h1"/><path d="M16.5 6.5h1"/><path d="M6.5 16.5h1"/></IconBase> }
export function CalendarIcon(props) { return <IconBase {...props}><rect x="4" y="5.5" width="16" height="14" rx="1.5"/><path d="M8 3.5v4"/><path d="M16 3.5v4"/><path d="M4 9.5h16"/></IconBase> }
export function PhoneIcon(props) { return <IconBase {...props}><path d="M6.5 4A1.5 1.5 0 0 0 5 5.5v.7a14 14 0 0 0 12.8 13.8h.7A1.5 1.5 0 0 0 20 18.5v-2.7a1 1 0 0 0-.7-.95l-3.3-1.1a1 1 0 0 0-1.07.3l-1 1.3A10.5 10.5 0 0 1 8.65 9.07l1.3-1a1 1 0 0 0 .3-1.07L9.15 3.7A1 1 0 0 0 8.2 3H6.5Z"/></IconBase> }
export function MapPinIcon(props) { return <IconBase {...props}><path d="M12 3.5A6 6 0 0 1 18 9.5c0 4-6 11-6 11S6 13.5 6 9.5a6 6 0 0 1 6-6Z"/><circle cx="12" cy="9.5" r="2.5"/></IconBase> }
export function IdCardIcon(props) { return <IconBase {...props}><rect x="3" y="5.5" width="18" height="13" rx="1.5"/><circle cx="8.5" cy="11" r="2"/><path d="M13 9.5h5"/><path d="M13 13h3"/><path d="M6.5 16.5h4"/></IconBase> }
export function DatabaseIcon(props) { return <IconBase {...props}><ellipse cx="12" cy="6.5" rx="7.5" ry="2.5"/><path d="M4.5 6.5v4c0 1.38 3.358 2.5 7.5 2.5s7.5-1.12 7.5-2.5v-4"/><path d="M4.5 10.5v4c0 1.38 3.358 2.5 7.5 2.5s7.5-1.12 7.5-2.5v-4"/></IconBase> }
export function HospitalIcon(props) { return <IconBase {...props}><path d="M3.5 21V9.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5V21"/><path d="M2 21h20"/><path d="M9 21v-5.5a3 3 0 0 1 6 0V21"/><path d="M10 4h4"/><path d="M12 3v4"/><rect x="6" y="13" width="3" height="3" rx=".5"/><rect x="15" y="13" width="3" height="3" rx=".5"/></IconBase> }
export function GlassesIcon(props) { return <IconBase {...props}><circle cx="7.5" cy="13" r="3.5"/><circle cx="16.5" cy="13" r="3.5"/><path d="M11 13h2"/><path d="M4 13 2.5 9"/><path d="M20 13l1.5-4"/></IconBase> }
export function HeadstonIcon(props) { return <IconBase {...props}><path d="M8 21V11a4 4 0 0 1 8 0v10"/><path d="M4 21h16"/><path d="M10 14h4"/><path d="M12 11v3"/></IconBase> }
export function SparklesIcon(props) { return <IconBase {...props}><path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/><path d="M18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/></IconBase> }
