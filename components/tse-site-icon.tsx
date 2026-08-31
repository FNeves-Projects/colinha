export function TseSiteIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className="tse-site-icon"
    >
      <rect width="32" height="32" rx="7" fill="#FFCC00" />
      <circle cx="16" cy="12.5" r="7.2" fill="#005FA3" />
      <path d="M0 21.5 32 13.5V32H0V21.5Z" fill="#004884" />
      <text
        x="8.5"
        y="27.5"
        fill="#fff"
        fontSize="7.5"
        fontWeight="800"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="0.04em"
      >
        TSE
      </text>
    </svg>
  );
}
